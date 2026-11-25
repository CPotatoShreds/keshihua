import React,{useEffect,useMemo,useRef,useState} from 'react';
import {buildWordTree} from '../shared/word-tree';
import {useSize} from './useSize';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sideEntries(tree,side,{cx,colGap}){
 let leaf=0;
 const walk=(node,level,parentPath,parentY)=>{
  if(!node)return null;
  const path=parentPath+'/'+node.token,children=node.children||[],entry={node,path,level,x:cx+side*colGap*level};
  const kids=children.map(child=>walk(child,level+1,path));
  if(kids.length){entry.y=(kids[0].y+kids.at(-1).y)/2;entry.children=kids;}
  else{entry.y=leaf*1;leaf++;}
  return entry;
 };
 const roots=(tree?.children||[]).map(node=>walk(node,1,''));
 return {roots,leaves:Math.max(1,leaf)};
}
export function WordTree({texts,root,color='#547c8e',compact=false,tuning,onRootChange}){
 const [ref,{width:w,height:h}]=useSize(),scroll=useRef(null),[hovered,setHovered]=useState(null);
 const depth=compact?tuning.treeCompactDepth:tuning.treeDepth,maxNodes=compact?tuning.treeCompactNodes:tuning.treeMaxNodes;
 const tree=useMemo(()=>buildWordTree(texts,root,{depth,minCount:tuning.treeMinCount,maxBranches:tuning.treeBranches,maxNodes}),[texts,root,depth,tuning.treeMinCount,tuning.treeBranches,maxNodes]);
 const cx=w/2,colGap=compact?tuning.treeCompactCol:clamp((w/2-92)/Math.max(1,depth),44,Math.max(44,tuning.treeColMax)),rowGap=compact?tuning.treeCompactRow:tuning.treeRowGap;
 const fontSize=compact?tuning.treeCompactFont:tuning.treeFont;
 const left=useMemo(()=>sideEntries(tree.left,-1,{cx,colGap}),[tree,cx,colGap]);
 const right=useMemo(()=>sideEntries(tree.right,1,{cx,colGap}),[tree,cx,colGap]);
 const leaves=Math.max(left.leaves,right.leaves,1),innerH=Math.max(h,leaves*rowGap+44),cy=innerH/2;
 const maxChars=tuning.treeChars>0?tuning.treeChars:Math.max(2,Math.floor((colGap-28)/12)),label=text=>text.length>maxChars?text.slice(0,maxChars-1)+'…':text;
 useEffect(()=>{if(scroll.current)scroll.current.scrollTop=Math.max(0,(innerH-h)/2);},[innerH,h,root]);
 const shift=(node,count)=>node?{...node,y:node.y*rowGap+cy-(count-1)*rowGap/2,children:node.children?.map(child=>shift(child,count))}:null;
 const leftRoots=useMemo(()=>left.roots.map(n=>shift(n,left.leaves)),[left,cy,rowGap]),rightRoots=useMemo(()=>right.roots.map(n=>shift(n,right.leaves)),[right,cy,rowGap]);
 const rootW=Math.max(78,root.length*13+30),examples=hovered?.example||tree.left?.example||'';
 const isOn=path=>hovered&&(hovered.path===path||hovered.path.startsWith(path+'/'));
 const renderNode=(entry,side)=>{
  if(!entry)return null;
  const on=isOn(entry.path),endX=entry.x-side*4,textX=entry.x+side*6,anchor=side<0?'end':'start',startX=entry.level===1?cx+side*(rootW/2+4):entry.x-side*(colGap-14);
  const mid=(startX+endX)/2;
  return <g key={entry.path} className="word-tree-node">
   <path d={`M${startX},${entry.parentY??cy} C${mid},${entry.parentY??cy} ${mid},${entry.y} ${endX},${entry.y}`} fill="none" stroke={on?'#6d8fa0':'#cbd8df'} strokeWidth={on?1.5:1}/>
   <g role="button" tabIndex="0" aria-label={`${entry.node.token}，出现${entry.node.count}次`} onPointerEnter={()=>setHovered({path:entry.path,example:entry.node.example})} onPointerLeave={()=>setHovered(null)} onFocus={()=>setHovered({path:entry.path,example:entry.node.example})} onBlur={()=>setHovered(null)} onClick={()=>onRootChange?.(entry.node.token)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onRootChange?.(entry.node.token);}}}>
    <rect x={side<0?entry.x-(colGap-8):entry.x-4} y={entry.y-10} width={colGap-4} height="20" fill="transparent"/>
    <text x={textX} y={entry.y+4} textAnchor={anchor} fontSize={fontSize} fill={on?'#214a5d':'#4b6777'}>{label(entry.node.token)}<tspan dx="4" fontSize="9" fill="#8aa0ad">{entry.node.count}</tspan></text>
    <title>{entry.node.token} · {entry.node.count}次{entry.node.example?'\n'+entry.node.example:''}</title>
   </g>
   {entry.children?.map(child=>{child.parentY=entry.y;return renderNode(child,side);})}
  </g>;
 };
 if(!tree.count)return <div className="word-tree-empty">「{root}」在当前语料中暂无足够语境</div>;
 return <div className="word-tree" ref={ref}>
  <div className="word-tree-scroll" ref={scroll}>
   <svg width={w} height={innerH} role="group" aria-label={`“${root}”的前后文单词树`}>
    <text x={10} y={14} fontSize="10" fill="#8aa0ad">前文</text><text x={w-10} y={14} fontSize="10" fill="#8aa0ad" textAnchor="end">后文</text>
    {leftRoots.map(entry=>renderNode(entry,-1))}{rightRoots.map(entry=>renderNode(entry,1))}
    <rect x={cx-rootW/2} y={cy-16} width={rootW} height="32" rx="16" fill={color} opacity=".14" stroke={color} strokeOpacity=".45"/>
    <text x={cx} y={cy+4} textAnchor="middle" fontSize="13" fontWeight="600" fill="#26495c">{label(root)}<tspan dx="4" fontSize="9" fill="#5f7b8a">{tree.count}</tspan></text>
   </svg>
  </div>
  {examples?<p className="word-tree-example">例：{examples}</p>:null}
  <small className="word-tree-note">模拟语料 · 左右为词的前后文 · 点击词语可重定根</small>
 </div>;
}
