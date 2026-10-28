import * as THREE from '../../vendor/three.module.js';
import {makeClouds} from '../../clouds.js?v=17';
import {makeFrame} from '../../frame.js';
import {sampleFlight} from '../../flight-motion.js';
import {TERRAIN} from './road-path.js?v=17';
import {makeRover} from './rover.js?v=17';
import {makeCloudVolume} from './cloud-volume.js?v=21';
import {makeWakeControls} from './controls.js?v=21';
const W=941,H=1672,S=941,SPEED=28,INITIAL_OFFSET=240;
const canvas=document.querySelector('#scene'),stage=document.querySelector('#stage'),status=document.querySelector('#status');
let playing=true,ready=false,time=0,last=performance.now(),frameId=0,inView=true,lastTelemetry=-1,frameSamples=0,frameWindow=0;
const still=new URLSearchParams(location.search).get('still');if(still!==null&&Number.isFinite(Number(still))){time=THREE.MathUtils.clamp(Number(still),0,180);playing=false;}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1.5),2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene(),terrain=new THREE.Group();scene.add(terrain);
const camera=new THREE.OrthographicCamera(-S/2,S/2,S/2,-S/2,.1,3000);camera.position.z=1800;
const cloudLayer=makeClouds(THREE,{size:S});scene.add(cloudLayer.shadows,cloudLayer.clouds,cloudLayer.aircraftShadows,makeFrame(THREE));cloudLayer.bake(renderer);
// Replace just the central flat cloud in this experiment; the other works keep
// their existing cloud renderer and the edge clouds keep framing this scene.
cloudLayer.clouds.children.forEach((mesh,index)=>{if(mesh.userData.underPlane){mesh.visible=false;cloudLayer.shadows.children[index].visible=false;}});
cloudLayer.aircraftShadows.visible=false;
const originalCentralCloud=cloudLayer.clouds.children.find(mesh=>mesh.userData.underPlane);
const cloudVolume=makeCloudVolume(THREE,{cloudMap:originalCentralCloud.material.map});scene.add(cloudVolume.group);
const controls=makeWakeControls({onChange(params){cloudVolume.setParams(params);if(ready){update(0);render();}},onPause:togglePlaying,onReplay(){time=0;playing=true;cloudVolume.reset();update(0);render();controls.setPlaying(true);syncAnimation();}});cloudVolume.setParams(controls.params);controls.setPlaying(playing);
const rover=makeRover(THREE);scene.add(rover.group);
const tiles=[],loader=new THREE.TextureLoader();let plane,planeShadow;
async function texture(path){const t=await loader.loadAsync(path);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
function sprite(map,w,h,z){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,depthTest:false}));mesh.position.z=z;mesh.renderOrder=z;return mesh;}
function ground(map,height,patch=false){const mesh=sprite(map,W,height,0);if(patch){mesh.material.customProgramCacheKey=()=>`wild-patch-${height}`;mesh.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.a *= smoothstep(0.,'+String(64/height)+',1.-vMapUv.y)*smoothstep(0.,'+String(64/height)+',vMapUv.y);');};}return mesh;}
async function init(){
 const [groundMap,patchMap,planeSource]=await Promise.all([texture('./assets/wilderness-ground-v17.png'),texture('./assets/wilderness-seam-v17.png'),texture('./assets/plane.png')]);
 const planeMap=planeSource.clone();planeMap.offset.set(98/planeSource.image.width,1-(126+784)/planeSource.image.height);planeMap.repeat.set(1340/planeSource.image.width,784/planeSource.image.height);planeMap.needsUpdate=true;
 for(let slot=0;slot<3;slot++){const group=new THREE.Group(),mapMesh=ground(groundMap,H),patchMesh=ground(patchMap,TERRAIN.patchHeight,true);mapMesh.position.y=-H/2;patchMesh.position.y=-TERRAIN.patchStart-TERRAIN.patchHeight/2;group.add(mapMesh,patchMesh);terrain.add(group);tiles.push({group,mapMesh,patchMesh});}
 plane=sprite(planeMap,64,37.4,24);plane.material.alphaTest=.3;scene.add(plane);planeMap.updateMatrix();cloudLayer.setAircraft(planeMap);
 cloudVolume.setAircraft(planeMap);
 planeShadow=new THREE.Mesh(new THREE.PlaneGeometry(68,40),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{uMap:{value:planeMap},uUv:{value:planeMap.matrix},uCloudFade:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uMap;uniform mat3 uUv;uniform float uCloudFade;float mask(vec2 p){return texture2D(uMap,(uUv*vec3(p,1.)).xy).a;}void main(){vec2 d=vec2(.018,.03);float a=mask(vUv)*.28;a+=(mask(vUv+vec2(d.x,0.))+mask(vUv-vec2(d.x,0.))+mask(vUv+vec2(0.,d.y))+mask(vUv-vec2(0.,d.y)))*.12;a+=(mask(vUv+d)+mask(vUv-d)+mask(vUv+vec2(d.x,-d.y))+mask(vUv+vec2(-d.x,d.y)))*.06;gl_FragColor=vec4(.13,.055,.025,a*.32*uCloudFade);}`
 }));planeShadow.position.z=8;planeShadow.renderOrder=8;scene.add(planeShadow);
 ready=true;
 if(still!==null&&time>0){const target=time;time=0;update(0);cloudVolume.advance(renderer);while(time<target-1e-5){const dt=Math.min(1/45,target-time);time+=dt;update(dt);cloudVolume.advance(renderer);}}
 stage.setAttribute('aria-busy','false');canvas.dataset.ready='true';update(0);render();syncAnimation();
}
function update(dt){
 if(!ready)return;const offset=INITIAL_OFFSET-time*SPEED,cycle=Math.floor(offset/TERRAIN.period);
 tiles.forEach((tile,slot)=>{tile.group.position.y=S/2+offset-(cycle-1+slot)*TERRAIN.period;tile.mapMesh.renderOrder=.1+slot*.2;tile.patchMesh.renderOrder=1;});
 rover.update(time,dt);const flight=sampleFlight(time),blend=dt>0?1-Math.exp(-3.1*dt):1;
 plane.position.x=THREE.MathUtils.lerp(plane.position.x,flight.x,blend);plane.position.y=THREE.MathUtils.lerp(plane.position.y,-S*.11+flight.y,blend);plane.rotation.z=THREE.MathUtils.lerp(plane.rotation.z,flight.yaw,blend);plane.scale.x=1-Math.abs(plane.rotation.z)*.12;
 planeShadow.position.set(plane.position.x+65,plane.position.y-95,8);planeShadow.rotation.z=plane.rotation.z;planeShadow.scale.x=plane.scale.x;
 cloudLayer.update(time);cloudLayer.updateAircraft({x:plane.position.x,y:plane.position.y,yaw:plane.rotation.z,scaleX:plane.scale.x});
 cloudVolume.update(time);
 cloudVolume.updateAircraft(plane.position.x,plane.position.y,plane.rotation.z,plane.scale.x);
 const transmittance=cloudVolume.transmittanceAt(plane.position.x,plane.position.y);
 planeShadow.material.uniforms.uCloudFade.value=.15+.85*transmittance;
 if(time-lastTelemetry>.12||dt===0){Object.assign(canvas.dataset,{cloudWake:'persistent-gpu-density-velocity',wakeLifeSeconds:String(cloudVolume.state.wakeLifetime),flowSteps:String(cloudVolume.state.flow.steps),flowPrecision:cloudVolume.state.flow.precision,flowLayers:'12',flowResets:String(cloudVolume.state.flow.resets),flowDebug:controls.params.debug,cloudSurfaceShadow:'live-density-clipped',cloudShadowVisibility:cloudVolume.state.shadowVisibility.toFixed(3)});}
 if(time-lastTelemetry>.12||dt===0){const cos=Math.cos(plane.rotation.z),sin=Math.sin(plane.rotation.z);Object.assign(canvas.dataset,{cloudMode:'split-raymarched-volume',cloudPhase:cloudVolume.state.phase.toFixed(3),cloudCenterY:cloudVolume.state.centerY.toFixed(2),planeTransmittance:transmittance.toFixed(4),leftWingTransmittance:cloudVolume.transmittanceAt(plane.position.x-26*cos,plane.position.y-26*sin).toFixed(4),rightWingTransmittance:cloudVolume.transmittanceAt(plane.position.x+26*cos,plane.position.y+26*sin).toFixed(4),volumeBuffer:String(cloudVolume.state.bufferSize),volumeNoise:'fixed-seed-continuous-advection',volumePasses:'back-aircraft-front',volumeShadow:'density-projected'});}
 if(time-lastTelemetry>.12||dt===0){lastTelemetry=time;Object.assign(canvas.dataset,{scene:'red-earth-wilderness',time:time.toFixed(3),playing:String(playing),carCount:'1',carX:rover.pose.x.toFixed(2),carY:rover.pose.y.toFixed(2),carYaw:rover.pose.yaw.toFixed(3),carWidth:String(rover.width),roadWidth:rover.pose.roadWidth.toFixed(2),dryCreek:'true',waterEffects:'none',animatedAnimals:'0',cloudTextureCached:String(cloudLayer.cached),cloudTextureId:cloudLayer.clouds.children[1].material.map.uuid,cloudCount:'6',cloudMotion:'cached-texture-linear',cloudSurfaceProjection:'true',sourceWidth:'941',cameraWidth:'941',terrainScale:'1',backgroundWarp:'none',renderPixelRatio:String(renderer.getPixelRatio())});}
}
const inspectFlow=new URLSearchParams(location.search).has('inspect');let lastProbe=-1;
function render(){const start=performance.now();cloudVolume.render(renderer,camera);renderer.render(scene,camera);canvas.dataset.renderSubmitMs=(performance.now()-start).toFixed(2);canvas.dataset.flowSteps=String(cloudVolume.state.flow.steps);if(inspectFlow&&(time-lastProbe>=.5||!playing)){lastProbe=time;canvas.dataset.flowProbe=JSON.stringify(cloudVolume.simulation.inspect(renderer));}}
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);cloudVolume.resize(width,height,renderer.getPixelRatio());if(ready)render();}).observe(stage);
function togglePlaying(){playing=!playing;canvas.dataset.playing=String(playing);controls.setPlaying(playing);syncAnimation();}
canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePlaying();}});
document.addEventListener('visibilitychange',syncAnimation);function wake(){if(frameId){cancelAnimationFrame(frameId);frameId=0;}syncAnimation();}window.addEventListener('pageshow',wake);window.addEventListener('focus',wake);
canvas.addEventListener('webglcontextrestored',()=>{cloudLayer.bake(renderer);cloudVolume.setCloudShape(originalCentralCloud.material.map);cloudVolume.restore();if(ready)render();wake();});new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncAnimation();},{threshold:.01}).observe(stage);
function syncAnimation(){const active=ready&&playing&&!document.hidden&&inView;if(!active&&frameId){cancelAnimationFrame(frameId);frameId=0;}if(active&&!frameId){last=performance.now();frameWindow=last;frameSamples=0;frameId=requestAnimationFrame(frame);}}
function frame(now){frameId=0;if(!ready||!playing||document.hidden||!inView)return;const elapsed=Math.min(.1,Math.max(0,(now-last)/1000))*controls.params.speed;last=now;time+=elapsed;update(Math.min(elapsed,.08));render();frameSamples++;if(now-frameWindow>=1500){canvas.dataset.frameRate=(frameSamples*1000/(now-frameWindow)).toFixed(1);frameWindow=now;frameSamples=0;}frameId=requestAnimationFrame(frame);}
init().catch(error=>{status.textContent='荒野场景加载失败，请刷新后重试。';console.error(error);});
