import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
const assets={};
async function scan(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+'/'+entry.name;if(entry.isDirectory())await scan(dir+'/'+entry.name,name);else assets[name]=Buffer.from(await readFile(dir+'/'+entry.name)).toString('base64');}}
await scan('dist/client');
const code=`import {api} from './server/api.js';
const assets=${JSON.stringify(assets)};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',zip:'application/zip',svg:'image/svg+xml'};
export default {fetch(request){const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return api(request);const name=path==='/'?'/index.html':path;const data=assets[name];if(!data)return new Response('Not found',{status:404});return new Response(Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{headers:{'Content-Type':types[name.split('.').at(-1)]||'application/octet-stream','Cache-Control':name.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'}});}};`;
await mkdir('dist/server',{recursive:true});
await build({stdin:{contents:code,resolveDir:process.cwd(),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Worker with SSE and embedded frontend built.');
