import {ImprovedNoise} from '../../vendor/ImprovedNoise.js';
import {sampleCloudWake,sampleWakeField} from './cloud-wake.js';
import {makeWakeSimulation,atlasShader} from './wake-simulation.js';

/**
 * Orthographic adaptation of the MIT-licensed three.js r180 volume-cloud example.
 * Source: https://github.com/mrdoob/three.js/blob/r180/examples/webgl_volume_cloud.html
 * Copyright (c) 2010-2025 three.js authors. License: ../../vendor/THREE-LICENSE.txt.
 * Fixed integration samples: no frame-random jitter or temporal accumulation.
 * The caller owns the clock, so pause/offscreen/context recovery stay coherent.
 */
export const VOLUME_SETTINGS=Object.freeze({width:941,planeZ:24,bottom:-62,top:142,period:32,speed:53,textureSize:64});
const SHAPE_SEED=12.31,SHAPE_WIDTH=400,SHAPE_HEIGHT=340;
// Match the original central cloud's seeded, scalloped outline. Keep its cached
// color surface and share this feathered density envelope with GPU and CPU.
const lobes=[[-.56,-.10,.32],[-.42,.27,.34],[-.10,.42,.35],[.26,.34,.37],[.56,.06,.33],[.41,-.28,.33],[.02,-.38,.37],[-.34,-.32,.31],[0,0,.43]];
const fract=x=>x-Math.floor(x),hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
const shapeLobes=lobes.map(([x,y,r],i)=>({x:x*.88+y*1.09*.20+(hash(i+9.2,SHAPE_SEED*3.7)-.5)*.14,y:y*1.09+(hash(SHAPE_SEED*8.1,i+2.5)-.5)*.14,r:r*(.86+.29*hash(i*4.3+1.7,SHAPE_SEED*5.9))}));
function shapeAlpha(x,y){
 let px=x/SHAPE_WIDTH*2.10,py=y/SHAPE_HEIGHT*2.10;px+=Math.sin(SHAPE_SEED*2)*py*.10;
 let d=Infinity;
 for(const lobe of shapeLobes){const next=Math.hypot(px-lobe.x,py-lobe.y)-lobe.r;if(!Number.isFinite(d)){d=next;continue;}const h=Math.max(0,Math.min(1,.5+.5*(next-d)/.075));d=next+(d-next)*h-.075*h*(1-h);}
 const t=Math.max(0,Math.min(1,(d+.10)/.20)),border=Math.min(.5-Math.abs(x/SHAPE_WIDTH),.5-Math.abs(y/SHAPE_HEIGHT));
 const edge=Math.max(0,Math.min(1,border/.045));return (1-t*t*(3-2*t))*edge*edge*(3-2*edge);
}
export function sampleCloudPass(time=0){
 const phase=(((time+362/53)%VOLUME_SETTINGS.period)+VOLUME_SETTINGS.period)%VOLUME_SETTINGS.period;
 return {x:-24,y:650-phase*VOLUME_SETTINGS.speed,phase};
}

const vertexShader=`
 varying vec2 vWorld;
 void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xy;gl_Position=projectionMatrix*viewMatrix*world;}
`;
const densityShader=`
 ${atlasShader}
 precision highp sampler3D;
 uniform sampler3D uNoise;
 uniform sampler2D uCloudShape;
 uniform sampler2D uCloudMask;
 uniform vec2 uCenter;
 uniform float uTime;
 uniform float uSimReady;
 uniform float uCloudDensity;
 uniform float uDebug;
 varying vec2 vWorld;
 vec2 cloudUv(vec2 world){return (world-uCenter)/vec2(400.0,340.0)+.5;}
 float cloudMask(vec2 world){
   vec2 uv=cloudUv(world);
   if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return 0.0;
   return texture2D(uCloudMask,uv).r;
 }
 vec4 wakeAt(vec2 world){
   vec3 p=vec3(world-uCenter,24.);vec4 rho=densityAtField(p);vec4 v=velocityAt(p);
   return vec4(clamp(1.-rho.r/max(rho.b,.05),0.,1.),max(rho.g,v.a),v.xy/60.);
 }
 float density(vec3 p){
   return densityAtField(vec3(p.xy-uCenter,p.z)).r*uCloudDensity;
 }
`;
function cloudFragment(near,far){return `${densityShader}
 void main(){
   vec2 local=vWorld-uCenter;if(any(greaterThan(abs(local),vec2(260.,230.))))discard;
   if(uDebug>.5){
     ${far===VOLUME_SETTINGS.top?'':'gl_FragColor=vec4(0.);return;'}
     float total=0.,speed=0.,activity=0.,difference=0.;vec3 velocity=vec3(0.);
     for(int k=0;k<12;k++){vec3 p=vec3(local,-62.+float(k)*204./11.);vec4 rho=densityAtField(p),v=velocityAt(p);total+=rho.b;velocity+=v.xyz;speed+=length(v.xyz);activity=max(activity,max(rho.g,v.a));difference+=abs(rho.r-rho.b);}
     float alpha=clamp(total*.17+activity*.8,0.,.94);if(alpha<.01)discard;
     vec3 color=uDebug<1.5?mix(vec3(.07,.12,.20),vec3(.88,.95,1.),clamp(total/11.,0.,1.)):uDebug<2.5?(.5+.5*normalize(velocity+vec3(.01)))*min(1.,.25+speed/95.):mix(vec3(.07,.20,.30),vec3(1.,.50,.12),clamp(activity*.85+difference*.35,0.,1.));
     gl_FragColor=vec4(color,alpha);return;
   }
   float trans=1.0;vec3 radiance=vec3(0.0);
   vec4 flow=wakeAt(vWorld);
   vec3 originalColor=texture2D(uCloudShape,clamp(cloudUv(vWorld-flow.ba*14.0),vec2(.005),vec2(.995))).rgb;
   const float stepLength=${((far-near)/56).toFixed(9)};
   for(int i=0;i<56;i++){
     float z=${far.toFixed(3)}-(float(i)+.5)*stepLength;
     vec3 p=vec3(vWorld,z);vec4 parcel=densityAtField(vec3(vWorld-uCenter,z));float d=parcel.r*uCloudDensity;
     if(d>.001){
       float lightDensity=0.;
       for(int l=1;l<=4;l++)lightDensity+=density(p+vec3(-12.,17.,22.)*float(l));
       float sun=exp(-lightDensity*.58);
       float height=clamp((z+62.0)/204.0,0.0,1.0);
       vec3 light=mix(vec3(.61,.71,.81),vec3(1.0),clamp(sun*.76+height*.24,0.,1.));
       vec3 transportedVelocity=velocityAt(vec3(vWorld-uCenter,z)).xyz;
       float rolledFace=smoothstep(-32.,38.,transportedVelocity.z);
       light*=1.-parcel.g*(.06+rolledFace*.21);
       light=mix(light,light*max(originalColor,vec3(.78)),.24);
       float rolledShade=flow.y*(.55+.45*sin(vWorld.x*.13+vWorld.y*.09+uTime*.25));
       light*=1.0-rolledShade*.12;
       float alpha=1.0-exp(-d*stepLength*.033);
       radiance+=trans*alpha*light;
       trans*=1.0-alpha;
       if(trans<.012)break;
     }
   }
   float alpha=1.0-trans;if(alpha<.002)discard;
   gl_FragColor=vec4(radiance/max(alpha,.0001),alpha);
   #include <colorspace_fragment>
 }
`;}
const shadowFragment=`${densityShader}
 uniform vec3 uGroundShadowColor;
 void main(){
   if(uDebug>.5)discard;
   float opticalDepth=0.0;
   for(int i=0;i<18;i++){
     float z=-62.0+(float(i)+.5)*(204.0/18.0);
     opticalDepth+=density(vec3(vWorld-vec2(58.0,-79.0),z))*(204.0/18.0)*.021;
   }
   float alpha=(1.0-exp(-opticalDepth))*.32;
   if(alpha<.002)discard;
   gl_FragColor=vec4(uGroundShadowColor,alpha);
   #include <colorspace_fragment>
 }
`;
const wispFragment=`${densityShader}
 uniform float uLayer;
 uniform vec4 uAircraftPose;
 void main(){
   if(uDebug>.5)discard;
   vec2 p=vWorld-uCenter;
   float envelope=clamp(densityAtField(vec3(p,45.)).r*2.,0.,1.);
   if(envelope<.008)discard;
   float front=uLayer;
   vec3 uv=vec3(p/vec2(275.0,155.0),.21+front*.37);
   uv+=vec3(uTime*.006,-uTime*(.010+front*.006),0.0);
   vec2 wing=vWorld-uAircraftPose.xy;
   float influence=exp(-dot(wing/vec2(65.0,32.0),wing/vec2(65.0,32.0))*1.7);
   uv.xy+=vec2(wing.x,-wing.y)*influence*.0014;
   float n=texture(uNoise,uv).r;
   float fine=texture(uNoise,uv*2.9+vec3(.3,.1,.4)).r;
   vec4 wake=wakeAt(vWorld);
   float alpha=(smoothstep(.45,.72,n*.78+fine*.22)*(.035+front*.025)*(1.0-wake.x*.65)+wake.y*.09*(.25+fine*.75))*envelope;
   if(alpha<.002)discard;
   vec3 rollColor=mix(vec3(.81,.87,.93),vec3(1.0),smoothstep(-.12,.12,wake.a));
   vec3 mistColor=mix(mix(vec3(.91,.95,.98),vec3(1.0),front),rollColor,clamp(wake.y*2.0,0.0,1.0));
   gl_FragColor=vec4(mistColor,alpha);
   #include <colorspace_fragment>
 }
`;

const surfaceShadowFragment=`${densityShader}
 uniform sampler2D uAircraft;
 uniform mat3 uAircraftUv;
 uniform vec4 uAircraftPose;
 uniform float uShadowVisibility;
 float silhouette(vec2 p){
   if(any(lessThan(p,vec2(0.0)))||any(greaterThan(p,vec2(1.0))))return 0.0;
   return texture2D(uAircraft,(uAircraftUv*vec3(p,1.0)).xy).a;
 }
 void main(){
   if(uDebug>.5)discard;
   vec2 delta=vWorld-uAircraftPose.xy-vec2(22.0,-32.0);
   float c=cos(uAircraftPose.z),s=sin(uAircraftPose.z);
   vec2 p=vec2(c*delta.x+s*delta.y,-s*delta.x+c*delta.y)/vec2(70.0*uAircraftPose.w,42.0)+.5;
   if(any(lessThan(p,vec2(-.04)))||any(greaterThan(p,vec2(1.04))))discard;
   vec2 d=vec2(.025,.032);
   float a=silhouette(p)*.32;
   a+=(silhouette(p+vec2(d.x,0.0))+silhouette(p-vec2(d.x,0.0))+silhouette(p+vec2(0.0,d.y))+silhouette(p-vec2(0.0,d.y)))*.12;
   a+=(silhouette(p+d)+silhouette(p-d)+silhouette(p+vec2(d.x,-d.y))+silhouette(p+vec2(-d.x,d.y)))*.05;
   vec4 wake=wakeAt(vWorld);
   float surface=clamp(density(vec3(vWorld,90.))*2.,0.,1.);
   a*=surface*(1.0-wake.x*.72)*(.16+uShadowVisibility*.46);
   if(a<.002)discard;
   gl_FragColor=vec4(.27,.32,.40,a);
   #include <colorspace_fragment>
 }
`;

export function makeCloudVolume(THREE,{cloudMap=null,groundShadowColor=[.20,.13,.085]}={}){
 const {width,planeZ,bottom,top,textureSize}=VOLUME_SETTINGS;
 const noise=new ImprovedNoise(),data=new Uint8Array(textureSize**3);
 const features=new Float32Array(10*10*10*3);
 for(let z=-1;z<=8;z++)for(let y=-1;y<=8;y++)for(let x=-1;x<=8;x++){const i=(((z+1)*10+y+1)*10+x+1)*3;features[i]=x+hash(x+z*17,y+9.13);features[i+1]=y+hash(y+x*13,z+4.71);features[i+2]=z+hash(z+y*19,x+2.39);}
 let index=0;
 for(let z=0;z<textureSize;z++)for(let y=0;y<textureSize;y++)for(let x=0;x<textureSize;x++){
   const a=noise.noise(x/13+7.13,y/13+1.73,z/13+3.91);
   const b=noise.noise(x/6.5+18.1,y/6.5+6.23,z/6.5+9.67);
   const px=x/8,py=y/8,pz=z/8,cx=Math.floor(px),cy=Math.floor(py),cz=Math.floor(pz);let nearest=4;
   for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const i=(((cz+dz+1)*10+cy+dy+1)*10+cx+dx+1)*3;const fx=px-features[i],fy=py-features[i+1],fz=pz-features[i+2];nearest=Math.min(nearest,fx*fx+fy*fy+fz*fz);}
   const worley=1-Math.min(1,Math.sqrt(nearest));
   data[index++]=Math.round(THREE.MathUtils.clamp((.5+a*.46+b*.14)*.80+worley*.20,0,1)*255);
 }
 const texture=new THREE.Data3DTexture(data,textureSize,textureSize,textureSize);
 texture.format=THREE.RedFormat;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 texture.wrapS=texture.wrapT=texture.wrapR=THREE.MirroredRepeatWrapping;
 texture.unpackAlignment=1;texture.needsUpdate=true;
 const maskSize=256,maskData=new Uint8Array(maskSize*maskSize);
 for(let y=0;y<maskSize;y++)for(let x=0;x<maskSize;x++)maskData[y*maskSize+x]=Math.round(shapeAlpha(((x+.5)/maskSize-.5)*SHAPE_WIDTH,((y+.5)/maskSize-.5)*SHAPE_HEIGHT)*255);
 const shapeMask=new THREE.DataTexture(maskData,maskSize,maskSize,THREE.RedFormat);
 shapeMask.minFilter=shapeMask.magFilter=THREE.LinearFilter;shapeMask.needsUpdate=true;
 const simulation=makeWakeSimulation(THREE,{noise:texture,mask:shapeMask});
 const group=new THREE.Group();group.name='Wind over wilderness / split volumetric cloud';
 const geometry=new THREE.PlaneGeometry(width,width);
 const uniforms={uNoise:{value:texture},uVelocity:{value:null},uDensity:{value:null},uPacked:{value:0},uSimReady:{value:0},uCloudDensity:{value:1},uDebug:{value:0},uCloudShape:{value:cloudMap},uCloudMask:{value:shapeMask},uCenter:{value:new THREE.Vector2()},uTime:{value:0},uAircraft:{value:null},uAircraftUv:{value:new THREE.Matrix3()},uAircraftPose:{value:new THREE.Vector4(0,0,0,1)},uShadowVisibility:{value:1}};
 function pass(name,order,fragment,extra={}){
   const material=new THREE.ShaderMaterial({uniforms:{...uniforms,...extra},vertexShader,fragmentShader:fragment,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
   const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.z=order;mesh.renderOrder=order;mesh.frustumCulled=false;group.add(mesh);return mesh;
 }
 const shadow=pass('Volume ground shadow',7.2,shadowFragment,{uGroundShadowColor:{value:new THREE.Vector3(...groundShadowColor)}});
 const back=pass('Cloud behind aircraft',18,cloudFragment(bottom,planeZ));
 const rearWisp=pass('Rear flowing mist',20,wispFragment,{uLayer:{value:0}});
 const front=pass('Cloud in front of aircraft',28,cloudFragment(planeZ,top));
 const frontWisp=pass('Near flowing mist',32,wispFragment,{uLayer:{value:1}});
 const surfaceShadow=pass('Aircraft shadow on cloud surface',29,surfaceShadowFragment);
 // Raymarch only at the cloud-buffer resolution. Full-resolution terrain and
 // aircraft stay sharp, and the two inexpensive wisps remain separate layers.
 const buffers=[];
 for(const mesh of [shadow,back,front]){
   const source=new THREE.Scene();source.add(mesh);mesh.material.blending=THREE.NoBlending;
   const target=new THREE.WebGLRenderTarget(256,256,{depthBuffer:false,stencilBuffer:false});
   const material=new THREE.MeshBasicMaterial({map:target.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
   const composite=new THREE.Mesh(geometry,material);composite.position.z=mesh.renderOrder;composite.renderOrder=mesh.renderOrder;composite.frustumCulled=false;composite.name=mesh.name+' composite';group.add(composite);
   buffers.push({source,target,composite});
 }
 // The split is at the actual sprite altitude. Foreground transmittance alone
 // attenuates the aircraft; never multiply its alpha a second time.
 const state={time:0,centerX:0,centerY:0,phase:0,passCount:6,textureSize,bufferSize:256,wakeSamples:[],wakeLifetime:16,shadowVisibility:1,flow:simulation.state};
 let cloudClock=0,previousTime=0;
 const noisePoint=new THREE.Vector3();
 function sampleTexture(x,y,z){
   const mirror=v=>{const p=((v%2)+2)%2;return p<=1?p:2-p;};
   const axis=v=>{const p=mirror(v)*textureSize-.5;const a=Math.floor(p),f=p-a;return [THREE.MathUtils.clamp(a,0,textureSize-1),THREE.MathUtils.clamp(a+1,0,textureSize-1),f];};
   const [x0,x1,fx]=axis(x),[y0,y1,fy]=axis(y),[z0,z1,fz]=axis(z);
   const at=(a,b,c)=>data[(c*textureSize+b)*textureSize+a]/255;
   const lerp=THREE.MathUtils.lerp;
   return lerp(lerp(lerp(at(x0,y0,z0),at(x1,y0,z0),fx),lerp(at(x0,y1,z0),at(x1,y1,z0),fx),fy),lerp(lerp(at(x0,y0,z1),at(x1,y0,z1),fx),lerp(at(x0,y1,z1),at(x1,y1,z1),fx),fy),fz);
 }
 // CPU envelope estimates support the small ground-aircraft shadow only.
 // Optical occlusion, cloud shape, and acceptance probes use the GPU fields.
 function densityAt(x,y,z,withWake=true,flow=null){
   const smooth=(low,high,v)=>{const t=THREE.MathUtils.clamp((v-low)/(high-low),0,1);return t*t*(3-2*t);};
   const h=(z-37)/101,envelope=shapeAlpha(x-state.centerX,y-state.centerY)*smooth(0,.28,1-h*h);if(envelope<.001)return 0;
   const wake=flow??(withWake?sampleWakeField(state.wakeSamples,x,y):{cut:0,rim:0,dx:0,dy:0});
   const shear=.7+.3*Math.sin((z-24)*.035);
   noisePoint.set((x-state.centerX-wake.dx*24*shear)/242+.31+state.time*.0024,(y-state.centerY-wake.dy*24*shear)/220+.27-state.time*.0018,z/160+.15+state.time*.0011);
   const n=sampleTexture(noisePoint.x,noisePoint.y,noisePoint.z)*.73+sampleTexture(noisePoint.x*2.47+.19,noisePoint.y*2.47+.57,noisePoint.z*2.47+.32)*.27;
   const billow=smooth(.22,.74,n),base=.45+billow*.95;
   if(!withWake||state.wakeSamples.length===0)return envelope*base;
   const vertical=Math.exp(-(((z-45)/195)**4));
   return envelope*(base*(1-wake.cut*(.96+billow*.025)*vertical)+wake.rim*.12*(.35+n*.65)*vertical);
 }
 function transmittanceAt(x,y,withWake=true){
   let depth=0;const step=(top-planeZ)/24,flow=withWake?sampleWakeField(state.wakeSamples,x,y):{cut:0,rim:0,dx:0,dy:0};
   for(let i=0;i<24;i++)depth+=densityAt(x,y,top-(i+.5)*step,withWake,flow)*step*.033;
   return Math.exp(-depth);
 }
 function update(time){
   if(time<previousTime)cloudClock=time*simulation.params.wind/.7;else cloudClock+=(time-previousTime)*simulation.params.wind/.7;previousTime=time;
   const pose=sampleCloudPass(cloudClock);Object.assign(state,{time,centerX:pose.x,centerY:pose.y,phase:pose.phase});
   uniforms.uTime.value=time;uniforms.uCenter.value.set(pose.x,pose.y);
 }
 function setAircraft(map){uniforms.uAircraft.value=map;uniforms.uAircraftUv.value.copy(map.matrix);}
 function setCloudShape(map){uniforms.uCloudShape.value=map;}
 function updateAircraft(x,y,yaw,scaleX){
   uniforms.uAircraftPose.value.set(x,y,yaw,scaleX);
   state.wakeSamples=sampleCloudWake(state.time,{x,y,yaw},sampleCloudPass,shapeAlpha);
   simulation.enqueue({time:state.time,centerX:state.centerX,centerY:state.centerY,x,y,yaw,phase:state.phase,gate:shapeAlpha(x-state.centerX,y-state.centerY)});
   state.shadowVisibility=transmittanceAt(x,y,false);uniforms.uShadowVisibility.value=state.shadowVisibility;
 }
 function wakeAtPoint(x,y){return sampleWakeField(state.wakeSamples,x,y);}
 function resize(width,height,pixelRatio){
   const resolution=Math.max(160,Math.min(512,Math.round(Math.max(width,height)*pixelRatio*.55)));
   if(resolution===state.bufferSize)return;
   state.bufferSize=resolution;buffers.forEach(({target})=>target.setSize(resolution,resolution));
 }
 function advance(renderer){const flow=simulation.render(renderer);uniforms.uDensity.value=flow.density;uniforms.uVelocity.value=flow.velocity;uniforms.uPacked.value=flow.packed;uniforms.uSimReady.value=1;}
 const savedColor=new THREE.Color();
 function render(renderer,camera){
   const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
   renderer.getClearColor(savedColor);
   try{
     renderer.autoClear=true;renderer.setClearColor(0,0);
     advance(renderer);
     for(const {source,target} of buffers){renderer.setRenderTarget(target);renderer.render(source,camera);}
   }finally{renderer.setRenderTarget(previous);renderer.setClearColor(savedColor,alpha);renderer.autoClear=autoClear;}
 }
 function setParams(params){simulation.setParams(params);state.wakeLifetime=params.lifetime??16;uniforms.uCloudDensity.value=params.density??1;uniforms.uDebug.value=({final:0,density:1,velocity:2,wake:3})[params.debug??'final'];}
 function reset(){simulation.reset();}
 function restore(){texture.needsUpdate=true;shapeMask.needsUpdate=true;simulation.reset();}
 function dispose(){geometry.dispose();texture.dispose();shapeMask.dispose();simulation.dispose();for(const mesh of [shadow,back,rearWisp,front,frontWisp,surfaceShadow])mesh.material.dispose();buffers.forEach(({target,composite})=>{target.dispose();composite.material.dispose();});}
 update(0);
 return {group,state,simulation,update,setAircraft,setCloudShape,updateAircraft,wakeAtPoint,resize,render,advance,transmittanceAt,densityAt,setParams,reset,restore,dispose,passes:{shadow,back,rearWisp,front,frontWisp,surfaceShadow}};
}
