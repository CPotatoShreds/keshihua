export const radiusFor=v=>100*Math.sqrt(Math.max(0,v)/100000);
export const clampZoom=k=>Math.max(.025,Math.min(16,k));
export function zoomAt(c,p,f){const k=clampZoom(c.k*f),ratio=k/c.k;return {k,x:p.x-(p.x-c.x)*ratio,y:p.y-(p.y-c.y)*ratio};}
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function worldLayout(items,previous=new Map(),blend=1){
 const nodes=items.map(q=>{const old=previous.get(q.id),seed=hash(q.id),angle=seed*.61803398875*Math.PI*2,reach=140+Math.sqrt(seed%1000)*22;return {...q,x:old?.x??Math.cos(angle)*reach,y:old?.y??Math.sin(angle)*reach};});
 for(let pass=0;pass<(previous.size?8:100);pass++)for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j],dx=b.x-a.x||.01,dy=b.y-a.y||.01,d=Math.hypot(dx,dy),required=a.r+b.r+180+Math.min(a.r,b.r)*.12;
  if(d<required){const push=(required-d)/d*.5*blend;a.x-=dx*push;a.y-=dy*push;b.x+=dx*push;b.y+=dy*push;}
 }return nodes;
}
export function fitCamera(nodes,w,h){
 if(!nodes.length)return {x:w/2,y:h/2,k:.55};
 const minX=Math.min(...nodes.map(n=>n.x-n.r)),maxX=Math.max(...nodes.map(n=>n.x+n.r)),minY=Math.min(...nodes.map(n=>n.y-n.r)),maxY=Math.max(...nodes.map(n=>n.y+n.r));
 const k=clampZoom(Math.min(Math.max(40,w-90)/Math.max(1,maxX-minX),Math.max(40,h-80)/Math.max(1,maxY-minY)));
 return {k,x:w/2-(maxX+minX)*k/2,y:h/2-(maxY+minY)*k/2};
}
