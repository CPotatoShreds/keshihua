export const TUNING_DEFAULTS={
 departMs:160,flightMs:520,flightEase:'cubic-bezier(.2,.8,.2,1)',
 titleDelay:420,titleFade:220,titleEase:'easeOut',
 wordDelay:500,wordStep:300,wordDur:300,wordEase:'easeOut',
 ringDelay:500,ringDur:620,ringEase:'easeOut',
 bubbleFactor:.40,cloudFactor:.86,cloudMax:28,cloudMinFont:11,cloudMaxFont:28,cloudGap:6,
 titleFont:.115,titleMin:14,titleMax:21,titleValueFont:11,
 ringGap:8,ringThick:18,ringCorner:4,ringPad:.012,ringHot:4,ringStroke:1.5,
 bubbleFill:.16,bubbleStroke:.5,bubbleStrokeW:2,
 chartMs:1050,chartEase:'cubic',focusEnd:.28,domainStart:.14,domainSpan:.56,fadeStart:.48,fadeSpan:.34,focusStroke:1.4,
 stageL:1.15,stageR:.85,stageGap:20,panelMin:300,
 stageGapN:14,panelMinN:330,
 chartH:220,chartMH:245,chartSH:280,
 topicPadX:20,topicPadXM:12,topicPadB:10,headerH:55,headerHM:52,
 panelPadX:18,panelPadY:16,panelPadXN:15,panelPadYN:14,panelPadXMS:18,panelPadYMS:26,
 panelRadius:14,eventW:330,drawerH:62,drawerHS:68,drawerMs:320,
 orbitVH:54,orbitVHS:52,
 headerFadeDelay:300,headerFadeDur:400,panelFadeDelay:550,panelFadeDur:450,
 treeRowGap:24,treeCompactRow:20,treeColMax:84,treeCompactCol:52,
 treeMaxNodes:56,treeCompactNodes:28,treeDepth:2,treeCompactDepth:1,
 treeMinCount:3,treeBranches:5,treeFont:12,treeCompactFont:11,treeChars:0,
 iconStroke:2,iconSearch:16,iconClear:13,iconChevron:12,iconBack:18,iconInfo:17,iconRadio:13,iconDownload:16,iconModalClose:18
};
const KEY='guanchao-tuning-v1';
export function loadTuning(){try{const raw=localStorage.getItem(KEY);return raw?{...TUNING_DEFAULTS,...JSON.parse(raw)}:{...TUNING_DEFAULTS};}catch{return {...TUNING_DEFAULTS};}}
export function saveTuning(value){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}}
export function clearTuning(){try{localStorage.removeItem(KEY);}catch{}}
