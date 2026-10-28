import {MAIN_ROAD,PATCH_ROAD} from './road-data.js?v=17';
export const TERRAIN={width:941,height:1672,period:2088,patchStart:1528,patchHeight:704,fade:64};
const wrap=(v,p)=>((v%p)+p)%p;
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
function sample(points,y,column=1){
 let i=0;while(i<points.length-2&&points[i+1][0]<y)i++;
 const a=points[i],b=points[i+1],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+2)],span=b[0]-a[0],u=Math.max(0,Math.min(1,(y-a[0])/span));
 if(column===2)return a[2]+(b[2]-a[2])*u;
 const m0=(b[1]-prev[1])/(b[0]-prev[0]),m1=(next[1]-a[1])/(next[0]-a[0]);
 return (2*u*u*u-3*u*u+1)*a[1]+(u*u*u-2*u*u+u)*span*m0+(-2*u*u*u+3*u*u)*b[1]+(u*u*u-u*u)*span*m1;
}
function centre(y,column=1){
 const p=wrap(y,TERRAIN.period),end=TERRAIN.patchStart+TERRAIN.patchHeight-TERRAIN.period;
 if(p>=TERRAIN.patchStart){const w=smooth((p-TERRAIN.patchStart)/64),patch=sample(PATCH_ROAD,p-TERRAIN.patchStart,column);return w>=1?patch:sample(MAIN_ROAD,p,column)*(1-w)+patch*w;}
 if(p<end){const w=smooth((end-p)/64),patch=sample(PATCH_ROAD,p+TERRAIN.period-TERRAIN.patchStart,column);return w>=1?patch:sample(MAIN_ROAD,p,column)*(1-w)+patch*w;}
 return sample(MAIN_ROAD,p,column);
}
export function roadAt(y){return {x:centre(y),width:centre(y,2),slope:(centre(y+2)-centre(y-2))/4};}
export function sampleRover(time){const y=130+35*Math.sin(time*.2),virtualY=240-time*28+470.5-y,road=roadAt(virtualY);return {x:road.x-470.5,y,yaw:Math.atan(road.slope),roadWidth:road.width,virtualY};}
