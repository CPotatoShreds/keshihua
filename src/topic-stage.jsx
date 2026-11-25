import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {pie,arc} from 'd3';
import {motion} from 'motion/react';
import {animate} from 'motion';
import {corpusFor,corpusTexts,corpusWords} from '../shared/corpus';
import {valuesAt} from '../shared/lifecycle';
import {number} from './live';
import {cloudInCircle} from './spatial-layout';
import {useSize} from './useSize';
import {WordTree} from './word-tree';
import {OpinionBars} from './charts';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TopicStage=React.memo(function TopicStage({topic,time,reduced=false,enter=null,tuning,replay=0}){
 const [areaRef,{width:w,height:h}]=useSize(),orbitRef=useRef(null);
 const [opinion,setOpinion]=useState(null),[hoverCluster,setHoverCluster]=useState(null),[hoverWord,setHoverWord]=useState(null),[pinnedWord,setPinnedWord]=useState(null),[drawerOpen,setDrawerOpen]=useState(false);
 const [compact,setCompact]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(max-width:800px)').matches);
 useEffect(()=>{const m=matchMedia('(max-width:800px)'),f=()=>setCompact(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
 useEffect(()=>{
  if(!enter||reduced)return;
  let alive=true,raf1=0,raf2=0;
  const start=()=>{
   if(!alive)return;
   const el=orbitRef.current,s=enter.sourceRect;
   if(!el||!s){raf1=requestAnimationFrame(start);return;}
   const rect=el.getBoundingClientRect();
   if(rect.width<2||rect.height<2){raf1=requestAnimationFrame(start);return;}
   const scale=clamp(Math.min(s.w/rect.width,s.h/rect.height),.12,1),dx=s.x+s.w/2-(rect.left+rect.width/2),dy=s.y+s.h/2-(rect.top+rect.height/2);
   el.style.transition='none';el.style.transform=`translate(${dx}px,${dy}px) scale(${scale})`;
   raf2=requestAnimationFrame(()=>{if(!alive)return;raf2=requestAnimationFrame(()=>{if(!alive)return;el.style.transition=`transform ${tuning.flightMs}ms ${tuning.flightEase}`;el.style.transform='translate(0,0) scale(1)';});});
  };
  raf1=requestAnimationFrame(start);
  return()=>{alive=false;cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);const el=orbitRef.current;if(el){el.style.transition='';el.style.transform='';}};
 },[enter,reduced,replay]);
 const bucket=Math.floor(time/60000),corpus=useMemo(()=>corpusFor(topic,time,{minutes:60,size:600}),[topic.id,bucket]);
 const live=valuesAt(topic,time),counts=live.counts.h1||[0,0,0,0,0],views=live.views||0,total=counts.reduce((a,b)=>a+b,0);
 const [ringDraw,setRingDraw]=useState(reduced?1:0);
 useLayoutEffect(()=>{if(reduced){setRingDraw(1);return;}setRingDraw(0);const controls=animate(0,1,{duration:tuning.ringDur/1000,delay:tuning.ringDelay/1000,ease:tuning.ringEase,onUpdate:v=>setRingDraw(v)});return()=>controls.stop();},[reduced,tuning.ringDur,tuning.ringDelay,tuning.ringEase,replay]);
 const words=useMemo(()=>corpusWords(corpus,opinion,tuning.cloudMax),[corpus,opinion,tuning.cloudMax]),treeTexts=useMemo(()=>corpusTexts(corpus,opinion),[corpus,opinion]);
 const ringPadPx=tuning.ringGap+tuning.ringThick+2;
 const minSide=Math.min(w,h),bubbleR=Math.max(76,Math.min(minSide*tuning.bubbleFactor,minSide/2-ringPadPx)),orbit=2*(bubbleR+ringPadPx),cx=orbit/2,cy=orbit/2;
 const measure=useMemo(()=>{const ctx=document.createElement('canvas').getContext('2d');return(text,size)=>{ctx.font=`600 ${size}px "PingFang SC","Microsoft YaHei",Arial,sans-serif`;return ctx.measureText(text).width;};},[]);
 const layout=useMemo(()=>{const tries=[tuning.cloudMax,Math.round(tuning.cloudMax*.78),Math.round(tuning.cloudMax*.57),Math.round(tuning.cloudMax*.43)].filter((n,i,a)=>n>0&&a.indexOf(n)===i);for(const n of tries){const p=cloudInCircle(words.slice(0,n),cx,cy,bubbleR*tuning.cloudFactor,measure,{minFont:tuning.cloudMinFont,maxFont:tuning.cloudMaxFont,gap:tuning.cloudGap});if(p.length)return p;}return [];},[words,cx,cy,bubbleR,measure,tuning.cloudMax,tuning.cloudFactor,tuning.cloudMinFont,tuning.cloudMaxFont,tuning.cloudGap]);
 const ring=useMemo(()=>{if(!(total>0))return [];const inner=bubbleR+tuning.ringGap,outer=inner+tuning.ringThick,sweep=-Math.PI/2+ringDraw*Math.PI*2,arcGen=arc().innerRadius(inner).outerRadius(outer).cornerRadius(tuning.ringCorner),hotGen=arc().innerRadius(Math.max(bubbleR+1,inner-2)).outerRadius(outer+tuning.ringHot).cornerRadius(tuning.ringCorner);return pie().value(d=>d).sort(null).padAngle(tuning.ringPad).startAngle(-Math.PI/2).endAngle(Math.PI*1.5)(counts).map((d,i)=>{const visibleEnd=Math.min(d.endAngle,sweep);if(visibleEnd<=d.startAngle+1e-6)return null;const partial={...d,endAngle:visibleEnd};return {...partial,index:i,path:arcGen(partial),hot:hotGen(partial),color:topic.clusters[i]?.color||'#9aa9b0'};}).filter(Boolean);},[counts,total,bubbleR,topic,ringDraw,tuning.ringGap,tuning.ringThick,tuning.ringCorner,tuning.ringPad,tuning.ringHot]);
 const name=topic.title.split(' · ')[0],titleFont=clamp(bubbleR*tuning.titleFont,tuning.titleMin,tuning.titleMax),titleLength=Math.max(4,Math.floor(bubbleR*1.5/titleFont)),titleLines=name.match(new RegExp(`.{1,${titleLength}}`,'g'))||[name];
 const treeWord=pinnedWord||hoverWord,selectedColor=opinion===null?'#547c8e':topic.clusters[opinion]?.color||'#547c8e';
 const chooseOpinion=index=>{setOpinion(index);setPinnedWord(null);setHoverWord(null);if(compact)setDrawerOpen(true);};
 const openPanel=()=>{if(compact)setDrawerOpen(true);};
 const wordColor=word=>opinion===null?topic.clusters[word.cluster]?.color||'#547c8e':topic.clusters[opinion]?.color||'#547c8e';
 return <div className="topic-stage">
  <div className="topic-orbit-area" ref={areaRef}>
   {w>0&&h>0&&<div key={replay} className={`topic-orbit ${enter&&!reduced?'flying':''}`} ref={orbitRef} style={{width:orbit,height:orbit}}>
    <svg width={orbit} height={orbit} role="group" aria-label={`${topic.title}的词云与舆论环`}>
     <circle cx={orbit/2} cy={orbit/2} r={bubbleR} fill={topic.color} opacity={tuning.bubbleFill} stroke={topic.color} strokeOpacity={tuning.bubbleStroke} strokeWidth={tuning.bubbleStrokeW}/>
     <motion.g className="topic-flight-title" transform={`translate(${cx} ${cy})`} initial={reduced?{opacity:0}:{opacity:1}} animate={{opacity:0}} transition={reduced?{duration:0}:{delay:tuning.titleDelay/1000,duration:tuning.titleFade/1000,ease:tuning.titleEase}}>
      <text textAnchor="middle" fontSize={titleFont} fontWeight="600" fill="#35566a">{titleLines.map((line,i)=><tspan key={i} x="0" y={(i-(titleLines.length-1)/2)*titleFont*1.2}>{line}</tspan>)}</text>
      <text textAnchor="middle" y={titleLines.length*titleFont*.6+14} fontSize={tuning.titleValueFont} fill="#5f7b8a">{number(views)}</text>
     </motion.g>
     <g className="topic-words">{layout.map((n,i)=>{const word=n.word,color=wordColor(n),on=hoverWord===word||pinnedWord===word;return <motion.g key={word} transform={`translate(${n.x} ${n.y})`} initial={reduced?false:{opacity:0}} animate={{opacity:1}} transition={reduced?{duration:0}:{duration:tuning.wordDur/1000,delay:tuning.wordDelay/1000+(i/Math.max(1,layout.length))*(tuning.wordStep/1000),ease:tuning.wordEase}} className={'topic-word '+(on?'active':'')} role="button" tabIndex="0" aria-label={`${word}，约${Math.round(n.value)}次提及`} onPointerEnter={()=>{setHoverWord(word);setHoverCluster(n.cluster);}} onPointerLeave={()=>{setHoverWord(null);setHoverCluster(null);}} onFocus={()=>{setHoverWord(word);setHoverCluster(n.cluster);}} onBlur={()=>setHoverWord(null)} onClick={()=>{setPinnedWord(word);setHoverWord(null);openPanel();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPinnedWord(word);openPanel();}}}>
      {on&&<rect x={-n.bw/2} y={-n.bh/2} width={n.bw} height={n.bh} rx="5" fill={color} opacity=".16"/>}
      <text y={n.font*.34} textAnchor="middle" fontSize={n.font} fontWeight={n.value>8?600:500} fill={color}>{word}</text>
      <title>{word} · 约{Math.round(n.value)}次提及</title>
     </motion.g>;})}</g>
     <g className="topic-ring" transform={`translate(${cx} ${cy})`}>{ring.map(r=>{const on=opinion===r.index||hoverCluster===r.index;return <path key={r.index} d={on?r.hot:r.path} fill={r.color} opacity={opinion!==null&&!on?.45:.92} role="button" tabIndex="0" aria-label={`${topic.clusters[r.index]?.title}，${((counts[r.index]/Math.max(1,total))*100).toFixed(1)}%`} onPointerEnter={()=>setHoverCluster(r.index)} onPointerLeave={()=>setHoverCluster(null)} onFocus={()=>setHoverCluster(r.index)} onBlur={()=>setHoverCluster(null)} onClick={()=>chooseOpinion(opinion===r.index?null:r.index)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseOpinion(opinion===r.index?null:r.index);}}} stroke="white" strokeWidth={tuning.ringStroke}><title>{topic.clusters[r.index]?.title} · {((counts[r.index]/Math.max(1,total))*100).toFixed(1)}%</title></path>;})}</g>
    </svg>
   </div>}
   <p className="topic-stage-note">环形为当前舆论占比 · 词云来自近一小时模拟语料</p>
  </div>
  {compact&&drawerOpen&&<div className="topic-drawer-backdrop" onClick={()=>setDrawerOpen(false)}/>}
  <aside className={'topic-panel '+(drawerOpen?'open':'')}>
   <button className="topic-panel-close" aria-label="收起面板" onClick={()=>setDrawerOpen(false)}>×</button>
   {treeWord?<>
    <div className="topic-panel-title"><strong>「{treeWord}」的前后文</strong><button onClick={()=>{setPinnedWord(null);setHoverWord(null);}}>返回观点</button></div>
    <WordTree texts={treeTexts} root={treeWord} color={selectedColor} compact={compact} tuning={tuning} onRootChange={word=>{setPinnedWord(word);openPanel();}}/>
   </>:<>
    <div className="topic-panel-title"><strong>此刻的主流观点</strong><span>近1小时</span></div>
    <OpinionBars topic={topic} counts={counts} selected={opinion} onSelect={chooseOpinion} hovered={hoverCluster} onHover={setHoverCluster}/>
    <p className="topic-panel-hint">悬浮词云看前后文 · 悬浮环形看对应观点</p>
   </>}
  </aside>
 </div>;
});
