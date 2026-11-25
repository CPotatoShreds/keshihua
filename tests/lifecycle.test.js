import test from 'node:test';
import assert from 'node:assert/strict';
import {instancesBetween,frameAt,eventsBetween,snapshot} from '../server/mock.js';
import {rateAt,aggregate,valuesAt} from '../shared/lifecycle.js';
import {STEP,DAY,RETENTION,MIN_VIEWS} from '../shared/catalog.js';
const now=1794571200000,topics=instancesBetween(now-RETENTION,now);
test('lifecycles span hours, days and weeks and are zero outside their support',()=>{
 const durations=topics.map(q=>q.endsAt-q.bornAt);assert.ok(Math.min(...durations)<DAY);assert.ok(Math.max(...durations)>=2*DAY);assert.ok(Math.max(...durations)<=4*DAY);
 for(const q of topics){for(const t of [q.bornAt-1,q.bornAt,q.endsAt,q.endsAt+DAY])assert.equal(rateAt(q,t),0);assert.ok(rateAt(q,q.bornAt+(q.endsAt-q.bornAt)*.3)>0);assert.equal(aggregate(q,q.endsAt+3600000,60).views,0);}
});
test('analytic integrated exposure agrees with independent numerical integration',()=>{
 for(const q of topics.slice(0,6)){
  const from=q.bornAt,to=q.endsAt,steps=8000,dt=(to-from)/steps;let numeric=0;
  for(let i=0;i<steps;i++)numeric+=rateAt(q,from+(i+.5)*dt)*dt/60000;
  const exact=aggregate(q,to,(to-from)/60000).views;assert.ok(Math.abs(exact-numeric)/exact<.00001);
  const sum=aggregate(q,to,(to-from)/60000).counts.reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-exact*q.discussionRatio)/sum<1e-9);
 }
});
test('wire frames and arbitrary historical sampling use the same deterministic model',()=>{
 const frame=frameAt(Math.floor(now/STEP));for(const q of topics){if(!(q.id in frame.values))continue;const v=valuesAt(q,frame.time),wire=frame.values[q.id];assert.ok(Math.abs(v.views-wire.views)<=.0051);for(const period of ['m5','h1'])v.counts[period].forEach((c,i)=>assert.ok(Math.abs(c-wire.counts[period][i])<=.5001));}
 const q=topics.at(-3),t=q.bornAt+(q.endsAt-q.bornAt)*.2;assert.deepEqual(valuesAt(q,t),valuesAt(q,t));assert.ok(Math.abs(rateAt(q,t+1)-rateAt(q,t))<q.amplitude*.001);
});
test('concurrent topic count stays inside a readable band',()=>{
 for(let i=0;i<12;i++){
  const t=now-7*DAY+i*(7*DAY/12),active=instancesBetween(t,t).filter(q=>q.bornAt<=t&&q.endsAt>=t).length;
  assert.ok(active>=6&&active<=30,`${active} concurrent at ${new Date(t).toISOString()}`);
 }
});
test('snapshot excludes future topic births and events and stays within a bounded payload',()=>{
 const data=snapshot(now);assert.ok(data.topics.every(q=>q.bornAt<=now));assert.ok(data.events.every(e=>e.time<=now));assert.ok(Object.values(data.frames.at(-1).values).filter(v=>v.views>0).length>=8);assert.ok(Buffer.byteLength(JSON.stringify(data))<7_000_000);
 const active=data.topics.filter(q=>q.bornAt<=now&&q.endsAt>=now);assert.ok(active.length>=8&&active.length<=30);
 for(const q of data.topics.filter((_,i)=>i%25===0))assert.ok(aggregate(q,q.endsAt,(q.endsAt-q.bornAt)/60000).views>=MIN_VIEWS*.999);
 assert.ok(Math.max(...data.topics.map(q=>q.amplitude))<2_000_000);
 for(const q of data.topics){const before=q.bornAt+(q.endsAt-q.bornAt)*.1;assert.ok(eventsBetween(q.bornAt,before,[q]).every(e=>e.time<=before));}
});
