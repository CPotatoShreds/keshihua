import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Info,Radio} from 'lucide-react';
import {animate} from 'motion';
import {formatDateTime} from './live';
import {Timeline} from './charts';
import {TopicStage} from './topic-stage';
import {ViewportBar} from './viewport-bar';

const ease=p=>p<.5?2*p*p:1-2*(1-p)*(1-p);
export function TopicPage({topic,time,edge,oldest,events,detail,status,player,reduced,enter,tuning,replay=0,onEntered,onBack,onAbout,onSeek,onPan,onZoom,onLive}){
 const [progress,setProgress]=useState(enter?0:1),[hoverEvent,setHoverEvent]=useState(null),[pinnedEvent,setPinnedEvent]=useState(null),entered=useRef(onEntered);
 entered.current=onEntered;
 useEffect(()=>{if(!enter||reduced){setProgress(1);return;}const chartEase=tuning.chartEase==='cubic'?[.22,.8,.24,1]:tuning.chartEase;const controls=animate(0,1,{duration:tuning.chartMs/1000,ease:chartEase,onUpdate:setProgress,onComplete:()=>entered.current?.()});return()=>controls.stop();},[enter,reduced,tuning.chartMs,tuning.chartEase]);
 const from=enter?.from,morph=enter&&!reduced?progress:1,stageTime=Math.floor(time/1000)*1000;
 const focus=Math.max(0,Math.min(1,morph/Math.max(.01,tuning.focusEnd)));
 const domain=ease(Math.max(0,Math.min(1,(morph-tuning.domainStart)/Math.max(.01,tuning.domainSpan))));
 const fade=ease(Math.max(0,Math.min(1,(morph-tuning.fadeStart)/Math.max(.01,tuning.fadeSpan))));
 const end=from?from.end+(detail.end-from.end)*domain:detail.end,span=from?from.span+(detail.span-from.span)*domain:detail.span;
 const morphTopics=useMemo(()=>from?[...new Map([...from.topics,topic].map(t=>[t.id,t])).values()]:[topic],[from,topic]);
 const seriesOpacity=useMemo(()=>from?Object.fromEntries(morphTopics.map(t=>[t.id,t.id===topic.id?1:Math.max(0,1-fade)])):null,[from,morphTopics,topic.id,fade]);
 const interactive=!enter||reduced||progress>=1,eventCard=hoverEvent||pinnedEvent;
 const selectEvent=event=>{setPinnedEvent(event);setHoverEvent(event);};
 const vars={
  '--stage-l':`${tuning.stageL}fr`,'--stage-r':`${tuning.stageR}fr`,'--stage-gap':`${tuning.stageGap}px`,
  '--panel-min':`${tuning.panelMin}px`,'--stage-gap-n':`${tuning.stageGapN}px`,'--panel-min-n':`${tuning.panelMinN}px`,
  '--chart-h':`${tuning.chartH}px`,'--chart-h-m':`${tuning.chartMH}px`,'--chart-h-s':`${tuning.chartSH}px`,
  '--topic-pad-x':`${tuning.topicPadX}px`,'--topic-pad-x-m':`${tuning.topicPadXM}px`,'--topic-pad-b':`${tuning.topicPadB}px`,
  '--header-h':`${tuning.headerH}px`,'--header-h-m':`${tuning.headerHM}px`,
  '--panel-pad-x':`${tuning.panelPadX}px`,'--panel-pad-y':`${tuning.panelPadY}px`,
  '--panel-pad-x-n':`${tuning.panelPadXN}px`,'--panel-pad-y-n':`${tuning.panelPadYN}px`,
  '--panel-pad-x-ms':`${tuning.panelPadXMS}px`,'--panel-pad-y-ms':`${tuning.panelPadYMS}px`,
  '--panel-radius':`${tuning.panelRadius}px`,'--event-w':`${tuning.eventW}px`,
  '--drawer-h':`${tuning.drawerH}vh`,'--drawer-h-s':`${tuning.drawerHS}vh`,'--drawer-ms':`${tuning.drawerMs}ms`,
  '--orbit-vh':`${tuning.orbitVH}vh`,'--orbit-vh-s':`${tuning.orbitVHS}vh`,
  '--header-fade-delay':`${tuning.headerFadeDelay}ms`,'--header-fade-dur':`${tuning.headerFadeDur}ms`,
  '--panel-fade-delay':`${tuning.panelFadeDelay}ms`,'--panel-fade-dur':`${tuning.panelFadeDur}ms`
 };
 return <main className="main topic-page" style={vars}>
  <header className="topic-header">
   <button className="topic-back" onClick={onBack} aria-label="返回总览"><ArrowLeft size={tuning.iconBack} strokeWidth={tuning.iconStroke}/></button>
   <i className="topic-marker" style={{background:topic.color}}/>
   <h1>{topic.title}</h1>
   <div className="topic-header-right">
    <span className={'connection '+(status==='connected'?'online':'')}><i/>{status==='connected'?'持续更新':status==='reconnecting'?'正在重连':status==='error'?'连接暂不可用':'正在连接'}</span>
    <button className="icon-button" aria-label="关于观潮" onClick={onAbout}><Info size={tuning.iconInfo} strokeWidth={tuning.iconStroke}/></button>
   </div>
  </header>
  <div className="page-content topic-content">
   <TopicStage topic={topic} time={stageTime} reduced={reduced} enter={enter} tuning={tuning} replay={replay}/>
   <section className="topic-chart">
    <div className="topic-chart-head">
     <h2>话题流量</h2><span className="topic-chart-hint">拖动定位 · 滚轮缩放 · 底部平移</span>
     <div className="chart-tools"><time className="playhead-time">{formatDateTime(time)}</time><button className={'live-button '+(player.mode==='live'?'active':'')} onClick={onLive}><Radio size={tuning.iconRadio} strokeWidth={tuning.iconStroke}/>{player.mode==='live'?'现在':'回到现在'}</button></div>
    </div>
    <div className="chart-box"><Timeline frames={[]} topics={morphTopics} topic={topic} time={time} end={end} span={span} empty={time<=topic.bornAt} onSeek={interactive?onSeek:()=>{}} onPan={interactive?onPan:()=>{}} onZoom={interactive?onZoom:()=>{}} events={events} wheelZoom seriesOpacity={seriesOpacity} onEventHover={setHoverEvent} onEventClick={selectEvent} pinnedEventId={pinnedEvent?.id} focusTopic={from?topic.id:null} focus={focus} focusStroke={tuning.focusStroke}/></div>
    <ViewportBar oldest={oldest} edge={edge} end={end} span={span} onPan={interactive?onPan:()=>{}}/>
    {eventCard&&<div className="event-card" role="dialog" aria-label="事件详情">
     <div className="event-card-head"><span className="event-tag">{eventCard.kind}</span><time>{formatDateTime(eventCard.time)}</time><button aria-label="关闭事件卡片" onClick={()=>{setPinnedEvent(null);setHoverEvent(null);}}>×</button></div>
     <h3>{eventCard.title}</h3><p>{eventCard.body}</p>
    </div>}
   </section>
  </div>
 </main>;
}
