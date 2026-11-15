import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,delta,frameAt,aggregate,instancesBetween,eventsBetween} from '../server/mock.js';
import {api} from '../server/api.js';
import {mergeFeed,sampleAt,stepPlayer,clampViewport,matching,wordsFor} from '../src/live.js';
import {STEP,RETENTION,LIFE,INTERVAL,templates} from '../shared/catalog.js';
const now=1794571200000,base=snapshot(now),q=base.topics.at(-4);
test('topics have unique story identities, ordered non-repeating events and a finite lifecycle',()=>{
 assert.equal(templates.length,24);const events=eventsBetween(q.bornAt,q.endsAt,[q]);assert.equal(events.length,5);assert.equal(new Set(events.map(e=>e.title)).size,5);assert.ok(events.every((e,i)=>i===0||e.time>events[i-1].time));assert.equal(aggregate(q,q.bornAt-1).views,0);assert.equal(aggregate(q,q.endsAt+300000).views,0);assert.ok(q.title.includes(' · '));assert.ok(aggregate(q,q.bornAt+(q.endsAt-q.bornAt)*.3).views>0);
});
test('one-hour totals integrate raw rates rather than summing overlapping windows',()=>{
 const t=q.bornAt+(q.endsAt-q.bornAt)*.6,total=aggregate(q,t,60),parts=Array.from({length:12},(_,i)=>aggregate(q,t-i*5*60000,5));
 assert.ok(Math.abs(total.views-parts.reduce((s,v)=>s+v.views,0))<=6);for(let j=0;j<5;j++)assert.ok(Math.abs(total.counts[j]-parts.reduce((s,v)=>s+v.counts[j],0))<=6);
});
test('responses and new evidence shift mainstream views',()=>{
 const life=q.endsAt-q.bornAt,early=aggregate(q,q.bornAt+life*.1),late=aggregate(q,q.bornAt+life*.9);assert.ok(early.counts[2]>early.counts[3]);assert.ok(late.counts[3]>late.counts[2]);
});
test('historical samples remain reproducible when new topics appear',()=>{
 const a=frameAt(Math.floor(now/STEP)),b=snapshot(now+STEP);assert.deepEqual(a,b.frames.at(-2));assert.equal(base.frames.at(-1).time-base.frames[0].time,RETENTION);assert.ok(base.frames.length<5000);assert.ok(base.frames.every(f=>Object.keys(f.values).every(id=>base.topics.some(q=>q.id===id))));
});
test('reconnect recovers newly born topic metadata and events',()=>{
 const boundary=instancesBetween(now,now+3*INTERVAL).find(q=>q.bornAt>now).bornAt,first=snapshot(boundary-STEP),message=delta(first.frames.at(-1).seq,boundary+STEP);assert.equal(message.type,'frames');assert.ok(message.payload.topics.some(q=>q.bornAt===boundary));
 const data=mergeFeed(mergeFeed(null,first,true),message.payload),full=snapshot(boundary+STEP);assert.deepEqual(data.frames.at(-1),full.frames.at(-1));assert.deepEqual(data.events,full.events);assert.deepEqual(data.topics,full.topics);
 assert.equal(delta(0,now).type,'snapshot');assert.equal(delta(Math.floor(now/STEP)+1,now).type,'snapshot');
});
test('duplicate and out-of-order packets cannot double count or rewind live edge',()=>{
 const s=mergeFeed(null,base,true),message=delta(base.frames.at(-1).seq,now+STEP*3).payload;const a=mergeFeed(s,message),b=mergeFeed(a,message);assert.deepEqual(a.frames,b.frames);assert.deepEqual(a.events,b.events);assert.ok(b.frames.length<5000);const c=mergeFeed(b,{frames:[base.frames[0]]});assert.equal(c.frames.at(-1).time,now+STEP*3);
});
test('all views interpolate the same two source samples, including a topic birth',()=>{
 const t=q.bornAt,a=frameAt(t/STEP),b=frameAt(t/STEP+1),s=sampleAt([a,b],t+STEP/2),v=s.values[q.id];assert.equal(v.views,((a.values[q.id]?.views||0)+b.values[q.id].views)/2);for(const k of ['m5','h1'])for(let j=0;j<5;j++)assert.equal(v.counts[k][j],((a.values[q.id]?.counts[k][j]||0)+b.values[q.id].counts[k][j])/2);
});
test('a selected moment stays fixed while live mode follows the edge and retention boundary',()=>{
 const p={time:100000,mode:'manual'};assert.equal(stepPlayer(p,200000,0).time,100000);assert.equal(stepPlayer(p,200000,120000).time,120000);assert.deepEqual(stepPlayer({time:100000,mode:'live'},200000,0),{time:200000,mode:'live'});
});
test('viewport stays separate from the selected moment and clamps at available history',()=>{assert.equal(clampViewport(400,100,0,1000),400);assert.equal(clampViewport(400,100,0,1100),400);assert.equal(clampViewport(20,100,0,1000),100);assert.equal(clampViewport(1100,100,0,1000),1000);});
test('search and word filtering follow the selected topic and opinion',()=>{
 const q=templates[0],words=wordsFor(q,[100,50,25,10,5],0);assert.ok(matching(q,'音乐节 补偿'));assert.ok(!matching(q,'不存在'));assert.ok(words.every(w=>q.clusters[0].words.includes(w.word)));assert.equal(words.length,3);assert.equal(wordsFor(q,[0,0,0,0,0]).length,0);
});
test('SSE sends a second timed packet and resumes by Last-Event-ID',async()=>{
 const seq=Math.floor(Date.now()/STEP),response=api(new Request('http://demo/api/stream?since=0',{headers:{'Last-Event-ID':String(seq-2)}})),reader=response.body.getReader(),decode=v=>new TextDecoder().decode(v);assert.match(response.headers.get('content-type'),/text\/event-stream/);await reader.read();const first=decode((await reader.read()).value),second=decode((await reader.read()).value);assert.match(first,/event: frames/);assert.ok(Number(second.match(/id: (\d+)/)[1])>Number(first.match(/id: (\d+)/)[1]));await reader.cancel();
});
