import {useEffect,useRef,useState} from 'react';
import {packTopics,compactTargets,approachLayout,separateOverlaps} from './bubble-world';

export function useBubbleLayout(items,{width,height,scale,time,scrubbing,scope,reduced}){
 const latest=useRef(null);latest.current={items,width,height,scale,time,scrubbing,scope,reduced};
 const [view,setView]=useState({nodes:[],epoch:0});
 const forceLayout=import.meta.env.DEV&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('qa');
 useEffect(()=>{
  let raf,last=0,layout=[],targets=[],signature='',oldAspect=0,oldScope=null,oldTime=null,holdUntil=0,solveAt=0,epoch=0;
  const frame=now=>{
   if(document.hidden&&!forceLayout){last=now;raf=requestAnimationFrame(frame);return;}
   const p=latest.current,dt=last?Math.min(50,now-last)/1000:0;last=now;
   const aspect=Math.max(1,p.width-180)/Math.max(1,p.height-180),key=p.items.map(n=>n.id).join('|'),reset=oldScope!==p.scope||Math.abs(oldAspect-aspect)>.12;
   if(oldTime!==null&&Math.abs(p.time-oldTime)>1000)holdUntil=now+180;oldTime=p.time;
   const hold=p.scrubbing||now<holdUntil;
   if(reset){layout=compactTargets(packTopics(p.items,aspect),aspect);targets=layout;epoch++;oldAspect=aspect;oldScope=p.scope;signature=key;solveAt=now+500;}
   else{
    const previous=new Map(layout.map(n=>[n.id,n]));
    if(key!==signature){layout=packTopics(p.items,aspect,previous);signature=key;solveAt=0;}
    else layout=p.items.map(n=>({...n,x:previous.get(n.id)?.x||0,y:previous.get(n.id)?.y||0}));
    if(now>=solveAt){targets=compactTargets(layout,aspect);solveAt=now+180;}
    layout=approachLayout(layout,targets,hold?dt*.35:dt,p.scale,p.reduced);
    // Never freeze collision correction: current radii must fit even with the pointer held.
    layout=separateOverlaps(layout,4/Math.max(.025,p.scale));
   }
   setView({nodes:layout,epoch});raf=requestAnimationFrame(frame);
  };raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf);
 },[]);
 return view;
}
