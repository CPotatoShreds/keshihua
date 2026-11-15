import {snapshot,delta} from './mock.js';
export function api(request){
 const url=new URL(request.url);
 if(url.pathname==='/api/snapshot')return Response.json(snapshot(),{headers:{'Cache-Control':'no-store'}});
 if(url.pathname!=='/api/stream')return new Response('Not found',{status:404});
 const last=request.headers.get('Last-Event-ID')??url.searchParams.get('since');
 let sent=last===null?NaN:Number(last),timer,closed=false;
 const encoder=new TextEncoder();
 const body=new ReadableStream({start(controller){
  controller.enqueue(encoder.encode('retry: 2000\n\n'));
  const send=()=>{if(closed)return;try{const message=delta(sent);sent=message.id;controller.enqueue(encoder.encode(`event: ${message.type}\nid: ${message.id}\ndata: ${JSON.stringify(message.payload)}\n\n`));}catch{clearInterval(timer);closed=true;try{controller.close();}catch{}}};
  send();timer=setInterval(send,5000);
 },cancel(){closed=true;clearInterval(timer);}});
 return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
