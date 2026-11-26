import {useEffect,useMemo,useRef,useState} from 'react';
import {sampleAt} from './live';
import {topEmotions} from '../shared/dutir';
import {STEP} from '../shared/catalog.js';

const ZERO=[0,0,0,0,0];

async function getJson(url,signal){
 const response=await fetch(url,{signal});
 if(!response.ok)throw new Error(url+' '+response.status);
 return response.json();
}

export function useTopicData({topic,time,frames,opinion,emotion,tuning,tab,initialCorpus=null}){
 const bucket=Math.floor(time/60000);
 const windowMs=Math.max(5,Number(tuning.textWindow)||60)*60000;
 const [history,setHistory]=useState([]);
 const [historyError,setHistoryError]=useState(null);
 const [wordData,setWordData]=useState({words:[],records:[]});
 const [wordState,setWordState]=useState('idle');
 const [wordError,setWordError]=useState(null);
 const [corpus,setCorpus]=useState(initialCorpus);
 const [discussion,setDiscussion]=useState(null);
 const [discussionState,setDiscussionState]=useState('idle');
 const [discussionError,setDiscussionError]=useState(null);
 const [loadingMore,setLoadingMore]=useState(false);
 const discussionParams=useRef(null);

 useEffect(()=>{setHistory([]);setHistoryError(null);},[topic.id]);
 useEffect(()=>{
  const controller=new AbortController();
  getJson(`/api/topic/${encodeURIComponent(topic.id)}/history`,controller.signal)
   .then(json=>setHistory(json.rows||[]))
   .catch(error=>{if(error.name!=='AbortError')setHistoryError(String(error));});
  return()=>controller.abort();
 },[topic.id,bucket]);

 useEffect(()=>{
  const controller=new AbortController();
  setWordState('loading');setWordError(null);
  const params=new URLSearchParams({
   limit:'80',
   recordLimit:String(tuning.wordSample||600),
   opinion:opinion===null||opinion===undefined?'':String(opinion),
   emotion:emotion||'',
   from:String(Math.max(topic.bornAt,time-windowMs)),
   to:String(time)
  });
  getJson(`/api/topic/${encodeURIComponent(topic.id)}/words?`+params,controller.signal)
   .then(json=>{setWordData({words:json.words||[],records:json.records||[]});setCorpus(json.corpus||null);setWordState('ready');})
   .catch(error=>{if(error.name!=='AbortError'){setWordError(String(error));setWordState('error');}});
  return()=>controller.abort();
 },[topic.id,bucket,opinion,emotion,tuning.wordSample,tuning.textWindow]);

 useEffect(()=>{
  if(tab!=='discussion')return;
  const controller=new AbortController();
  setDiscussionState('loading');setDiscussionError(null);
  const discussionWindowMs=Math.max(1,Number(tuning.discussionWindow)||6)*3600000;
  const params={
   limit:String(tuning.discussionPage||20),
   sort:tuning.discussionSort||'hot',
   opinion:opinion===null||opinion===undefined?'':String(opinion),
   emotion:emotion||'',
   from:String(Math.max(topic.bornAt,time-discussionWindowMs)),
   to:String(time)
  };
  discussionParams.current=params;
  getJson(`/api/topic/${encodeURIComponent(topic.id)}/discussion?`+new URLSearchParams(params),controller.signal)
   .then(json=>{setDiscussion(json);setCorpus(json.corpus||null);setDiscussionState('ready');})
   .catch(error=>{if(error.name!=='AbortError'){setDiscussionError(String(error));setDiscussionState('error');}});
  return()=>controller.abort();
 },[topic.id,bucket,opinion,emotion,tab,tuning.discussionPage,tuning.discussionSort,tuning.discussionWindow,tuning.textWindow]);

 const loadMore=async()=>{
  if(!discussion?.next||loadingMore)return;
  setLoadingMore(true);
  try{
   const params={...discussionParams.current,cursor:discussion.next};
   const json=await getJson(`/api/topic/${encodeURIComponent(topic.id)}/discussion?`+new URLSearchParams(params));
   setDiscussion(previous=>({...json,posts:[...(previous?.posts||[]),...json.posts]}));
  }catch{}
  setLoadingMore(false);
 };

 const recentFrames=useMemo(()=>{
  if(!frames?.length)return [];
  const edge=frames[frames.length-1].time;
  return frames.filter(item=>item.time>=edge-10*60000);
 },[frames]);
 const live=recentFrames.length&&time>=recentFrames[0].time-STEP&&time<=recentFrames[recentFrames.length-1].time+STEP?sampleAt(recentFrames,time)?.values?.[topic.id]:null;
 const row=useMemo(()=>{let found=null;for(const item of history)if(item.time<=time)found=item;return found;},[history,time]);
 const liveHasCounts=!!live?.counts?.h1?.some(value=>value>0);
 const counts=liveHasCounts?live.counts.h1:(row?.weighted||ZERO);
 const raw=liveHasCounts?live.raw.h1:(row?.raw||ZERO);
 const emotions=liveHasCounts&&live.emotions&&Object.keys(live.emotions).length?live.emotions:(row?.emotions||{});
 const emotionRing=useMemo(()=>topEmotions(emotions,Number(tuning.emotionTop)||8),[emotions,tuning.emotionTop]);

 return {
  history,historyError,
  words:wordData.words,records:wordData.records,wordState,wordError,
  discussion,discussionState,discussionError,loadingMore,loadMore,
  corpus:corpus||initialCorpus,
  counts,raw,emotions,emotionRing,
  bucket
 };
}
