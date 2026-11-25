import React,{useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';

const CSS_EASE=[['cubic-bezier(.2,.8,.2,1)','柔和'],['ease-out','减速'],['ease-in-out','平滑'],['linear','线性']];
const MOTION_EASE=[['easeOut','减速'],['easeInOut','平滑'],['linear','线性'],['circOut','圆形'],['backOut','回弹']];
const CHART_EASE=[['cubic','柔和三段'],...MOTION_EASE];
const R=(k,label,min,max,step,unit='')=>({k,label,min,max,step,unit,type:'range'});
const S=(k,label,options)=>({k,label,options,type:'select'});
const GROUPS=[
 ['转场 · 入场时序',[
  R('departMs','其他气泡淡出 / 换页',0,600,10,'ms'),
  R('flightMs','气泡飞行位移',200,1500,20,'ms'),
  S('flightEase','飞行曲线',CSS_EASE),
  R('titleDelay','标题开始淡出',0,1500,20,'ms'),
  R('titleFade','标题淡出时长',0,800,20,'ms'),
  S('titleEase','标题曲线',MOTION_EASE),
  R('wordDelay','词云第一个词',0,1500,20,'ms'),
  R('wordStep','词云逐词总跨度',0,800,10,'ms'),
  R('wordDur','单词浮现时长',80,800,10,'ms'),
  S('wordEase','词云曲线',MOTION_EASE),
  R('ringDelay','环形开始绘制',0,1500,20,'ms'),
  R('ringDur','环形绘制时长',100,2000,20,'ms'),
  S('ringEase','环形曲线',MOTION_EASE)
 ]],
 ['舞台 · 气泡与词云',[
  R('bubbleFactor','气泡半径系数',.25,.48,.01,'×短边'),
  R('cloudFactor','词云半径系数',.55,.98,.01,'×气泡'),
  R('cloudMax','词云最多显示词数',10,40,1,'词'),
  R('cloudMinFont','词云最小字号',8,18,1,'px'),
  R('cloudMaxFont','词云最大字号',14,40,1,'px'),
  R('cloudGap','词云词间距',0,16,1,'px'),
  R('titleFont','标题字号系数',.06,.22,.005,'×半径'),
  R('titleMin','标题最小字号',10,24,1,'px'),
  R('titleMax','标题最大字号',14,40,1,'px'),
  R('titleValueFont','标题下数值字号',8,18,1,'px')
 ]],
 ['舞台 · 环形与圆',[
  R('ringGap','圆与环的间隙',2,24,1,'px'),
  R('ringThick','环形厚度',8,40,1,'px'),
  R('ringCorner','环形圆角',0,14,1,'px'),
  R('ringPad','环形分段间隙',0,.05,.002,'弧度'),
  R('ringHot','悬浮 / 选中外扩',0,12,1,'px'),
  R('ringStroke','环形分段描边',0,4,.5,'px'),
  R('bubbleFill','圆底色透明度',0,.5,.01,''),
  R('bubbleStroke','圆描边透明度',0,1,.05,''),
  R('bubbleStrokeW','圆描边宽度',0,5,.5,'px')
 ]],
 ['底部流量图',[
  R('chartMs','图表聚焦总时长',300,2400,10,'ms'),
  S('chartEase','图表曲线',CHART_EASE),
  R('focusEnd','阶段1：定位目标结束',.05,.6,.01,'进度'),
  R('domainStart','阶段2：缩放平移开始',0,.5,.01,'进度'),
  R('domainSpan','阶段2：缩放平移跨度',.2,1,.01,'进度'),
  R('fadeStart','阶段3：其他条淡去开始',0,1,.01,'进度'),
  R('fadeSpan','阶段3：其他条淡去跨度',.1,.6,.01,'进度'),
  R('focusStroke','目标色带描边增幅',0,4,.1,'px')
 ]],
 ['页面布局 · 桌面',[
  R('stageL','舞台左栏比例',.6,2,.05,'fr'),
  R('stageR','舞台右栏比例',.4,1.6,.05,'fr'),
  R('stageGap','舞台两栏间距',0,48,1,'px'),
  R('panelMin','右面板最小宽度',220,480,2,'px'),
  R('chartH','流量图高度',150,380,2,'px'),
  R('topicPadX','页面左右内边距',0,48,1,'px'),
  R('topicPadB','页面底部内边距',0,48,1,'px'),
  R('headerH','顶栏高度',40,88,1,'px'),
  R('panelPadX','右面板横向内边距',0,40,1,'px'),
  R('panelPadY','右面板纵向内边距',0,40,1,'px'),
  R('panelRadius','右面板圆角',0,28,1,'px'),
  R('eventW','事件卡片宽度',240,460,2,'px'),
  R('headerFadeDelay','顶栏淡入延迟',0,1500,10,'ms'),
  R('headerFadeDur','顶栏淡入时长',0,1200,10,'ms'),
  R('panelFadeDelay','面板淡入延迟',0,1500,10,'ms'),
  R('panelFadeDur','面板淡入时长',0,1200,10,'ms')
 ]],
 ['页面布局 · 窄屏',[
  R('stageGapN','1150 以下栏间距',0,40,1,'px'),
  R('panelMinN','1150 以下面板宽度',240,400,2,'px'),
  R('headerHM','800 以下顶栏高度',40,80,1,'px'),
  R('topicPadXM','800 以下页面内边距',0,32,1,'px'),
  R('chartMH','800 以下图表高度',150,360,1,'px'),
  R('chartSH','520 以下图表高度',150,400,1,'px'),
  R('panelPadXN','1150 以下面板横内边距',0,32,1,'px'),
  R('panelPadYN','1150 以下面板纵内边距',0,32,1,'px'),
  R('panelPadXMS','800 以下面板横内边距',0,32,1,'px'),
  R('panelPadYMS','800 以下面板纵内边距',0,40,1,'px'),
  R('drawerH','800 以下抽屉最大高度',40,90,1,'vh'),
  R('drawerHS','520 以下抽屉最大高度',40,95,1,'vh'),
  R('orbitVH','800 以下圆区高度',35,75,1,'vh'),
  R('orbitVHS','520 以下圆区高度',35,75,1,'vh'),
  R('drawerMs','移动端抽屉滑出时长',0,800,10,'ms')
 ]],
 ['单词树',[
  R('treeRowGap','桌面行距',14,44,1,'px'),
  R('treeCompactRow','窄屏行距',12,36,1,'px'),
  R('treeColMax','桌面最大列距',50,140,1,'px'),
  R('treeCompactCol','窄屏列距',40,100,1,'px'),
  R('treeMaxNodes','桌面节点上限',12,120,2,'个'),
  R('treeCompactNodes','窄屏节点上限',8,80,2,'个'),
  R('treeDepth','桌面前后文层数',1,4,1,'层'),
  R('treeCompactDepth','窄屏前后文层数',1,2,1,'层'),
  R('treeMinCount','最少出现次数',1,8,1,'次'),
  R('treeBranches','每层最多分支',2,10,1,'支'),
  R('treeFont','桌面字号',9,16,1,'px'),
  R('treeCompactFont','窄屏字号',9,14,1,'px'),
  R('treeChars','每词最多字数（0=自动）',0,10,1,'字')
 ]],
 ['图标',[
  R('iconStroke','图标线宽',1,3,.25,''),
  R('iconSearch','搜索图标',10,24,1,'px'),
  R('iconClear','清空图标',8,20,1,'px'),
  R('iconChevron','建议箭头',8,20,1,'px'),
  R('iconBack','返回图标',12,28,1,'px'),
  R('iconInfo','关于图标',12,28,1,'px'),
  R('iconRadio','“现在”图标',8,22,1,'px'),
  R('iconDownload','下载图标',10,26,1,'px'),
  R('iconModalClose','弹层关闭图标',12,28,1,'px')
 ]]
];
function Row({field,value,onChange}){
 const label=<span>{field.label}</span>;
 if(field.type==='select')return <label className="tuning-row"><span>{field.label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{field.options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
 const set=e=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(Math.max(field.min,Math.min(field.max,n)));};
 return <label className="tuning-row">{label}
  <input type="range" min={field.min} max={field.max} step={field.step} value={value} onChange={set}/>
  <input className="tuning-num" type="number" min={field.min} max={field.max} step={field.step} value={value} onChange={set}/>
  <small>{field.unit}</small>
 </label>;
}
export function TuningPanel({value,onChange,onReset,onReplay}){
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false);
 const copy=()=>{const text=JSON.stringify(value,null,2);const done=()=>{setCopied(true);setTimeout(()=>setCopied(false),1400);};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(done).catch(done);else done();};
 return <>
  <button className="tuning-toggle" aria-expanded={open} aria-controls="tuning-panel" onClick={()=>setOpen(o=>!o)}><SlidersHorizontal size={13}/>{open?'收起调参':'动画 / 布局调参'}</button>
  {open&&<aside className="tuning-panel" id="tuning-panel" aria-label="动画与布局调参台">
   <header>
    <strong>动画 / 布局调参</strong>
    <div><button onClick={onReplay}>重播舞台</button><button onClick={copy}>{copied?'已复制':'复制 JSON'}</button><button onClick={onReset}>恢复默认</button><button aria-label="关闭调参台" onClick={()=>setOpen(false)}>×</button></div>
   </header>
   <p className="tuning-note">改动实时生效并自动保存在本机。转场、图表聚焦类参数需返回总览重新进入话题预览；词云 / 环形 / 标题可点“重播舞台”。</p>
   <div className="tuning-scroll">
    {GROUPS.map(([title,fields])=><details key={title} open><summary>{title}</summary>{fields.map(field=><Row key={field.k} field={field} value={value[field.k]} onChange={v=>onChange(field.k,v)}/>)}</details>)}
   </div>
  </aside>}
 </>;
}
