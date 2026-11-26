// Thin client for the external corpus producer (separate process/port).
const DEFAULT_URL='http://127.0.0.1:5400';
export function corpusUrl(){return (process.env.CORPUS_URL||DEFAULT_URL).replace(/\/+$/,'');}

async function getJson(pathname,params={},timeout=2500){
 const url=new URL(corpusUrl()+pathname);
 for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,value);
 const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw new Error(`corpus ${pathname} ${response.status}`);
 return response.json();
}

export function health(){return getJson('/health',{},1200);}
export function manifest(){return getJson('/manifest',{},4000);}
export async function aggregates({from,to,step}={}){
 const url=new URL(corpusUrl()+'/aggregates');
 if(from)url.searchParams.set('from',from);
 if(to)url.searchParams.set('to',to);
 if(step)url.searchParams.set('step',step);
 const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('corpus aggregates '+response.status);
 const body=await response.text();
 return body.trim()?body.trim().split('\n').map(line=>JSON.parse(line)):[];
}
export function texts(params={}){
 const clean={};
 for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')clean[key]=value;
 return getJson('/texts',clean,6000);
}
export function control(body){return fetch(corpusUrl()+'/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());}

export async function openFeed({from,speed=1,catchup=true,signal,onRecord,onReady,onReset,onCaughtUp,onError}={}){
 const url=new URL(corpusUrl()+'/feed');
 if(Number.isFinite(from))url.searchParams.set('from',from);
 url.searchParams.set('speed',speed);
 if(catchup)url.searchParams.set('catchup','1');
 let response;
 try{response=await fetch(url,{signal});}
 catch(error){onError?.(error);return;}
 if(!response.ok||!response.body){onError?.(new Error('corpus feed '+response.status));return;}
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   let index;
   while((index=buffer.indexOf('\n\n'))>=0){
    const chunk=buffer.slice(0,index);
    buffer=buffer.slice(index+2);
    if(!chunk||chunk.startsWith(':'))continue;
    let event='message',data='';
    for(const line of chunk.split('\n')){
     if(line.startsWith('event:'))event=line.slice(6).trim();
     else if(line.startsWith('data:'))data+=line.slice(5).trim();
    }
    if(!data)continue;
    let payload;
    try{payload=JSON.parse(data);}catch{continue;}
    if(event==='ready')onReady?.(payload);
    else if(event==='reset')onReset?.(payload);
    else if(event==='caughtup')onCaughtUp?.(payload);
    else onRecord?.(payload);
   }
  }
 }catch(error){if(!signal?.aborted)onError?.(error);}
}
