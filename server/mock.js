import {templates,cities,STEP,RETENTION,LIFE,SLOT,MIN_VIEWS,HEAT_SCALE,HEAT_QUANTILES} from '../shared/catalog.js';
import {makePulses,valuesAt,aggregate} from '../shared/lifecycle.js';
export {aggregate} from '../shared/lifecycle.js';
const anchor=Date.UTC(2026,0,1,0),mod=(a,b)=>(a%b+b)%b;
function random(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function heatFor(u){
 if(u<=0)return HEAT_QUANTILES[0][1];
 for(let i=1;i<HEAT_QUANTILES.length;i++){
  const [x0,v0]=HEAT_QUANTILES[i-1],[x1,v1]=HEAT_QUANTILES[i];
  if(u<=x1){const f=(u-x0)/Math.max(1e-9,x1-x0);return Math.exp(Math.log(v0)+(Math.log(v1)-Math.log(v0))*f);}
 }
 return HEAT_QUANTILES.at(-1)[1];
}
// Admitted topics are the high-heat subset, so lifetimes are longer than the full-list median.
// Right-skewed 8h..60h, median ~22h, mean ~26h.
function durationFor(u){return Math.round(8*3600000*Math.pow(7.5,Math.max(0,Math.min(1,u)))/STEP)*STEP;}
const cache=new Map();
export function instance(slot){
 if(cache.has(slot))return cache.get(slot);
 if(cache.size>6000)for(const key of cache.keys())if(key<slot-3000)cache.delete(key);
 const combos=templates.length*cities.length,index=mod(slot*977,combos);
 const template=templates[index%templates.length],city=cities[Math.floor(index/templates.length)%cities.length];
 const bornAt=anchor+slot*SLOT+Math.floor(random(slot+11)*10)*60000,duration=durationFor(random(slot+29));
 const heat=heatFor(random(slot+73)),targetViews=heat*HEAT_SCALE;
 if(targetViews<MIN_VIEWS){cache.set(slot,null);return null;}
 const pulses=makePulses(bornAt,duration,1,index%templates.length);
 const unitViews=aggregate({bornAt,endsAt:bornAt+duration,pulses,amplitude:1,discussionRatio:0},bornAt+duration,duration/60000).views;
 const amplitude=targetViews/Math.max(1,unitViews);
 pulses.forEach(p=>{p.amplitude*=amplitude;});
 const title=city+template.cityTitle,discussionRatio=.0015+random(slot+91)*.0045,endsAt=bornAt+duration;
 const ceiling=Math.round(pulses.reduce((n,p)=>n+p.amplitude,0));
 const q={...template,id:template.key+'-'+slot,index:index%templates.length,city,bornAt,endsAt,title,description:`${city}：${template.description}`,tags:[city,...template.tags],amplitude,discussionRatio,pulses,eventTitles:template.eventTitles.map(e=>city+e),simulation:true,ceilings:{views:ceiling,m5:ceiling*5*discussionRatio,h1:ceiling*60*discussionRatio}};
 cache.set(slot,q);return q;
}
export function instancesBetween(start,end){
 const out=[];
 for(let slot=Math.floor((start-LIFE-3600000-anchor)/SLOT)-1;slot<=Math.floor((end-anchor)/SLOT);slot++){
  const q=instance(slot);if(q&&q.bornAt<=end&&q.endsAt+3600000>=start)out.push(q);
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
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP,topics=instancesBetween(first*STEP,last*STEP),frames=[];
 for(let s=Math.max(first,last-120);s<=last;s++)frames.push(frameAt(s,topics));
 return {serverTime:now,step:STEP,retention:RETENTION,retentionStart:first*STEP,model:'synthetic-beta-v2',topics,frames,events:eventsBetween(first*STEP,last*STEP,topics)};
}
export function delta(after,now=Date.now()){
 const last=Math.floor(now/STEP),first=last-RETENTION/STEP;
 if(!Number.isSafeInteger(after)||after<first||after>last||last-after>720)return {type:'snapshot',payload:snapshot(now),id:last};
 const topics=instancesBetween(after*STEP,last*STEP);
 return {type:'frames',id:last,payload:{serverTime:now,retentionStart:first*STEP,topics:topics.filter(q=>q.bornAt>after*STEP),frames:Array.from({length:last-after},(_,i)=>frameAt(after+i+1,topics)),events:eventsBetween(after*STEP+1,last*STEP,topics)}};
}
