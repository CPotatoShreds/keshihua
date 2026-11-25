// Rectangular glyph bounds follow an elliptical spiral, rather than rows/columns.
// Packing envelopes reserve the maximum live font size, so changing weights do
// not shuffle words or collide with neighbours on every incoming data frame.
// Words stay horizontal and fit inside a circle (topic-stage word cloud).
export function cloudInCircle(words,cx,cy,radius,measure,{minFont=11,maxFont=24,gap=6,minScale=.4}={}) {
 const max=Math.max(1,...words.map(w=>w.value||1));
 const ordered=words.slice().sort((a,b)=>(b.value||0)-(a.value||0)||b.word.length-a.word.length||a.word.localeCompare(b.word));
 const sizes=ordered.map(w=>Math.max(minFont,Math.min(maxFont,minFont+(maxFont-minFont)*Math.sqrt((w.value||1)/max))));
 for(let scale=1;scale>=minScale;scale-=.05){
  const placed=[];
  for(let i=0;i<ordered.length;i++){
   const q=ordered[i],font=sizes[i]*scale,textWidth=measure(q.word,font),bw=textWidth+gap,bh=font+gap;
   let found=null;
   for(let s=0;s<4200;s++){
    const angle=s*.21+i*.91,rad=.55*Math.sqrt(s)*Math.sqrt(s/6);
    const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad,px=cx+x,py=cy+y;
    if(Math.hypot(Math.abs(x)+bw/2,Math.abs(y)+bh/2)>radius)continue;
    if(placed.some(p=>Math.abs(px-p.x)<(bw+p.bw)/2&&Math.abs(py-p.y)<(bh+p.bh)/2))continue;
    found={...q,x:px,y:py,bw,bh,font,rotate:0};break;
   }
   if(!found)break;placed.push(found);
  }
  if(placed.length===ordered.length)return placed;
 }
 return [];
}
export function cloudLayout(words,width,height,measure) {
 const nominal=width<480?36:48, gap=7;
 const ordered=words.slice().sort((a,b)=>b.word.length-a.word.length||a.word.localeCompare(b.word));
 for(let scale=1;scale>=.35;scale-=.05){
  const placed=[];
  for(let i=0;i<ordered.length;i++){
   const q=ordered[i],font=nominal*scale;
   const rotate=ordered.length>5&&i%6===4?90:0;
   const textWidth=measure(q.word,font),bw=(rotate?font:textWidth)+gap,bh=(rotate?textWidth:font)+gap;
   let found=null;
   for(let s=0;s<3200;s++){
    const angle=s*.19+i*.73,radius=.45*Math.sqrt(s)*Math.sqrt(s/8);
    const x=width/2+Math.cos(angle)*radius*Math.min(2.6,width/height),y=height/2+Math.sin(angle)*radius;
    const box={x,y,bw,bh};
    if(x-bw/2<10||x+bw/2>width-10||y-bh/2<9||y+bh/2>height-9)continue;
    if(placed.some(p=>Math.abs(x-p.x)<(bw+p.bw)/2&&Math.abs(y-p.y)<(bh+p.bh)/2))continue;
    found={...q,...box,font,rotate};break;
   }
   if(!found)break;placed.push(found);
  }
  if(placed.length===ordered.length)return placed;
 }
 return [];
}
