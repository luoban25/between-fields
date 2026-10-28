import {sampleFlight} from '../../flight-motion.js';

export const WAKE_LIFETIME=5,WAKE_SAMPLE_COUNT=32;

/** Advected flight history, reconstructed from the scene clock even in stills. */
export function sampleCloudWake(time,actual,cloudAt,maskAt){
 const current=cloudAt(time),predicted=sampleFlight(time),dx=actual.x-predicted.x,dy=actual.y-(-941*.11+predicted.y);
 return Array.from({length:WAKE_SAMPLE_COUNT},(_,index)=>{
   const age=index*WAKE_LIFETIME/(WAKE_SAMPLE_COUNT-1),born=time-age;
   if(born<0)return {x:0,y:0,width:22,strength:0,yaw:0,age,time};
   const flight=sampleFlight(born),cloud=cloudAt(born),correction=Math.exp(-age*1.7);
   const x=flight.x+dx*correction,y=-941*.11+flight.y+dy*correction;
   const inCloud=maskAt(x-cloud.x,y-cloud.y);
   const fade=(1-age/WAKE_LIFETIME)**1.15;
   const curl=(Math.sin(age*1.7+born*.63)*.6+Math.sin(age*3.7-born*.29)*.4)*(1-Math.exp(-age*.8))*6;
   const yaw=flight.yaw+(actual.yaw-predicted.yaw)*correction;
   return {x:x+current.x-cloud.x+Math.sin(yaw)*4+Math.cos(yaw)*curl,y:y+current.y-cloud.y-Math.cos(yaw)*4+Math.sin(yaw)*curl,width:22+age*1.8,strength:Math.min(1,inCloud*2.5)*fade,yaw,age,time};
 });
}

/** A short soft opening followed by counter-rotating, dissipating wingtip flow. */
export function sampleWakeField(samples,x,y){
 let cut=0,rim=0,vx=0,vy=0,weight=0;
 for(const s of samples){
   if(s.strength<.001)continue;
   const dx=x-s.x,dy=y-s.y,c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
   const across=c*dx+sn*dy,along=-sn*dx+c*dy,length=16+s.age*4;
   const radius=(across/s.width)**2+(along/length)**2;
   const blob=Math.min(1,1.06*Math.exp(-1.4*radius)*s.strength*Math.exp(-s.age*1.65));
   cut=Math.max(cut,blob);
   const grown=(1-Math.exp(-s.age*4))*Math.exp(-s.age*.18)*s.strength;
   for(const side of [-1,1]){
     const offset=side*(23+s.age*3.5)+Math.sin(s.age*1.4+side)*1.5*(1-Math.exp(-s.age));
     const qx=(across-offset)/(7.5+s.age*3.3),qy=along/(15+s.age*4.8);
     const vortex=Math.exp(-1.15*(qx*qx+qy*qy))*grown;
     const phase=qx*1.7+qy*2.4-side*s.age*2.1+s.time*.23;
     const mist=vortex*(.45+.55*Math.sin(phase)**2);
     rim=Math.max(rim,mist);
     const localX=-qy*side*vortex,localY=qx*side*vortex;
     vx+=c*localX-sn*localY;vy+=sn*localX+c*localY;weight+=vortex;
   }
 }
 vx/=Math.max(weight,1);vy/=Math.max(weight,1);const soften=1+Math.hypot(vx,vy);
 return {cut,rim,dx:vx/soften,dy:vy/soften};
}
