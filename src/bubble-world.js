export const radiusFor=v=>100*Math.sqrt(Math.max(0,v)/100000);
export const clampZoom=k=>Math.max(.025,Math.min(16,k));
export function zoomAt(c,p,f){const k=clampZoom(c.k*f),ratio=k/c.k;return {k,x:p.x-(p.x-c.x)*ratio,y:p.y-(p.y-c.y)*ratio};}
export function packTopics(items,aspect=1){
 const placed=[];aspect=Math.max(.35,Math.min(4,aspect));
 for(const q of [...items].sort((a,b)=>b.r-a.r||a.id.localeCompare(b.id))){
  let best=null,score=Infinity;
  const candidates=placed.length?placed.flatMap(a=>Array.from({length:48},(_,i)=>{const angle=i*Math.PI/24,d=a.r+q.r+180+Math.min(a.r,q.r)*.12;return {x:a.x+Math.cos(angle)*d,y:a.y+Math.sin(angle)*d};})):[{x:0,y:0}];
  for(const p of candidates){
   if(placed.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<a.r+q.r+179+Math.min(a.r,q.r)*.12))continue;
   const all=[...placed,{...q,...p}],xs=all.flatMap(n=>[n.x-n.r,n.x+n.r]),ys=all.flatMap(n=>[n.y-n.r,n.y+n.r]);
   const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
   const value=Math.max(width/aspect,height)+.04*(width/aspect+height)+.0001*Math.hypot(p.x,p.y);
   if(value<score){score=value;best=p;}
  }
  placed.push({...q,...(best||{x:Math.max(0,...placed.map(n=>n.x+n.r))+q.r+200,y:0})});
 }
 const cx=(Math.min(...placed.map(n=>n.x-n.r))+Math.max(...placed.map(n=>n.x+n.r)))/2,cy=(Math.min(...placed.map(n=>n.y-n.r))+Math.max(...placed.map(n=>n.y+n.r)))/2;
 return placed.map(n=>({...n,x:n.x-cx,y:n.y-cy}));
}
export function worldLayout(items,previous=new Map(),blend=1,aspect=1,targets=null){
 const packed=targets||packTopics(items,aspect),map=new Map(packed.map(n=>[n.id,n]));
 const nodes=items.map(q=>{const old=previous.get(q.id),target=map.get(q.id)||{x:0,y:0};return {...q,x:old?old.x+(target.x-old.x)*blend:target.x,y:old?old.y+(target.y-old.y)*blend:target.y};});
 for(let pass=0;pass<6;pass++)for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j],dx=b.x-a.x||.01,dy=b.y-a.y||.01,d=Math.hypot(dx,dy),required=a.r+b.r+180+Math.min(a.r,b.r)*.12;
  if(d<required){const push=(required-d)/d*.5;a.x-=dx*push;a.y-=dy*push;b.x+=dx*push;b.y+=dy*push;}
 }return nodes;
}
export function fitCamera(nodes,w,h){
 if(!nodes.length)return {x:w/2,y:h/2,k:.55};
 const minX=Math.min(...nodes.map(n=>n.x-n.r)),maxX=Math.max(...nodes.map(n=>n.x+n.r)),minY=Math.min(...nodes.map(n=>n.y-n.r)),maxY=Math.max(...nodes.map(n=>n.y+n.r));
 const k=clampZoom(Math.min(Math.max(40,w-150)/Math.max(1,maxX-minX),Math.max(40,h-160)/Math.max(1,maxY-minY)));
 return {k,x:w/2-(maxX+minX)*k/2,y:h/2-(maxY+minY)*k/2+12};
}
export function leaderLabels(nodes,w,h){
 const labels=[];
 for(const n of [...nodes].sort((a,b)=>b.r-a.r)){
  if(n.r>=44||n.x+n.r<0||n.x-n.r>w||n.y+n.r<0||n.y-n.r>h)continue;
  const title=n.title.split(' · ')[0],width=Math.min(154,title.length*11+16);let best=null,bestScore=Infinity;
  for(const distance of [30,54,82,112])for(let j=0;j<12;j++){
   const a=j*Math.PI/6,side=Math.cos(a)>=0?1:-1,ey=n.y+Math.sin(a)*(n.r+distance),ex=n.x+Math.cos(a)*(n.r+distance),x=side>0?ex:ex-width,y=ey-12;
   if(x<8||x+width>w-8||y<76||y+24>h-48)continue;
   const overlap=nodes.some(c=>{const px=Math.max(x,Math.min(x+width,c.x)),py=Math.max(y,Math.min(y+24,c.y));return Math.hypot(px-c.x,py-c.y)<c.r+7;})||labels.some(l=>x<l.x+l.width+6&&x+width+6>l.x&&y<l.y+29&&y+29>l.y);
   if(overlap)continue;
   const score=distance+Math.abs(Math.sin(a))*9;if(score<bestScore){bestScore=score;best={...n,title,width,x,y,ex,ey,side,sx:n.x+Math.cos(a)*n.r,sy:n.y+Math.sin(a)*n.r};}
  }
  if(best)labels.push(best);
 }
 return labels;
}
