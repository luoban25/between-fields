import * as THREE from '../../vendor/three.module.js';
import {makeClouds} from '../../clouds.js?v=17';
import {makeFrame} from '../../frame.js';
import {sampleFlight} from '../../flight-motion.js';
import {makeCloudVolume} from '../wilderness/cloud-volume.js?v=23';
import {makeWakeControls} from '../wilderness/controls.js?v=21';
import {makeSea} from './sea.js?v=23';
const W=941,S=941;let H=1672;
const canvas=document.querySelector('#scene'),stage=document.querySelector('#stage'),status=document.querySelector('#status');
let playing=true,ready=false,time=0,last=performance.now(),frameId=0,inView=true,lastTelemetry=-1,sea,plane,planeShadow;
const still=new URLSearchParams(location.search).get('still');
if(still!==null&&Number.isFinite(Number(still))){time=THREE.MathUtils.clamp(Number(still),0,180);playing=false;}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1.5),2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-S/2,S/2,S/2,-S/2,.1,3000);camera.position.z=1800;
const clouds=makeClouds(THREE,{size:S});scene.add(clouds.shadows,clouds.clouds,clouds.aircraftShadows,makeFrame(THREE));clouds.bake(renderer);
clouds.clouds.children.forEach((mesh,index)=>{if(mesh.userData.underPlane){mesh.visible=false;clouds.shadows.children[index].visible=false;}});clouds.aircraftShadows.visible=false;
const central=clouds.clouds.children.find(mesh=>mesh.userData.underPlane);
const volume=makeCloudVolume(THREE,{cloudMap:central.material.map,groundShadowColor:[.035,.15,.18]});scene.add(volume.group);
const controls=makeWakeControls({onChange(params){volume.setParams(params);if(ready){update(0);render();}},onPause:togglePlaying,onReplay(){time=0;playing=true;volume.reset();if(ready){update(0);render();}controls.setPlaying(true);syncAnimation();}});
volume.setParams(controls.params);controls.setPlaying(playing);
const loader=new THREE.TextureLoader();
async function texture(path){const t=await loader.loadAsync(path);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
async function init(){
 const [map,source]=await Promise.all([texture('./assets/islands-ground-v23.png'),texture('./assets/plane.png')]);
 H=W*map.image.height/map.image.width;sea=makeSea(THREE,{map,width:W,height:H});scene.add(sea.mesh);
 const planeMap=source.clone();planeMap.offset.set(98/source.image.width,1-(126+784)/source.image.height);planeMap.repeat.set(1340/source.image.width,784/source.image.height);planeMap.needsUpdate=true;planeMap.updateMatrix();
 plane=new THREE.Mesh(new THREE.PlaneGeometry(64,37.4),new THREE.MeshBasicMaterial({map:planeMap,transparent:true,alphaTest:.3,depthTest:false,depthWrite:false}));plane.position.z=24;plane.renderOrder=24;scene.add(plane);volume.setAircraft(planeMap);
 planeShadow=new THREE.Mesh(new THREE.PlaneGeometry(68,40),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{uMap:{value:planeMap},uUv:{value:planeMap.matrix},uCloudFade:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uMap;uniform mat3 uUv;uniform float uCloudFade;float mask(vec2 p){return texture2D(uMap,(uUv*vec3(p,1.)).xy).a;}void main(){vec2 d=vec2(.018,.03);float a=mask(vUv)*.28;a+=(mask(vUv+vec2(d.x,0.))+mask(vUv-vec2(d.x,0.))+mask(vUv+vec2(0.,d.y))+mask(vUv-vec2(0.,d.y)))*.12;a+=(mask(vUv+d)+mask(vUv-d)+mask(vUv+vec2(d.x,-d.y))+mask(vUv+vec2(-d.x,d.y)))*.06;gl_FragColor=vec4(.025,.105,.12,a*.32*uCloudFade);}`}));planeShadow.position.z=8;planeShadow.renderOrder=8;scene.add(planeShadow);
 ready=true;
 if(still!==null&&time>0){const target=time;time=0;update(0);volume.advance(renderer);while(time<target-1e-5){const dt=Math.min(1/45,target-time);time+=dt;update(dt);volume.advance(renderer);}}
 stage.setAttribute('aria-busy','false');canvas.dataset.ready='true';canvas.dataset.assetSize=map.image.width+'x'+map.image.height;update(0);render();syncAnimation();
}
function update(dt){
 if(!ready)return;
 // Smoothly explore the original plate with no texture splice or mirroring.
 const scroll=(H-S)*(.5-.5*Math.cos(time*Math.PI*2/108+.2));sea.mesh.position.y=(S-H)/2+scroll;sea.update(time);
 const f=sampleFlight(time),blend=dt>0?1-Math.exp(-3.1*dt):1;
 plane.position.x=THREE.MathUtils.lerp(plane.position.x,f.x,blend);plane.position.y=THREE.MathUtils.lerp(plane.position.y,-S*.11+f.y,blend);plane.rotation.z=THREE.MathUtils.lerp(plane.rotation.z,f.yaw,blend);plane.scale.x=1-Math.abs(plane.rotation.z)*.12;
 planeShadow.position.set(plane.position.x+65,plane.position.y-95,8);planeShadow.rotation.z=plane.rotation.z;planeShadow.scale.x=plane.scale.x;
 clouds.update(time);volume.update(time);volume.updateAircraft(plane.position.x,plane.position.y,plane.rotation.z,plane.scale.x);planeShadow.material.uniforms.uCloudFade.value=.15+.85*volume.transmittanceAt(plane.position.x,plane.position.y);
 if(time-lastTelemetry>.12||dt===0){lastTelemetry=time;Object.assign(canvas.dataset,{scene:'turquoise-islands',time:time.toFixed(3),playing:String(playing),cloudWake:'persistent-gpu-density-velocity',cloudMode:'split-raymarched-volume',cloudSurfaceShadow:'live-density-clipped',flowLayers:'12',flowSteps:String(volume.state.flow.steps),flowPrecision:volume.state.flow.precision,flowDebug:controls.params.debug,wakeLifeSeconds:String(volume.state.wakeLifetime),water:'water-only-caustics-glints-shore-wash',backgroundWarp:'none',terrainScale:'1',terrainRotation:'0',terrainX:'0',terrainY:sea.mesh.position.y.toFixed(3),sourceWidth:String(W),cameraWidth:String(S),carCount:'0',boatCount:'0',cloudCount:'6',bakedClouds:'0',bakedCloudShadows:'0',terrainLoop:'smooth-reversible-pan'});}
}
const inspectFlow=new URLSearchParams(location.search).has('inspect');let lastProbe=-1;
function render(){volume.render(renderer,camera);renderer.render(scene,camera);canvas.dataset.flowSteps=String(volume.state.flow.steps);if(inspectFlow&&(time-lastProbe>=.5||!playing)){lastProbe=time;canvas.dataset.flowProbe=JSON.stringify(volume.simulation.inspect(renderer));}}
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);volume.resize(width,height,renderer.getPixelRatio());if(ready)render();}).observe(stage);
function togglePlaying(){playing=!playing;canvas.dataset.playing=String(playing);controls.setPlaying(playing);syncAnimation();}
canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePlaying();}});
document.addEventListener('visibilitychange',syncAnimation);
function wake(){if(frameId){cancelAnimationFrame(frameId);frameId=0;}syncAnimation();}window.addEventListener('pageshow',wake);window.addEventListener('focus',wake);
canvas.addEventListener('webglcontextrestored',()=>{clouds.bake(renderer);volume.setCloudShape(central.material.map);volume.restore();if(ready)render();wake();});
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncAnimation();},{threshold:.01}).observe(stage);
function syncAnimation(){const active=ready&&playing&&!document.hidden&&inView;if(!active&&frameId){cancelAnimationFrame(frameId);frameId=0;}if(active&&!frameId){last=performance.now();frameId=requestAnimationFrame(frame);}}
function frame(now){frameId=0;if(!ready||!playing||document.hidden||!inView)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000))*controls.params.speed;last=now;time+=dt;update(Math.min(dt,.08));render();frameId=requestAnimationFrame(frame);}
init().catch(error=>{status.textContent='海岛场景加载失败，请刷新重试。';console.error(error);});
