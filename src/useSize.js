import {useEffect,useRef,useState} from 'react';
export function useSize(){
 const ref=useRef(null),[size,setSize]=useState({width:900,height:260});
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const apply=(width,height)=>{width=Math.max(1,width);height=Math.max(1,height);setSize(s=>s.width===width&&s.height===height?s:{width,height});};
  const measure=()=>{const r=el.getBoundingClientRect();apply(r.width,r.height);};
  measure();
  const observer=new ResizeObserver(([e])=>apply(e.contentRect.width,e.contentRect.height));
  observer.observe(el);
  window.addEventListener('resize',measure);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[]);
 return [ref,size];
}
