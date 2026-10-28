import * as THREE from './vendor/three.module.js';
import {makePastureEffects} from './pasture-effects.js?v=11';
import {makeClouds} from './clouds.js?v=11';
import {ANIMALS} from './animal-layout.js?v=11';
import {makeCyclist} from './cyclist.js?v=12';
import {TERRAIN} from './road-path.js?v=12';
import {makeFrame} from './frame.js';
import {sampleFlight} from './flight-motion.js?v=10';

const W=941,H=1672,S=941,JOIN_H=TERRAIN.patchHeight,PERIOD=TERRAIN.period,SPEED=28,INITIAL_OFFSET=240;
const canvas=document.querySelector('#scene'),stage=document.querySelector('#stage'),status=document.querySelector('#status');
// This is an explicitly requested animated scene: start on load, pause with Space.
let playing=true,ready=false,time=0,last=performance.now(),frameId=0,inView=true,lastTelemetry=-1;
// Deterministic stills for inspecting joins and rendering without mutating browser state.
const still=new URLSearchParams(location.search).get('still');
if(still!==null&&Number.isFinite(Number(still))){time=THREE.MathUtils.clamp(Number(still),0,180);playing=false;}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1.5),2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene(),terrain=new THREE.Group();scene.add(terrain);
const camera=new THREE.OrthographicCamera(-S/2,S/2,S/2,-S/2,.1,3000);camera.position.z=1800;
const cloudLayer=makeClouds(THREE,{size:S});scene.add(cloudLayer.shadows,cloudLayer.clouds,cloudLayer.aircraftShadows,makeFrame(THREE));
const cyclist=makeCyclist(THREE);scene.add(cyclist.group);
cloudLayer.bake(renderer);
const tiles=[],loader=new THREE.TextureLoader();
let plane,planeShadow;
async function texture(path){const t=await loader.loadAsync(path);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
function crop(t,x,y,w,h){const a=t.clone();a.offset.set(x/t.image.width,1-(y+h)/t.image.height);a.repeat.set(w/t.image.width,h/t.image.height);a.userData.spriteAspect=w/h;a.needsUpdate=true;return a;}
function sprite(map,w,h,z,opacity=1,color=0xffffff){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,color,opacity,transparent:true,depthWrite:false,depthTest:false}));
 mesh.position.z=z;mesh.renderOrder=z;return mesh;
}
function ground(map,height,patch=false){
 const mesh=sprite(map,W,height,0);
 mesh.material.customProgramCacheKey=()=>`pasture-ground-${height}`;
 // The repaired patch includes 144 unchanged source units at each end.
 if(patch)mesh.material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
   '#include <map_fragment>\n diffuseColor.a *= smoothstep(0.,'+String(TERRAIN.fade/height)+',1.-vMapUv.y)*smoothstep(0.,'+String(TERRAIN.fade/height)+',vMapUv.y);');
 };
 return mesh;
}
async function init(){
 const [groundMap,joinMap,planeSource,cowMap,blackMap,sheepMap]=await Promise.all([
  texture('./assets/pasture-ground-v7.png'),texture('./assets/pasture-seam-v11.png'),
  texture('./assets/plane.png'),texture('./assets/pasture-cow-top-v8-1.png'),
  texture('./assets/pasture-black-cow-top-v8-1.png'),texture('./assets/pasture-sheep-v7.png')
 ]);
 const planeMap=crop(planeSource,98,126,1340,784);
 // Trim transparent padding only in UVs, keeping actual cow/sheep body sizes consistent.
 const animalMaps={brown:crop(cowMap,204,128,1088,884),black:crop(blackMap,188,140,1120,856),sheep:crop(sheepMap,432,392,544,468)};
 for(let slot=0;slot<3;slot++){
  const group=new THREE.Group();group.name='Unwarped pasture strip';
  const mapMesh=ground(groundMap,H),joinMesh=ground(joinMap,JOIN_H,true);
  mapMesh.position.y=-H/2;joinMesh.position.y=-TERRAIN.patchStart-JOIN_H/2;
  group.add(mapMesh,joinMesh);
  const details=makePastureEffects(THREE,{map:groundMap,width:W,height:H,animalMaps,animals:ANIMALS});
  const joinDetails=makePastureEffects(THREE,{map:joinMap,width:W,height:JOIN_H});
  details.group.position.y=-H/2;joinDetails.group.position.y=joinMesh.position.y;
  group.add(details.group,joinDetails.group);terrain.add(group);
  tiles.push({group,mapMesh,joinMesh,details,joinDetails});
 }
 plane=sprite(planeMap,64,37.4,24);plane.material.alphaTest=.3;scene.add(plane);
 planeMap.updateMatrix();
 cloudLayer.setAircraft(planeMap);
 planeShadow=new THREE.Mesh(new THREE.PlaneGeometry(68,40),new THREE.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,
  uniforms:{uMap:{value:planeMap},uUv:{value:planeMap.matrix}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uMap;uniform mat3 uUv;
   float mask(vec2 p){return texture2D(uMap,(uUv*vec3(p,1.)).xy).a;}
   void main(){vec2 d=vec2(.018,.030);float a=mask(vUv)*.28;
    a+=(mask(vUv+vec2(d.x,0.))+mask(vUv-vec2(d.x,0.))+mask(vUv+vec2(0.,d.y))+mask(vUv-vec2(0.,d.y)))*.12;
    a+=(mask(vUv+d)+mask(vUv-d)+mask(vUv+vec2(d.x,-d.y))+mask(vUv+vec2(-d.x,d.y)))*.06;
    gl_FragColor=vec4(.07,.13,.10,a*.32);}`
 }));planeShadow.position.z=8;planeShadow.renderOrder=8;scene.add(planeShadow);
 ready=true;stage.setAttribute('aria-busy','false');canvas.dataset.ready='true';update(0);render();syncAnimation();
}
function update(dt){
 if(!ready)return;
 const offset=INITIAL_OFFSET-time*SPEED,cycle=Math.floor(offset/PERIOD);
 for(let slot=0;slot<tiles.length;slot++){
  const tile=tiles[slot],index=cycle-1+slot;
  tile.group.position.y=S/2+offset-index*PERIOD;
  tile.mapMesh.renderOrder=.1+slot*.2;tile.joinMesh.renderOrder=1;
  tile.details.update(time);tile.joinDetails.update(time);
 }
 cyclist.update(time,dt);
 const flight=sampleFlight(time),blend=dt>0?1-Math.exp(-3.1*dt):1;
 plane.position.x=THREE.MathUtils.lerp(plane.position.x,flight.x,blend);
 plane.position.y=THREE.MathUtils.lerp(plane.position.y,-S*.11+flight.y,blend);
 plane.rotation.z=THREE.MathUtils.lerp(plane.rotation.z,flight.yaw,blend);
 plane.scale.x=1-Math.abs(plane.rotation.z)*.12;
 planeShadow.position.set(plane.position.x+65,plane.position.y-95,8);planeShadow.rotation.z=plane.rotation.z;planeShadow.scale.x=plane.scale.x;
 cloudLayer.update(time);
 cloudLayer.updateAircraft({x:plane.position.x,y:plane.position.y,yaw:plane.rotation.z,scaleX:plane.scale.x});
 if(time-lastTelemetry>.12||dt===0){
  lastTelemetry=time;
  Object.assign(canvas.dataset,{
   time:time.toFixed(3),groundDistance:(time*SPEED).toFixed(2),scene:'pasture-river',
   planeX:plane.position.x.toFixed(2),planeY:plane.position.y.toFixed(2),planeYaw:plane.rotation.z.toFixed(3),
   clouds:'procedural',playing:String(playing),carCount:'0',animatedCows:String(ANIMALS.filter(a=>a.kind==='cow').length),
   animatedSheep:String(ANIMALS.filter(a=>a.kind==='sheep').length),animatedAnimals:String(ANIMALS.length),bakedAnimals:'0',
   terrainScale:'1',terrainX:'0',terrainRotation:'0',sourceWidth:String(W),cameraWidth:String(camera.right-camera.left),renderPixelRatio:String(renderer.getPixelRatio()),
   cloudCount:String(cloudLayer.clouds.children.length),smallCloudCount:'3',cloudTime:time.toFixed(3),leftCloudY:cloudLayer.clouds.children[1].position.y.toFixed(2),
   leftShadowY:cloudLayer.shadows.children[1].position.y.toFixed(2),backgroundWarp:'none',
   leftCloudX:cloudLayer.clouds.children[1].position.x.toFixed(2),leftCloudWidth:'270',leftCloudHeight:'250',cloudMotion:'cached-texture-linear',leftCloudColour:'neutral-white',cloudTextureCached:String(cloudLayer.cached),
   planeShadowOffsetY:'95',planeShadowOpacity:'.32',cloudTextureId:cloudLayer.clouds.children[1].material.map.uuid,cowView:'top-down-back',
   centreCloudY:cloudLayer.clouds.children[5].position.y.toFixed(2),cloudSurfaceProjection:String(cloudLayer.aircraftShadows.children.length===1),
   connector:'repaired-patch-v11',period:String(PERIOD),water:'ground-colour-mask',
   cyclistCount:'1',cyclistX:cyclist.pose.x.toFixed(2),cyclistY:cyclist.pose.y.toFixed(2),cyclistWidth:String(cyclist.width),cyclistLength:String(cyclist.length),cyclistRoadWidth:cyclist.pose.roadWidth.toFixed(2),cloudEdges:'cached-grain-dither-scatter',
   cowX:tiles[1].details.herd[0].cow.position.x.toFixed(3),cowYaw:tiles[1].details.herd[0].cow.rotation.z.toFixed(3),
   sheepX:tiles[1].details.herd[18].cow.position.x.toFixed(3),sheepYaw:tiles[1].details.herd[18].cow.rotation.z.toFixed(3),
   cowLocalY:tiles[1].details.herd[0].cow.position.y.toFixed(3),sheepLocalY:tiles[1].details.herd[18].cow.position.y.toFixed(3),autoplay:'true',animalMotion:'walking-visible'
  });
 }
}
function render(){renderer.render(scene,camera);}
function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);if(ready)render();}
new ResizeObserver(resize).observe(stage);
canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();playing=!playing;canvas.dataset.playing=String(playing);syncAnimation();}});
document.addEventListener('visibilitychange',syncAnimation);
// Resume a suspended browser/page lifecycle without requiring a keyboard action.
function wakeAnimation(){if(frameId){cancelAnimationFrame(frameId);frameId=0;}syncAnimation();}
window.addEventListener('pageshow',wakeAnimation);
window.addEventListener('focus',wakeAnimation);
canvas.addEventListener('webglcontextrestored',()=>{cloudLayer.bake(renderer);if(ready)render();wakeAnimation();});
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncAnimation();},{threshold:.01}).observe(stage);
function syncAnimation(){
 const active=ready&&playing&&!document.hidden&&inView;
 if(!active&&frameId){cancelAnimationFrame(frameId);frameId=0;}
 if(active&&!frameId){last=performance.now();frameId=requestAnimationFrame(frame);}
}
function frame(now){
 frameId=0;if(!ready||!playing||document.hidden||!inView)return;
 const elapsed=Math.max(0,(now-last)/1000);last=now;time+=elapsed;
 update(Math.min(elapsed,.08));render();frameId=requestAnimationFrame(frame);
}
init().catch(error=>{status.textContent='场景加载失败，请刷新页面重试。';console.error(error);});
