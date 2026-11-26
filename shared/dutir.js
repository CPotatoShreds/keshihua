// DUTIR (大连理工大学情感词汇本体库) 7 大类 / 21 小类。
// 分类名与层级取自公开本体说明；强度沿用 1/3/5/7/9 五级。
// 本文件只做演示用的确定性抽样表，不代表 DUTIR 官方标注结果。

export const DUTIR_GROUPS=[
 {id:'joy',title:'乐',color:'#d9a441'},
 {id:'like',title:'好',color:'#6f9e7a'},
 {id:'anger',title:'怒',color:'#c8564f'},
 {id:'sorrow',title:'哀',color:'#6f86a8'},
 {id:'fear',title:'惧',color:'#8b7aa8'},
 {id:'disgust',title:'恶',color:'#a0846a'},
 {id:'surprise',title:'惊',color:'#5aa3a8'},
 {id:'neutral',title:'中性',color:'#a9b3b8'}
];

export const DUTIR=[
 {id:'e0',title:'快乐',group:'joy',color:'#e0a53f',polarity:1},
 {id:'e1',title:'安心',group:'joy',color:'#d8b45a',polarity:1},
 {id:'e2',title:'尊敬',group:'like',color:'#6f9e7a',polarity:1},
 {id:'e3',title:'赞扬',group:'like',color:'#7fae86',polarity:1},
 {id:'e4',title:'相信',group:'like',color:'#4f8060',polarity:1},
 {id:'e5',title:'喜爱',group:'like',color:'#8fbf95',polarity:1},
 {id:'e6',title:'祝愿',group:'like',color:'#5d8f6a',polarity:1},
 {id:'e7',title:'愤怒',group:'anger',color:'#c8564f',polarity:-1},
 {id:'e8',title:'悲伤',group:'sorrow',color:'#5e7597',polarity:-1},
 {id:'e9',title:'失望',group:'sorrow',color:'#7d94b5',polarity:-1},
 {id:'e10',title:'疚',group:'sorrow',color:'#8fa3c0',polarity:-1},
 {id:'e11',title:'思',group:'sorrow',color:'#6f86a8',polarity:0},
 {id:'e12',title:'慌',group:'fear',color:'#8b7aa8',polarity:-1},
 {id:'e13',title:'恐惧',group:'fear',color:'#7a69a0',polarity:-1},
 {id:'e14',title:'羞',group:'fear',color:'#9b8ab8',polarity:-1},
 {id:'e15',title:'烦闷',group:'disgust',color:'#a0846a',polarity:-1},
 {id:'e16',title:'憎恶',group:'disgust',color:'#8f7359',polarity:-1},
 {id:'e17',title:'贬责',group:'disgust',color:'#b0957a',polarity:-1},
 {id:'e18',title:'妒忌',group:'disgust',color:'#7f6550',polarity:-1},
 {id:'e19',title:'怀疑',group:'disgust',color:'#bfa58a',polarity:-1},
 {id:'e20',title:'惊奇',group:'surprise',color:'#5aa3a8',polarity:0},
 {id:'e21',title:'无显著情绪',group:'neutral',color:'#a9b3b8',polarity:0}
];

export const NEUTRAL_ID='e21';
export const EMOTION_BY_ID=new Map(DUTIR.map(e=>[e.id,e]));
export const EMOTION_IDS=DUTIR.map(e=>e.id);
export const EMOTION_TITLES=Object.fromEntries(DUTIR.map(e=>[e.id,e.title]));

export function emotion(id){return EMOTION_BY_ID.get(id)||EMOTION_BY_ID.get(NEUTRAL_ID);}
export function emotionGroup(id){return emotion(id).group;}

// 观点 0..4 × 情绪 e0..e21 的条件分布。原始权重只表达相对倾向，
// 载入时按行归一化，保证每个观点内情绪占比之和为 1。
const RAW_MIX=[
 [.01,.02,.02,.03,.05,.02,.08,.20,.10,.14,.02,.04,.01,.08,.01,.04,.02,.02,.01,.10,.01,.08],
 [.01,.02,.03,.03,.04,.02,.05,.10,.03,.08,.01,.05,.02,.02,.01,.08,.05,.12,.03,.18,.04,.07],
 [.04,.05,.05,.10,.12,.06,.18,.03,.03,.05,.01,.06,.01,.01,.01,.02,.01,.02,.01,.08,.03,.12],
 [.06,.06,.10,.18,.12,.14,.10,.01,.01,.02,.01,.03,.01,.01,.01,.01,.01,.01,.01,.04,.03,.02],
 [.02,.03,.03,.04,.06,.02,.08,.04,.03,.05,.01,.14,.03,.02,.01,.03,.01,.02,.01,.12,.08,.18]
];

export const EMOTION_MIX=RAW_MIX.map(row=>{
 const total=row.reduce((sum,v)=>sum+v,0)||1;
 return row.map(v=>v/total);
});

export function emotionMix(cluster){
 const row=EMOTION_MIX[Math.max(0,Math.min(EMOTION_MIX.length-1,cluster|0))];
 return Object.fromEntries(EMOTION_IDS.map((id,i)=>[id,row[i]]));
}

// 按加权计数取前 n 个小类，其余合并为“其他”。
export function topEmotions(counts,n=8){
 const list=EMOTION_IDS.map((id,i)=>({id,index:i,title:emotion(id).title,color:emotion(id).color,value:Math.max(0,Number(counts?.[id]||0))})).filter(e=>e.value>0).sort((a,b)=>b.value-a.value||a.index-b.index).map(({index,...e})=>e);
 if(list.length<=n)return list;
 const head=list.slice(0,n),rest=list.slice(n);
 return [...head,{id:'other',title:`其他 ${rest.length} 类`,color:'#b0bac0',value:rest.reduce((sum,e)=>sum+e.value,0)}];
}

export function dominantEmotion(counts){
 const list=EMOTION_IDS.map((id,i)=>({id,index:i,value:Math.max(0,Number(counts?.[id]||0))})).sort((a,b)=>b.value-a.value||a.index-b.index);
 return list[0]?.value>0?list[0].id:NEUTRAL_ID;
}
