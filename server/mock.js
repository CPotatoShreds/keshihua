import {templates,STEP,RETENTION,INTERVAL,LIFE,durations} from '../shared/catalog.js';
import {makePulses,valuesAt} from '../shared/lifecycle.js';
export {aggregate} from '../shared/lifecycle.js';
const anchor=Date.UTC(2026,0,1,0),mod=(a,b)=>(a%b+b)%b;
function random(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function instance(slot){
 const index=mod(slot,templates.length),q=templates[index];
 const bornAt=anchor+slot*INTERVAL+Math.floor(random(slot+11)*10)*3600000;
 const duration=durations[index],amplitude=Math.round(3500*Math.exp(random(slot+73)*7.9));
 const day=new Date(bornAt+8*3600000).toISOString().slice(5,10),pulses=makePulses(bornAt,duration,amplitude,index),discussionRatio=.008+random(slot+91)*.028;
 const ceiling=pulses.reduce((n,p)=>n+p.amplitude,0);
 return {...q,id:q.key+'-'+slot,index,bornAt,endsAt:bornAt+duration,title:q.title+' · '+day,amplitude,discussionRatio,pulses,simulation:true,ceilings:{views:ceiling,m5:ceiling*5*discussionRatio,h1:ceiling*60*discussionRatio}};
}
export function instancesBetween(start,end){
 const out=[];
 for(let slot=Math.floor((start-LIFE-3600000-anchor)/INTERVAL)-1;slot<=Math.floor((end-anchor)/INTERVAL);slot++){
  const q=instance(slot);if(q.bornAt<=end&&q.endsAt+3600000>=start)out.push(q);
 }return out.sort((a,b)=>a.bornAt-b.bornAt);
}
function rounded(v){return {views:Math.round(v.views*100)/100,counts:{m5:v.counts.m5.map(Math.round),h1:v.counts.h1.map(Math.round)}};}
export function frameAt(seq,known=instancesBetween(seq*STEP,seq*STEP)){
 const time=seq*STEP,values={};
 for(const q of known){if(q.bornAt>time||q.endsAt+3600000<time)continue;values[q.id]=rounded(valuesAt(q,time));}
 return {seq,time,values};
}
export function eventsBetween(start,end,known=instancesBetween(start,end)){
 const out=[];
 for(const q of known)q.eventTitles.forEach((title,j)=>{const time=Math.floor(q.pulses[j].at/STEP)*STEP;if(time<start||time>end)return;out.push({id:q.id+'-e'+j,topicId:q.id,time,title,kind:['首次发布','公众反馈','相关方回应','补充材料','后续进展'][j],body:[`“${q.title}”进入社区讨论，最初的关注集中于${q.clusters[2].title}。`,`围绕${q.description}，用户开始提出具体经历与诉求，${q.clusters[0].title}的讨论增加。`,`相关方发布了进一步安排。关于“${q.clusters[1].title}”的疑问逐步得到回应，讨论开始分化。`,`新的材料补充了此前缺失的背景，${q.clusters[3].title}逐渐获得更多支持。`,`后续安排逐步落实，讨论转向${q.clusters[3].title}，话题流量开始回落。`][j]});});return out.sort((a,b)=>a.time-b.time);
}
export function snapshot(now=Date.now()){
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP,topics=instancesBetween(first*STEP,last*STEP),times=new Set([first,last]);
 const add=t=>{const s=Math.floor(t/STEP);if(s>=first&&s<=last)times.add(s);};
 for(let t=Math.ceil(first*STEP/3600000)*3600000;t<=last*STEP;t+=3600000)add(t);
 for(const q of topics){add(q.bornAt);add(q.endsAt);for(const p of q.pulses)add(p.at);}
 for(let s=Math.max(first,last-120);s<=last;s++)times.add(s);
 return {serverTime:now,step:STEP,retention:RETENTION,model:'synthetic-beta-v1',topics,frames:[...times].sort((a,b)=>a-b).map(s=>frameAt(s,topics)),events:eventsBetween(first*STEP,last*STEP,topics)};
}
export function delta(after,now=Date.now()){
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP;
 if(!Number.isSafeInteger(after)||after<first||after>last||last-after>720)return {type:'snapshot',payload:snapshot(now),id:last};
 const topics=instancesBetween(after*STEP,last*STEP);
 return {type:'frames',id:last,payload:{serverTime:now,topics:topics.filter(q=>q.bornAt>after*STEP),frames:Array.from({length:last-after},(_,i)=>frameAt(after+i+1,topics)),events:eventsBetween(after*STEP+1,last*STEP,topics)}};
}
