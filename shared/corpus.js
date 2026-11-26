import {aggregate} from './lifecycle.js';

// Deterministic simulated discussion corpus.
// One topic/hour produces a representative sample of texts (not the full platform volume).
// Texts carry a cluster label and pre-segmented tokens; word cloud and word tree read from them.
const PATTERNS=[
 ['围绕','$topic','，','不少','居民','更','关注','$w1','，','也','希望','$w2','能','尽快','落实'],
 ['$city','的','$topic','引发','讨论','，','大家','对','$w1','的','看法','不','一样'],
 ['有','网友','认为','$w1','和','$w2','都','重要','，','但','$w3','不能','被','忽略'],
 ['如果','只','看','$w1','，','可能','会','忽略','$w2','带来','的','影响'],
 ['希望','相关方','把','$w1','的','安排','说','清楚','，','不要','只','回应','$w2'],
 ['从','现场','反馈','看','，','$w1','的','影响','已经','出现','，','$w2','还','需要','观察'],
 ['有','人','支持','$w1','，','也','有','人','担心','$w2','会','带来','新','问题'],
 ['$label','不是','一句','口号','，','$w1','和','$w2','都','需要','具体','方案'],
 ['这','条','讨论','里','，','$w3','出现','得','越来越','多','，','值得','关注'],
 ['等','后续','信息','出来','再','判断','，','现在','更','关心','$w1','的','进展'],
 ['$city','相关','部门','回应','了','$w1','，','但','$w2','的','细节','还','没有','公布'],
 ['不少','人','在','评论','区','提到','$w2','，','希望','能','看到','$w1','的','实际','变化'],
 ['关于','$w3','，','目前','的','信息','还','不','完整','，','需要','继续','核实'],
 ['$topic','的','讨论','不该','只','停留','在','$w1','，','$w2','同样','值得','追问'],
 ['有','网友','认为','$w2','和','$w1','都','重要','，','但','$w3','不能','被','忽略'],
 ['如果','只','看','$w2','，','可能','会','忽略','$w1','带来','的','影响'],
 ['$w2','的','细节','还','没有','公布','，','$w1','仍','需要','说明'],
 ['围绕','$w3','，','$w1','和','$w2','仍','有','不同','看法'],
 ['$w1','之后','，','大家','更','关心','$w2','的','后续','安排'],
 ['对','$w1','来说','，','$w3','的','透明','同样','重要'],
 ['$w2','和','$w3','都','被','提到','，','$w1','的','进展','最','受','关注'],
 ['$w1','是否','能够','落实','，','要','看','$w2','和','$w3','的','配合'],
 ['$w1','的','变化','需要','时间','，','$w2','的','讨论','才','刚刚','开始']
];
const PUNCT=/^[，。！？；：、“”‘’（）《》〈〉…—\s]+$/;
const STOP=new Set(['的','了','在','是','和','也','都','就','不','有','人','这','那','里','上','下','中','对','把','被','让','给','从','到','与','及','而','但','却','还','又','很','更','最','会','能','要','说','看','等','再','只','一','个','些','条','次','点','我','你','他','她','它','我们','他们','大家','自己','这个','那个','如果','因为','所以','但是','而且','以及','可能','应该','可以','需要','已经','目前','还是','就是','没有','不是','不能','不要','已经','出来','出现','带来','忽略','落实','追问','提到','看到','觉得','认为','相关','不少','有人','评论','方面','情况','时候','已经','同样','值得','越来越','一句','一点','不能','不会','不是','一个','一样','仍','才','刚刚','最受','来说','之后','是否','能够','继续','其','并','且','时','网友','居民','市民','游客']);
const cache=new Map();
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function allocate(counts,size){
 const positive=counts.map(c=>Math.max(0,c)),total=positive.reduce((a,b)=>a+b,0);
 if(!(total>0))return counts.map(()=>0);
 const raw=positive.map(c=>c/total*size),base=raw.map(v=>Math.max(0,Math.floor(v)));
 let used=base.reduce((a,b)=>a+b,0),left=Math.max(0,size-used);
 const order=raw.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
 for(let k=0;k<left;k++)base[order[k%order.length].i]++;
 for(let j=0;j<5;j++)if(positive[j]>0&&base[j]===0){base[j]=1;const donor=base.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v)[0].i;if(donor!==j)base[donor]--;}
 return base;
}
function wordsOf(cluster){return (cluster?.words||[]).filter(Boolean).slice(0,3);}
function fill(pattern,cluster,topic){
 const words=wordsOf(cluster);
 return pattern.map(token=>token==='$w1'?words[0]||'':token==='$w2'?words[1]||'':token==='$w3'?words[2]||'':token==='$label'?cluster?.title||'':token==='$topic'?topic.title||'':token==='$city'?topic.city||'':token).filter(Boolean);
}
export function corpusFor(topic,time,{minutes=60,size=600}={}){
 if(!topic)return [];
 const key=topic.id+':'+Math.floor(time/15000)+':'+minutes+':'+size;
 if(cache.has(key))return cache.get(key);
 const counts=aggregate(topic,time,minutes).counts,total=counts.reduce((a,b)=>a+b,0);
 if(!(total>0)){cache.set(key,[]);return [];}
 const alloc=allocate(counts,size),first=Math.max(topic.bornAt,time-minutes*60000),last=Math.max(first,time),span=Math.max(1,last-first),rand=rng(hash(key)),texts=[];
 for(let j=0;j<5;j++){
  const cluster=topic.clusters?.[j];if(!cluster||!alloc[j])continue;
  const keywords=wordsOf(cluster);
  for(let k=0;k<alloc[j];k++){
   const tokens=fill(PATTERNS[Math.floor(rand()*PATTERNS.length)],cluster,topic),at=first+Math.floor(rand()*span);
   if(!tokens.length)continue;
   texts.push({id:topic.id+'-c'+j+'-'+k,cluster:j,time:at,text:tokens.join(''),tokens,keywords});
  }
 }
 texts.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 if(cache.size>40)cache.delete(cache.keys().next().value);
 cache.set(key,texts);return texts;
}
export function corpusTexts(texts,opinion=null){return opinion===null||opinion===undefined?texts:texts.filter(t=>t.cluster===opinion);}
const isWord=token=>!!token&&token.length>=2&&token.length<=6&&!PUNCT.test(token)&&!STOP.has(token);
export const isWordToken=isWord;
export function corpusWords(texts,opinion=null,limit=28,{weighted=false}={}){
 const list=corpusTexts(texts,opinion),keywords=new Set(list.flatMap(t=>t.keywords||[])),counts=new Map();
 for(const text of list)for(const token of text.tokens||[]){
  if(!isWord(token))continue;
  const current=counts.get(token)||{word:token,value:0,clusters:new Map()};
  const contribution=weighted?1+Math.max(0,Math.min(100,Number(text.weight||0)))/50:1;
  current.value+=contribution*(keywords.has(token)?1.8:1);
  current.clusters.set(text.cluster,(current.clusters.get(text.cluster)||0)+1);
  counts.set(token,current);
 }
 return [...counts.values()].map(w=>{let cluster=0,best=-1;for(const [k,v] of w.clusters)if(v>best){best=v;cluster=k;}return {word:w.word,value:w.value,cluster};}).sort((a,b)=>b.value-a.value||a.word.localeCompare(b.word)).slice(0,limit);
}
export function clearCorpusCache(){cache.clear();}
