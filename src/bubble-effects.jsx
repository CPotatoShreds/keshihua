import React,{useEffect,useRef} from 'react';
import {safeBirth,dropletAt} from './bubble-geometry';
const clamp=v=>Math.max(0,Math.min(1,v));
// A narrow, concave Bézier neck connects the approaching drop to its host.
function bridge(ctx,n,p,r){
 const dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy),gap=d-n.r-r;
 if(gap>r*1.8||d<n.r-r*.6)return;
 const ux=dx/d,uy=dy/d,vx=-uy,vy=ux,strength=clamp(1-gap/(r*1.8)),neck=r*(.18+.65*strength),host=neck*1.55;
 const a={x:n.x+ux*Math.sqrt(Math.max(0,n.r*n.r-host*host)),y:n.y+uy*Math.sqrt(Math.max(0,n.r*n.r-host*host))};
 const b={x:p.x-ux*r*.55,y:p.y-uy*r*.55},mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
 ctx.beginPath();ctx.moveTo(a.x+vx*host,a.y+vy*host);ctx.bezierCurveTo(mx+vx*neck*.25,my+vy*neck*.25,mx+vx*neck*.25,my+vy*neck*.25,b.x+vx*neck,b.y+vy*neck);ctx.lineTo(b.x-vx*neck,b.y-vy*neck);ctx.bezierCurveTo(mx-vx*neck*.25,my-vy*neck*.25,mx-vx*neck*.25,my-vy*neck*.25,a.x-vx*host,a.y-vy*host);ctx.closePath();ctx.fill();
}
export function BubbleInflux({nodes,width,height,enabled}){
 const ref=useRef(null),latest=useRef({nodes,width,height});latest.current={nodes,width,height};
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas.getContext('2d');let raf,last=0,spawn=0,drops=[];
  const clear=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!enabled){clear();return;}
  const frame=now=>{
   const {nodes,width:w,height:h}=latest.current,dpr=Math.min(2,window.devicePixelRatio||1);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const dt=last?Math.min(50,now-last):0;last=now;
   if(!document.hidden){
    spawn+=dt;
    if(spawn>420&&drops.length<14){spawn=0;const eligible=nodes.filter(n=>n.r>18&&n.x+n.r>0&&n.x-n.r<w&&n.y+n.r>0&&n.y-n.r<h);
     for(let attempt=0;attempt<18&&eligible.length;attempt++){
      const n=eligible[Math.floor(Math.random()*eligible.length)];if(drops.filter(d=>d.id===n.id).length>=3)continue;
      const angle=Math.random()*Math.PI*2,distance=65+Math.random()*95,start=safeBirth(n,nodes,w,h,angle,distance);
      if(!start||drops.some(d=>Math.hypot(d.start.x-start.x,d.start.y-start.y)<35))continue;
      drops.push({id:n.id,start,angle,distance,age:0,life:3000+Math.random()*1600,size:Math.min(9,n.r*.13)});break;
     }
    }
    drops=drops.filter(d=>{d.age+=dt;const n=nodes.find(n=>n.id===d.id);if(!n||d.age>=d.life)return false;
     const t=d.age/d.life,{r,distance}=dropletAt(t,n.r,d.distance,d.size),p={x:n.x+Math.cos(d.angle)*distance,y:n.y+Math.sin(d.angle)*distance};
     if(nodes.some(other=>other.id!==n.id&&Math.hypot(p.x-other.x,p.y-other.y)<other.r+r+14))return false;
     ctx.fillStyle=n.color;ctx.globalAlpha=clamp(t*5);bridge(ctx,n,p,r);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.01,r),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;return true;
    });
   }
   raf=requestAnimationFrame(frame);
  };raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);clear();};
 },[enabled]);
 return <canvas ref={ref} className="influx-canvas" aria-hidden="true" data-active={enabled}/>;
}
