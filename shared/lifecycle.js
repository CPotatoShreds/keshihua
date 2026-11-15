// Research-inspired synthetic lifecycles. Rate units: exposure / minute.
// Integer Beta kernels allow exact polynomial integration of rolling windows.
const kernels=new Map();
function kernel(a,b){
 const key=a+','+b;if(kernels.has(key))return kernels.get(key);
 const m=a/(a+b),normal=1/(m**a*(1-m)**b),terms=[];let choose=1;
 for(let k=0;k<=b;k++){terms.push([a+k+1,normal*choose*(k%2?-1:1)/(a+k+1)]);choose=choose*(b-k)/(k+1);}
 const primitive=u=>terms.reduce((sum,[power,c])=>sum+c*u**power,0);
 const out={normal,primitive};kernels.set(key,out);return out;
}
const weights=[[.12,.16,.56,.10,.06],[.24,.27,.32,.11,.06],[.22,.30,.23,.19,.06],[.15,.19,.18,.42,.06],[.10,.13,.10,.61,.06]];
export function pulsesFor(q){
 if(q.pulses)return q.pulses;
 return [{at:q.bornAt,duration:q.endsAt-q.bornAt,amplitude:q.amplitude||10000,a:2,b:6,opinion:weights[0]}];
}
export function makePulses(bornAt,duration,amplitude,index){
 const starts=[0,.13,.29,.48,.70],ends=[.56,.70,.84,.94,1],gains=[.82,.32,.78,1.18,.48];
 return starts.map((fraction,j)=>({at:bornAt+fraction*duration,duration:(ends[j]-fraction)*duration,amplitude:amplitude*gains[(j+index%2)%gains.length],a:2+(index+j)%2,b:j===4?3:5+(index+j)%3,opinion:weights[j]}));
}
export function rateAt(q,time){
 if(time<=q.bornAt||time>=q.endsAt)return 0;
 let total=0;for(const p of pulsesFor(q)){const u=(time-p.at)/p.duration;if(u>0&&u<1)total+=p.amplitude*kernel(p.a,p.b).normal*u**p.a*(1-u)**p.b;}
 return total;
}
function integratedPulse(p,from,to){
 const lo=Math.max(0,Math.min(1,(from-p.at)/p.duration)),hi=Math.max(0,Math.min(1,(to-p.at)/p.duration));
 if(hi<=lo)return 0;const k=kernel(p.a,p.b);
 return Math.max(0,p.amplitude*(p.duration/60000)*(k.primitive(hi)-k.primitive(lo)));
}
export function aggregate(q,time,minutes=5){
 const counts=[0,0,0,0,0];let views=0;
 if(!(minutes>0)||time<=q.bornAt||time-minutes*60000>=q.endsAt)return {views,counts};
 for(const p of pulsesFor(q)){const volume=integratedPulse(p,time-minutes*60000,time);views+=volume;for(let j=0;j<5;j++)counts[j]+=volume*(q.discussionRatio??.018)*p.opinion[j];}
 return {views,counts};
}
export function valuesAt(q,time){return {views:rateAt(q,time),counts:{m5:aggregate(q,time,5).counts,h1:aggregate(q,time,60).counts}};}
