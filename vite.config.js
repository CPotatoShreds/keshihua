import {api} from './server/api.js';
export default {server:{host:'0.0.0.0',allowedHosts:['terminal.local']},build:{outDir:'dist/client'},plugins:[{
 name:'mock-sse-backend',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  if(!req.url.startsWith('/api/'))return next();
  const response=api(new Request('http://localhost'+req.url,{headers:req.headers}));
  res.writeHead(response.status,Object.fromEntries(response.headers));
  const reader=response.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));
  try{while(!res.destroyed){const {done,value}=await reader.read();if(done)break;res.write(value);}res.end();}catch{res.end();}
 });}
}]};
