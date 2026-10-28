// Persistent, cloud-local 2.5D fluid volume. Twelve physical depth slices are
// packed into a 4x3 atlas; every update reads the previous GPU state.
export const FLOW_GRID=Object.freeze({resolution:192,columns:4,rows:3,layers:12,width:520,height:460,bottom:-62,top:142,step:1/45});
export const FLOW_DEFAULTS=Object.freeze({speed:1,strength:1.25,density:1,wind:.7,lifetime:16,decay:.07,debug:'final'});
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const atlasShader=`
 precision highp float;
 uniform sampler2D uVelocity;
 uniform sampler2D uDensity;
 uniform float uPacked;
 const vec3 FIELD_SIZE=vec3(520.,460.,204.);
 const vec3 CELL=vec3(520./192.,460./192.,204./11.);
 vec2 atlasUv(vec3 p,float layer){
   vec2 uv=clamp(p.xy/FIELD_SIZE.xy+.5,vec2(.5/192.),vec2(1.-.5/192.));
   return (uv+vec2(mod(layer,4.),floor(layer/4.)))/vec2(4.,3.);
 }
 vec4 fieldSample(sampler2D tex,vec3 p){
   if(any(greaterThan(abs(p.xy),FIELD_SIZE.xy*.5))||p.z< -62.||p.z>142.)return vec4(0.);
   float z=clamp((p.z+62.)/204.*11.,0.,11.);float lo=floor(z);
   return mix(texture2D(tex,atlasUv(p,lo)),texture2D(tex,atlasUv(p,min(lo+1.,11.))),fract(z));
 }
 vec4 velocityAt(vec3 p){
   if(any(greaterThan(abs(p.xy),FIELD_SIZE.xy*.5))||p.z< -62.||p.z>142.)return vec4(0.);
   vec4 s=fieldSample(uVelocity,p);return vec4(mix(s.xyz,(s.xyz-.5)*160.,uPacked),s.a);
 }
 vec4 densityAtField(vec3 p){vec4 d=fieldSample(uDensity,p);d.rb*=1.+uPacked;return d;}
`;
const baseShader=`
 uniform highp sampler3D uNoise;
 uniform sampler2D uCloudMask;
 float originalDensity(vec3 p){
   vec2 uv=p.xy/vec2(400.,340.)+.5;
   if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
   float mask=texture2D(uCloudMask,uv).r;
   vec3 q=p/vec3(242.,220.,160.)+vec3(.31,.27,.15);
   vec3 warp=vec3(texture(uNoise,q*.71+vec3(.17,.43,.23)).r,texture(uNoise,q*.73+vec3(.64,.18,.61)).r,texture(uNoise,q*.69+vec3(.35,.76,.14)).r)-.5;
   q+=warp*.17;
   float cap=texture(uNoise,vec3(p.xy/vec2(155.,145.)+vec2(.21,.33),.33)).r;
   float h=(p.z-25.)/(58.+cap*88.);float envelope=mask*smoothstep(0.,.25,1.-h*h);
   float n=texture(uNoise,q).r*.73+texture(uNoise,q*2.47+vec3(.19,.57,.32)).r*.27;
   return envelope*(.07+smoothstep(.27,.73,n)*1.35);
 }
`;
const simulationShader=`${atlasShader}${baseShader}
 varying vec2 vUv;
 uniform sampler2D uCurl;
 uniform vec4 uAircraft;
 uniform vec2 uMotion;
 uniform vec4 uSettings;
 uniform vec2 uDecay;
 uniform float uDt;
 uniform float uTime;
 uniform float uMode;
 uniform float uReset;
 uniform float uGate;
 vec3 positionAtPixel(){
   vec2 tiled=vUv*vec2(4.,3.);vec2 tile=floor(tiled);
   return vec3((fract(tiled)-.5)*FIELD_SIZE.xy,-62.+(tile.y*4.+tile.x)*204./11.);
 }
 vec4 curlAt(vec3 p){if(any(greaterThan(abs(p.xy),FIELD_SIZE.xy*.5))||p.z< -62.||p.z>142.)return vec4(0.);vec4 s=fieldSample(uCurl,p);return vec4(mix(s.xyz,(s.xyz-.5)*12.,uPacked),s.a*6.);}
 vec3 curl(vec3 p){
   vec3 x=CELL*vec3(1.,0.,0.),y=CELL*vec3(0.,1.,0.),z=CELL*vec3(0.,0.,1.);
   vec3 vx=(velocityAt(p+x).xyz-velocityAt(p-x).xyz)/(2.*CELL.x);
   vec3 vy=(velocityAt(p+y).xyz-velocityAt(p-y).xyz)/(2.*CELL.y);
   vec3 vz=(velocityAt(p+z).xyz-velocityAt(p-z).xyz)/(2.*CELL.z);
   return vec3(vy.z-vz.y,vz.x-vx.z,vx.y-vy.x);
 }
 void main(){
   vec3 p=positionAtPixel();
   if(uReset>.5){if(uMode>1.5){float stored=originalDensity(p)/(1.+uPacked);gl_FragColor=vec4(stored,0.,stored,1.);}else gl_FragColor=vec4(vec3(.5)*uPacked,0.);return;}
   if(uMode<.5){vec3 w=curl(p);gl_FragColor=vec4(mix(w,.5+w/12.,uPacked),min(length(w)/6.,1.));return;}
   vec3 d=p-vec3(uAircraft.xy,24.);
   float c=cos(uAircraft.z),s=sin(uAircraft.z);
   vec3 right=vec3(c,s,0.),forward=vec3(-s,c,0.);
   float across=dot(d,right),along=dot(d,forward);
   float gate=uGate;
   float nose=exp(-pow(across/17.,2.)-pow((along-10.)/24.,2.)-pow(d.z/115.,2.))*gate;
   vec3 wind=vec3(uSettings.z*2.5,uSettings.z*1.5,0.);
   if(uMode<1.5){
     vec4 old=velocityAt(p);vec3 back=p-(old.xyz+wind)*uDt;
     vec4 advected=velocityAt(back);vec3 v=advected.xyz*exp(-uDt*(uDecay.x+1./uSettings.w*.3));
     vec3 ex=CELL*vec3(1.,0.,0.),ey=CELL*vec3(0.,1.,0.),ez=CELL*vec3(0.,0.,1.);
     vec3 gradient=vec3(curlAt(p+ex).a-curlAt(p-ex).a,curlAt(p+ey).a-curlAt(p-ey).a,curlAt(p+ez).a-curlAt(p-ez).a)/(2.*CELL);
     vec3 omega=curlAt(p).xyz;
     v+=cross(gradient/(length(gradient)+.001),omega)*1.9*uDt;
     float activity=advected.a*exp(-uDt*(uDecay.x+.6/uSettings.w));
     for(int i=0;i<2;i++){
       float side=i==0?-1.:1.;float dx=across-side*26.;
       float radius2=dx*dx+d.z*d.z*.32;
       float vortex=exp(-radius2/(29.*29.))*exp(-along*along/(24.*24.))*gate;
       vec3 spin=(right*(-d.z)+vec3(0.,0.,dx))*side;
       v+=spin*vortex*uSettings.x*3.8*uDt;
       v+=forward*(sin(d.z*.08+side*.9)*vortex*uSettings.x*10.*uDt);
       activity=max(activity,vortex*.9*min(uSettings.x,1.));
     }
     v+=right*(across/17.)*nose*uSettings.x*95.*uDt;
     v+=forward*nose*14.*uSettings.x*uDt;
     // Gentle spatially coherent breakup acts on existing disturbed air only.
     v+=vec3(sin(p.y*.052+p.z*.08+uTime*.31),cos(p.x*.045-p.z*.07+uTime*.27),sin(p.x*.04+p.y*.03-uTime*.23))*activity*2.2*uDt;
     float edge=smoothstep(0.,22.,min(FIELD_SIZE.x*.5-abs(p.x),FIELD_SIZE.y*.5-abs(p.y)));
     v=clamp(v*edge,vec3(-72.),vec3(72.));activity=max(activity,nose*.7*min(uSettings.x,1.))*edge;
     gl_FragColor=vec4(mix(v,.5+v/160.,uPacked),activity);return;
   }
   float base=originalDensity(p);vec4 flow=velocityAt(p);vec3 back=p-(flow.xyz+wind)*uDt;
   // Radial backtrace pushes existing cloud mass outwards at the nose; the
   // displaced material enters both wing vortices rather than vanishing.
   back-=right*sign(across)*nose*uSettings.x*32.*uDt;
   vec4 old=densityAtField(back);float rho=old.r;
   float diffusion=clamp(uDt*.8,0.,.08);
   float neighbors=(densityAtField(back+vec3(CELL.x,0.,0.)).r+densityAtField(back-vec3(CELL.x,0.,0.)).r+densityAtField(back+vec3(0.,CELL.y,0.)).r+densityAtField(back-vec3(0.,CELL.y,0.)).r)*.25;
   rho=mix(rho,neighbors,diffusion);
   float divergence=(velocityAt(p+vec3(CELL.x,0.,0.)).x-velocityAt(p-vec3(CELL.x,0.,0.)).x)/(2.*CELL.x)+(velocityAt(p+vec3(0.,CELL.y,0.)).y-velocityAt(p-vec3(0.,CELL.y,0.)).y)/(2.*CELL.y)+(velocityAt(p+vec3(0.,0.,CELL.z)).z-velocityAt(p-vec3(0.,0.,CELL.z)).z)/(2.*CELL.z);
   rho*=exp(-clamp(divergence,-1.2,1.2)*uDt*.58);
   // Slow humidity restoration is separate from disturbance decay.
   float restore=1.-exp(-uDt*(2./uSettings.w+uDecay.x*.25));
   rho=mix(rho,base,restore);
   rho*=exp(-nose*uDt*uSettings.x*4.8);
   float shell=exp(-pow((abs(across)-31.)/14.,2.)-pow(along/25.,2.)-pow(d.z/95.,2.))*gate;
   rho+=shell*base*uSettings.x*.45*uDt;
   float edge=smoothstep(0.,15.,min(FIELD_SIZE.x*.5-abs(p.x),FIELD_SIZE.y*.5-abs(p.y)));
   gl_FragColor=vec4(clamp(rho*edge,0.,1.95)/(1.+uPacked),max(old.g*exp(-uDt/uSettings.w),flow.a),base/(1.+uPacked),1.);
 }
`;

export function makeWakeSimulation(THREE,{noise,mask}){
 const {resolution,columns,rows,step}=FLOW_GRID;
 const params={...FLOW_DEFAULTS},state={steps:0,resets:0,elapsed:0,precision:'half-float',enabled:true};
 const uniforms={uVelocity:{value:null},uDensity:{value:null},uCurl:{value:null},uNoise:{value:noise},uCloudMask:{value:mask},uPacked:{value:0},uAircraft:{value:new THREE.Vector4(0,-400,0,1)},uGate:{value:0},uMotion:{value:new THREE.Vector2()},uSettings:{value:new THREE.Vector4(params.strength,params.density,params.wind,params.lifetime)},uDecay:{value:new THREE.Vector2(params.decay,0)},uDt:{value:step},uTime:{value:0},uMode:{value:0},uReset:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:simulationShader,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
 const geometry=new THREE.PlaneGeometry(2,2),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.Camera();mesh.frustumCulled=false;scene.add(mesh);
 const probeTarget=new THREE.WebGLRenderTarget(48,48,{depthBuffer:false,stencilBuffer:false});
 const probeMaterial=new THREE.ShaderMaterial({uniforms:{uVelocity:uniforms.uVelocity,uDensity:uniforms.uDensity,uPacked:uniforms.uPacked},vertexShader:vertex,fragmentShader:`${atlasShader}varying vec2 vUv;void main(){float delta=0.,activity=0.,speed=0.,rho=0.;for(int i=0;i<12;i++){vec3 p=vec3((vUv-.5)*FIELD_SIZE.xy,-62.+float(i)*204./11.);vec4 d=densityAtField(p),v=velocityAt(p);delta+=abs(d.r-d.b)/12.;activity=max(activity,max(d.g,v.a));speed=max(speed,length(v.xyz));rho+=d.r/12.;}gl_FragColor=vec4(delta*.5,activity,speed/80.,rho*.5);}`,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
 const probeScene=new THREE.Scene();const probeMesh=new THREE.Mesh(geometry,probeMaterial);probeMesh.frustumCulled=false;probeScene.add(probeMesh);
 let velocities=[],densities=[],curlTarget,head=0,initialized=false,lastTime=null,lastPose=null,queue=[],needReset=true,packed=false;
 const savedColor=new THREE.Color();
 function allocate(renderer){
   if(velocities.length)return;
   packed=!renderer.extensions.has('EXT_color_buffer_float');uniforms.uPacked.value=Number(packed);state.precision=packed?'packed-byte':'half-float';
   const target=()=>new THREE.WebGLRenderTarget(resolution*columns,resolution*rows,{type:packed?THREE.UnsignedByteType:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
   velocities=[target(),target()];densities=[target(),target()];curlTarget=target();
 }
 function draw(renderer,target,mode,reset=false){uniforms.uMode.value=mode;uniforms.uReset.value=Number(reset);renderer.setRenderTarget(target);renderer.render(scene,camera);}
 function reset(){needReset=true;queue=[];lastTime=null;lastPose=null;}
 function enqueue({time,centerX,centerY,x,y,yaw,phase,gate=0}){
   if(lastTime!==null&&(time<lastTime||phase<state.phase-.1))reset();
   if(lastTime!==null&&time>lastTime){
     // Fixed small steps, up to .35 s catchup. Hidden tabs pause their own clock.
     let dt=Math.min(time-lastTime,.35),start=time-dt;
     while(dt>1e-5){const h=Math.min(step,dt),at=start+h,f=(at-lastTime)/(time-lastTime),previous=lastPose??{x:x-centerX,y:y-centerY,yaw,gate};queue.push({dt:h,time:at,x:previous.x+(x-centerX-previous.x)*f,y:previous.y+(y-centerY-previous.y)*f,yaw:previous.yaw+(yaw-previous.yaw)*f,gate:previous.gate+(gate-previous.gate)*f});start=at;dt-=h;}
   }
   state.phase=phase;lastTime=time;lastPose={x:x-centerX,y:y-centerY,yaw,gate};
   uniforms.uAircraft.value.set(x-centerX,y-centerY,yaw,1);
 }
 function render(renderer){
   allocate(renderer);const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;renderer.getClearColor(savedColor);
   try{
     renderer.autoClear=true;renderer.setClearColor(0,0);
     if(needReset||!initialized){head=0;uniforms.uVelocity.value=null;uniforms.uDensity.value=null;for(let i=0;i<2;i++){draw(renderer,velocities[i],1,true);draw(renderer,densities[i],2,true);}initialized=true;needReset=false;state.resets++;}
     uniforms.uSettings.value.set(params.strength,params.density,params.wind,params.lifetime);uniforms.uDecay.value.set(params.decay,0);
     for(const tick of queue){
       uniforms.uDt.value=tick.dt;uniforms.uTime.value=tick.time;uniforms.uAircraft.value.set(tick.x,tick.y,tick.yaw,1);uniforms.uGate.value=tick.gate;
       uniforms.uVelocity.value=velocities[head].texture;uniforms.uDensity.value=densities[head].texture;
       uniforms.uCurl.value=null;draw(renderer,curlTarget,0);uniforms.uCurl.value=curlTarget.texture;
       const next=1-head;draw(renderer,velocities[next],1);uniforms.uVelocity.value=velocities[next].texture;draw(renderer,densities[next],2);head=next;state.steps++;state.elapsed+=tick.dt;
     }
     queue=[];
   }finally{renderer.setRenderTarget(previous);renderer.setClearColor(savedColor,alpha);renderer.autoClear=autoClear;}
   return {density:densities[head].texture,velocity:velocities[head].texture,packed:Number(packed)};
 }
 function setParams(next){Object.assign(params,next);}
 function inspect(renderer){
   if(!initialized)return null;
   uniforms.uVelocity.value=velocities[head].texture;uniforms.uDensity.value=densities[head].texture;
   const previous=renderer.getRenderTarget();renderer.setRenderTarget(probeTarget);renderer.render(probeScene,camera);
   const pixels=new Uint8Array(48*48*4);renderer.readRenderTargetPixels(probeTarget,0,0,48,48,pixels);renderer.setRenderTarget(previous);
   let maxDensityDelta=0,maxActivity=0,maxSpeed=0,changedCells=0,activeCells=0;
   for(let i=0;i<pixels.length;i+=4){maxDensityDelta=Math.max(maxDensityDelta,pixels[i]/255*2);maxActivity=Math.max(maxActivity,pixels[i+1]/255);maxSpeed=Math.max(maxSpeed,pixels[i+2]/255*80);if(pixels[i]>6)changedCells++;if(pixels[i+1]>10)activeCells++;}
   const result={maxDensityDelta,maxActivity,maxSpeed,changedCells,activeCells,steps:state.steps,resets:state.resets};state.probe=result;return result;
 }
 function dispose(){velocities.forEach(t=>t.dispose());densities.forEach(t=>t.dispose());curlTarget?.dispose();probeTarget.dispose();probeMaterial.dispose();material.dispose();geometry.dispose();}
 return {state,params,enqueue,render,reset,setParams,inspect,dispose,get targets(){return {velocity:velocities[head],density:densities[head]};}};
}
