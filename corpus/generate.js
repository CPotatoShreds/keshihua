// Deterministic corpus generator for the external producer.
// One topic -> posts -> comments -> replies, all timestamped along the topic's
// exposure curve. The generator is pure: same topic slot + seed -> same records.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {aggregate,rateAt,pulsesFor} from '../shared/lifecycle.js';
import {instance,instancesBetween,slotForTime} from '../shared/topics.js';
import {DAY,STEP,SLOT} from '../shared/catalog.js';
import {EMOTION_MIX,NEUTRAL_ID} from '../shared/dutir.js';
import {textWeight} from '../shared/weight.js';
import {SUBJECT,STANCE,EMOTION,CONNECTIVE,AGREE,SKELETONS,TAILS} from './phrases/generic.js';
import {FLAVOR} from './phrases/archetypes.js';
import {LAYER_RATIO,rngFor,pick,weightedPick,sampleCluster,sampleEmotion,sampleIntensity,fillClause,joinTokens,validateRecord} from './schema.js';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT=path.join(HERE,'out');

// China Standard Time diurnal multipliers, 22:00 peak / 04:00 trough.
const DIURNAL=[1.68,.96,.43,.19,.12,.17,.38,.77,.96,1.01,.96,.91,1.20,.94,.86,.86,.91,.94,1.01,1.20,1.56,2.04,2.16,1.78];
const HOUR=3600000;
function cstHour(time){return ((Math.floor(time/HOUR)+8)%24+24)%24;}
function diurnal(time){return DIURNAL[cstHour(time)]||1;}

function gaussian(rng){
 let u=0,v=0;
 while(u===0)u=rng();
 while(v===0)v=rng();
 return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function lognormal(rng,median,sigma){return median*Math.exp(sigma*gaussian(rng));}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function activePulse(topic,time){
 let active=pulsesFor(topic)[0];
 for(const pulse of pulsesFor(topic))if(time>=pulse.at&&time<=pulse.at+pulse.duration)active=pulse;
 return active;
}
function opinionAt(topic,time){return activePulse(topic,time).opinion;}

// CDF over the topic's exposure curve from `from` onward, on a 5-minute grid.
export function timeSampler(topic,from=topic.bornAt){
 const step=5*60000,start=Math.max(topic.bornAt,Math.min(from,topic.endsAt-1));
 const n=Math.max(1,Math.ceil((topic.endsAt-start)/step));
 const weights=new Array(n);let sum=0;
 for(let i=0;i<n;i++){
  const t=Math.min(topic.endsAt-1,start+i*step+step/2);
  const w=Math.max(0,rateAt(topic,t))*diurnal(t);
  weights[i]=w;sum+=w;
 }
 if(!(sum>0)){for(let i=0;i<n;i++)weights[i]=1;sum=n;}
 const cdf=new Array(n);let acc=0;
 for(let i=0;i<n;i++){acc+=weights[i]/sum;cdf[i]=acc;}
 return rng=>{
  const r=rng();let lo=0,hi=n-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<r)lo=mid+1;else hi=mid;}
  return Math.min(topic.endsAt-1,start+lo*step+Math.floor(rng()*step));
 };
}

function subjectPool(topic,cluster){
 const flavor=FLAVOR[topic.archetypeIndex]?.[cluster];
 return flavor?[...SUBJECT[cluster],flavor]:SUBJECT[cluster];
}

export function makeText(rng,layer,topic,cluster,emotion){
 const words=(topic.clusters?.[cluster]?.words||[]).filter(Boolean).slice(0,3);
 const vars={$topic:topic.title,$city:topic.city,$w1:words[0]||topic.title,$w2:words[1]||words[0]||topic.title,$w3:words[2]||words[1]||words[0]||topic.title};
 const skeleton=pick(rng,SKELETONS[layer]);
 const tokens=[];
 for(const part of skeleton){
  if(part==='subject')tokens.push(...fillClause(pick(rng,subjectPool(topic,cluster)),vars));
  else if(part==='stance')tokens.push(...fillClause(pick(rng,STANCE[cluster]),vars));
  else if(part==='emotion')tokens.push(...fillClause(pick(rng,EMOTION[emotion]||EMOTION[NEUTRAL_ID]),vars));
  else if(part==='connective')tokens.push(...fillClause(pick(rng,CONNECTIVE),vars));
  else if(part==='agree')tokens.push(...fillClause(pick(rng,AGREE),vars));
  else tokens.push(part);
 }
 if(layer!=='reply'&&rng()<.18)tokens.push('。',...fillClause(pick(rng,TAILS[layer]),vars));
 const max=layer==='post'?180:layer==='comment'?64:32;
 const trimmed=tokens.slice(0,max);
 if(!/[。！？]$/.test(trimmed.at(-1)||''))trimmed.push('。');
 return {tokens:trimmed,text:joinTokens(trimmed)};
}

function authorFor(rng){
 const n=1000+Math.floor(Math.pow(rng(),1.7)*9000);
 return 'u_'+String(n).padStart(4,'0');
}

function makeRecord({id,slot,archetype,layer,parentId=null,rootId,time,author,cluster,emotion,intensity,topic,text}){
 return {id,topicSlot:slot,archetype,layer,parentId,rootId,time,author,cluster,emotion,intensity,text:text.text,tokens:text.tokens,keywords:(topic.clusters?.[cluster]?.words||[]).filter(Boolean).slice(0,3),metrics:{}};
}

function commentsPerPost(posts,commentCount){
 const weights=posts.map(p=>Math.pow(Math.max(1,p.metrics.views),1.15));
 const total=weights.reduce((a,b)=>a+b,0)||1;
 const alloc=posts.map((_,i)=>Math.max(1,Math.floor(commentCount*weights[i]/total)));
 let used=alloc.reduce((a,b)=>a+b,0);
 let left=commentCount-used;
 const order=weights.map((w,i)=>({i,w:w/total})).sort((a,b)=>b.w-a.w);
 let k=0;
 while(left>0){alloc[order[k%order.length].i]++;left--;k++;}
 while(left<0){const i=alloc.indexOf(Math.max(...alloc));if(alloc[i]<=1)break;alloc[i]--;left++;}
 return alloc;
}

export function generateTopic(topic,recordsTarget,{seed='corpus-v1',validate=false}={}){
 const slot=slotForTime(topic.bornAt),rng=rngFor(seed,slot,'topic');
 const totalViews=Math.max(1000,aggregate(topic,topic.endsAt,(topic.endsAt-topic.bornAt)/60000).views);
 // A hot topic has a handful of original posts, not hundreds. Comments carry the volume.
 const postCount=Math.max(8,Math.min(24,8+Math.round(Math.sqrt(recordsTarget)/40)));
 const replyCount=Math.max(0,Math.round(recordsTarget*LAYER_RATIO.reply));
 const commentCount=Math.max(1,recordsTarget-postCount-replyCount);
 const sampler=timeSampler(topic);
 const posts=[];
 for(let i=0;i<postCount;i++){
  const time=i===0?Math.min(topic.endsAt-1,topic.bornAt+Math.floor(rng()*10*60000)):sampler(rng);
  const cluster=sampleCluster(rng,opinionAt(topic,time));
  const emotion=sampleEmotion(rng,EMOTION_MIX[cluster]);
  const intensity=sampleIntensity(rng,emotion);
  const id=`p-${slot}-${String(i+1).padStart(6,'0')}`;
  const record=makeRecord({id,slot,archetype:topic.archetype,layer:'post',parentId:null,rootId:id,time,author:authorFor(rng),cluster,emotion,intensity,topic,text:makeText(rng,'post',topic,cluster,emotion)});
  record.metrics={views:1,likes:0,reposts:0,comments:0,impressions:0,position:0};
  posts.push(record);
 }
 posts.sort((a,b)=>a.time-b.time);
 // Power-law exposure across posts; the anchor post carries most of it.
 const postWeights=posts.map((_,i)=>Math.pow(.55,i));
 const postWeightSum=postWeights.reduce((a,b)=>a+b,0);
 posts.forEach((post,i)=>{
  post.metrics.views=Math.max(1,Math.round(totalViews*postWeights[i]/postWeightSum));
  const likeRate=clamp(lognormal(rng,.012,.62),.0005,.10);
  post.metrics.likes=Math.min(post.metrics.views,Math.round(post.metrics.views*likeRate));
  post.metrics.reposts=Math.round(post.metrics.likes*clamp(lognormal(rng,.08,.55),.005,.4));
 });
 const alloc=commentsPerPost(posts,commentCount);
 const comments=[],replies=[];
 let commentSeq=0,replySeq=0;
 for(let pi=0;pi<posts.length;pi++){
  const post=posts[pi],count=alloc[pi],postSampler=timeSampler(topic,post.time);
  const list=[];
  for(let k=0;k<count;k++){
   const time=Math.max(post.time,postSampler(rng));
   const cluster=sampleCluster(rng,opinionAt(topic,time));
   const emotion=sampleEmotion(rng,EMOTION_MIX[cluster]);
   const intensity=sampleIntensity(rng,emotion);
   const id=`c-${slot}-${String(++commentSeq).padStart(6,'0')}`;
   const record=makeRecord({id,slot,archetype:topic.archetype,layer:'comment',parentId:post.id,rootId:post.id,time,author:authorFor(rng),cluster,emotion,intensity,topic,text:makeText(rng,'comment',topic,cluster,emotion)});
   record.metrics={views:0,likes:0,impressions:1,position:0,replies:0};
   list.push(record);
  }
  list.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
  // Comment impressions are a latent fraction of post views: only a slice of
  // viewers open the comment area, then position decides who is actually seen.
  const commentViewShare=clamp(lognormal(rng,.12,.5),.02,.4);
  const totalImpressions=post.metrics.views*commentViewShare;
  const rankWeights=list.map((_,i)=>1/Math.pow(i+10,.85));
  const rankSum=rankWeights.reduce((a,b)=>a+b,0)||1;
  list.forEach((comment,i)=>{
   comment.metrics.position=i+1;
   comment.metrics.impressions=Math.max(1,Math.round(totalImpressions*rankWeights[i]/rankSum));
   const likeRate=clamp(lognormal(rng,.004,.95),.00005,.35)*(i<10?1.35:1);
   comment.metrics.likes=Math.min(comment.metrics.impressions,Math.round(comment.metrics.impressions*likeRate));
   comments.push(comment);
  });
  post.metrics.comments=list.length;
 }
 // Replies: pick comments by visibility, inherit the parent's cluster most of the time.
 if(replyCount>0&&comments.length){
  const weights=comments.map(c=>Math.sqrt(Math.max(1,c.metrics.likes+1))*Math.sqrt(Math.max(1,c.metrics.impressions)));
  for(let i=0;i<replyCount;i++){
   const parent=weightedPick(rng,comments,weights);
   const parentSampler=timeSampler(topic,parent.time);
   const time=Math.max(parent.time,parentSampler(rng));
   const cluster=rng()<.72?parent.cluster:sampleCluster(rng,opinionAt(topic,time));
   const emotion=rng()<.5?parent.emotion:sampleEmotion(rng,EMOTION_MIX[cluster]);
   const intensity=sampleIntensity(rng,emotion);
   const id=`r-${slot}-${String(++replySeq).padStart(6,'0')}`;
   const record=makeRecord({id,slot,archetype:topic.archetype,layer:'reply',parentId:parent.id,rootId:parent.rootId,time,author:authorFor(rng),cluster,emotion,intensity,topic,text:makeText(rng,'reply',topic,cluster,emotion)});
   record.metrics={views:0,likes:0,impressions:Math.max(1,Math.round(parent.metrics.impressions*clamp(lognormal(rng,.08,.5),.01,.3))),position:1,replies:0};
   const likeRate=clamp(lognormal(rng,.004,.9),.00005,.35);
   record.metrics.likes=Math.min(record.metrics.impressions,Math.round(record.metrics.impressions*likeRate));
   parent.metrics.replies++;
   replies.push(record);
  }
 }
 const all=[...posts,...comments,...replies].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 for(const record of all)record.weight=textWeight(record.layer,record.metrics);
 if(validate)for(const record of all){const errors=validateRecord(record,topic);if(errors.length)throw new Error(`invalid ${record.id}: ${errors.join(',')}`);}
 return all;
}

function hourKey(time){return Math.floor(time/HOUR);}
function emptyCounts(){return {weighted:[0,0,0,0,0],raw:[0,0,0,0,0],emotions:{}};}
function aggregateBuckets(records,step){
 const buckets=new Map();
 for(const record of records){
  const bucket=Math.floor(record.time/step);
  if(!buckets.has(bucket))buckets.set(bucket,emptyCounts());
  const target=buckets.get(bucket);
  const c=Math.max(0,Math.min(4,record.cluster));
  target.weighted[c]+=record.weight;
  target.raw[c]+=1;
  target.emotions[record.emotion]=(target.emotions[record.emotion]||0)+record.weight;
 }
 return [...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([bucket,v])=>({bucket,...v}));
}
export function aggregateRecords(records){
 return aggregateBuckets(records,HOUR).map(row=>({hour:row.bucket,...row}));
}
export function aggregateBy5m(records){
 return aggregateBuckets(records,5*60000);
}

export function buildWindow({end=Date.now(),days=7,total=7_000_000,scale=1,outDir=DEFAULT_OUT,seed='corpus-v1',log=()=>{},maxTopics=Infinity}={}){
 const start=end-days*DAY,target=Math.max(1,Math.round(total*scale));
 const topics=instancesBetween(start,end).slice(0,maxTopics);
 if(!topics.length)throw new Error('no topics in window');
 const weights=topics.map(q=>Math.max(1,aggregate(q,q.endsAt,(q.endsAt-q.bornAt)/60000).views));
 const weightSum=weights.reduce((a,b)=>a+b,0);
 fs.mkdirSync(path.join(outDir,'topics'),{recursive:true});
 fs.mkdirSync(path.join(outDir,'aggregates'),{recursive:true});
 const manifestTopics=[],hourly=[],fiveMinute=[];
 let recordCount=0,postCount=0,commentCount=0,replyCount=0;
 topics.forEach((topic,i)=>{
  const share=weights[i]/weightSum;
  const recordsTarget=Math.max(50,Math.round(target*share));
  const records=generateTopic(topic,recordsTarget,{seed});
  const slot=slotForTime(topic.bornAt);
  const file=`topics/${slot}.ndjson.gz`;
  const body=records.map(r=>JSON.stringify(r)).join('\n')+'\n';
  fs.writeFileSync(path.join(outDir,file),zlib.gzipSync(Buffer.from(body),{level:6}));
  const hourlyRows=aggregateRecords(records);
  for(const row of hourlyRows)hourly.push({topicSlot:slot,archetype:topic.archetype,...row});
  const fiveMinuteRows=aggregateBy5m(records);
  for(const row of fiveMinuteRows)fiveMinute.push({topicSlot:slot,archetype:topic.archetype,...row});
  const posts=records.reduce((n,r)=>n+(r.layer==='post'?1:0),0);
  const comments=records.reduce((n,r)=>n+(r.layer==='comment'?1:0),0);
  const replies=records.reduce((n,r)=>n+(r.layer==='reply'?1:0),0);
  recordCount+=records.length;postCount+=posts;commentCount+=comments;replyCount+=replies;
  manifestTopics.push({slot,id:topic.id,archetype:topic.archetype,title:topic.title,city:topic.city,bornAt:topic.bornAt,endsAt:topic.endsAt,views:weights[i],records:records.length,posts,comments,replies,file});
  log(`  ${String(i+1).padStart(3)}/${topics.length} ${topic.title} ${records.length} 条`);
 });
 const manifest={version:'corpus-v1',seed,builtAt:Date.now(),windowStart:start,windowEnd:end,days,total:recordCount,topics:manifestTopics,counts:{posts:postCount,comments:commentCount,replies:replyCount}};
 fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(outDir,'aggregates/hourly.ndjson'),hourly.map(r=>JSON.stringify(r)).join('\n')+'\n');
 fs.writeFileSync(path.join(outDir,'aggregates/by5m.ndjson'),fiveMinute.map(r=>JSON.stringify(r)).join('\n')+'\n');
 return manifest;
}
