const clamp=v=>Math.max(0,Math.min(1,v));
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
export function safeBirth(target,nodes,w,h,angle,distance){
 const end={x:target.x+Math.cos(angle)*target.r,y:target.y+Math.sin(angle)*target.r},start={x:target.x+Math.cos(angle)*(target.r+distance),y:target.y+Math.sin(angle)*(target.r+distance)};
 if(start.x<18||start.x>w-18||start.y<80||start.y>h-55)return null;
 if(nodes.some(n=>n.id!==target.id&&(Math.hypot(start.x-n.x,start.y-n.y)<n.r+55||segmentDistance(n,start,end)<n.r+26)))return null;
 return start;
}

export function dropletAt(t,hostRadius,distance,size){
 const u=t*t*(3-2*t),r=size*Math.pow(Math.sin(t*Math.PI/2),1.3);
 return {r,distance:hostRadius+distance*(1-u)-r*1.1*u};
}
