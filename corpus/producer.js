// External corpus producer. This process is intentionally separate from the
// system: it owns the full synthetic text store and exposes a replay feed.
// Run: node corpus/producer.js [--port 5400] [--dir corpus/out]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
import zlib from 'node:zlib';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;};
const PORT=Number(arg('port',process.env.CORPUS_PORT||5400));
const DIR=path.resolve(arg('dir',process.env.CORPUS_DIR||path.join(HERE,'out')));
const START_FROM_NOW=Number(arg('start',10))*60000;

function readManifest(){
 const file=path.join(DIR,'manifest.json');
 if(!fs.existsSync(file))throw new Error(`corpus manifest missing: ${file}\nrun: npm run corpus:build`);
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
let manifest=readManifest();
let hourlyRows=null,fiveMinuteRows=null;
const state={paused:false,speed:Number(arg('speed',1)),subscribers:0,seekFrom:null,reset:0,startedAt:Date.now(),lastRecordAt:0};

function loadHourly(){
 if(hourlyRows)return hourlyRows;
 const file=path.join(DIR,'aggregates/hourly.ndjson');
 hourlyRows=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 return hourlyRows;
}
function loadFiveMinute(){
 if(fiveMinuteRows)return fiveMinuteRows;
 const file=path.join(DIR,'aggregates/by5m.ndjson');
 fiveMinuteRows=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 return fiveMinuteRows;
}

const textCache=new Map();
async function loadTopic(entry){
 if(textCache.has(entry.slot))return textCache.get(entry.slot);
 const file=path.join(DIR,entry.file);
 const body=zlib.gunzipSync(fs.readFileSync(file)).toString().trim();
 const records=body?body.split('\n').map(JSON.parse):[];
 if(textCache.size>=3)textCache.delete(textCache.keys().next().value);
 textCache.set(entry.slot,records);
 return records;
}

function openCursor(entry){
 const file=path.join(DIR,entry.file);
 const raw=createReadStream(file);
 const gunzip=zlib.createGunzip();
 const rl=readline.createInterface({input:raw.pipe(gunzip),crlfDelay:Infinity});
 const iterator=rl[Symbol.asyncIterator]();
 let closed=false;
 return {
  async next(){
   if(closed)return null;
   const {value,done}=await iterator.next();
   if(done){this.close();return null;}
   try{return JSON.parse(value);}catch{return null;}
  },
  close(){
   if(closed)return;closed=true;
   try{rl.close();}catch{}
   try{raw.destroy();}catch{}
  }
 };
}

class MinHeap{
 constructor(cmp){this.a=[];this.cmp=cmp;}
 get size(){return this.a.length;}
 peek(){return this.a[0];}
 push(x){const a=this.a;a.push(x);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(this.cmp(a[i],a[p])>=0)break;[a[i],a[p]]=[a[p],a[i]];i=p;}}
 pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<a.length&&this.cmp(a[l],a[m])<0)m=l;if(r<a.length&&this.cmp(a[r],a[m])<0)m=r;if(m===i)break;[a[i],a[m]]=[a[m],a[i]];i=m;}}return top;}
}

const byTime=(a,b)=>a.record.time-b.record.time||a.record.id.localeCompare(b.record.id);

async function feed(req,res,url){
 const now=Date.now();
 const requested=Number(url.searchParams.get('from'));
 const from=Math.max(manifest.windowStart,Math.min(Number.isFinite(requested)&&requested>0?requested:Math.max(manifest.windowStart,now-START_FROM_NOW),manifest.windowEnd));
 const speed=Math.max(.01,Number(url.searchParams.get('speed'))||state.speed);
 let catchup=url.searchParams.get('catchup')==='1';
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});
 const ready={from,speed,windowStart:manifest.windowStart,windowEnd:manifest.windowEnd,topics:manifest.topics.length};
 res.write(`event: ready\ndata: ${JSON.stringify(ready)}\n\n`);
 state.subscribers++;
 const heap=new MinHeap(byTime);
 const opened=new Set(),cursors=new Set();
 let alive=true;
 const closeAll=()=>{if(!alive)return;alive=false;state.subscribers=Math.max(0,state.subscribers-1);for(const c of cursors)c.close();cursors.clear();};
 const openTopic=async entry=>{
  if(!entry||opened.has(entry.slot))return;
  opened.add(entry.slot);
  const cursor=openCursor(entry);
  cursors.add(cursor);
  let record=await cursor.next();
  while(record&&record.time<from)record=await cursor.next();
  if(record)heap.push({cursor,record,slot:entry.slot});else{cursors.delete(cursor);cursor.close();}
 };
 const boot=async()=>{
  for(const entry of manifest.topics)if(entry.bornAt<=from&&entry.endsAt>=from)await openTopic(entry);
 };
 await boot();
 let startReal=Date.now(),simFrom=from,resetToken=state.reset,lastPing=Date.now();
 const timer=setInterval(async()=>{
  if(!alive)return;
  if(resetToken!==state.reset){
   resetToken=state.reset;
   res.write(`event: reset\ndata: ${JSON.stringify({from:state.seekFrom??from})}\n\n`);
   clearInterval(timer);res.end();return;
  }
  if(state.paused)return;
  const realNow=Date.now();
  let target=simFrom+(realNow-startReal)*(catchup?speed:state.speed);
  if(catchup&&target>=realNow){
   catchup=false;simFrom=realNow;startReal=realNow;target=realNow;
   res.write(`event: caughtup\ndata: ${JSON.stringify({at:realNow})}\n\n`);
  }
  let budget=1200;
  while(heap.size&&budget-->0){
   const top=heap.peek();
   if(top.record.time>target)break;
   const {cursor,record}=heap.pop();
   const line=JSON.stringify(record);
   res.write(`id: ${record.time}\ndata: ${line}\n\n`);
   state.lastRecordAt=record.time;
   const next=await cursor.next();
   if(next)heap.push({cursor,record:next});else{cursors.delete(cursor);cursor.close();}
  }
  for(const entry of manifest.topics){
   if(entry.bornAt<=target&&!opened.has(entry.slot)&&entry.endsAt>=from)await openTopic(entry);
  }
  if(Date.now()-lastPing>15000){lastPing=Date.now();res.write(': ping\n\n');}
 },100);
 req.on('close',()=>{clearInterval(timer);closeAll();});
 res.on('close',()=>{clearInterval(timer);closeAll();});
}

function sendJson(res,status,body){
 const data=JSON.stringify(body);
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
 res.end(data);
}

async function textsResponse(res,url){
 const slot=Number(url.searchParams.get('slot'));
 const entry=manifest.topics.find(t=>t.slot===slot);
 if(!entry)return sendJson(res,404,{error:'topic not found'});
 const from=Number(url.searchParams.get('from'))||entry.bornAt,to=Number(url.searchParams.get('to'))||entry.endsAt;
 const layer=url.searchParams.get('layer'),cluster=url.searchParams.get('cluster'),emotion=url.searchParams.get('emotion');
 const limit=Math.max(1,Math.min(20000,Number(url.searchParams.get('limit'))||500));
 const sort=url.searchParams.get('sort')||'time';
 let list=(await loadTopic(entry)).filter(r=>r.time>=from&&r.time<=to);
 if(layer)list=list.filter(r=>r.layer===layer);
 if(cluster!==null&&cluster!=='')list=list.filter(r=>r.cluster===Number(cluster));
 if(emotion)list=list.filter(r=>r.emotion===emotion);
 if(sort==='hot')list=list.slice().sort((a,b)=>(b.weight||0)-(a.weight||0)||b.time-a.time);
 else list=list.slice().sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 if(url.searchParams.get('sample')==='1'&&list.length>limit){
  const stride=Math.max(1,Math.floor(list.length/limit));
  list=list.filter((_,i)=>i%stride===0);
 }
 sendJson(res,200,{slot,from,to,total:list.length,records:list.slice(0,limit)});
}

function aggregatesResponse(res,url){
 const from=Number(url.searchParams.get('from'))||manifest.windowStart;
 const to=Number(url.searchParams.get('to'))||manifest.windowEnd;
 const step=url.searchParams.get('step');
 const source=step==='5m'?loadFiveMinute():loadHourly();
 const rows=source.filter(r=>{const t=(step==='5m'?r.bucket*5*60000:r.hour*3600000);return t>=from-3600000&&t<=to;});
 res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
 res.end(rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''));
}

const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 try{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  if(url.pathname==='/health')return sendJson(res,200,{ok:true,version:manifest.version,windowStart:manifest.windowStart,windowEnd:manifest.windowEnd,topics:manifest.topics.length,records:manifest.total,counts:manifest.counts,subscribers:state.subscribers,paused:state.paused,speed:state.speed,lastRecordAt:state.lastRecordAt});
  if(url.pathname==='/manifest')return sendJson(res,200,manifest);
  if(url.pathname==='/feed')return feed(req,res,url);
  if(url.pathname==='/texts')return textsResponse(res,url);
  if(url.pathname==='/aggregates')return aggregatesResponse(res,url);
  if(url.pathname==='/control'&&req.method==='POST'){
   let body='';for await(const chunk of req)body+=chunk;
   let json={};try{json=JSON.parse(body||'{}');}catch{}
   if(typeof json.paused==='boolean')state.paused=json.paused;
   if(Number.isFinite(Number(json.speed)))state.speed=Math.max(.01,Number(json.speed));
   if(Number.isFinite(Number(json.seek))){state.seekFrom=Number(json.seek);state.reset++;}
   return sendJson(res,200,{ok:true,paused:state.paused,speed:state.speed,seek:state.seekFrom});
  }
  sendJson(res,404,{error:'not found'});
 }catch(error){sendJson(res,500,{error:String(error?.message||error)});}
});

server.listen(PORT,'127.0.0.1',()=>{
 console.log(`[corpus] ${manifest.topics.length} topics / ${manifest.total} records`);
 console.log(`[corpus] window ${new Date(manifest.windowStart).toISOString()} .. ${new Date(manifest.windowEnd).toISOString()}`);
 console.log(`[corpus] listening http://127.0.0.1:${PORT}  (feed /texts /aggregates /health /control)`);
});
