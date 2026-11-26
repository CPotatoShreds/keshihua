import test from 'node:test';
import assert from 'node:assert/strict';
import {Aggregator} from '../server/aggregator.js';
import {generateTopic} from '../corpus/generate.js';
import {instance} from '../shared/topics.js';
import {textWeight} from '../shared/weight.js';
import {STEP} from '../shared/catalog.js';

const STEP5M=5*60000,HOUR=3600000;

test('aggregator conserves weighted and raw counts in frames, history and buckets',()=>{
 const topic=instance(5205);
 const records=generateTopic(topic,600,{seed:'test'});
 const agg=new Aggregator({topics:[topic]});
 for(const record of records)agg.ingest(record);
 assert.equal(agg.recordCount,records.length);
 assert.deepEqual(agg.byLayer,{
  post:records.filter(r=>r.layer==='post').length,
  comment:records.filter(r=>r.layer==='comment').length,
  reply:records.filter(r=>r.layer==='reply').length
 });
 const last=Math.max(...records.map(r=>r.time));
 const seq=Math.floor(last/STEP),frame=agg.frameAt(seq,[topic]),values=frame.values[topic.id];
 assert.ok(values&&values.counts.h1.some(v=>v>0));
 const fromHour=frame.time-HOUR,toHour=frame.time+STEP5M;
 const expectedWeighted=[0,0,0,0,0],expectedRaw=[0,0,0,0,0];
 for(const record of records){
  if(record.time<fromHour||record.time>=toHour)continue;
  expectedWeighted[record.cluster]+=textWeight(record.layer,record.metrics);
  expectedRaw[record.cluster]++;
 }
 for(let i=0;i<5;i++){
  assert.ok(Math.abs(values.counts.h1[i]-Math.round(expectedWeighted[i]*10)/10)<0.11,`cluster ${i}`);
  assert.equal(values.raw.h1[i],expectedRaw[i]);
 }
 const emotionTotal=Object.values(values.emotions).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(emotionTotal-values.counts.h1.reduce((a,b)=>a+b,0))<0.11);
 const history=agg.history(topic.id);
 assert.ok(history.length>=1);
 const historyWeighted=history.reduce((sum,row)=>sum+row.weighted.reduce((a,b)=>a+b,0),0);
 const totalWeight=records.reduce((sum,record)=>sum+textWeight(record.layer,record.metrics),0);
 assert.ok(Math.abs(historyWeighted-totalWeight)<0.5,`history ${historyWeighted} vs ${totalWeight}`);
});

test('backfill replaces hourly rows and five-minute backfill can skip the live bucket',()=>{
 const topic=instance(5205);
 const agg=new Aggregator({topics:[topic]});
 const hour=Math.floor(topic.bornAt/HOUR)+1;
 const row={topicSlot:topic.slot,archetype:topic.archetype,hour,weighted:[1,2,3,4,5],raw:[5,4,3,2,1],emotions:{e0:15,e7:5}};
 assert.equal(agg.backfillHourly([row]),1);
 const history=agg.history(topic.id);
 const found=history.find(item=>item.hour===hour);
 assert.ok(found);
 assert.deepEqual(found.raw,[5,4,3,2,1]);
 assert.ok(Math.abs(found.weighted.reduce((a,b)=>a+b,0)-15)<0.01);
 const current5m=Math.floor(Date.now()/STEP5M);
 assert.equal(agg.backfill5m([{topicSlot:topic.slot,bucket:current5m-1,weighted:[1,0,0,0,0],raw:[1,0,0,0,0],emotions:{e0:1}},{topicSlot:topic.slot,bucket:current5m,weighted:[9,0,0,0,0],raw:[9,0,0,0,0],emotions:{e0:9}}],current5m),1);
 const counts=agg.countsAt(topic.id,current5m*STEP5M);
 assert.ok(counts.h1[0]>=1);
});

test('dirty rows are emitted once and status reports ingested records',()=>{
 const topic=instance(5205);
 const records=generateTopic(topic,200,{seed:'test'});
 const agg=new Aggregator({topics:[topic]});
 for(const record of records.slice(0,80))agg.ingest(record);
 const dirty=agg.takeDirty();
 assert.ok(dirty.length>0);
 assert.equal(agg.takeDirty().length,0);
 const status=agg.status();
 assert.equal(status.records,80);
 assert.ok(status.lastRecordAt>0);
});
