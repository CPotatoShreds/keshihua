// System-side aggregation of the external corpus feed.
// Views stay analytic (the topic pulse curve); opinion/emotion counts come from
// ingested texts, weighted by the shared layered formula.
import {STEP} from '../shared/catalog.js';
import {rateAt} from '../shared/lifecycle.js';
import {textWeight} from '../shared/weight.js';

const STEP5M=5*60000,HOUR=3600000;
const KEEP_5S=Math.ceil(10*60000/STEP);
const KEEP_5M=Math.ceil(2*HOUR/STEP5M);
const zero=()=>({weighted:[0,0,0,0,0],raw:[0,0,0,0,0],emotions:{}});
const round1=v=>Math.round(v*10)/10;
const round2=v=>Math.round(v*100)/100;
const roundObj=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,round1(v)]));

function merge(target,source){
 const weighted=source.weighted||[],raw=source.raw||[];
 for(let i=0;i<5;i++){target.weighted[i]+=Number(weighted[i]||0);target.raw[i]+=Number(raw[i]||0);}
 for(const [id,v] of Object.entries(source.emotions||{}))target.emotions[id]=(target.emotions[id]||0)+Number(v||0);
}
function sumBuckets(map,step,from,to){
 const out=zero();
 if(!map)return out;
 for(const [key,bucket] of map){const time=key*step;if(time>=from&&time<to)merge(out,bucket);}
 return out;
}
const hasData=bucket=>bucket.raw.some(v=>v>0)||Object.values(bucket.emotions).some(v=>v>0);

export class Aggregator{
 constructor({topics=[]}={}){
  this.setTopics(topics);
  this.reset();
 }
 setTopics(topics){
  this.topics=topics;
  this.byId=new Map(topics.map(topic=>[topic.id,topic]));
  this.bySlot=new Map(topics.map(topic=>[Number(topic.slot??String(topic.id).split('-').at(-1)),topic]));
 }
 reset(){
  this.buckets5s=new Map();
  this.buckets5m=new Map();
  this.buckets1h=new Map();
  this.recordCount=0;
  this.lastRecordAt=0;
  this.byLayer={post:0,comment:0,reply:0};
  this.dirty=new Set();
 }
 add(map,id,key,record,weight){
  let byKey=map.get(id);
  if(!byKey){byKey=new Map();map.set(id,byKey);}
  let bucket=byKey.get(key);
  if(!bucket){bucket=zero();byKey.set(key,bucket);}
  const cluster=Math.max(0,Math.min(4,record.cluster|0));
  bucket.weighted[cluster]+=weight;
  bucket.raw[cluster]+=1;
  bucket.emotions[record.emotion]=(bucket.emotions[record.emotion]||0)+weight;
 }
 prune(id,seq){
  const m5s=this.buckets5s.get(id);
  if(m5s&&m5s.size>KEEP_5S*2)for(const key of m5s.keys())if(key<seq-KEEP_5S)m5s.delete(key);
  const m5=this.buckets5m.get(id);
  if(m5&&m5.size>KEEP_5M*2){const current=Math.floor(seq*STEP/STEP5M);for(const key of m5.keys())if(key<current-KEEP_5M)m5.delete(key);}
 }
 ingest(record){
  if(!record||!Number.isFinite(record.time))return false;
  const topic=this.bySlot.get(record.topicSlot);
  if(!topic)return false;
  const weight=textWeight(record.layer,record.metrics||{});
  const seq=Math.floor(record.time/STEP),bucket5m=Math.floor(record.time/STEP5M),hour=Math.floor(record.time/HOUR);
  this.add(this.buckets5s,topic.id,seq,record,weight);
  this.add(this.buckets5m,topic.id,bucket5m,record,weight);
  this.add(this.buckets1h,topic.id,hour,record,weight);
  this.recordCount++;
  this.lastRecordAt=Math.max(this.lastRecordAt,record.time);
  this.byLayer[record.layer]=(this.byLayer[record.layer]||0)+1;
  this.dirty.add(topic.id+':'+hour);
  this.prune(topic.id,seq);
  return true;
 }
 countsAt(topicId,time){
  const m5=sumBuckets(this.buckets5s.get(topicId),STEP,time-5*60000,time+STEP);
  let h1=sumBuckets(this.buckets5m.get(topicId),STEP5M,time-HOUR,time+STEP5M);
  if(!hasData(h1))h1=sumBuckets(this.buckets1h.get(topicId),HOUR,time-HOUR,time+1);
  return {m5:m5.weighted.map(round1),h1:h1.weighted.map(round1),rawM5:m5.raw,rawH1:h1.raw,emotions:roundObj(h1.emotions)};
 }
 frameAt(seq,known=this.topics){
  const time=seq*STEP,values={};
  for(const topic of known){
   if(topic.bornAt>time||topic.endsAt+HOUR<time)continue;
   const counts=this.countsAt(topic.id,time);
   values[topic.id]={views:round2(rateAt(topic,time)),counts:{m5:counts.m5,h1:counts.h1},raw:{m5:counts.rawM5,h1:counts.rawH1},emotions:counts.emotions};
  }
  return {seq,time,values};
 }
 history(topicId){
  const topic=this.byId.get(topicId);
  if(!topic)return [];
  const map=this.buckets1h.get(topicId)||new Map();
  const first=Math.floor(topic.bornAt/HOUR),last=Math.floor(topic.endsAt/HOUR),rows=[];
  for(let hour=first;hour<=last;hour++){
   const bucket=map.get(hour)||zero(),time=Math.max(topic.bornAt,hour*HOUR);
   rows.push({hour,time,views:round2(rateAt(topic,time)),weighted:bucket.weighted.map(round1),raw:bucket.raw.slice(),emotions:roundObj(bucket.emotions)});
  }
  return rows;
 }
 backfillHourly(rows=[]){
  let count=0;
  for(const row of rows){
   const topic=this.bySlot.get(row.topicSlot);
   if(!topic||!Number.isFinite(row.hour))continue;
   let map=this.buckets1h.get(topic.id);
   if(!map){map=new Map();this.buckets1h.set(topic.id,map);}
   const bucket=zero();
   merge(bucket,{weighted:row.weighted,raw:row.raw,emotions:row.emotions});
   map.set(row.hour,bucket);
   this.dirty.add(topic.id+':'+row.hour);
   count++;
  }
  return count;
 }
 backfill5m(rows=[],skipBucket=null){
  let count=0;
  for(const row of rows){
   const topic=this.bySlot.get(row.topicSlot);
   if(!topic||!Number.isFinite(row.bucket))continue;
   if(skipBucket!==null&&row.bucket>=skipBucket)continue;
   let map=this.buckets5m.get(topic.id);
   if(!map){map=new Map();this.buckets5m.set(topic.id,map);}
   const bucket=zero();
   merge(bucket,{weighted:row.weighted,raw:row.raw,emotions:row.emotions});
   map.set(row.bucket,bucket);
   count++;
  }
  return count;
 }
 rowsFor(ids=null){
  const out=[];
  for(const [topicId,map] of this.buckets1h){
   const topic=this.byId.get(topicId);
   if(!topic)continue;
   for(const [hour,bucket] of map){
    const key=topicId+':'+hour;
    if(ids&&!ids.has(key))continue;
    out.push({topicSlot:Number(topic.slot??String(topic.id).split('-').at(-1)),archetype:topic.archetype,hour,weighted:bucket.weighted,raw:bucket.raw,emotions:bucket.emotions});
   }
  }
  return out;
 }
 takeDirty(){const ids=new Set(this.dirty);this.dirty.clear();return this.rowsFor(ids);}
 status(){
  return {records:this.recordCount,lastRecordAt:this.lastRecordAt,byLayer:{...this.byLayer},topics:this.topics.length,hourBuckets:[...this.buckets1h.values()].reduce((n,m)=>n+m.size,0),fiveMinuteBuckets:[...this.buckets5m.values()].reduce((n,m)=>n+m.size,0)};
 }
}
