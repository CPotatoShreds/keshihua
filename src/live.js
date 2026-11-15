import {useEffect,useRef,useState} from 'react';
import {STEP,RETENTION,LIFE} from '../shared/catalog.js';
export const EMPTY={views:0,counts:{m5:[0,0,0,0,0],h1:[0,0,0,0,0]}};
export function mergeFeed(previous,message,replace=false){
 const prior=replace?null:previous;
 const all=new Map((prior?.frames||[]).map(f=>[f.seq,f]));for(const f of message.frames||[])all.set(f.seq,f);
 const sorted=[...all.values()].sort((a,b)=>a.seq-b.seq),latest=sorted.at(-1)?.time||0,oldest=latest-RETENTION;
 const topics=new Map((prior?.topics||[]).map(q=>[q.id,q]));for(const q of message.topics||[])topics.set(q.id,q);
 const events=new Map((prior?.events||[]).map(e=>[e.id,e]));for(const e of message.events||[])events.set(e.id,e);
 const firstRetained=sorted.findIndex(f=>f.time>=oldest);
 const boundaries=new Set([...topics.values()].flatMap(q=>[q.bornAt,q.endsAt]));for(const e of events.values())boundaries.add(e.time);
 return {frames:sorted.filter((f,i)=>f.time>=oldest&&(f.time>=latest-600000||f.time%3600000===0||boundaries.has(f.time)||i===firstRetained)),topics:[...topics.values()].filter(q=>q.endsAt+3600000>=oldest).sort((a,b)=>a.bornAt-b.bornAt),events:[...events.values()].filter(e=>e.time>=oldest).sort((a,b)=>a.time-b.time),receivedAt:previous?.frames.at(-1)?.time===latest?previous.receivedAt:performance.now()};
}
export function sampleAt(frames,time){
 if(!frames.length)return {time,values:{}};
 let lo=0,hi=frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].time<=time)lo=mid;else hi=mid-1;}
 const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],u=b.time===a.time?0:Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time))),values={};
 for(const id of new Set([...Object.keys(a.values),...Object.keys(b.values)])){const x=a.values[id]||EMPTY,y=b.values[id]||EMPTY;values[id]={views:x.views+(y.views-x.views)*u,counts:Object.fromEntries(['m5','h1'].map(k=>[k,x.counts[k].map((c,j)=>c+(y.counts[k][j]-c)*u)]))};}
 return {time,values};
}
export function matching(q,query){return query.trim().toLowerCase().split(/\s+/).every(t=>(q.title+' '+q.description+' '+q.tags.join(' ')).toLowerCase().includes(t));}
export function viewportFor(time,span,oldest,latest){return Math.max(oldest+span,Math.min(latest,time+span*.16));}
export function clampViewport(end,span,oldest,latest){return Math.min(latest,Math.max(oldest+span,Math.min(latest,end)));}
// The two detail charts share this domain; selection freezes both boundaries.
export function detailViewport(bornAt,time,oldest,latest,range='auto',fixed=null){
 const first=Math.max(bornAt,oldest),right=Math.max(first+STEP,latest);
 const requested=fixed?.span??(range==='auto'?Math.max(STEP,time-first):range);
 const span=Math.max(STEP,Math.min(requested,right-first));
 const end=fixed?Math.max(first+span,Math.min(right,fixed.end)):Math.max(first+span,Math.min(right,time));
 return {start:end-span,end,span,truncated:bornAt<oldest};
}
export function wordsFor(topic,counts,selected=null){
 const map=new Map();topic.clusters.forEach((c,j)=>{if(selected!==null&&selected!==j)return;c.words.forEach((word,k)=>{const value=counts[j]*(.62-k*.13);if(value<.5)return;const old=map.get(word);map.set(word,{word,value:value+(old?.value||0),cluster:j,color:c.color});});});return [...map.values()].sort((a,b)=>b.value-a.value);
}
export function stepPlayer(state,elapsed,edge,oldest){
 if(state.mode==='live')return {...state,time:edge,speed:1};
 if(state.mode==='paused')return {...state,time:Math.max(oldest,state.time)};
 const time=Math.max(oldest,state.time+elapsed*state.speed);
 return time>=edge?{time:edge,mode:'live',speed:1}:{...state,time};
}
export function useFeed(){
 const [data,setData]=useState(null),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0);
 useEffect(()=>{let stopped=false,stream,restart;const abort=new AbortController();
  const connect=async()=>{try{
   const response=await fetch('/api/snapshot',{signal:abort.signal});if(!response.ok)throw Error('snapshot');const snapshot=await response.json();if(stopped)return;
   setData(prev=>mergeFeed(prev,snapshot,true));setStatus('connecting');
   stream=new EventSource('/api/stream?since='+snapshot.frames.at(-1).seq);
   const receive=replace=>e=>{if(stopped)return;try{const m=JSON.parse(e.data);setData(prev=>mergeFeed(prev,m,replace));setStatus('connected');}catch{setStatus('reconnecting');}};
   stream.addEventListener('frames',receive(false));stream.addEventListener('snapshot',receive(true));stream.onerror=()=>!stopped&&setStatus('reconnecting');
  }catch(e){if(stopped)return;setStatus('error');restart=setTimeout(connect,4000);}};
  connect();return()=>{stopped=true;abort.abort();stream?.close();clearTimeout(restart);};
 },[retry]);return {data,status,retry:()=>setRetry(n=>n+1)};
}
export function usePlayer(data){
 const [state,setState]=useState({time:0,mode:'live',speed:1}),ref=useRef(state),feed=useRef(data);feed.current=data;
 const update=next=>{ref.current=typeof next==='function'?next(ref.current):next;setState(ref.current);};
 useEffect(()=>{let id,last=null;function frame(now){const d=feed.current;if(d?.frames.length){const edge=d.frames.at(-1).time-STEP+Math.min(STEP,Math.max(0,now-d.receivedAt));const elapsed=last===null||document.hidden?0:now-last;const next={...stepPlayer(ref.current,elapsed,edge,d.frames[0].time),edge};if(next.time!==ref.current.time||next.mode!==ref.current.mode||next.edge!==ref.current.edge){ref.current=next;setState(next);}}last=document.hidden?null:now;id=requestAnimationFrame(frame);}id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);},[]);
 return {...state,pause:()=>update(s=>({...s,mode:'paused'})),toggle:()=>update(s=>({...s,mode:s.mode==='paused'?'playing':'paused'})),seek:t=>update(s=>({...s,time:Math.max(data.frames[0].time,Math.min(t,ref.current.edge||data.frames.at(-1).time)),mode:'paused'})),live:()=>update(s=>({...s,time:s.edge||s.time,mode:'live',speed:1})),rate:speed=>update(s=>({...s,speed}))};
}
const clock=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const minute=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'});
export const formatTime=t=>minute.format(t);
export const formatClock=t=>clock.format(t);
export const number=n=>n>=10000?(n/10000).toFixed(1)+'万':Math.round(n).toLocaleString('zh-CN');

const dateTime=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour12:false,hour:'2-digit',minute:'2-digit'});
const dateOnly=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'});
export const formatDateTime=t=>dateTime.format(t);
export const formatAxis=(t,span)=>span>=2*86400000?dateOnly.format(t):span>=86400000?dateTime.format(t):formatTime(t);
