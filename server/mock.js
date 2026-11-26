import {STEP,RETENTION} from '../shared/catalog.js';
import {valuesAt} from '../shared/lifecycle.js';
import {instancesBetween} from '../shared/topics.js';
export {aggregate} from '../shared/lifecycle.js';
export {instance,instancesBetween,TOPIC_ANCHOR} from '../shared/topics.js';
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
export function snapshot(now=Date.now(),{frameAt:framesFor=frameAt}={}){
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP,topics=instancesBetween(first*STEP,last*STEP),frames=[];
 for(let s=Math.max(first,last-120);s<=last;s++)frames.push(framesFor(s,topics));
 return {serverTime:now,step:STEP,retention:RETENTION,retentionStart:first*STEP,model:'synthetic-beta-v2',topics,frames,events:eventsBetween(first*STEP,last*STEP,topics)};
}
export function delta(after,now=Date.now(),{frameAt:framesFor=frameAt}={}){
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP;
 if(!Number.isSafeInteger(after)||after<first||after>last||last-after>720)return {type:'snapshot',payload:snapshot(now,{frameAt:framesFor}),id:last};
 const topics=instancesBetween(after*STEP,last*STEP);
 return {type:'frames',id:last,payload:{serverTime:now,retentionStart:first*STEP,topics:topics.filter(q=>q.bornAt>after*STEP),frames:Array.from({length:last-after},(_,i)=>framesFor(after+i+1,topics)),events:eventsBetween(after*STEP+1,last*STEP,topics)}};
}
