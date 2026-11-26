// Start the external corpus producer and the Vite dev server together.
// Usage: npm run dev:all [-- --port 5300]
import {spawn} from 'node:child_process';
import fs from 'node:fs';

if(!fs.existsSync('corpus/out/manifest.json')){
 console.error('[dev:all] corpus/out/manifest.json missing. Run: npm run corpus:build');
 process.exit(1);
}
const children=[];
let shuttingDown=false;
const shutdown=code=>{
 if(shuttingDown)return;
 shuttingDown=true;
 for(const child of children){try{child.kill();}catch{}}
 setTimeout(()=>process.exit(code??0),250);
};
const run=(command,args)=>{
 const child=spawn(command,args,{stdio:'inherit',shell:process.platform==='win32',env:process.env});
 children.push(child);
 child.on('exit',code=>{if(!shuttingDown)shutdown(code);});
};
run(process.execPath,['corpus/producer.js']);
run(process.platform==='win32'?'npx.cmd':'npx',['vite','--host','0.0.0.0',...process.argv.slice(2)]);
process.on('SIGINT',()=>shutdown(0));
process.on('SIGTERM',()=>shutdown(0));
