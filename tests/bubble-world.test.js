import test from 'node:test';
import assert from 'node:assert/strict';
import {radiusFor,packTopics,compactTargets,approachLayout,leaderLabels,zoomAt,fitCamera} from '../src/bubble-world.js';
const bounds=ns=>({w:Math.max(...ns.map(n=>n.x+n.r))-Math.min(...ns.map(n=>n.x-n.r)),h:Math.max(...ns.map(n=>n.y+n.r))-Math.min(...ns.map(n=>n.y-n.r))});
test('circle area preserves exposure ratios without minimums or caps',()=>{assert.equal(radiusFor(0),0);assert.ok(Math.abs(radiusFor(1e7)**2/radiusFor(2e6)**2-5)<1e-10);assert.equal(radiusFor(100000),100);assert.equal(radiusFor(400000),200);assert.ok(radiusFor(1e9)>1000);});
test('camera preserves cursor world position and relative radii',()=>{const c={k:.5,x:120,y:90},p={x:400,y:220},n=zoomAt(c,p,2);assert.equal((p.x-c.x)/c.k,(p.x-n.x)/n.k);assert.equal((p.y-c.y)/c.k,(p.y-n.y)/n.k);const nodes=packTopics([{id:'a',r:1000},{id:'b',r:25},{id:'c',r:100}]);const f=fitCamera(nodes,800,400);assert.ok(f.k<1);assert.equal(nodes.find(q=>q.id==='a').r/nodes.find(q=>q.id==='b').r,40);});
test('current-radius packing is compact, nonoverlapping and follows viewport aspect',()=>{
 const items=Array.from({length:12},(_,i)=>({id:String(i),r:100+i*12}));
 const wide=packTopics(items,2.8),tall=packTopics(items,.65),a=bounds(wide),b=bounds(tall);
 assert.ok(a.w/a.h>b.w/b.h*2);
 for(const nodes of [wide,tall])for(const n of nodes){assert.equal(n.r,items.find(q=>q.id===n.id).r);for(const q of nodes)if(q.id!==n.id)assert.ok(Math.hypot(q.x-n.x,q.y-n.y)>=q.r+n.r+24);}
 const equal=packTopics(Array.from({length:8},(_,i)=>({id:String(i),r:100})),2),box=bounds(equal);
 assert.ok(equal.length*Math.PI*100**2/(box.w*box.h)>.4);
});
test('local relaxation closes obsolete peak-sized gaps without changing current radii',()=>{
 const large=packTopics(Array.from({length:8},(_,i)=>({id:String(i),r:300})),2);
 let small=large.map(n=>({...n,r:60}));const before=bounds(small);
 for(let i=0;i<8;i++)small=compactTargets(small,2);
 const after=bounds(small);assert.ok(after.w*after.h<before.w*before.h*.35);
 for(const a of small){assert.equal(a.r,60);for(const b of small)if(a.id!==b.id)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r+20);}
});
test('new topics keep retained coordinates; scrubbing holds centers while radius changes',()=>{
 const initial=packTopics([{id:'a',r:100},{id:'b',r:80}],2),old=new Map(initial.map(n=>[n.id,n]));
 const next=packTopics([...initial.map(n=>({...n,r:n.r*1.3})),{id:'c',r:50}],2,old);
 for(const n of initial){const p=next.find(q=>q.id===n.id);assert.equal(p.x,n.x);assert.equal(p.y,n.y);}
 const held=approachLayout(next,compactTargets(next,2),.05,.5,true);assert.deepEqual(held,next);
});
test('motion is speed limited and similar across frame rates, without overshoot',()=>{
 const initial=[{id:'a',x:0,y:0,r:50}],target=[{id:'a',x:400,y:150,r:50}];
 const simulate=fps=>{let ns=initial;for(let i=0;i<fps*2;i++){const next=approachLayout(ns,target,1/fps,.5);assert.ok(Math.hypot(next[0].x-ns[0].x,next[0].y-ns[0].y)*.5<=72/fps+1e-8);ns=next;}return ns[0];};
 const a=simulate(30),b=simulate(120);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<2);assert.ok(a.x>0&&a.x<400);
});
test('nearby bookmarks avoid circles and cards and retain direction during small changes',()=>{
 const nodes=[{id:'large',x:500,y:300,r:130,title:'主体'},{id:'a',x:300,y:170,r:20,title:'城市屋顶菜园'},{id:'b',x:260,y:350,r:15,title:'地铁站无障碍指引'},{id:'c',x:740,y:250,r:25,title:'老电影院重新开门'}];
 const first=leaderLabels(nodes,1000,650);assert.equal(first.length,3);
 const next=leaderLabels(nodes.map(n=>({...n,x:n.x+2})),1000,650,new Map(first.map(l=>[l.id,l])));
 for(const l of first){assert.ok(l.distance<=80);assert.equal(Math.abs(l.ex-l.endX),14);assert.equal(l.angle,next.find(n=>n.id===l.id).angle);assert.equal(l.height,l.lines.length>1?48:36);
  const host=nodes.find(n=>n.id===l.id);assert.ok(Math.abs(Math.hypot(l.sx-host.x,l.sy-host.y)-host.r)<1e-8);
  for(const n of nodes){const x=Math.max(l.x,Math.min(l.x+l.width,n.x)),y=Math.max(l.y,Math.min(l.y+l.height,n.y));assert.ok(Math.hypot(x-n.x,y-n.y)>=n.r+6);}
  for(const other of first)if(l.id!==other.id)assert.ok(l.x+l.width<=other.x||other.x+other.width<=l.x||l.y+l.height<=other.y||other.y+other.height<=l.y);
 }
});
test('label threshold hysteresis and narrow screen bounds',()=>{
 const q={id:'a',x:190,y:240,r:41,title:'一个很长很长的话题名称'};const first=leaderLabels([q],390,650);assert.equal(first.length,1);
 const memory=new Map(first.map(l=>[l.id,l]));assert.equal(leaderLabels([{...q,r:45}],390,650,memory).length,1);assert.equal(leaderLabels([{...q,r:49}],390,650,memory).length,0);
 for(const l of first){assert.ok(l.x>=10&&l.x+l.width<=380);assert.ok(l.y>=90&&l.y+l.height<=596);}
});

test('an unchanged scene settles instead of orbiting or jittering forever',()=>{
 let nodes=packTopics(Array.from({length:8},(_,i)=>({id:String(i),r:100})),2),targets=nodes,before;
 for(let i=0;i<1800;i++){if(i%11===0)targets=compactTargets(nodes,2);if(i===1680)before=nodes;nodes=approachLayout(nodes,targets,1/60,.5);}
 assert.ok(Math.max(...nodes.map((n,i)=>Math.hypot(n.x-before[i].x,n.y-before[i].y)*.5))<1);
});
