import test from 'node:test';
import assert from 'node:assert/strict';
import {detailViewport} from '../src/live.js';
import {STEP} from '../shared/catalog.js';
test('detail auto view anchors the first event while the right edge follows fractional playback time',()=>{
 const birth=100000;
 const a=detailViewport(birth,130123,0,180000),b=detailViewport(birth,130139.67,0,180000);
 assert.equal(a.start,birth);assert.equal(b.start,birth);assert.equal(a.end,130123);assert.equal(b.end,130139.67);
 assert.ok(b.span>a.span);assert.deepEqual(detailViewport(birth,130123,0,190000),a,'paused view must not drift as new data arrives');
});
test('detail click freezes the entire window; manual range, retention and birth boundaries stay valid',()=>{
 const before=detailViewport(100000,160000,0,180000);
 assert.deepEqual(detailViewport(100000,130000,0,190000,'auto',{end:before.end,span:before.span}),before);
 const reset=detailViewport(100000,130000,0,190000);assert.equal(reset.start,100000);assert.equal(reset.end,130000);
 const narrow=detailViewport(100000,160000,0,190000,15000);assert.equal(narrow.start,145000);
 const young=detailViewport(100000,102000,0,103000);assert.equal(young.start,100000);assert.equal(young.span,STEP);
 const prebirth=detailViewport(100000,90000,0,160000);assert.equal(prebirth.start,100000);assert.ok(prebirth.span>0);
 const expired=detailViewport(100000,180000,120000,190000);assert.equal(expired.start,120000);assert.ok(expired.truncated);
});
