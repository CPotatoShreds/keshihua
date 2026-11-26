// Build the external corpus (default 7 days / 7M records).
// Usage:
//   node corpus/build.js                       full build
//   node corpus/build.js --days 1 --scale .05  quick dev build
//   node corpus/build.js --total 20000 --days 1 --out corpus/out-test
import path from 'node:path';
import {buildWindow, DEFAULT_OUT} from './generate.js';

const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;};
const days=Number(arg('days',7));
const total=Number(arg('total',7_000_000));
const scale=Number(arg('scale',1));
const seed=arg('seed','corpus-v1');
const outDir=path.resolve(arg('out',DEFAULT_OUT));
const maxTopics=Number(arg('max-topics',Infinity));

console.log(`[corpus] building ${(total*scale).toLocaleString('zh-CN')} records over ${days} day(s)`);
console.log(`[corpus] out: ${outDir}`);
const started=Date.now();
const manifest=buildWindow({
 end:Date.now(),
 days,total,scale,outDir,seed,maxTopics,
 log:line=>console.log(line)
});
const seconds=((Date.now()-started)/1000).toFixed(1);
console.log(`[corpus] done in ${seconds}s: ${manifest.total.toLocaleString('zh-CN')} records / ${manifest.topics.length} topics`);
console.log(`[corpus] posts ${manifest.counts.posts.toLocaleString('zh-CN')} · comments ${manifest.counts.comments.toLocaleString('zh-CN')} · replies ${manifest.counts.replies.toLocaleString('zh-CN')}`);
