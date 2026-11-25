import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudLayout,cloudInCircle} from '../src/spatial-layout.js';
import {instancesBetween,frameAt} from '../server/mock.js';
import {templates,STEP} from '../shared/catalog.js';
test('circular word cloud keeps every word horizontal inside the circle',()=>{
 const words=['交通','住宿','补偿','退款','到账','时间','信息披露','主办方','知情权','安全','现场','天气','安排','回应','后续'].map((word,i)=>({word,value:60-i*3}));
 const measure=(text,size)=>text.length*size*.62,p=cloudInCircle(words,320,320,185,measure);
 assert.equal(p.length,words.length);assert.deepEqual(p,cloudInCircle(words,320,320,185,measure));
 for(const n of p){
  assert.equal(n.rotate,0);
  for(const sx of [-1,1])for(const sy of [-1,1])assert.ok(Math.hypot(n.x-320+sx*n.bw/2,n.y-320+sy*n.bh/2)<=185+1e-9);
  for(const m of p)if(m!==n)assert.ok(Math.abs(n.x-m.x)>=(n.bw+m.bw)/2||Math.abs(n.y-m.y)>=(n.bh+m.bh)/2);
 }
});
test('spiral word packing fits all topics and filters without overlapping reserved glyph bounds',()=>{
 for(const topic of templates)for(const selected of [null,0])for(const [w,h] of [[1230,210],[326,300]]){
  const words=topic.clusters.filter((c,j)=>selected===null||j===selected).flatMap(c=>c.words.map(word=>({word}))),p=cloudLayout(words,w,h,(t,s)=>t.length*s);
  assert.equal(p.length,words.length);assert.deepEqual(p,cloudLayout(words,w,h,(t,s)=>t.length*s));
  for(const n of p)assert.ok(n.x-n.bw/2>=0&&n.x+n.bw/2<=w&&n.y-n.bh/2>=0&&n.y+n.bh/2<=h);
  for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)assert.ok(Math.abs(p[i].x-p[j].x)>=(p[i].bw+p[j].bw)/2||Math.abs(p[i].y-p[j].y)>=(p[i].bh+p[j].bh)/2);
 }
});
