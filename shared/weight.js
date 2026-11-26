// Layered text weight for the simulated platform.
// Posts use an engagement rate over views; comments/replies use a like rate
// over internal impressions plus a small reply bonus. Each layer is shrunk
// toward its own prior, then mapped to 0..100 with a log2 scale.
// This is a design choice for the demo, not an official platform formula.

export const LAYERS={
 post:{coef:1,prior:.02,C:1000,minSample:5000,sample:'views'},
 comment:{coef:.85,prior:.006,C:200,minSample:100,sample:'impressions'},
 reply:{coef:.7,prior:.006,C:100,minSample:50,sample:'impressions'}
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

export function layerConfig(layer){return LAYERS[layer]||LAYERS.comment;}

export function sampleSize(layer,metrics={}){
 const cfg=layerConfig(layer);
 return Math.max(0,num(metrics[cfg.sample]));
}

export function interactionRate(layer,metrics={}){
 if(layer==='post'){
  const views=Math.max(1,num(metrics.views));
  return (num(metrics.likes)+2*num(metrics.reposts)+1.5*num(metrics.comments))/views;
 }
 const impressions=Math.max(1,num(metrics.impressions));
 return num(metrics.likes)/impressions+.002*Math.log1p(Math.max(0,num(metrics.replies)));
}

export function weightBreakdown(layer,metrics={}){
 const cfg=layerConfig(layer),n=sampleSize(layer,metrics);
 if(!(n>0))return {layer,weight:0,rate:0,sample:0,shrunk:0,relative:0,base:0,coef:cfg.coef,prior:cfg.prior,sufficient:false};
 const rate=Math.max(0,interactionRate(layer,metrics));
 const shrunk=(cfg.C*cfg.prior+rate*n)/(cfg.C+n);
 const relative=shrunk/cfg.prior;
 const base=relative>0?clamp((Math.log2(relative)+2)/4,0,1):0;
 const weight=Math.round(100*base*cfg.coef);
 return {layer,weight,rate,sample:n,shrunk,relative,base,coef:cfg.coef,prior:cfg.prior,sufficient:n>=cfg.minSample};
}

export function textWeight(layer,metrics={}){
 return weightBreakdown(layer,metrics).weight;
}

// Word-cloud contribution: every text keeps a floor of 1 so frequency is not
// erased by zero-weight samples, while high-engagement texts get up to 3x.
export function wordContribution(weight){
 return 1+Math.max(0,Math.min(100,num(weight)))/50;
}
