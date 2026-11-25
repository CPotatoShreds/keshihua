import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Search,Radio,X,ChevronRight,Download} from 'lucide-react';
import {useFeed,usePlayer,matching,clampViewport,detailViewport,formatDateTime} from './live';
import {BubbleMap,Timeline} from './charts';
import {ViewportBar} from './viewport-bar';
import {TopicPage} from './topic-page';
import {TUNING_DEFAULTS,loadTuning,saveTuning,clearTuning} from './tuning';
import './style.css';
import {valuesAt} from '../shared/lifecycle';
import {RETENTION} from '../shared/catalog';
const DAY=86400000,TUNING_ENABLED=import.meta.env.DEV||new URLSearchParams(location.search).has('tune');
const TuningPanel=TUNING_ENABLED?React.lazy(()=>import('./tuning-panel').then(m=>({default:m.TuningPanel}))):null;
function App(){
 const {data,status,retry}=useFeed(),player=usePlayer(data);
 const [scrubbing,setScrubbing]=useState(false),[selected,setSelected]=useState(null),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[overviewSpan,setOverviewSpan]=useState(7*DAY),[detailWindow,setDetailWindow]=useState(null),[fixedEnd,setFixedEnd]=useState(null),[info,setInfo]=useState(false),[enter,setEnter]=useState(null),[departing,setDeparting]=useState(null);
 const [tuning,setTuning]=useState(loadTuning),[replay,setReplay]=useState(0);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),infoRef=useRef(null);
 useEffect(()=>{saveTuning(tuning);},[tuning]);
 useEffect(()=>{if(!searchOpen)return;const dismiss=e=>{if(!e.target.closest('.search-wrap'))setSearchOpen(false);};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[searchOpen]);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 useEffect(()=>{if(!info)return;const prev=document.activeElement;infoRef.current.querySelector('button').focus();const key=e=>{if(e.key==='Escape')setInfo(false);if(e.key==='Tab'){const a=infoRef.current.querySelectorAll('button,a');if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a[a.length-1].focus();}else if(!e.shiftKey&&document.activeElement===a[a.length-1]){e.preventDefault();a[0].focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prev?.focus();};},[info]);
 const time=player.time||data?.frames.at(-1)?.time||Date.now(),edge=player.edge||time,oldest=data?.retentionStart??time-RETENTION,topics=data?.topics||[],topic=topics.find(q=>q.id===selected);
 const detail=topic?detailViewport(topic.bornAt,time,oldest,edge,'auto',detailWindow):null;
 const span=detail?.span??overviewSpan,end=detail?.end??clampViewport(fixedEnd===null?time:fixedEnd,overviewSpan,oldest,edge);
 const snapshot=data?{time,values:Object.fromEntries(topics.filter(q=>q.bornAt<=time&&q.endsAt+3600000>=time).map(q=>[q.id,valuesAt(q,time)]))}:null,values=snapshot?.values||{};
 const filtered=useMemo(()=>topics.filter(q=>matching(q,query)),[topics,query]);
 const active=filtered.filter(q=>q.bornAt<=time&&(values[q.id]?.views||0)>0),ranked=active.slice().sort((a,b)=>(values[b.id]?.views||0)-(values[a.id]?.views||0)),shown=ranked.length>14?ranked.slice(0,14):ranked;
 const chartTopics=useMemo(()=>{if(selected)return [];const visible=filtered.filter(q=>q.bornAt<=end&&q.endsAt>=end-span).sort((a,b)=>b.amplitude-a.amplitude);return visible.length>24?visible.slice(0,24):visible;},[selected,filtered,end,span]);
 const allTopicEvents=useMemo(()=>data?.events.filter(e=>e.topicId===selected)||[],[data?.events,selected]);
 const openTopic=(id,source=null)=>{if(!id||id===selected)return;const target=topics.find(q=>q.id===id);if(!target)return;
  const from={topics:chartTopics,end,span};
  if(time<target.bornAt||time>target.endsAt)player.seek(Math.min(edge,target.bornAt+(target.endsAt-target.bornAt)*.35));
  const rect=source?{x:source.x,y:source.y,w:source.width??source.w,h:source.height??source.h}:null;
  setSearchOpen(false);
  if(!reduced&&rect){
   setDeparting(id);
   const enterNext={topicId:id,sourceRect:rect,from,startedAt:performance.now()};
   setTimeout(()=>{flushSync(()=>{setSelected(id);setDetailWindow(null);setEnter(enterNext);setDeparting(null);});},tuning.departMs);
  }else flushSync(()=>{setSelected(id);setDetailWindow(null);setEnter(null);});
 };
 const back=()=>{if(!selected)return;setDeparting(null);const change=()=>flushSync(()=>{setSelected(null);setEnter(null);setDetailWindow(null);});if(document.startViewTransition&&!reduced)document.startViewTransition(change);else change();};
 const seek=t=>{if(topic)setDetailWindow({end,span});else setFixedEnd(end);player.seek(t);};
 const pan=t=>topic?setDetailWindow({end:t,span}):setFixedEnd(clampViewport(t,span,oldest,edge));
 const goLive=()=>{setFixedEnd(null);setDetailWindow(null);setEnter(null);player.live();};
 const resetTuning=()=>{setTuning({...TUNING_DEFAULTS});clearTuning();};
 const zoomTimeline=(requested,center=time)=>{const next=Math.max(60000,Math.min(RETENTION,requested)),nextEnd=Math.max(oldest+next,Math.min(edge,center+next/2));if(topic)setDetailWindow({end:nextEnd,span:next});else{setOverviewSpan(next);setFixedEnd(nextEnd);}};
 return <>
 {!snapshot?<main className="loading"><span className="loading-dot"/><h1>{status==='error'?'暂时无法连接':'正在汇聚此刻的讨论'}</h1><p>回声社区 · 模拟平台</p>{status==='error'&&<button onClick={retry}>重新连接</button>}</main>:
  topic?<TopicPage topic={topic} time={time} edge={edge} oldest={oldest} events={allTopicEvents} detail={detail} status={status} player={player} reduced={reduced} enter={enter} tuning={tuning} replay={replay} onEntered={()=>setEnter(null)} onBack={back} onAbout={()=>setInfo(true)} onSeek={seek} onPan={pan} onZoom={zoomTimeline} onLive={goLive}/>:
  <main className="main overview-page" style={{'--depart-ms':`${tuning.departMs}ms`}}><div className="page-content" key="overview">
   <section className="panel bubble-panel">
    <div className="overview-overlay"><button className="brand floating-brand" onClick={()=>{}} aria-label="返回话题总览"><span className="brand-mark"><i/><i/><i/></span><strong>观潮</strong></button>
    <div className="search-wrap" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setSearchOpen(false);}}><label className="search"><Search size={tuning.iconSearch} strokeWidth={tuning.iconStroke}/><input aria-label="搜索话题" placeholder="搜索话题" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Escape'&&setSearchOpen(false)}/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><X size={tuning.iconClear} strokeWidth={tuning.iconStroke}/></button>}</label>{searchOpen&&<div className="search-suggestions"><span>{query?'匹配话题':'此刻热议'}</span>{(query?filtered.slice().reverse():ranked.slice(0,4)).slice(0,6).map(q=><button key={q.id} onClick={e=>{setSearchOpen(false);openTopic(q.id,e.currentTarget.getBoundingClientRect());}}>{q.title}<ChevronRight size={tuning.iconChevron} strokeWidth={tuning.iconStroke}/></button>)}{query&&!filtered.length&&<p>试试“{topics.filter(q=>(values[q.id]?.views||0)>0).at(-1)?.title||'社区'}”</p>}</div>}</div></div>
    <BubbleMap scrubbing={scrubbing} topics={shown} values={values} time={time} live={player.mode==='live'} cameraScope={query} onOpen={openTopic} departingId={departing}/>
   </section>
   <section className="panel flow-panel"><div className="section-heading"><h2>流量演化</h2><div className="chart-tools"><time className="playhead-time">{formatDateTime(time)}</time><button className={'live-button '+(player.mode==='live'?'active':'')} onClick={goLive}><Radio size={tuning.iconRadio} strokeWidth={tuning.iconStroke}/>{player.mode==='live'?'现在':'回到现在'}</button></div></div>
    <div className="chart-box"><Timeline frames={data.frames} topics={chartTopics} time={time} end={end} span={span} onSeek={seek} onPan={pan} onZoom={zoomTimeline} wheelZoom onInteractionChange={setScrubbing}/></div>
    <ViewportBar oldest={oldest} edge={edge} end={end} span={span} onPan={pan}/>
   </section>
  </div></main>}
 {info&&<div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setInfo(false)}><section className="about-modal" ref={infoRef} role="dialog" aria-modal="true" aria-labelledby="about-title"><button className="modal-close icon-button" aria-label="关闭说明" onClick={()=>setInfo(false)}><X size={tuning.iconModalClose} strokeWidth={tuning.iconStroke}/></button><h2 id="about-title">观潮 · 回声社区</h2><p>在一个虚构平台中，观察关注流向与观点转变。</p><dl><dt>空间与时间</dt><dd>气泡面积与每分钟曝光量成正比，半径取平方根。每分钟2万与4000的面积比为5:1。累计曝光低于500万的话题不进入观察台，同一时刻通常有8至23个话题。画布可缩放拖拽，不改变气泡之间的比例。</dd><dt>观点与词云</dt><dd>详情页的环形、条形与词云共用近1小时的舆论比例；选中观点会筛选模拟语料，词云和单词树从筛选后的文本重新计算。词云全部横向；单词树展示一个词的前后文。语料为确定性合成评论，不是真实用户发言。</dd><dt>持续变化</dt><dd>流量演化图就是全局时间控制。左键拖动图表定位时刻，滚轮缩放视野，底部滑动条平移时间轴，回到现在恢复实时跟随。120天历史随现在持续滚动。</dd><dt>课程演示</dt><dd>研究启发的合成数据，非真实平台记录。标题为虚构城市议题，流量按公开热搜热度分布校准。不同话题持续8到60小时，事件冲击叠加形成多峰。当前曝光率从零开始、回到零；累计曝光不会归零。</dd></dl><a className="download" href="/guanchao-project-docs.zip" download><Download size={tuning.iconDownload} strokeWidth={tuning.iconStroke}/>项目说明</a></section></div>}
 {TUNING_ENABLED&&<React.Suspense fallback={null}><TuningPanel value={tuning} onChange={(key,value)=>setTuning(t=>({...t,[key]:value}))} onReset={resetTuning} onReplay={()=>setReplay(r=>r+1)}/></React.Suspense>}
 </>;
}
createRoot(document.getElementById('root')).render(<App/>);
