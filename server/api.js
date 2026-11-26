import {snapshot,delta} from './mock.js';

// Pure API layer. Node-specific corpus ingestion is injected as `deps` by the
// dev server; the production worker uses the analytic fallback below.
const fallback={
 snapshot:()=>snapshot(),
 delta:after=>delta(after),
 history:()=>[],
 texts:async()=>({records:[],total:0,error:'corpus offline'}),
 words:async()=>({words:[],total:0,error:'corpus offline'}),
 discussion:async()=>({posts:[],totalPosts:0,next:null,error:'corpus offline'}),
 status:()=>({status:'disabled',producer:null,connected:false,records:0})
};

export async function api(request,deps=fallback){
 const url=new URL(request.url);
 if(url.pathname==='/api/snapshot')return Response.json(deps.snapshot(),{headers:{'Cache-Control':'no-store'}});
 if(url.pathname==='/api/corpus/status')return Response.json(deps.status(),{headers:{'Cache-Control':'no-store'}});
 const topic=url.pathname.match(/^\/api\/topic\/([^/]+)\/(history|texts|words|discussion)$/);
 if(topic){
  const id=decodeURIComponent(topic[1]),action=topic[2],params=Object.fromEntries(url.searchParams);
  try{
   if(action==='history')return Response.json({topicId:id,rows:deps.history(id)},{headers:{'Cache-Control':'no-store'}});
   return Response.json(await deps[action](id,params),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:String(error?.message||error)},{status:503});}
 }
 if(url.pathname!=='/api/stream')return new Response('Not found',{status:404});
 const last=request.headers.get('Last-Event-ID')??url.searchParams.get('since');
 let sent=last===null?NaN:Number(last),timer,closed=false;
 const encoder=new TextEncoder();
 const body=new ReadableStream({start(controller){
  controller.enqueue(encoder.encode('retry: 2000\n\n'));
  const send=()=>{if(closed)return;try{const message=deps.delta(sent);sent=message.id;controller.enqueue(encoder.encode(`event: ${message.type}\nid: ${message.id}\ndata: ${JSON.stringify(message.payload)}\n\n`));}catch{clearInterval(timer);closed=true;try{controller.close();}catch{}}};
  send();timer=setInterval(send,5000);
 },cancel(){closed=true;clearInterval(timer);}});
 return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
