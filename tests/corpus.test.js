import test from 'node:test';
import assert from 'node:assert/strict';
import {instancesBetween} from '../server/mock.js';
import {aggregate} from '../shared/lifecycle.js';
import {corpusFor,corpusTexts,corpusWords,clearCorpusCache} from '../shared/corpus.js';
import {buildWordTree,countTreeNodes} from '../shared/word-tree.js';
const now=1794571200000,topic=instancesBetween(now-30*86400000,now-30*86400000)[0],time=topic.bornAt+(topic.endsAt-topic.bornAt)*.5;
test('simulated corpus is deterministic, proportional and filterable',()=>{
 clearCorpusCache();
 const a=corpusFor(topic,time),b=corpusFor(topic,time);assert.deepEqual(a,b);assert.ok(a.length>300);
 const counts=aggregate(topic,time,60).counts,total=counts.reduce((x,y)=>x+y,0);
 for(let j=0;j<5;j++){
  const share=a.filter(t=>t.cluster===j).length/a.length,expected=counts[j]/total;
  assert.ok(Math.abs(share-expected)<.06,`cluster ${j}: ${share} vs ${expected}`);
 }
 const selected=corpusTexts(a,0);assert.ok(selected.length>20&&selected.every(t=>t.cluster===0));
 const words=corpusWords(a,0);assert.ok(words.length>3);assert.ok(words.every(w=>w.value>0));
 assert.ok(words.some(w=>topic.clusters[0].words.includes(w.word)));
 for(const text of a.slice(0,20))assert.ok(text.tokens.some(token=>text.keywords.includes(token)));
});
test('word tree is a deterministic, pruned bidirectional trie from the corpus',()=>{
 const a=corpusFor(topic,time),words=corpusWords(a,0),root=words.find(w=>w.word.length>1)?.word;
 assert.ok(root);
 const texts=corpusTexts(a,0),tree=buildWordTree(texts,root),again=buildWordTree(texts,root);
 assert.deepEqual(tree,again);assert.ok(tree.count>0);assert.ok(tree.left&&tree.right);
 assert.ok(countTreeNodes(tree.left)<=31);assert.ok(countTreeNodes(tree.right)<=31);
 const nodes=[];const walk=n=>{nodes.push(n);n.children.forEach(walk);};tree.left&&walk(tree.left);tree.right&&walk(tree.right);
 assert.ok(nodes.length>0);for(const n of nodes)assert.ok(n.count>=3);for(const n of nodes)assert.ok(n.children.length<=5);
});
