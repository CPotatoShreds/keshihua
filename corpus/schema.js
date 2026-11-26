// Shared schema and deterministic helpers for the external corpus producer.
// The producer is a demo stand-in for a platform firehose; every record is synthetic.
import {EMOTION_BY_ID,EMOTION_IDS,NEUTRAL_ID} from '../shared/dutir.js';
import {weightBreakdown} from '../shared/weight.js';

export const CORPUS_VERSION='corpus-v1';
export const LAYER_RATIO={post:.001,comment:.90,reply:.099};
export const INTENSITIES=[1,3,5,7,9];
export const INTENSITY_WEIGHTS=[.12,.26,.34,.20,.08];

export function hashString(str){
 let h=2166136261;
 for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}

export function mulberry32(seed){
 let a=seed>>>0;
 return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
}

export function rngFor(seed,...parts){return mulberry32(hashString([seed,...parts].join('|')));}

export function pick(rng,list){return list[Math.floor(rng()*list.length)];}

export function weightedPick(rng,list,weights){
 const total=weights.reduce((a,b)=>a+Math.max(0,b),0);
 if(!(total>0))return list[Math.floor(rng()*list.length)];
 let r=rng()*total;
 for(let i=0;i<list.length;i++){r-=Math.max(0,weights[i]);if(r<=0)return list[i];}
 return list.at(-1);
}

export function fillClause(template,vars){
 return template.split('|').map(token=>vars[token]!==undefined?vars[token]:token).filter(token=>token!=='');
}

export function joinTokens(tokens){return tokens.join('');}

export function sampleCluster(rng,opinions){
 const total=opinions.reduce((a,b)=>a+Math.max(0,b),0);
 if(!(total>0))return 0;
 let r=rng()*total;
 for(let i=0;i<opinions.length;i++){r-=Math.max(0,opinions[i]);if(r<=0)return i;}
 return opinions.length-1;
}

export function sampleEmotion(rng,mix){
 let r=rng();
 if(Array.isArray(mix)){
  for(let i=0;i<mix.length;i++){r-=mix[i]||0;if(r<=0)return EMOTION_IDS[i];}
  return NEUTRAL_ID;
 }
 for(const id of EMOTION_IDS){r-=mix[id]||0;if(r<=0)return id;}
 return NEUTRAL_ID;
}

export function sampleIntensity(rng,emotion){
 if(emotion===NEUTRAL_ID)return 0;
 return weightedPick(rng,INTENSITIES,INTENSITY_WEIGHTS);
}

export function publicRecord(record){
 const {impressions,position,...metrics}=record.metrics;
 const breakdown=weightBreakdown(record.layer,record.metrics||{});
 return {...record,metrics,weightInfo:{layer:record.layer,coef:breakdown.coef,sufficient:breakdown.sufficient}};
}

export function validateRecord(record,topic){
 const errors=[];
 if(!record||typeof record!=='object')return ['record'];
 if(!record.id)errors.push('id');
 if(!['post','comment','reply'].includes(record.layer))errors.push('layer');
 if(!Number.isSafeInteger(record.topicSlot))errors.push('topicSlot');
 if(!Number.isFinite(record.time))errors.push('time');
 if(!record.author)errors.push('author');
 if(!Number.isInteger(record.cluster)||record.cluster<0||record.cluster>4)errors.push('cluster');
 if(!EMOTION_BY_ID.has(record.emotion))errors.push('emotion');
 if(!INTENSITIES.includes(record.intensity)&&record.intensity!==0)errors.push('intensity');
 if(typeof record.text!=='string'||!record.text)errors.push('text');
 if(!Array.isArray(record.tokens)||record.tokens.join('')!==record.text)errors.push('tokens');
 if(!Array.isArray(record.keywords))errors.push('keywords');
 if(!record.metrics||typeof record.metrics!=='object')errors.push('metrics');
 if(topic){
  if(record.time<topic.bornAt||record.time>topic.endsAt)errors.push('time-range');
  if(record.layer==='post'){
   if(record.parentId!==null)errors.push('post-parent');
   if(record.rootId!==record.id)errors.push('post-root');
   if(!(record.metrics.views>0))errors.push('views');
  }else{
   if(!record.parentId)errors.push('parent');
   if(!record.rootId)errors.push('root');
   if(!(record.metrics.impressions>0))errors.push('impressions');
  }
 }
 if(record.metrics&&Number(record.metrics.likes)>Number(record.metrics.impressions||Infinity))errors.push('likes>impressions');
 return errors;
}
