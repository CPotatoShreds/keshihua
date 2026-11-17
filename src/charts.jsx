import React,{useId,useMemo,useRef,useState,useEffect} from 'react';
import {area,curveMonotoneX} from 'd3';
import {STEP} from '../shared/catalog.js';
import {rateAt,aggregate,valuesAt} from '../shared/lifecycle.js';
import {EMPTY,sampleAt,formatTime,formatClock,formatDateTime,formatAxis,number,wordsFor} from './live';
import {useSize} from './useSize';
import {cloudLayout} from './spatial-layout';
import {radiusFor,leaderLabels,zoomAt,fitCamera} from './bubble-world';
import {BubbleInflux} from './bubble-effects';
import {useBubbleLayout} from './useBubbleLayout';

export function BubbleMap({topics,values,time,onOpen,cameraScope='',live=false,scrubbing=false}){
 const [ref,{width:w,height:h}]=useSize(),[hover,setHover]=useState(null),[camera,setCamera]=useState({x:0,y:0,k:.55});
 const gesture=useRef(new Map()),drag=useRef(null),wheel=useRef(null),labelMemory=useRef(new Map());
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),f=()=>setReduced(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
 const items=topics.map(q=>({...q,r:radiusFor(values[q.id]?.views||0)}));
 const {nodes,epoch}=useBubbleLayout(items,{width:w,height:h,scale:camera.k,time,scrubbing,scope:cameraScope,reduced});
 useEffect(()=>{if(w>0&&h>0)setCamera(fitCamera(nodes,w,h));},[epoch]);
 const screenNodes=nodes.map(n=>({...n,x:n.x*camera.k+camera.x,y:n.y*camera.k+camera.y,r:n.r*camera.k}));
 const labels=leaderLabels(screenNodes,w,h,labelMemory.current);labelMemory.current=new Map(labels.map(l=>[l.id,l]));
 const labeled=new Set(labels.map(l=>l.id));
 const local=e=>{const b=ref.current.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
 wheel.current=e=>{e.preventDefault();const p=local(e);setCamera(c=>zoomAt(c,p,Math.exp(-e.deltaY*.002)));};
 useEffect(()=>{const el=ref.current,handler=e=>wheel.current(e);el.addEventListener('wheel',handler,{passive:false});return()=>el.removeEventListener('wheel',handler);},[]);
 const down=e=>{if(e.button!==0)return;const p=local(e);gesture.current.set(e.pointerId,p);e.currentTarget.setPointerCapture(e.pointerId);drag.current={...p,camera,moved:false,pinch:gesture.current.size>1};};
 const move=e=>{const old=gesture.current.get(e.pointerId);if(!old)return;const p=local(e);gesture.current.set(e.pointerId,p);const points=[...gesture.current.values()];if(points.length===2){const other=points.find(v=>v!==p),before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(p.x-other.x,p.y-other.y);setCamera(c=>zoomAt(c,{x:(p.x+other.x)/2,y:(p.y+other.y)/2},after/Math.max(1,before)));drag.current.moved=true;drag.current.pinch=true;return;}const d=drag.current;if(!d)return;const dx=p.x-d.x,dy=p.y-d.y;if(Math.hypot(dx,dy)>4)d.moved=true;if(d.moved&&!d.pinch)setCamera({...d.camera,x:d.camera.x+dx,y:d.camera.y+dy});};
 const up=e=>{const d=drag.current,p=local(e);gesture.current.delete(e.pointerId);if(d&&!d.moved&&!d.pinch){const x=(p.x-camera.x)/camera.k,y=(p.y-camera.y)/camera.k;const hit=nodes.slice().reverse().find(n=>Math.hypot(x-n.x,y-n.y)<=Math.max(n.r,8/camera.k));if(hit)onOpen(hit.id);}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!gesture.current.size)drag.current=null;};
 const zoom=f=>setCamera(c=>zoomAt(c,{x:w/2,y:h/2},f)),hovered=nodes.find(n=>n.id===hover);
 return <div className="bubble-canvas" ref={ref}>
 <svg width={w} height={h} role="group" aria-label="可缩放的话题流量画布" data-camera-scale={camera.k} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current.clear();drag.current=null;}} style={{touchAction:'none',cursor:drag.current?'grabbing':'grab'}}>
 <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>{nodes.map(q=>{
 const v=values[q.id]?.views||0,r=q.r,screenR=r*camera.k,name=q.title.split(' · ')[0];
 const font=Math.min(20,Math.max(12,screenR*.25)),lineLength=Math.max(3,Math.floor(screenR*1.55/font)),balancedLength=Math.ceil(name.length/Math.ceil(name.length/lineLength)),lines=name.match(new RegExp(`.{1,${balancedLength}}`,'g'))||[name];
 const inside=!labeled.has(q.id)&&screenR>=36;
 return <g key={q.id} data-topic-id={q.id} transform={`translate(${q.x} ${q.y})`}>
 <g className="topic-bubble" role="button" tabIndex="0" aria-label={`${q.title}，${number(v)}，查看详情`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(q.id);}}} onPointerEnter={()=>setHover(q.id)} onPointerLeave={()=>setHover(null)} onFocus={()=>setHover(q.id)} onBlur={()=>setHover(null)}>
 <circle r={r} fill={q.color} data-flow={v} data-radius={r}/><circle r={Math.max(r,8/camera.k)} fill="transparent" stroke="none"/>
 {inside?<><text textAnchor="middle" fontSize={font/camera.k} fill="#fff" fontWeight="600">{lines.map((line,i)=><tspan key={i} x="0" y={(i-(lines.length-1)/2)*font*1.25/camera.k}>{line}</tspan>)}</text>{screenR>52&&<text textAnchor="middle" y={(lines.length*font*.625+16)/camera.k} fontSize={11/camera.k} fill="#ffffffd9">{number(v)}</text>}</>:null}
 <title>{q.title} · {Math.round(v).toLocaleString()}</title></g></g>;
 })}</g>
 {labels.map(l=><g key={l.id} className="bubble-callout" data-label-topic={l.id}>
 <path className="bubble-leader" d={`M${l.sx},${l.sy} L${l.ex},${l.ey} H${l.endX}`} fill="none" stroke={l.color} strokeWidth="1.2" strokeLinejoin="round"/>
 <circle cx={l.sx} cy={l.sy} r="2.5" fill={l.color}/>
 <g className="bubble-label" role="button" tabIndex="0" aria-label={'查看'+l.title} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={()=>onOpen(l.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(l.id);}}}>
 <rect className="bookmark-card" x={l.x} y={l.y} width={l.width} height={l.height} rx="8"/>
 <path d={`M${l.x+12},${l.y} h9 v18 l-4.5,-3 l-4.5,3 Z`} fill={l.color}/>
 <text x={l.x+31} y={l.y+(l.lines.length===1?23:20)} fontSize="12" fontWeight="500" fill="#385465">{l.lines.map((line,i)=><tspan key={i} x={l.x+31} dy={i?17:0}>{line}</tspan>)}</text><title>{l.title}</title></g></g>)}
 </svg>
 <BubbleInflux nodes={screenNodes} width={w} height={h} enabled={live&&!reduced}/>
 {!nodes.length&&<div className="bubble-empty">这一时刻暂无匹配话题</div>}
 <div className="canvas-controls"><button aria-label="缩小气泡画布" onClick={()=>zoom(1/1.4)}>−</button><span>{Math.round(camera.k*100)}%</span><button aria-label="放大气泡画布" onClick={()=>zoom(1.4)}>+</button><button onClick={()=>setCamera(fitCamera(nodes,w,h))}>查看全貌</button><button aria-label="重置气泡比例尺" onClick={()=>setCamera({k:1,x:w/2,y:h/2})}>1:1</button></div>
 {hovered&&<div className="bubble-info"><i style={{background:hovered.color}}/><strong>{hovered.title}</strong><span>{number(values[hovered.id]?.views||0)}</span></div>}
 </div>;
}

export function Timeline({frames,topics,time,end,span,onSeek,onPan,onZoom,kind='traffic',topic=null,windowKey='m5',metric='count',selected=null,onSelect,events=[],empty=false,wheelZoom=false,onInteractionChange}){
 const [ref,{width:w,height:h}]=useSize(),clip=useId(),[probe,setProbe]=useState(null),drag=useRef(null),wheelRef=useRef(null);
 const left=58,right=20,top=14,bottom=31,pw=Math.max(20,w-left-right),ph=Math.max(50,h-top-bottom);
 const resolution=Math.max(STEP,span/Math.max(100,Math.floor(pw/3))),anchor=Math.ceil(end/resolution)*resolution,start=anchor-span,offset=(end-anchor)*pw/span;
 const series=useMemo(()=>kind==='opinion'?topic.clusters.map((c,j)=>({...c,index:j})):topics,[kind,topic,topics]);
 const average=kind==='traffic'&&resolution>60000;
 const read=(q,t)=>kind==='traffic'?(average?aggregate(q,t,resolution/60000).views/(resolution/60000):rateAt(q,t)):valuesAt(topic,t).counts[windowKey][q.index];
 const geometry=useMemo(()=>{
  const count=Math.max(100,Math.ceil(pw/3)),samples=[];let peak=0;
  if(!empty)for(let i=-1;i<=count+1;i++){const t=start+i*span/count,amounts=kind==='opinion'?valuesAt(topic,t).counts[windowKey]:series.map(q=>read(q,t)),sum=amounts.reduce((a,b)=>a+b,0);peak=Math.max(peak,sum);samples.push({time:t,amounts,sum});}
  const raw=Math.max(1,peak*1.08),power=10**Math.floor(Math.log10(raw)),ymax=kind==='opinion'&&metric==='share'?100:Math.ceil(raw/power*2)/2*power;
  const y=v=>top+ph-v/ymax*ph,points=series.map(()=>[]);
  for(const s of samples){let base=kind==='opinion'?(ymax-(metric==='share'&&s.sum?100:s.sum))/2:0;s.amounts.forEach((v,j)=>{const height=kind==='opinion'&&metric==='share'?(s.sum?v/s.sum*100:0):v;points[j].push({time:s.time,lo:base,hi:base+height});base+=height;});}
  const shape=area().x(p=>left+(p.time-start)/span*pw).y0(p=>y(p.lo)).y1(p=>y(p.hi)).curve(curveMonotoneX);
  return {ymax,paths:points.map((p,j)=>({key:series[j].id,path:shape(p)}))};
 },[series,start,span,pw,ph,left,kind,topic,windowKey,metric,empty,average,resolution]);
 const {ymax}=geometry,x=t=>left+(t-(end-span))/span*pw,y=v=>top+ph-v/ymax*ph;
 const point=e=>{const rect=ref.current.getBoundingClientRect(),px=Math.max(left,Math.min(w-right,e.clientX-rect.left)),py=e.clientY-rect.top;return {px,py,t:end-span+(px-left)/pw*span};};
 const hit=p=>{if(empty)return {...p,index:-1,values:[],sum:0};const amounts=kind==='opinion'?valuesAt(topic,p.t).counts[windowKey]:series.map(s=>read(s,p.t)),sum=amounts.reduce((a,b)=>a+b,0);let base=kind==='opinion'?(ymax-(metric==='share'&&sum?100:sum))/2:0,index=-1;amounts.forEach((v,j)=>{const high=base+(kind==='opinion'&&metric==='share'?(sum?v/sum*100:0):v);if(p.py>=y(high)&&p.py<=y(base)&&v>0)index=j;base=high;});return {...p,index,values:amounts,sum};};
 wheelRef.current=e=>{if(e.ctrlKey||e.metaKey||(wheelZoom&&!e.shiftKey&&Math.abs(e.deltaX)<=Math.abs(e.deltaY))){e.preventDefault();onZoom?.(span*Math.exp(e.deltaY*.003),point(e).t);}else{const dx=Math.abs(e.deltaX)>0?e.deltaX:e.shiftKey?e.deltaY:0;if(dx){e.preventDefault();onPan(end+dx/pw*span);}}};
 useEffect(()=>{const el=ref.current,handler=e=>wheelRef.current(e);el.addEventListener('wheel',handler,{passive:false});return()=>el.removeEventListener('wheel',handler);},[]);
 const down=e=>{if(e.button!==0)return;onInteractionChange?.(true);const p=hit(point(e));drag.current={x:p.px,end,pan:e.shiftKey||e.altKey};e.currentTarget.setPointerCapture(e.pointerId);if(!drag.current.pan){onSeek(p.t);if(kind==='opinion'&&p.index>=0)onSelect?.(series[p.index].index);}};
 const move=e=>{const p=point(e),d=drag.current;if(d){if(d.pan)onPan(d.end-(p.px-d.x)/pw*span);else onSeek(p.t);}setProbe(hit(p));};
 const up=e=>{drag.current=null;onInteractionChange?.(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
 const ticks=Math.max(2,Math.floor(pw/140)),visibleEvents=events.filter(e=>e.time>=end-span&&e.time<=Math.min(end,time));
 return <div ref={ref} className="timeline" onPointerLeave={()=>!drag.current&&setProbe(null)}>
 <svg width={w} height={h} role="slider" tabIndex="0" aria-valuemin={end-span} aria-valuemax={end} aria-valuenow={Math.max(end-span,Math.min(end,time))} aria-valuetext={formatDateTime(time)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const delta=(e.key==='ArrowLeft'?-1:1)*span/100;e.shiftKey?onPan(end+delta*10):onSeek(Math.max(end-span,Math.min(end,time+delta)));}}} data-time-start={end-span} data-time-end={end} aria-label={kind==='opinion'?'观点演化河流图':'流量演化时间图'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;setProbe(null);onInteractionChange?.(false);}} style={{cursor:'crosshair',touchAction:'none'}}>
 <defs><clipPath id={clip}><rect x={left} y={top} width={pw} height={ph}/></clipPath></defs>
 {kind==='traffic'&&[0,.5,1].map(n=><g key={n}><line x1={left} x2={w-right} y1={y(ymax*n)} y2={y(ymax*n)} stroke="#e2e9ed" strokeDasharray="3 5"/><text x={left-9} y={y(ymax*n)+4} textAnchor="end" className="axis-text">{number(ymax*n)}</text></g>)}
 <g clipPath={`url(#${clip})`}><g transform={`translate(${-offset} 0)`}>{geometry.paths.map((g,j)=><path key={g.key} d={g.path} fill={series[j].color} opacity={kind==='opinion'&&selected!==null&&selected!==j?.25:.88} stroke="white" strokeWidth=".45"/>)}</g>
 {visibleEvents.map(e=><line key={e.id} x1={x(e.time)} x2={x(e.time)} y1={top} y2={top+ph} stroke="#486b7c" strokeOpacity=".23" strokeDasharray="3 5"/>)}
 <line x1={x(time)} x2={x(time)} y1={top} y2={top+ph} stroke="#294f61" strokeWidth="1.8"/>
 {probe&&<line x1={probe.px} x2={probe.px} y1={top} y2={top+ph} stroke="#486b7c" strokeDasharray="3 4"/>}</g>
 <line x1={left} x2={w-right} y1={top+ph} y2={top+ph} stroke="#b9cbd3"/>
 {time>=end-span&&time<=end&&<circle cx={x(time)} cy={top+ph} r="5" fill="#365e70" stroke="white" strokeWidth="2"/>}
 {Array.from({length:ticks+1},(_,j)=><text key={j} x={left+j*pw/ticks} y={h-7} textAnchor={j===0?'start':j===ticks?'end':'middle'} className="axis-text">{formatAxis(end-span+j*span/ticks,span)}</text>)}
 </svg>
 {empty&&<div className="chart-empty">话题尚未开始</div>}
 {probe&&probe.index>=0&&<div className="chart-tooltip" style={{left:Math.max(6,Math.min(w-224,probe.px+14)),top:Math.max(4,Math.min(h-92,probe.py-70))}}><time>{formatDateTime(probe.t)}</time><strong><i style={{background:series[probe.index].color}}/>{series[probe.index].title}</strong><span>{number(probe.values[probe.index])}{kind==='opinion'?' 条讨论':average?' · 区间均值':''}</span></div>}
 </div>;
}

export function OpinionBars({topic,counts,selected,onSelect}){
 const total=counts.reduce((a,b)=>a+b,0),max=Math.max(1,...counts);
 const order=topic.clusters.map((c,i)=>({...c,index:i})).sort((a,b)=>counts[b.index]-counts[a.index]);
 return <div className="opinion-bars">{topic.clusters.map((c,index)=>({...c,index})).map(c=><button style={{transform:`translateY(${order.findIndex(q=>q.index===c.index)*57}px)`}} key={c.id} className={'opinion-row '+(selected===c.index?'selected':'')} aria-pressed={selected===c.index} onClick={()=>onSelect(selected===c.index?null:c.index)}><span className="bar-label"><i style={{background:c.color}}/>{c.title}<strong>{number(counts[c.index])}<small>{(counts[c.index]/Math.max(1,total)*100).toFixed(1)}%</small></strong></span><span className="bar-track"><span style={{width:counts[c.index]/max*100+'%',background:c.color,opacity:selected===null||selected===c.index?1:.3}}/></span></button>)}</div>;
}

export function WordCloud({topic,counts,selected,onWord,word}){
 const [ref,{width:w,height:h}]=useSize(),words=wordsFor(topic,counts,selected),max=Math.max(1,...words.map(q=>q.value));
 const key=topic.id+':'+selected+':'+words.map(q=>q.word).sort().join('|');
 const layout=useMemo(()=>{
  const context=document.createElement('canvas').getContext('2d');
  return cloudLayout(words,w,h,(text,size)=>{context.font=`550 ${size}px "PingFang SC","Microsoft YaHei",Arial,sans-serif`;return context.measureText(text).width;});
 },[key,w,h]);
 const current=new Map(words.map(q=>[q.word,q]));
 return <div className="wordcloud" ref={ref}>{!words.length?<p className="quiet">这一时刻还没有足够讨论</p>:<svg width={w} height={h} role="group" aria-label="观点关键词词云">{layout.map(p=>{const q=current.get(p.word);if(!q)return null;const size=p.font*(.32+.68*Math.sqrt(q.value/max));return <g key={q.word} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`} className={'cloud-word '+(word===q.word?'selected':'')} role="button" tabIndex="0" aria-label={`${q.word}，约${Math.round(q.value)}次提及，查看评论`} onClick={()=>onWord(word===q.word?null:q.word)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onWord(word===q.word?null:q.word);}}}><text y={size*.35} textAnchor="middle" fill={selected===null?q.color:'#57788a'} fontSize={size} fontWeight={q.value>max*.6?550:400}>{q.word}</text><title>{q.word} · 约{Math.round(q.value)}次提及</title></g>;})}</svg>}</div>;
}
