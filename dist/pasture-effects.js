import {animalMotion} from './animal-layout.js?v=13';
import {makeRiverGeometry} from './river-geometry.js';
/** Ground-bound river glints and individually animated animals. */
export function makePastureEffects(THREE,{map,width,height,animalMaps={},animals=[],road=false,riverPath=null}) {
 const group=new THREE.Group();group.name='Pasture details';
 if(road){
  // A separate sand path aligns both joins precisely; no ground UV remapping.
  const path=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.ShaderMaterial({
   transparent:true,depthTest:false,depthWrite:false,
   uniforms:{uSize:{value:new THREE.Vector2(width,height)}},
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision highp float;varying vec2 vUv;uniform vec2 uSize;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){
     vec2 p=vec2(vUv.x,1.-vUv.y)*uSize;float t=p.y/uSize.y;
     float h00=2.*t*t*t-3.*t*t+1.,h10=t*t*t-2.*t*t+t,h01=-2.*t*t*t+3.*t*t,h11=t*t*t-t*t;
     float centre=h00*146.5+h10*.20*uSize.y+h01*238.+h11*.27*uSize.y;
     float d=abs(p.x-centre),grain=noise(p*.8),edge=noise(p*.19)-.5;
     float alpha=(1.-smoothstep(13.3,15.8,d+edge*1.3))*smoothstep(0.,48.,p.y);
     if(alpha<.001)discard;
     vec3 colour=mix(vec3(.94,.78,.51),vec3(.99,.86,.60),noise(p*.16)*.6+grain*.4);
     colour+=exp(-pow((p.x-centre+2.)/4.,2.))*vec3(.012,.045,.055);
     colour-=smoothstep(11.,16.,d)*.025;
     gl_FragColor=vec4(colour,alpha);
    }`
  }));
  path.position.z=1.1;path.renderOrder=1.1;path.name='Aligned connector road';group.add(path);
 }
 const waterMaterial=new THREE.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,
  uniforms:{uMap:{value:map},uTime:{value:0},uSize:{value:new THREE.Vector2(width,height)}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uMap;uniform float uTime;uniform vec2 uSize;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){
    vec3 ground=texture2D(uMap,vUv).rgb;
    // Classify actual river pixels, so highlights never cross grass, banks or rocks.
    float water=smoothstep(.035,.13,ground.b-ground.r)*smoothstep(.04,.16,ground.g-ground.r)*smoothstep(-.01,.03,ground.b-ground.g);
    if(water<.01)discard;
    vec2 p=vUv*uSize;
    float drift=p.y+uTime*29.;
    float ribbon=sin(p.x*.13+sin(drift*.019)*1.6+drift*.045);
    float glint=pow(max(0.,ribbon),20.);
    float broken=pow(max(0.,sin(drift*.16+p.x*.035)),9.);
    float fine=sin(p.x*.35+drift*.12)*.5+.5;
    float ends=smoothstep(0.,32./uSize.y,min(vUv.y,1.-vUv.y));
    float alpha=water*ends*(glint*broken*.19+fine*.018);
    gl_FragColor=vec4(.77,.97,1.,alpha);
   }`
 });
 const waterGeometry=riverPath?makeRiverGeometry(THREE,width,height,riverPath):new THREE.PlaneGeometry(width,height);
 const water=new THREE.Mesh(waterGeometry,waterMaterial);
 water.position.z=2;water.renderOrder=2;group.add(water);
 const herd=animals.map((spec)=>{
  const sheep=spec.kind==='sheep';
  const animalMap=sheep?animalMaps.sheep:animalMaps[spec.coat];
  const uniforms={uGraze:{value:0},uPhase:{value:spec.phase},uGait:{value:0},uWalk:{value:0},uSmall:{value:sheep ? .6 : 1},uTopDown:{value:sheep?0:1},uSpan:{value:spec.size},uHeading:{value:spec.headAngle}};
  const material=new THREE.MeshBasicMaterial({map:animalMap,transparent:true,alphaTest:.08,depthTest:false,depthWrite:false});
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='uniform float uGraze;uniform float uPhase;uniform float uGait;uniform float uWalk;uniform float uSmall;uniform float uTopDown;uniform float uSpan;uniform float uHeading;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float head=smoothstep(.57,.86,uv.x);
    float legs=(1.-smoothstep(.27,.48,uv.y))*smoothstep(.15,.30,uv.x);
    float tail=(1.-smoothstep(.23,.38,uv.x))*(1.-smoothstep(.42,.61,uv.y));
    vec2 forward=vec2(cos(uHeading),sin(uHeading));
    float along=dot(transformed.xy,forward)/uSpan;
    float across=dot(transformed.xy,vec2(-forward.y,forward.x))/uSpan;
    head=mix(head,smoothstep(.23,.47,along),uTopDown);
    legs=mix(legs,smoothstep(.10,.23,abs(across))*(1.-smoothstep(.36,.5,abs(along))),uTopDown);
    tail=mix(tail,1.-smoothstep(-.48,-.30,along),uTopDown);
    transformed.y+=head*sin(uGraze*1.4+uPhase)*1.2*uSmall;
    transformed.x+=head*cos(uGraze*.95+uPhase)*.65*uSmall;
    float stride=mix(uGait+uv.x*14.,uGait+step(0.,across)*3.14159+step(0.,along)*3.14159,uTopDown);
    vec2 strideAxis=mix(vec2(1.,0.),forward,uTopDown);
    transformed.xy+=strideAxis*legs*sin(stride)*uWalk*1.9*uSmall;
    transformed.y+=legs*cos(stride)*uWalk*.7*uSmall;
    transformed.y+=tail*sin(uGraze*2.1+uPhase)*1.1*uSmall;`);
  };
  const cow=new THREE.Mesh(new THREE.PlaneGeometry(spec.size,spec.size/animalMap.userData.spriteAspect,16,12),material);
  cow.renderOrder=5;cow.position.z=5;cow.name=sheep?'grazing-sheep':'grazing-cow';
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(spec.size*(sheep?1.06:1),spec.size*(sheep?.65:.57)),new THREE.ShaderMaterial({
   transparent:true,depthTest:false,depthWrite:false,
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`varying vec2 vUv;void main(){float a=(1.-smoothstep(.2,1.,length((vUv-.5)*2.)))*.19;gl_FragColor=vec4(.15,.24,.08,a);}`
  }));
  shadow.renderOrder=3;shadow.position.z=3;
  group.add(shadow,cow);return {cow,shadow,uniforms,...spec};
 });
 const poses=herd.map(()=>({x:0,y:0,motion:null}));
 function update(t){
  waterMaterial.uniforms.uTime.value=t;
  for(let i=0;i<herd.length;i++){
   const unit=herd[i],pose=poses[i];pose.motion=animalMotion(unit,t);
   pose.x=unit.x-width/2+pose.motion.dx;pose.y=height/2-unit.y+pose.motion.dy;
  }
  // Gentle separation stops nearby animals walking through one another.
  for(let pass=0;pass<2;pass++)for(let i=0;i<herd.length;i++)for(let j=i+1;j<herd.length;j++){
   const a=poses[i],b=poses[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
   const gap=(herd[i].kind==='sheep'?6.5:10.5)+(herd[j].kind==='sheep'?6.5:10.5);
   if(d2>=gap*gap)continue;
   const d=Math.sqrt(d2),nx=d>.001?dx/d:Math.cos(i+j*2.4),ny=d>.001?dy/d:Math.sin(i+j*2.4),push=(gap-d)*.5;
   a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
  }
  for(let i=0;i<herd.length;i++){
   const unit=herd[i],pose=poses[i],motion=pose.motion,sheep=unit.kind==='sheep';
   const x=pose.x,y=pose.y;
   unit.cow.position.set(x,y,5);unit.cow.rotation.z=motion.yaw;
   unit.shadow.position.set(x+(sheep?3.2:6),y-(sheep?4.8:9),3);unit.shadow.rotation.z=motion.yaw;
   unit.uniforms.uGraze.value=t;
   unit.uniforms.uGait.value=motion.gait;unit.uniforms.uWalk.value=motion.walk;
  }
 }
 update(0);return {group,update,herd};
}
