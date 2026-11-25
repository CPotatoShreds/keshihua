import React,{useRef} from 'react';
import {formatDateTime} from './live';
export function ViewportBar({oldest,edge,end,span,onPan}){
 const ref=useRef(null),drag=useRef(null),total=Math.max(1,edge-oldest),widthFrac=Math.min(1,span/total),start=Math.max(oldest,Math.min(edge-span,end-span)),leftFrac=Math.max(0,Math.min(1-widthFrac,(start-oldest)/total));
 const point=clientX=>oldest+Math.max(0,Math.min(1,(clientX-ref.current.getBoundingClientRect().left)/ref.current.getBoundingClientRect().width))*total+span/2;
 const down=e=>{if(e.button!==0)return;const thumb=e.target.classList.contains('viewport-thumb'),next=thumb?end:Math.max(oldest+span,Math.min(edge,point(e.clientX)));onPan(next);drag.current={x:e.clientX,end:next};e.currentTarget.setPointerCapture(e.pointerId);};
 const move=e=>{const d=drag.current;if(!d)return;onPan(d.end+(e.clientX-d.x)/ref.current.getBoundingClientRect().width*total);};
 const up=e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
 const key=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onPan(end+(e.key==='ArrowLeft'?-1:1)*span*.2);}};
 return <div className="viewport-shell"><div ref={ref} className="viewport-bar" role="scrollbar" aria-label="时间视口" aria-orientation="horizontal" aria-valuemin={Math.round(oldest)} aria-valuemax={Math.round(edge)} aria-valuenow={Math.round(start)} aria-valuetext={formatDateTime(start)} tabIndex="0" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;}} onKeyDown={key}><span className="viewport-track"/><span className="viewport-thumb" style={{left:(leftFrac*100)+'%',width:(widthFrac*100)+'%'}}/></div></div>;
}
