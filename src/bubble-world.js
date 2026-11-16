import {pulsesFor} from '../shared/lifecycle.js';
export const radiusFor=v=>100*Math.sqrt(Math.max(0,v)/100000);
export const clampZoom=k=>Math.max(.025,Math.min(16,k));
export function zoomAt(c,p,f){const k=clampZoom(c.k*f),ratio=k/c.k;return {k,x:p.x-(p.x-c.x)*ratio,y:p.y-(p.y-c.y)*ratio};}
export function packTopics(items,aspect=1){
 if(!items.length)return [];
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
// Bound the maximum of the sum of unimodal pulses. Subdivision gives a tight
// upper bound without guessing a future radius or changing the displayed area.
export function footprintRadius(q){
 const pulses=pulsesFor(q),start=q.bornAt,end=q.endsAt;
 if(!(end>start))return radiusFor(pulses.reduce((s,p)=>s+p.amplitude,0));
 let peak=0;
 for(let i=0;i<128;i++){
  const lo=start+(end-start)*i/128,hi=start+(end-start)*(i+1)/128;
  const bound=pulses.reduce((sum,p)=>{
   const a=Math.max(0,(lo-p.at)/p.duration),b=Math.min(1,(hi-p.at)/p.duration);
   if(a>=b)return sum;
   const mode=p.a/(p.a+p.b),u=Math.max(a,Math.min(b,mode));
   return sum+p.amplitude*(u/mode)**p.a*((1-u)/(1-mode))**p.b;
  },0);peak=Math.max(peak,bound);
 }
 return radiusFor(peak);
}
// Reserve a topic's maximum footprint once. Nonconcurrent topics may reuse space.
// Streaming updates and time scrubbing never move an existing anchor.
export function anchorTopics(items,previous=new Map(),aspect=1){
 const anchors=new Map(previous);aspect=Math.max(.35,Math.min(4,aspect));
 const ordered=[...items].sort((a,b)=>(a.bornAt??0)-(b.bornAt??0)||a.id.localeCompare(b.id));
 const overlap=(a,b)=>(a.bornAt??-Infinity)<(b.endsAt??Infinity)&&(b.bornAt??-Infinity)<(a.endsAt??Infinity);
 for(const q of ordered){
  if(anchors.has(q.id))continue;
  const peers=[...anchors.values()].filter(n=>overlap(q,n)),gap=(a,b)=>a.r+b.r+180+Math.min(a.r,b.r)*.12;
  const candidates=[{x:0,y:0},...peers.flatMap(n=>Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,d=gap(q,n)+1;return {x:n.x+Math.cos(a)*d,y:n.y+Math.sin(a)*d};}))];
  let best=null,score=Infinity;
  for(const pos of candidates){
   if(peers.some(n=>Math.hypot(pos.x-n.x,pos.y-n.y)<gap(q,n)))continue;
   const all=[...peers,{...q,...pos}],extentX=Math.max(...all.map(n=>Math.abs(n.x)+n.r)),extentY=Math.max(...all.map(n=>Math.abs(n.y)+n.r));
   const value=Math.max(extentX/aspect,extentY)+.05*(extentX/aspect+extentY)+.001*Math.hypot(pos.x/aspect,pos.y);
   if(value<score){best=pos;score=value;}
  }
  anchors.set(q.id,{...q,...(best||{x:Math.max(0,...peers.map(n=>n.x+n.r))+q.r+200,y:0})});
 }
 return anchors;
}
export function worldLayout(items,anchors=new Map(),blend=1,aspect=1){
 const positions=anchorTopics(items,anchors,aspect);
 return items.map(q=>({...q,x:positions.get(q.id).x,y:positions.get(q.id).y}));
}
export function labelRails(w){const margin=w<600?10:24,width=Math.min(180,Math.max(88,w*.22)),gutter=margin+width+28;return {margin,width,gutter};}
export function fitCamera(nodes,w,h){
 if(!nodes.length)return {x:w/2,y:h/2,k:.55};
 const minX=Math.min(...nodes.map(n=>n.x-n.r)),maxX=Math.max(...nodes.map(n=>n.x+n.r)),minY=Math.min(...nodes.map(n=>n.y-n.r)),maxY=Math.max(...nodes.map(n=>n.y+n.r));
 const k=clampZoom(Math.min(Math.max(40,w-2*labelRails(w).gutter)/Math.max(1,maxX-minX),Math.max(40,h-160)/Math.max(1,maxY-minY)));
 return {k,x:w/2-(maxX+minX)*k/2,y:h/2-(maxY+minY)*k/2+12};
}
export function leaderLabels(nodes,w,h){
 const {margin,width}=labelRails(w),height=52,top=100,bottom=h-72,labels=[];
 const visible=nodes.filter(n=>n.r>0&&n.x+n.r>=0&&n.x-n.r<=w&&n.y+n.r>=0&&n.y-n.r<=h);
 for(const side of [-1,1]){
  // Include larger circles in the row allocation: crossing the label threshold
  // changes visibility, not the positions of the remaining bookmark cards.
  const column=visible.filter(n=>(n.x<w/2?-1:1)===side).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id));
  const capacity=Math.max(1,Math.floor((bottom-top+10)/(height+10))),selected=column.length>capacity?column.filter(n=>n.r<44).slice(0,capacity):column;
  const ys=selected.map(n=>Math.max(top,Math.min(bottom-height,n.y-height/2)));
  for(let i=1;i<ys.length;i++)ys[i]=Math.max(ys[i],ys[i-1]+height+10);
  if(ys.length&&ys.at(-1)>bottom-height){ys[ys.length-1]=bottom-height;for(let i=ys.length-2;i>=0;i--)ys[i]=Math.min(ys[i],ys[i+1]-height-10);}
  selected.forEach((n,i)=>{
   if(n.r>=44)return;
   const x=side<0?margin:w-margin-width,y=ys[i],ey=y+height/2,endX=side<0?x+width:x,ex=endX-side*30;
   const dx=ex-n.x,dy=ey-n.y,length=Math.hypot(dx,dy)||1;
   const title=n.title.split(' · ')[0],chars=Math.max(4,Math.floor((width-36)/12)),parts=Array.from(title),lines=[parts.slice(0,chars).join('')];
   if(parts.length>chars)lines.push(parts.slice(chars,chars*2-1).join('')+(parts.length>chars*2-1?'…':''));
   labels.push({...n,title,lines,width,height,x,y,ex,ey,endX,side,sx:n.x+dx/length*n.r,sy:n.y+dy/length*n.r});
  });
 }
 return labels;
}
