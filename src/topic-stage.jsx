import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {pie,arc} from 'd3';
import {motion} from 'motion/react';
import {animate} from 'motion';
import {valuesAt} from '../shared/lifecycle';
import {number} from './live';
import {cloudInCircle} from './spatial-layout';
import {useSize} from './useSize';
import {WordTree} from './word-tree';
import {OpinionBars} from './charts';
import {Discussion} from './discussion';
import {useTopicData} from './topic-data';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function EmotionLegend({items,total,selected,onSelect,onHover}){
 if(!items?.length)return null;
 return <div className="topic-emotion-legend" aria-label="情绪占比">
  {items.map(item=>{
   const active=selected===item.id,share=total>0?item.value/total*100:0;
   return <button key={item.id} className={'emotion-legend-chip '+(active?'active':'')} style={{'--chip':item.color}} onClick={()=>item.id==='other'?onSelect(null):onSelect(selected===item.id?null:item.id)} onPointerEnter={()=>onHover(item.id)} onPointerLeave={()=>onHover(null)} title={`${item.title} · ${share.toFixed(1)}%`}>
    <i/>{item.title}<small>{share.toFixed(0)}%</small>
   </button>;
  })}
 </div>;
}

export const TopicStage=React.memo(function TopicStage({topic,time,frames,corpus=null,reduced=false,enter=null,tuning,replay=0,onTuning}){
 const [areaRef,{width:w,height:h}]=useSize(),orbitRef=useRef(null);
 const [opinion,setOpinion]=useState(null),[emotion,setEmotion]=useState(null),[hoverCluster,setHoverCluster]=useState(null),[hoverEmotion,setHoverEmotion]=useState(null),[hoverWord,setHoverWord]=useState(null),[pinnedWord,setPinnedWord]=useState(null),[drawerOpen,setDrawerOpen]=useState(false);
 const [tab,setTab]=useState('opinion'),[lastTab,setLastTab]=useState('opinion');
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
 const treeWord=pinnedWord||hoverWord;
 const data=useTopicData({topic,time,frames,opinion,emotion,tuning,tab,initialCorpus:corpus});
 const counts=data.counts,raw=data.raw,total=counts.reduce((a,b)=>a+b,0),live=valuesAt(topic,time),views=live.views||0;
 const emotionTotal=data.emotionRing.reduce((sum,item)=>sum+Math.max(0,item.value||0),0);
 const [ringDraw,setRingDraw]=useState(reduced?1:0);
 useLayoutEffect(()=>{
  if(reduced){setRingDraw(1);return;}
  setRingDraw(0);
  const controls=animate(0,1,{duration:tuning.ringDur/1000,delay:tuning.ringDelay/1000,ease:tuning.ringEase,onUpdate:v=>setRingDraw(v)});
  // Hidden/background tabs can throttle rAF; never leave the ring permanently empty.
  const fallback=setTimeout(()=>setRingDraw(1),tuning.ringDelay+tuning.ringDur+260);
  return()=>{controls.stop();clearTimeout(fallback);};
 },[reduced,tuning.ringDur,tuning.ringDelay,tuning.ringEase,replay]);
 const ringPadPx=tuning.ringGap+tuning.ringThick+tuning.emotionRingGap+tuning.emotionRingThick+2;
 const noteReserve=26;
 const minSide=Math.min(w,h),bubbleR=Math.max(76,Math.min(minSide*tuning.bubbleFactor,(minSide-noteReserve)/2-ringPadPx)),orbit=2*(bubbleR+ringPadPx),cx=orbit/2,cy=orbit/2;
 const measure=useMemo(()=>{const ctx=document.createElement('canvas').getContext('2d');return(text,size)=>{ctx.font=`600 ${size}px "PingFang SC","Microsoft YaHei",Arial,sans-serif`;return ctx.measureText(text).width;};},[]);
 const layout=useMemo(()=>{const tries=[tuning.cloudMax,Math.round(tuning.cloudMax*.78),Math.round(tuning.cloudMax*.57),Math.round(tuning.cloudMax*.43)].filter((n,i,a)=>n>0&&a.indexOf(n)===i);for(const n of tries){const p=cloudInCircle(data.words.slice(0,n),cx,cy,bubbleR*tuning.cloudFactor,measure,{minFont:tuning.cloudMinFont,maxFont:tuning.cloudMaxFont,gap:tuning.cloudGap});if(p.length)return p;}return [];},[data.words,cx,cy,bubbleR,measure,tuning.cloudMax,tuning.cloudFactor,tuning.cloudMinFont,tuning.cloudMaxFont,tuning.cloudGap]);
 const ring=useMemo(()=>{
  if(!(total>0))return [];
  const inner=bubbleR+tuning.ringGap,outer=inner+tuning.ringThick,sweep=-Math.PI/2+ringDraw*Math.PI*2,arcGen=arc().innerRadius(inner).outerRadius(outer).cornerRadius(tuning.ringCorner),hotGen=arc().innerRadius(Math.max(bubbleR+1,inner-2)).outerRadius(outer+tuning.ringHot).cornerRadius(tuning.ringCorner);
  return pie().value(d=>d).sort(null).padAngle(tuning.ringPad).startAngle(-Math.PI/2).endAngle(Math.PI*1.5)(counts).map((d,i)=>{
   const visibleEnd=Math.min(d.endAngle,sweep);
   if(visibleEnd<=d.startAngle+1e-6)return null;
   const partial={...d,endAngle:visibleEnd};
   return {...partial,index:i,path:arcGen(partial),hot:hotGen(partial),color:topic.clusters[i]?.color||'#9aa9b0'};
  }).filter(Boolean);
 },[counts,total,bubbleR,topic,ringDraw,tuning.ringGap,tuning.ringThick,tuning.ringCorner,tuning.ringPad,tuning.ringHot]);
 const outerRing=useMemo(()=>{
  if(!(emotionTotal>0))return [];
  const inner=bubbleR+tuning.ringGap+tuning.ringThick+tuning.emotionRingGap,outer=inner+tuning.emotionRingThick,sweep=-Math.PI/2+ringDraw*Math.PI*2,arcGen=arc().innerRadius(inner).outerRadius(outer).cornerRadius(tuning.emotionRingCorner),hotGen=arc().innerRadius(Math.max(bubbleR+1,inner-1)).outerRadius(outer+tuning.emotionHot).cornerRadius(tuning.emotionRingCorner);
  return pie().value(d=>Math.max(0,d.value)).sort(null).padAngle(tuning.emotionRingPad).startAngle(-Math.PI/2).endAngle(Math.PI*1.5)(data.emotionRing).map((d,i)=>{
   const visibleEnd=Math.min(d.endAngle,sweep);
   if(visibleEnd<=d.startAngle+1e-6)return null;
   const partial={...d,endAngle:visibleEnd};
   return {...partial,index:i,id:d.data.id,path:arcGen(partial),hot:hotGen(partial),color:d.data.color,title:d.data.title,value:d.data.value};
  }).filter(Boolean);
 },[data.emotionRing,emotionTotal,bubbleR,ringDraw,tuning.ringGap,tuning.ringThick,tuning.emotionRingGap,tuning.emotionRingThick,tuning.emotionRingCorner,tuning.emotionRingPad,tuning.emotionHot]);
 const name=topic.title.split(' · ')[0],titleFont=clamp(bubbleR*tuning.titleFont,tuning.titleMin,tuning.titleMax),titleLength=Math.max(4,Math.floor(bubbleR*1.5/titleFont)),titleLines=name.match(new RegExp(`.{1,${titleLength}}`,'g'))||[name];
 const selectedColor=opinion===null?'#547c8e':topic.clusters[opinion]?.color||'#547c8e';
 const chooseOpinion=index=>{setOpinion(index);setPinnedWord(null);setHoverWord(null);if(compact)setDrawerOpen(true);};
 const chooseEmotion=id=>{setEmotion(id);setPinnedWord(null);setHoverWord(null);if(compact)setDrawerOpen(true);};
 const openPanel=()=>{if(compact)setDrawerOpen(true);};
 const openTree=word=>{setPinnedWord(word);setLastTab(tab==='tree'?lastTab:tab);setTab('tree');openPanel();};
 const closeTree=()=>{setPinnedWord(null);setHoverWord(null);setTab(lastTab);};
 const wordColor=word=>opinion===null?topic.clusters[word.cluster]?.color||'#547c8e':topic.clusters[opinion]?.color||'#547c8e';
 const corpusState=data.corpus?.status||'starting';
 return <div className="topic-stage">
  <div className="topic-orbit-area" ref={areaRef}>
   {w>0&&h>0&&<div key={replay} className={`topic-orbit ${enter&&!reduced?'flying':''}`} ref={orbitRef} style={{width:orbit,height:orbit}}>
    <svg width={orbit} height={orbit} role="group" aria-label={`${topic.title}的词云、观点环与情绪环`}>
     <circle cx={orbit/2} cy={orbit/2} r={bubbleR} fill={topic.color} opacity={tuning.bubbleFill} stroke={topic.color} strokeOpacity={tuning.bubbleStroke} strokeWidth={tuning.bubbleStrokeW}/>
     <motion.g className="topic-flight-title" transform={`translate(${cx} ${cy})`} initial={reduced?{opacity:0}:{opacity:1}} animate={{opacity:0}} transition={reduced?{duration:0}:{delay:tuning.titleDelay/1000,duration:tuning.titleFade/1000,ease:tuning.titleEase}}>
      <text textAnchor="middle" fontSize={titleFont} fontWeight="600" fill="#35566a">{titleLines.map((line,i)=><tspan key={i} x="0" y={(i-(titleLines.length-1)/2)*titleFont*1.2}>{line}</tspan>)}</text>
      <text textAnchor="middle" y={titleLines.length*titleFont*.6+14} fontSize={tuning.titleValueFont} fill="#5f7b8a">{number(views)}</text>
     </motion.g>
     <g className="topic-words">{layout.map((n,i)=>{const word=n.word,color=wordColor(n),on=hoverWord===word||pinnedWord===word;return <motion.g key={word} transform={`translate(${n.x} ${n.y})`} initial={reduced?false:{opacity:0}} animate={{opacity:1}} transition={reduced?{duration:0}:{duration:tuning.wordDur/1000,delay:tuning.wordDelay/1000+(i/Math.max(1,layout.length))*(tuning.wordStep/1000),ease:tuning.wordEase}} className={'topic-word '+(on?'active':'')} role="button" tabIndex="0" aria-label={`${word}，约${Math.round(n.value)}次加权提及`} onPointerEnter={()=>{setHoverWord(word);setHoverCluster(n.cluster);}} onPointerLeave={()=>{setHoverWord(null);setHoverCluster(null);}} onFocus={()=>{setHoverWord(word);setHoverCluster(n.cluster);}} onBlur={()=>setHoverWord(null)} onClick={()=>openTree(word)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTree(word);}}}>
      {on&&<rect x={-n.bw/2} y={-n.bh/2} width={n.bw} height={n.bh} rx="5" fill={color} opacity=".16"/>}
      <text y={n.font*.34} textAnchor="middle" fontSize={n.font} fontWeight={n.value>8?600:500} fill={color}>{word}</text>
      <title>{word} · 约{Math.round(n.value)}次加权提及</title>
     </motion.g>;})}</g>
     <g className="topic-ring" transform={`translate(${cx} ${cy})`}>{ring.map(r=>{const on=opinion===r.index||hoverCluster===r.index;return <path key={'o'+r.index} d={on?r.hot:r.path} fill={r.color} opacity={opinion!==null&&!on?.45:.92} role="button" tabIndex="0" aria-label={`${topic.clusters[r.index]?.title}，${((counts[r.index]/Math.max(1,total))*100).toFixed(1)}%`} onPointerEnter={()=>setHoverCluster(r.index)} onPointerLeave={()=>setHoverCluster(null)} onFocus={()=>setHoverCluster(r.index)} onBlur={()=>setHoverCluster(null)} onClick={()=>chooseOpinion(opinion===r.index?null:r.index)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseOpinion(opinion===r.index?null:r.index);}}} stroke="white" strokeWidth={tuning.ringStroke}><title>{topic.clusters[r.index]?.title} · {((counts[r.index]/Math.max(1,total))*100).toFixed(1)}% · 讨论量 {number(raw[r.index]||0)}</title></path>;})}</g>
     <g className="topic-emotion-ring" transform={`translate(${cx} ${cy})`}>{outerRing.map(r=>{const on=emotion===r.id||hoverEmotion===r.id;return <path key={'e'+r.id} d={on?r.hot:r.path} fill={r.color} opacity={emotion!==null&&!on?.4:.86} role="button" tabIndex="0" aria-label={`${r.title}，${((r.value/Math.max(1,emotionTotal))*100).toFixed(1)}%`} onPointerEnter={()=>setHoverEmotion(r.id)} onPointerLeave={()=>setHoverEmotion(null)} onFocus={()=>setHoverEmotion(r.id)} onBlur={()=>setHoverEmotion(null)} onClick={()=>{if(r.id==='other')setEmotion(null);else chooseEmotion(emotion===r.id?null:r.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(r.id==='other')setEmotion(null);else chooseEmotion(emotion===r.id?null:r.id);}}} stroke="white" strokeWidth={tuning.emotionRingStroke}><title>{r.title} · {((r.value/Math.max(1,emotionTotal))*100).toFixed(1)}%</title></path>;})}</g>
    </svg>
   </div>}
   <p className="topic-stage-note">内环为互动加权观点 · 外环为情绪 Top {tuning.emotionTop} · 词云来自近 {Math.round((tuning.textWindow||60))} 分钟模拟语料{corpusState!=='live'&&<span className="corpus-offline"> · 语料源{corpusState==='offline'?'离线':'接入中'}</span>}</p>
  </div>
  {compact&&drawerOpen&&<div className="topic-drawer-backdrop" onClick={()=>setDrawerOpen(false)}/>}
  <aside className={'topic-panel '+(drawerOpen?'open ':'')+(tab==='discussion'?'has-discussion':'')}>
   <button className="topic-panel-close" aria-label="收起面板" onClick={()=>setDrawerOpen(false)}>×</button>
   <div className="topic-panel-tabs" role="tablist">
    <button role="tab" aria-selected={tab==='opinion'} className={tab==='opinion'?'active':''} onClick={()=>setTab('opinion')}>观点</button>
    <button role="tab" aria-selected={tab==='discussion'} className={tab==='discussion'?'active':''} onClick={()=>setTab('discussion')}>讨论</button>
    <button role="tab" aria-selected={tab==='tree'} className={tab==='tree'?'active':''} disabled={!treeWord} onClick={()=>setTab('tree')}>词树</button>
   </div>
   {tab==='opinion'&&<>
    <div className="topic-panel-title"><strong>此刻的主流观点</strong><span>近1小时 · 互动加权</span></div>
    {total>0?<OpinionBars topic={topic} counts={counts} raw={raw} selected={opinion} onSelect={chooseOpinion} hovered={hoverCluster} onHover={setHoverCluster}/>:<p className="topic-panel-hint">语料正在接入，环形与条形暂不可用。</p>}
    <EmotionLegend items={data.emotionRing} total={emotionTotal} selected={emotion} onSelect={chooseEmotion} onHover={setHoverEmotion}/>
    <p className="topic-panel-hint">点击内环观点或外环情绪筛选 · 点击词云查看前后文</p>
   </>}
   {tab==='discussion'&&<Discussion topic={topic} data={data.discussion} state={data.discussionState} error={data.discussionError} opinion={opinion} emotion={emotion} sort={tuning.discussionSort||'hot'} windowHours={tuning.discussionWindow||6} onOpinion={chooseOpinion} onEmotion={chooseEmotion} onSort={value=>onTuning?.('discussionSort',value)} onWord={openTree} onLoadMore={data.loadMore} loadingMore={data.loadingMore}/>}
   {tab==='tree'&&(treeWord?<>
    <div className="topic-panel-title"><strong>「{treeWord}」的前后文</strong><button onClick={closeTree}>返回{lastTab==='discussion'?'讨论':'观点'}</button></div>
    <WordTree texts={data.records} root={treeWord} color={selectedColor} compact={compact} tuning={tuning} onRootChange={word=>{setPinnedWord(word);setTab('tree');openPanel();}}/>
   </>:<p className="topic-panel-hint">悬浮或点击词云中的词，查看它的前后文。</p>)}
  </aside>
 </div>;
});
