import test from 'node:test';
import assert from 'node:assert/strict';
import {radiusFor,worldLayout,zoomAt,fitCamera} from '../src/bubble-world.js';
test('circle area preserves exposure ratios without minimums or caps',()=>{assert.equal(radiusFor(0),0);assert.ok(Math.abs(radiusFor(1e7)**2/radiusFor(2e6)**2-5)<1e-10);assert.equal(radiusFor(100000),100);assert.equal(radiusFor(400000),200);assert.ok(radiusFor(1e9)>1000);});
test('camera preserves cursor world position and relative radii',()=>{const c={k:.5,x:120,y:90},p={x:400,y:220},n=zoomAt(c,p,2);assert.equal((p.x-c.x)/c.k,(p.x-n.x)/n.k);assert.equal((p.y-c.y)/c.k,(p.y-n.y)/n.k);const nodes=worldLayout([{id:'a',r:1000},{id:'b',r:25},{id:'c',r:100}]);const f=fitCamera(nodes,800,400);assert.ok(f.k<1);assert.equal(nodes[0].r*f.k/(nodes[1].r*f.k),40);assert.ok(Math.hypot(nodes[0].x-nodes[1].x,nodes[0].y-nodes[1].y)>=1025);});
