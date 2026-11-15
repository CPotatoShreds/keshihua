import test from 'node:test';
import assert from 'node:assert/strict';
import {radiusFor,worldLayout,zoomAt,fitCamera} from '../src/bubble-world.js';
test('circle area preserves exposure ratios without minimums or caps',()=>{assert.equal(radiusFor(0),0);assert.ok(Math.abs(radiusFor(1e7)**2/radiusFor(2e6)**2-5)<1e-10);assert.equal(radiusFor(100000),100);assert.equal(radiusFor(400000),200);assert.ok(radiusFor(1e9)>1000);});
test('camera preserves cursor world position and relative radii',()=>{const c={k:.5,x:120,y:90},p={x:400,y:220},n=zoomAt(c,p,2);assert.equal((p.x-c.x)/c.k,(p.x-n.x)/n.k);assert.equal((p.y-c.y)/c.k,(p.y-n.y)/n.k);const nodes=worldLayout([{id:'a',r:1000},{id:'b',r:25},{id:'c',r:100}]);const f=fitCamera(nodes,800,400);assert.ok(f.k<1);assert.equal(nodes[0].r*f.k/(nodes[1].r*f.k),40);assert.ok(Math.hypot(nodes[0].x-nodes[1].x,nodes[0].y-nodes[1].y)>=1025);});

test('packing follows viewport aspect without changing bubble sizes',async()=>{
 const {packTopics}=await import('../src/bubble-world.js');
 const items=Array.from({length:12},(_,i)=>({id:String(i),r:100+i*12}));
 const ratio=ns=>(Math.max(...ns.map(n=>n.x+n.r))-Math.min(...ns.map(n=>n.x-n.r)))/(Math.max(...ns.map(n=>n.y+n.r))-Math.min(...ns.map(n=>n.y-n.r)));
 const wide=packTopics(items,2.8),tall=packTopics(items,.65);
 assert.ok(ratio(wide)>ratio(tall)*2);
 for(const nodes of [wide,tall])for(const a of nodes){
  assert.equal(a.r,items.find(n=>n.id===a.id).r);
  for(const b of nodes)if(a.id!==b.id)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r+178);
 }
 const camera=fitCamera(wide,1440,650);
 for(const n of wide){assert.ok((n.x-n.r)*camera.k+camera.x>=0);assert.ok((n.x+n.r)*camera.k+camera.x<=1440);assert.ok((n.y-n.r)*camera.k+camera.y>=0);assert.ok((n.y+n.r)*camera.k+camera.y<=650);}
});
test('small bubble callouts avoid circles and each other',async()=>{
 const {leaderLabels}=await import('../src/bubble-world.js');
 const nodes=[{id:'large',x:440,y:260,r:145,title:'主体'},{id:'a',x:220,y:170,r:20,title:'城市屋顶菜园'},{id:'b',x:200,y:270,r:15,title:'地铁站无障碍指引'},{id:'c',x:700,y:300,r:25,title:'老电影院重新开门'}];
 const labels=leaderLabels(nodes,1000,600);assert.equal(labels.length,3);
 for(const l of labels){
  const host=nodes.find(n=>n.id===l.id);assert.ok(Math.abs(Math.hypot(l.sx-host.x,l.sy-host.y)-host.r)<1e-8);
  for(const n of nodes){const x=Math.max(l.x,Math.min(l.x+l.width,n.x)),y=Math.max(l.y,Math.min(l.y+24,n.y));assert.ok(Math.hypot(x-n.x,y-n.y)>=n.r+7);}
  for(const other of labels)if(l.id!==other.id)assert.ok(l.x+l.width<=other.x||other.x+other.width<=l.x||l.y+24<=other.y||other.y+24<=l.y);
 }
});
