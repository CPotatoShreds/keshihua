// Dev/demo runtime: loads the external corpus, backfills aggregates, keeps a
// live feed, and serves the snapshot/delta/text APIs. Node-only; the production
// worker uses api-worker.js instead.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {instancesBetween} from '../shared/topics.js';
import {RETENTION} from '../shared/catalog.js';
import {snapshot,delta} from './mock.js';
import {Aggregator} from './aggregator.js';
import {corpusUrl,health,aggregates,texts as corpusTexts,openFeed} from './corpus-client.js';
import {publicRecord} from '../corpus/schema.js';
import {corpusWords} from '../shared/corpus.js';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR=path.join(HERE,'.data');
const HOURLY_FILE=path.join(DATA_DIR,'hourly.ndjson');
const STEP5M=5*60000;
const HOUR=3600000;

function readRows(file){
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return [];}
}
const slotOf=topic=>Number(topic.slot??String(topic.id).split('-').at(-1));
const num=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

export function createRuntime(){
 const agg=new Aggregator({topics:instancesBetween(Date.now()-RETENTION,Date.now())});
 const state={status:'starting',connected:false,backfilledHours:0,backfilled5m:0,feedFrom:null,lastError:null,caughtUp:false,startedAt:Date.now()};
 const cache=new Map();
 let feedAbort=null,persistTimer=null,retryTimer=null,stopped=false;

 const refreshTopics=()=>{const topics=instancesBetween(Date.now()-RETENTION,Date.now());agg.setTopics(topics);return topics;};
 const corpusStatus=()=>({status:state.status,producer:corpusUrl(),connected:state.connected,backfilledHours:state.backfilledHours,backfilled5m:state.backfilled5m,feedFrom:state.feedFrom,caughtUp:state.caughtUp,records:agg.recordCount,lastRecordAt:agg.lastRecordAt,error:state.lastError});

 function loadPersisted(){
  const rows=readRows(HOURLY_FILE);
  if(rows.length)agg.backfillHourly(rows);
 }
 function persist(){
  const rows=agg.takeDirty();
  if(!rows.length)return;
  try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.appendFileSync(HOURLY_FILE,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');}catch{}
 }

 async function fetchWindowTexts(topic,from,to){
  const key=`${slotOf(topic)}:${Math.floor(from/STEP5M)}:${Math.floor(to/STEP5M)}`;
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<20000)return hit.data;
  const data=await corpusTexts({slot:slotOf(topic),from,to,limit:20000,sort:'time'});
  if(cache.size>20)cache.delete(cache.keys().next().value);
  cache.set(key,{at:Date.now(),data});
  return data;
 }

 function windowFor(topic,params={}){
  const now=Date.now();
  const from=Math.max(topic.bornAt,num(params.from,now-60*60000));
  const to=Math.min(topic.endsAt,num(params.to,now));
  return {from,to:Math.max(from+1,to)};
 }

 function filterRecords(list,params={}){
  let filtered=list;
  if(params.opinion!==undefined&&params.opinion!==null&&params.opinion!==''){
   const opinion=Number(params.opinion);
   filtered=filtered.filter(r=>r.cluster===opinion);
  }
  if(params.emotion)filtered=filtered.filter(r=>r.emotion===params.emotion);
  if(params.layer)filtered=filtered.filter(r=>r.layer===params.layer);
  return filtered;
 }

 async function topicTexts(id,params={}){
  const topic=agg.byId.get(id);
  if(!topic)return {topicId:id,records:[],total:0,error:'topic not found'};
  const {from,to}=windowFor(topic,params);
  const data=await fetchWindowTexts(topic,from,to);
  let list=filterRecords(data.records,params).filter(r=>r.time>=from&&r.time<=to);
  const limit=Math.max(1,Math.min(2000,num(params.limit,600)));
  const sort=params.sort||'sample';
  if(sort==='hot')list=list.slice().sort((a,b)=>(b.weight||0)-(a.weight||0)||b.time-a.time);
  else if(sort==='sample'&&list.length>limit){const stride=Math.max(1,Math.floor(list.length/limit));list=list.filter((_,i)=>i%stride===0);}
  else list=list.slice().sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
  return {topicId:id,from,to,total:list.length,records:list.slice(0,limit).map(publicRecord),corpus:corpusStatus()};
 }

 async function topicWords(id,params={}){
  const topic=agg.byId.get(id);
  if(!topic)return {topicId:id,words:[],corpus:corpusStatus()};
  const {from,to}=windowFor(topic,params);
  const data=await fetchWindowTexts(topic,from,to);
  const filtered=filterRecords(data.records,{opinion:params.opinion,emotion:params.emotion}).filter(r=>r.time>=from&&r.time<=to);
  const limit=Math.max(1,Math.min(80,num(params.limit,28)));
  const recordLimit=Math.max(100,Math.min(2000,num(params.recordLimit,1200)));
  const stride=Math.max(1,Math.floor(filtered.length/recordLimit));
  const sampled=stride>1?filtered.filter((_,i)=>i%stride===0):filtered;
  return {topicId:id,from,to,total:filtered.length,words:corpusWords(sampled,null,limit,{weighted:true}),records:sampled.slice(0,recordLimit).map(publicRecord),corpus:corpusStatus()};
 }

 async function topicDiscussion(id,params={}){
  const topic=agg.byId.get(id);
  if(!topic)return {topicId:id,posts:[],totalPosts:0,next:null,error:'topic not found'};
  const {from,to}=windowFor(topic,params);
  const data=await fetchWindowTexts(topic,from,to);
  const inWindow=data.records.filter(r=>r.time>=from&&r.time<=to);
  const posts=inWindow.filter(r=>r.layer==='post');
  const comments=inWindow.filter(r=>r.layer==='comment');
  const replies=inWindow.filter(r=>r.layer==='reply');
  const commentMatch=record=>{
   if(params.opinion!==undefined&&params.opinion!==null&&params.opinion!==''&&record.cluster!==Number(params.opinion))return false;
   if(params.emotion&&record.emotion!==params.emotion)return false;
   if(params.layer==='comment'&&record.layer!=='comment')return false;
   if(params.layer==='reply'&&record.layer!=='reply')return false;
   return true;
  };
  const postMatch=record=>{
   if(params.opinion!==undefined&&params.opinion!==null&&params.opinion!==''&&record.cluster!==Number(params.opinion))return false;
   if(params.emotion&&record.emotion!==params.emotion)return false;
   return true;
  };
  const commentsByPost=new Map();
  for(const comment of comments)(commentsByPost.get(comment.parentId)||commentsByPost.set(comment.parentId,[]).get(comment.parentId)).push(comment);
  const repliesByComment=new Map();
  for(const reply of replies)(repliesByComment.get(reply.parentId)||repliesByComment.set(reply.parentId,[]).get(reply.parentId)).push(reply);
  const visiblePosts=posts.filter(post=>postMatch(post)||(commentsByPost.get(post.id)||[]).some(commentMatch));
  visiblePosts.sort(params.sort==='time'?(a,b)=>b.time-a.time:(a,b)=>(b.weight||0)-(a.weight||0)||b.time-a.time);
  const commentSort=params.sort==='time'?(a,b)=>b.time-a.time||a.id.localeCompare(b.id):(a,b)=>(b.weight||0)-(a.weight||0)||b.time-a.time;
  const cursor=Math.max(0,num(params.cursor,0)),pageSize=Math.max(1,Math.min(40,num(params.limit,20)));
  const page=visiblePosts.slice(cursor,cursor+pageSize);
  const shapeComment=comment=>{
   const all=(repliesByComment.get(comment.id)||[]).sort(commentSort);
   return {...publicRecord(comment),replies:all.slice(0,4).map(publicRecord),replyTotal:all.length};
  };
  const shaped=page.map(post=>{
   const list=(commentsByPost.get(post.id)||[]).filter(commentMatch).sort(commentSort);
   return {...publicRecord(post),comments:list.slice(0,6).map(shapeComment),commentTotal:list.length};
  });
  return {topicId:id,from,to,totalPosts:visiblePosts.length,next:cursor+pageSize<visiblePosts.length?cursor+pageSize:null,posts:shaped,corpus:corpusStatus()};
 }

 function snapshotPayload(){
  refreshTopics();
  const now=Date.now();
  const payload=snapshot(now,{frameAt:(seq,known)=>agg.frameAt(seq,known)});
  return {...payload,model:'synthetic-corpus-v1',corpus:corpusStatus()};
 }
 function deltaPayload(after){
  refreshTopics();
  const message=delta(after,Date.now(),{frameAt:(seq,known)=>agg.frameAt(seq,known)});
  message.payload={...message.payload,corpus:corpusStatus()};
  return message;
 }

 function startFeed(from){
  feedAbort?.abort();
  feedAbort=new AbortController();
  const signal=feedAbort.signal;
  openFeed({
   from,speed:100,catchup:true,signal,
   onReady:payload=>{state.feedFrom=payload.from;state.connected=true;state.status='live';state.lastError=null;},
   onCaughtUp:()=>{state.caughtUp=true;},
   onRecord:record=>agg.ingest(record),
   onReset:payload=>{state.connected=false;startFeed(payload.from??Date.now());},
   onError:error=>{
    if(stopped)return;
    state.connected=false;state.status='offline';state.lastError=String(error?.message||error);
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>startFeed(Math.max(agg.lastRecordAt||0,Date.now()-5*60000)),5000);
   }
  });
 }

 async function connect(){
  if(stopped)return;
  try{
   state.status='connecting';state.lastError=null;
   const info=await health();
   state.status='backfilling';
   const now=Date.now();
   const hourly=await aggregates({from:now-RETENTION,to:now});
   state.backfilledHours=agg.backfillHourly(hourly);
   const current5m=Math.floor(now/STEP5M)*STEP5M;
   const five=await aggregates({from:current5m-2*HOUR,to:now,step:'5m'});
   state.backfilled5m=agg.backfill5m(five,Math.floor(current5m/STEP5M));
   startFeed(Math.max(info.windowStart,Math.min(current5m,info.windowEnd)));
  }catch(error){
   if(stopped)return;
   state.status='offline';state.connected=false;state.lastError=String(error?.message||error);
   clearTimeout(retryTimer);
   retryTimer=setTimeout(connect,5000);
  }
 }

 function start(){
  if(persistTimer)return;
  loadPersisted();
  connect();
  persistTimer=setInterval(persist,30000);
 }
 function stop(){
  stopped=true;
  clearInterval(persistTimer);clearTimeout(retryTimer);
  feedAbort?.abort();
 }
 return {agg,refreshTopics,snapshot:snapshotPayload,delta:deltaPayload,history:id=>agg.history(id),texts:topicTexts,words:topicWords,discussion:topicDiscussion,status:corpusStatus,start,stop};
}

export const runtime=createRuntime();
