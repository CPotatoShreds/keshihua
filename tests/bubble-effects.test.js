import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBirth,dropletAt} from '../src/bubble-geometry.js';

test('droplets grow continuously from zero and finish inside their host',()=>{
 let previous={r:0,distance:Infinity};
 for(let i=0;i<=100;i++){
  const p=dropletAt(i/100,100,120,9);
  assert.ok(p.r>=previous.r&&p.distance<=previous.distance);
  assert.ok(Number.isFinite(p.r)&&Number.isFinite(p.distance));previous=p;
 }
 assert.equal(dropletAt(0,100,120,9).r,0);
 assert.ok(previous.distance+previous.r<100);
});
test('droplet birth rejects both crowded origins and obstructed approach paths',()=>{
 const host={id:'host',x:300,y:300,r:70};
 assert.ok(safeBirth(host,[host],1000,700,0,150));
 assert.equal(safeBirth(host,[host,{id:'neighbor',x:530,y:300,r:30}],1000,700,0,150),null);
 assert.equal(safeBirth(host,[host,{id:'obstacle',x:420,y:300,r:22}],1000,700,0,150),null);
 assert.equal(safeBirth(host,[host],1000,700,-Math.PI/2,250),null);
});
