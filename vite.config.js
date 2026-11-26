import {api} from './server/api.js';
import {runtime} from './server/runtime.js';
export default {server:{host:'0.0.0.0',allowedHosts:['terminal.local']},build:{outDir:'dist/client'},plugins:[{
 name:'mock-sse-backend',configureServer(server){runtime.start();server.middlewares.use(async(req,res,next)=>{
  if(!req.url.startsWith('/api/'))return next();
  try{
   const response=await api(new Request('http://localhost'+req.url,{headers:req.headers}),runtime);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(!response.body)return res.end();
   const reader=response.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));
   while(!res.destroyed){const {done,value}=await reader.read();if(done)break;res.write(value);}res.end();
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end(String(error?.message||error));}
 });}
}]};
