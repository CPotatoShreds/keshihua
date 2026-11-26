import test from 'node:test';
import assert from 'node:assert/strict';
import {textWeight,weightBreakdown,interactionRate,sampleSize,wordContribution,LAYERS} from '../shared/weight.js';

test('post weight is bounded and monotone in likes',()=>{
 const base={views:1_000_000,reposts:1000,comments:2000};
 const low=textWeight('post',{...base,likes:10_000});
 const mid=textWeight('post',{...base,likes:25_000});
 const high=textWeight('post',{...base,likes:60_000});
 assert.ok(low>=0&&low<=100);
 assert.ok(mid>low);
 assert.ok(high>mid);
 assert.ok(high<=100);
});

test('invalid or empty post samples get zero weight',()=>{
 assert.equal(textWeight('post',{}),0);
 assert.equal(textWeight('post',{views:0,likes:10}),0);
 assert.equal(weightBreakdown('post',{}).sufficient,false);
});

test('comment weight shrinks small samples toward the prior',()=>{
 const small=weightBreakdown('comment',{impressions:10,likes:0,replies:0});
 const large=weightBreakdown('comment',{impressions:100_000,likes:0,replies:0});
 assert.ok(small.relative>large.relative);
 assert.ok(small.weight>large.weight);
 assert.equal(small.sufficient,false);
 assert.equal(large.sufficient,true);
 assert.ok(large.weight<=100);
});

test('more impressions at a fixed like count lowers the comment weight',()=>{
 const shallow=textWeight('comment',{impressions:200,likes:8,replies:1});
 const deep=textWeight('comment',{impressions:20_000,likes:8,replies:1});
 assert.ok(shallow>deep);
});

test('reply bonus raises weight but cannot dominate the like rate',()=>{
 const noReply=weightBreakdown('comment',{impressions:5000,likes:30,replies:0});
 const many=weightBreakdown('comment',{impressions:5000,likes:30,replies:12});
 assert.ok(many.rate>noReply.rate);
 assert.ok(many.rate<noReply.rate+.02);
});

test('layer coefficients order identical relative engagement',()=>{
 const p=textWeight('post',{views:1000,likes:20,reposts:0,comments:0});
 const c=textWeight('comment',{impressions:1000,likes:6,replies:0});
 const r=textWeight('reply',{impressions:1000,likes:6,replies:0});
 assert.ok(p>=c&&c>=r);
 assert.equal(p,50);
 assert.equal(c,43);
 assert.equal(r,35);
 assert.equal(LAYERS.post.coef,1);
 assert.equal(LAYERS.comment.coef,.85);
 assert.equal(LAYERS.reply.coef,.7);
});

test('sampleSize follows the layer denominator',()=>{
 assert.equal(sampleSize('post',{views:123}),123);
 assert.equal(sampleSize('comment',{impressions:45}),45);
 assert.equal(sampleSize('reply',{}),0);
});

test('word contribution keeps a floor and a ceiling',()=>{
 assert.equal(wordContribution(0),1);
 assert.equal(wordContribution(50),2);
 assert.equal(wordContribution(100),3);
 assert.equal(wordContribution(-10),1);
});

test('interaction rate uses the post formula',()=>{
 const rate=interactionRate('post',{views:1000,likes:10,reposts:5,comments:10});
 assert.equal(rate,(10+10+15)/1000);
});
