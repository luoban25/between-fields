import {MAIN_ROAD,PATCH_ROAD} from './road-data.js';
export const TERRAIN={width:941,height:1672,period:2088,patchStart:1528,patchHeight:704,fade:64};
const wrap=(v,p)=>((v%p)+p)%p;
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
function sample(points,y,column=1){
 let i=0;while(i<points.length-2&&points[i+1][0]<y)i++;
 const a=points[i],b=points[i+1],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+2)];
 const span=b[0]-a[0],u=Math.max(0,Math.min(1,(y-a[0])/span));
 const m0=(b[column]-prev[column])/(b[0]-prev[0]),m1=(next[column]-a[column])/(next[0]-a[0]);
 return (2*u*u*u-3*u*u+1)*a[column]+(u*u*u-2*u*u+u)*span*m0+(-2*u*u*u+3*u*u)*b[column]+(u*u*u-u*u)*span*m1;
}
function centre(y,column=1){
 const p=wrap(y,TERRAIN.period),end=TERRAIN.patchStart+TERRAIN.patchHeight-TERRAIN.period;
 if(p>=TERRAIN.patchStart){
  const w=smooth((p-TERRAIN.patchStart)/TERRAIN.fade),patch=sample(PATCH_ROAD,p-TERRAIN.patchStart,column);
  return w>=1?patch:sample(MAIN_ROAD,p,column)*(1-w)+patch*w;
 }
 if(p<end){
  const w=smooth((end-p)/TERRAIN.fade),patch=sample(PATCH_ROAD,p+TERRAIN.period-TERRAIN.patchStart,column);
  return w>=1?patch:sample(MAIN_ROAD,p,column)*(1-w)+patch*w;
 }
 return sample(MAIN_ROAD,p,column);
}
export function roadAt(y){return {x:centre(y),width:centre(y,2),slope:(centre(y+2)-centre(y-2))/4};}
// Follow the one cyclist near the middle of the frame, with a gentle forward drift.
// Its virtual ground position still advances continuously along the scrolling road.
export function sampleCyclist(time){
 const size=TERRAIN.width,y=55*Math.sin(time*.28);
 const virtualY=240-time*28+size/2-y,road=roadAt(virtualY);
 return {x:road.x-size/2,y,yaw:Math.atan(road.slope),roadWidth:road.width,virtualY};
}
