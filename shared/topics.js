// Deterministic topic instance space shared by the system and the corpus producer.
// 40 archetypes x 80 cities = 3200 unique titles, assigned by a permutation.
import {templates,cities,STEP,LIFE,SLOT,MIN_VIEWS,HEAT_SCALE,HEAT_QUANTILES} from './catalog.js';
import {makePulses,aggregate} from './lifecycle.js';

export const TOPIC_ANCHOR=Date.UTC(2026,0,1,0);
const mod=(a,b)=>(a%b+b)%b;
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
export function durationFor(u){return Math.round(8*3600000*Math.pow(7.5,Math.max(0,Math.min(1,u)))/STEP)*STEP;}
const cache=new Map();
export function instance(slot){
 if(cache.has(slot))return cache.get(slot);
 if(cache.size>6000)for(const key of cache.keys())if(key<slot-3000)cache.delete(key);
 const combos=templates.length*cities.length,index=mod(slot*977,combos);
 const template=templates[index%templates.length],city=cities[Math.floor(index/templates.length)%cities.length];
 const bornAt=TOPIC_ANCHOR+slot*SLOT+Math.floor(random(slot+11)*10)*60000,duration=durationFor(random(slot+29));
 const heat=heatFor(random(slot+73)),targetViews=heat*HEAT_SCALE;
 if(targetViews<MIN_VIEWS){cache.set(slot,null);return null;}
 const pulses=makePulses(bornAt,duration,1,index%templates.length);
 const unitViews=aggregate({bornAt,endsAt:bornAt+duration,pulses,amplitude:1,discussionRatio:0},bornAt+duration,duration/60000).views;
 const amplitude=targetViews/Math.max(1,unitViews);
 pulses.forEach(p=>{p.amplitude*=amplitude;});
 const title=city+template.cityTitle,discussionRatio=.0015+random(slot+91)*.0045,endsAt=bornAt+duration;
 const ceiling=Math.round(pulses.reduce((n,p)=>n+p.amplitude,0));
 const q={...template,id:template.key+'-'+slot,slot,index:index%templates.length,archetype:template.key,archetypeIndex:index%templates.length,city,bornAt,endsAt,title,description:`${city}：${template.description}`,tags:[city,...template.tags],amplitude,discussionRatio,pulses,eventTitles:template.eventTitles.map(e=>city+e),simulation:true,ceilings:{views:ceiling,m5:ceiling*5*discussionRatio,h1:ceiling*60*discussionRatio}};
 cache.set(slot,q);return q;
}
export function instancesBetween(start,end){
 const out=[];
 for(let slot=Math.floor((start-LIFE-3600000-TOPIC_ANCHOR)/SLOT)-1;slot<=Math.floor((end-TOPIC_ANCHOR)/SLOT);slot++){
  const q=instance(slot);if(q&&q.bornAt<=end&&q.endsAt+3600000>=start)out.push(q);
 }return out.sort((a,b)=>a.bornAt-b.bornAt);
}
export function slotForTime(time){return Math.floor((time-TOPIC_ANCHOR)/SLOT);}
