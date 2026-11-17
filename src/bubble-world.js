export const radiusFor=v=>100*Math.sqrt(Math.max(0,v)/100000);
export const clampZoom=k=>Math.max(.025,Math.min(16,k));
export function zoomAt(c,p,f){const k=clampZoom(c.k*f),ratio=k/c.k;return {k,x:p.x-(p.x-c.x)*ratio,y:p.y-(p.y-c.y)*ratio};}
const gap=(a,b)=>28+Math.min(52,(a.r+b.r)*.12);
const extent=ns=>({left:Math.min(...ns.map(n=>n.x-n.r)),right:Math.max(...ns.map(n=>n.x+n.r)),top:Math.min(...ns.map(n=>n.y-n.r)),bottom:Math.max(...ns.map(n=>n.y+n.r))});
// Initial packing and births use current radii. Retained centers are never reseeded.
export function packTopics(items,aspect=1,previous=new Map()){
 if(!items.length)return [];
 aspect=Math.max(.35,Math.min(4,aspect));
 const placed=items.filter(q=>previous.has(q.id)).map(q=>({...q,x:previous.get(q.id).x,y:previous.get(q.id).y}));
 for(const q of items.filter(q=>!previous.has(q.id)).sort((a,b)=>b.r-a.r||a.id.localeCompare(b.id))){
  let best=null,score=Infinity;
  const candidates=placed.length?placed.flatMap(a=>Array.from({length:48},(_,i)=>{const angle=i*Math.PI/24,d=a.r+q.r+gap(a,q)+1;return {x:a.x+Math.cos(angle)*d,y:a.y+Math.sin(angle)*d};})):[{x:0,y:0}];
  for(const p of candidates){
   if(placed.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<a.r+q.r+gap(a,q)))continue;
   const box=extent([...placed,{...q,...p}]),width=box.right-box.left,height=box.bottom-box.top;
   const value=Math.max(width/aspect,height)+.04*(width/aspect+height)+.0001*Math.hypot(p.x,p.y);
   if(value<score){score=value;best=p;}
  }
  placed.push({...q,...(best||{x:Math.max(0,...placed.map(n=>n.x+n.r))+q.r+60,y:0})});
 }
 if(!previous.size){const box=extent(placed),cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2;placed.forEach(n=>{n.x-=cx;n.y-=cy;});}
 return placed;
}
// Local relaxation preserves the existing neighbourhood; it never sorts by heat.
export function compactTargets(nodes,aspect=1){
 if(nodes.length<2)return nodes.map(n=>({...n}));
 const out=nodes.map(n=>({...n})),ratio=Math.max(.5,Math.min(3,aspect));
 const center=ns=>{const mass=ns.reduce((s,n)=>s+n.r+40,0);return {x:ns.reduce((s,n)=>s+n.x*(n.r+40),0)/mass,y:ns.reduce((s,n)=>s+n.y*(n.r+40),0)/mass};},origin=center(out);
 for(let pass=0;pass<36;pass++){
  for(const n of out){n.x+=(origin.x-n.x)*.012/ratio;n.y+=(origin.y-n.y)*.012*ratio;}
  for(let solve=0;solve<3;solve++)for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
   const a=out[i],b=out[j],dx=b.x-a.x||.001,dy=b.y-a.y||.001,d=Math.hypot(dx,dy),need=a.r+b.r+gap(a,b);
   if(d>=need)continue;
   const wa=(b.r+40)/(a.r+b.r+80),push=(need-d)/d;
   a.x-=dx*push*wa;a.y-=dy*push*wa;b.x+=dx*push*(1-wa);b.y+=dy*push*(1-wa);
  }
 }
 const shifted=center(out);for(const n of out){n.x+=origin.x-shifted.x;n.y+=origin.y-shifted.y;}return out;
}
// Exponential convergence with a screen-space speed cap, independent of frame rate.
export function approachLayout(nodes,targets,dt,scale=1,hold=false){
 const map=new Map(targets.map(n=>[n.id,n])),seconds=Math.min(.05,Math.max(0,dt)),k=Math.max(.025,scale);
 return nodes.map(n=>{const t=map.get(n.id);if(!t||hold)return {...n};const dx=t.x-n.x,dy=t.y-n.y,d=Math.hypot(dx,dy);if(d*k<.8)return {...n};
  const fraction=Math.min(1-Math.exp(-seconds/ .65),72*seconds/(d*k));return {...n,x:n.x+dx*fraction,y:n.y+dy*fraction};});
}
export function fitCamera(nodes,w,h){
 if(!nodes.length)return {x:w/2,y:h/2,k:.55};
 const box=extent(nodes),k=clampZoom(Math.min(Math.max(40,w-180)/Math.max(1,box.right-box.left),Math.max(40,h-180)/Math.max(1,box.bottom-box.top)));
 return {k,x:w/2-(box.right+box.left)*k/2,y:h/2-(box.top+box.bottom)*k/2+12};
}
export function leaderLabels(nodes,w,h,previous=new Map()){
 const labels=[],cx=w/2,cy=h/2;
 for(const n of [...nodes].sort((a,b)=>a.id.localeCompare(b.id))){
  const old=previous.get(n.id);if(n.r>=(old?48:42)||n.r<=0||n.x<0||n.x>w||n.y<0||n.y>h)continue;
  const title=n.title.split(' · ')[0],width=Math.min(w<600?130:164,Math.max(104,title.length*12+38)),chars=Math.max(4,Math.floor((width-34)/12)),parts=Array.from(title),lines=[parts.slice(0,chars).join('')];
  if(parts.length>chars)lines.push(parts.slice(chars,chars*2-1).join('')+(parts.length>chars*2-1?'…':''));
  const height=lines.length>1?48:36,outward=Math.atan2(n.y-cy,n.x-cx);let best=null,score=Infinity;
  for(const distance of [20,34,54,80,112,152,200,256])for(let j=0;j<24;j++){
   const angle=j*Math.PI/12,side=Math.cos(angle)>=0?1:-1,rawX=n.x+Math.cos(angle)*(n.r+distance)+side*14,rawY=n.y+Math.sin(angle)*(n.r+distance);
   const x=Math.max(10,Math.min(w-10-width,side>0?rawX:rawX-width)),y=Math.max(90,Math.min(h-54-height,rawY-height/2)),endX=side>0?x:x+width,ex=endX-side*14,ey=y+height/2;
   const dx=ex-n.x,dy=ey-n.y,length=Math.hypot(dx,dy)||1;
   const overlaps=labels.some(l=>x<l.x+l.width+8&&x+width+8>l.x&&y<l.y+l.height+8&&y+height+8>l.y);
   if(overlaps)continue;
   const circleHit=nodes.some(c=>{const px=Math.max(x,Math.min(x+width,c.x)),py=Math.max(y,Math.min(y+height,c.y));return Math.hypot(px-c.x,py-c.y)<c.r+6;});
   if(circleHit)continue;
   const turn=Math.abs(Math.atan2(Math.sin(angle-outward),Math.cos(angle-outward))),change=old?(old.angle===angle?0:44)+Math.abs(old.distance-distance)*.15:0,value=Math.max(0,length-n.r)+turn*7+change;
   if(value<score){score=value;best={...n,title,lines,width,height,x,y,ex,ey,endX,side,angle,distance,sx:n.x+dx/length*n.r,sy:n.y+dy/length*n.r};}
  }
  if(best)labels.push(best);
 }
 return labels;
}
