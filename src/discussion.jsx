import React from 'react';
import {DUTIR,emotion as emotionById} from '../shared/dutir';
import {weightBreakdown} from '../shared/weight';
import {isWordToken} from '../shared/corpus';
import {number,formatDateTime} from './live';

function TokenText({record,onWord}){
 if(!record.tokens?.length)return <p className="record-text">{record.text}</p>;
 return <p className="record-text">{record.tokens.map((token,index)=>isWordToken(token)
  ?<button key={index} type="button" className="token-link" title="查看前后文" onClick={()=>onWord(token)}>{token}</button>
  :<span key={index}>{token}</span>)}</p>;
}

function LayerBadge({layer}){
 return <span className={'layer-badge '+layer}>{layer==='post'?'主帖':layer==='comment'?'评论':'回复'}</span>;
}

function Chips({record,topic}){
 const cluster=topic.clusters?.[record.cluster];
 const emo=emotionById(record.emotion);
 return <span className="record-chips">
  {cluster&&<span className="chip opinion-chip" style={{'--chip':cluster.color}}>{cluster.title}</span>}
  <span className="chip emotion-chip" style={{'--chip':emo.color}}>{emo.title}</span>
 </span>;
}

function WeightMeter({record}){
 const info=record.weightInfo;
 const postBreakdown=record.layer==='post'?weightBreakdown(record.layer,record.metrics||{}):null;
 const weight=Number.isFinite(record.weight)?record.weight:(postBreakdown?.weight||0);
 const coef=info?.coef??postBreakdown?.coef??1;
 const sufficient=info?.sufficient??postBreakdown?.sufficient??true;
 const title=postBreakdown
  ?`互动率 ${(postBreakdown.rate*100).toFixed(2)}% · 浏览 ${number(postBreakdown.sample)} · 层级系数 ${coef}`
  :`互动加权 · 评论层级系数 ${coef} · 评论曝光为内部指标`;
 return <span className={'weight-meter '+(sufficient?'':'insufficient')} title={title}>
  <span className="weight-track"><i style={{width:Math.max(2,Math.min(100,weight))+'%'}}/></span>
  <b>{weight}</b>
  {!sufficient&&<small>样本不足</small>}
 </span>;
}

function Metrics({record}){
 if(record.layer==='post')return <span className="record-metrics">{number(record.metrics.views)} 浏览 · {number(record.metrics.likes)} 赞 · {number(record.metrics.reposts)} 转发 · {number(record.metrics.comments)} 评论</span>;
 return <span className="record-metrics">{number(record.metrics.likes)} 赞 · {number(record.metrics.replies)} 回复</span>;
}

function CommentCard({record,topic,onWord}){
 return <div className="discussion-comment">
  <header>
   <span className="record-author">{record.author}</span>
   <LayerBadge layer={record.layer}/>
   <Chips record={record} topic={topic}/>
   <time>{formatDateTime(record.time)}</time>
   <WeightMeter record={record}/>
  </header>
  <TokenText record={record} onWord={onWord}/>
  <Metrics record={record}/>
  {record.replies?.length>0&&<div className="reply-list">{record.replies.map(reply=><div className="discussion-reply" key={reply.id}>
   <header><span className="record-author">{reply.author}</span><LayerBadge layer={reply.layer}/><Chips record={reply} topic={topic}/><time>{formatDateTime(reply.time)}</time><WeightMeter record={reply}/></header>
   <TokenText record={reply} onWord={onWord}/>
   <Metrics record={reply}/>
  </div>)}</div>}
  {record.replyTotal>record.replies.length&&<p className="record-more">还有 {record.replyTotal-record.replies.length} 条回复</p>}
 </div>;
}

export function Discussion({topic,data,state,error,opinion,emotion,sort,onOpinion,onEmotion,onSort,onWord,onLoadMore,loadingMore,windowHours=6}){
 const posts=data?.posts||[];
 return <div className="discussion-panel">
  <div className="discussion-filters">
   <div className="filter-row"><span>观点</span><div className="filter-scroll">
    <button className={opinion===null?'active':''} onClick={()=>onOpinion(null)}>全部</button>
    {topic.clusters.map((cluster,index)=><button key={cluster.id} className={opinion===index?'active':''} style={{'--chip':cluster.color}} onClick={()=>onOpinion(opinion===index?null:index)}>{cluster.title}</button>)}
   </div></div>
   <div className="filter-row"><span>情绪</span><div className="filter-scroll">
    <button className={emotion===null?'active':''} onClick={()=>onEmotion(null)}>全部</button>
    {DUTIR.map(item=><button key={item.id} className={emotion===item.id?'active':''} style={{'--chip':item.color}} onClick={()=>onEmotion(emotion===item.id?null:item.id)}><i/>{item.title}</button>)}
   </div></div>
   <div className="filter-row"><span>排序</span><div className="filter-scroll">
    <button className={sort==='hot'?'active':''} onClick={()=>onSort('hot')}>热度</button>
    <button className={sort==='time'?'active':''} onClick={()=>onSort('time')}>时间</button>
   </div></div>
  </div>
  {state==='loading'&&<p className="discussion-note">正在载入讨论…</p>}
  {state==='error'&&<p className="discussion-note">语料源未接入：{String(error).replace(/^Error:\s*/,'')}</p>}
  {state==='ready'&&!posts.length&&<p className="discussion-note">近 {windowHours} 小时没有匹配的讨论。</p>}
  <div className="discussion-list">
   {posts.map(post=><article className="discussion-post" key={post.id}>
    <header>
     <span className="record-author">{post.author}</span>
     <LayerBadge layer={post.layer}/>
     <Chips record={post} topic={topic}/>
     <time>{formatDateTime(post.time)}</time>
     <WeightMeter record={post}/>
    </header>
    <TokenText record={post} onWord={onWord}/>
    <Metrics record={post}/>
    {post.comments?.length>0&&<div className="comment-list">{post.comments.map(comment=><CommentCard key={comment.id} record={comment} topic={topic} onWord={onWord}/>)}</div>}
    {post.commentTotal>post.comments.length&&<p className="record-more">还有 {post.commentTotal-post.comments.length} 条评论按热度未展示</p>}
   </article>)}
  </div>
  {data?.next!==null&&data?.next!==undefined&&<button className="discussion-more" disabled={loadingMore} onClick={onLoadMore}>{loadingMore?'载入中…':'加载更多主帖'}</button>}
  {data?.totalPosts>0&&<p className="discussion-note">共 {data.totalPosts} 个匹配主帖 · 近 {windowHours} 小时 · 热度按互动权重排序</p>}
 </div>;
}
