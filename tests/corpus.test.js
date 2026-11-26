import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {buildWindow,aggregateRecords,generateTopic} from '../corpus/generate.js';
import {publicRecord,validateRecord} from '../corpus/schema.js';
import {instance} from '../shared/topics.js';
import {buildWordTree,countTreeNodes} from '../shared/word-tree.js';

const END=Date.UTC(2026,10,25,12,0,0);
const OUT=path.join(os.tmpdir(),'guanchao-corpus-'+process.pid);

test.after(()=>{try{fs.rmSync(OUT,{recursive:true,force:true});}catch{}});

test('corpus build produces three-layer records with consistent parents and counts',()=>{
 const manifest=buildWindow({end:END,days:1,total:3000,maxTopics:4,outDir:OUT,seed:'test',log:()=>{}});
 assert.ok(manifest.topics.length>0);
 assert.ok(manifest.total>0);
 assert.ok(manifest.counts.posts>0&&manifest.counts.comments>0);
 assert.ok(fs.existsSync(path.join(OUT,'aggregates/hourly.ndjson')));
 const entry=manifest.topics[0],topic=instance(entry.slot);
 const lines=zlib.gunzipSync(fs.readFileSync(path.join(OUT,entry.file))).toString().trim().split('\n').map(JSON.parse);
 assert.ok(lines.length>0);
 const posts=new Map(lines.filter(r=>r.layer==='post').map(p=>[p.id,p]));
 const comments=new Map(lines.filter(r=>r.layer==='comment').map(c=>[c.id,c]));
 for(const record of lines){
  assert.deepEqual(validateRecord(record,topic),[],record.id);
  assert.ok(record.weight>=0&&record.weight<=100,record.id);
  if(record.layer==='post')assert.equal(posts.has(record.id),true);
  if(record.layer==='comment'){assert.equal(posts.has(record.parentId),true);assert.equal(record.rootId,record.parentId);}
  if(record.layer==='reply'){assert.equal(comments.has(record.parentId),true);assert.equal(record.rootId,comments.get(record.parentId).rootId);}
 }
 const commentCounts=new Map();
 for(const c of lines.filter(r=>r.layer==='comment'))commentCounts.set(c.parentId,(commentCounts.get(c.parentId)||0)+1);
 for(const post of posts.values())assert.equal(post.metrics.comments,commentCounts.get(post.id)||0);
 const replyCounts=new Map();
 for(const r of lines.filter(r=>r.layer==='reply'))replyCounts.set(r.parentId,(replyCounts.get(r.parentId)||0)+1);
 for(const comment of comments.values())assert.equal(comment.metrics.replies,replyCounts.get(comment.id)||0);
 assert.ok(new Set(lines.map(r=>r.emotion)).size>=5);
});

test('aggregate buckets conserve weighted and raw counts',()=>{
 const topic=instance(5205);
 const lines=generateTopic(topic,800,{seed:'test'});
 const rows=aggregateRecords(lines);
 const weighted=[0,0,0,0,0],raw=[0,0,0,0,0];
 for(const row of rows){row.weighted.forEach((v,i)=>weighted[i]+=v);row.raw.forEach((v,i)=>raw[i]+=v);}
 for(let i=0;i<5;i++){
  const expectedWeight=lines.filter(r=>r.cluster===i).reduce((sum,r)=>sum+r.weight,0);
  const expectedRaw=lines.filter(r=>r.cluster===i).length;
  assert.ok(Math.abs(weighted[i]-expectedWeight)<1e-6);
  assert.equal(raw[i],expectedRaw);
 }
 const emotionTotal=Object.values(rows.reduce((acc,row)=>{for(const [id,v] of Object.entries(row.emotions))acc[id]=(acc[id]||0)+v;return acc;},{})).reduce((a,b)=>a+b,0);
 const weightTotal=lines.reduce((sum,r)=>sum+r.weight,0);
 assert.ok(Math.abs(emotionTotal-weightTotal)<1e-6);
});

test('generation is deterministic and public records hide impressions',()=>{
 const topic=instance(5205);
 const a=generateTopic(topic,300,{seed:'test'});
 const b=generateTopic(topic,300,{seed:'test'});
 assert.deepEqual(a,b);
 const withImpressions=a.filter(r=>r.layer!=='post');
 assert.ok(withImpressions.length>0);
 for(const record of withImpressions.slice(0,20)){
  const pub=publicRecord(record);
  assert.equal('impressions' in pub.metrics,false);
  assert.equal('position' in pub.metrics,false);
  assert.equal(pub.text,record.text);
 }
});

test('word tree stays a deterministic, pruned bidirectional trie on corpus tokens',()=>{
 const topic=instance(5205);
 const lines=generateTopic(topic,600,{seed:'test'});
 const cluster=lines.filter(r=>r.cluster===2&&r.layer==='comment');
 const root=cluster.flatMap(r=>r.keywords).find(w=>w&&w.length>=2);
 assert.ok(root);
 const tree=buildWordTree(cluster,root),again=buildWordTree(cluster,root);
 assert.deepEqual(tree,again);
 assert.ok(tree.count>0);
 assert.ok(tree.left&&tree.right);
 assert.ok(countTreeNodes(tree.left)<=31);
 assert.ok(countTreeNodes(tree.right)<=31);
 const nodes=[];const walk=n=>{nodes.push(n);n.children.forEach(walk);};tree.left&&walk(tree.left);tree.right&&walk(tree.right);
 assert.ok(nodes.length>0);
 for(const node of nodes){assert.ok(node.count>=3);assert.ok(node.children.length<=5);}
});
