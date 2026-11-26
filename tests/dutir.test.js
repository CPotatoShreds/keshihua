import test from 'node:test';
import assert from 'node:assert/strict';
import {DUTIR,DUTIR_GROUPS,EMOTION_MIX,NEUTRAL_ID,EMOTION_IDS,topEmotions,dominantEmotion,emotionMix} from '../shared/dutir.js';

test('DUTIR has 21 subcategories plus a neutral bucket',()=>{
 assert.equal(DUTIR.length,22);
 assert.equal(DUTIR.filter(e=>e.id!==NEUTRAL_ID).length,21);
 assert.equal(new Set(DUTIR.map(e=>e.id)).size,22);
 assert.equal(new Set(DUTIR.map(e=>e.title)).size,22);
 const groups=new Set(DUTIR.map(e=>e.group));
 assert.equal(groups.size,8);
 assert.deepEqual([...groups],DUTIR_GROUPS.map(g=>g.id));
});

test('the five example emotions map to distinct DUTIR subcategories',()=>{
 const titles=new Set(['愤怒','快乐','祝愿','悲伤','尊敬']);
 assert.equal(titles.size,5);
 for(const title of titles)assert.ok(DUTIR.some(e=>e.title===title),title);
});

test('every opinion cluster has a normalized emotion distribution',()=>{
 assert.equal(EMOTION_MIX.length,5);
 for(const row of EMOTION_MIX){
  assert.equal(row.length,22);
  const total=row.reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(total-1)<1e-9,'sum='+total);
  assert.ok(row.every(v=>v>=0&&v<=1));
 }
 const mix=emotionMix(0);
 assert.deepEqual(Object.keys(mix),EMOTION_IDS);
 assert.ok(Math.abs(Object.values(mix).reduce((a,b)=>a+b,0)-1)<1e-9);
});

test('topEmotions keeps at most n real emotions and merges the rest',()=>{
 const counts=Object.fromEntries(EMOTION_IDS.map((id,i)=>[id,(i+1)*10]));
 const top=topEmotions(counts,8);
 assert.equal(top.length,9);
 assert.equal(top.at(-1).id,'other');
 assert.ok(top.at(-1).value>0);
 const all=topEmotions(counts,30);
 assert.equal(all.length,22);
 assert.ok(all.every(e=>e.id!=='other'));
 assert.equal(dominantEmotion(counts),'e21');
 assert.equal(dominantEmotion({}),NEUTRAL_ID);
});
