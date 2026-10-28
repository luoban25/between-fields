import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {makeClouds} from '../dist/clouds.js';
import {ANIMALS,animalMotion} from '../dist/animal-layout.js';
import {makePastureEffects} from '../dist/pasture-effects.js';
import {sampleFlight} from '../dist/flight-motion.js';
import {roadAt,sampleCyclist,TERRAIN} from '../dist/road-path.js';
import {makeCyclist} from '../dist/cyclist.js';
import {MAIN_RIVER,PATCH_RIVER} from '../dist/river-data.js';
import {makeRiverGeometry,sampleRiver} from '../dist/river-geometry.js';

const counts={cows:ANIMALS.filter(a=>a.kind==='cow').length,sheep:ANIMALS.filter(a=>a.kind==='sheep').length};
assert.equal(counts.cows,7);assert.equal(counts.sheep,5);
const trajectories=new Set();
for(const animal of ANIMALS){
 const start=animalMotion(animal,0),end=animalMotion(animal,12);
 assert.ok(Math.hypot(start.dx-end.dx,start.dy-end.dy)>.1,'Each animal must move independently');
 trajectories.add([end.dx,end.dy,end.yaw].map(v=>v.toFixed(5)).join(','));
 for(let t=0;t<240;t+=.25){
  const motion=animalMotion(animal,t);
  assert.ok(Object.values(motion).every(Number.isFinite));
  const next=animalMotion(animal,t+2),minimum=animal.kind==='cow'?8:6.5;
  assert.ok(Math.hypot(next.dx-motion.dx,next.dy-motion.dy)>=minimum,'Walking must be visible within two seconds');
  assert.ok(Math.abs(motion.dx)<=44.001&&Math.abs(motion.dy)<=30.801,'Animals must stay near their original grazing patch');
  const heading=motion.yaw+animal.headAngle;
  assert.ok(Math.cos(heading)*motion.vx+Math.sin(heading)*motion.vy>0,'Animals must face their travel direction');
 }
}
assert.equal(trajectories.size,ANIMALS.length,'Animals must not share one synchronized motion');

// Check actual scene meshes after separation, rather than only the path sampler.
const map=new THREE.Texture();map.userData.spriteAspect=1.3;
const effects=makePastureEffects(THREE,{map,width:941,height:1672,animalMaps:{brown:map,black:map,sheep:map},animals:ANIMALS});
effects.update(0);
const startMeshes=effects.herd.map(a=>a.cow.position.clone());
effects.update(2);
const meshDistances=effects.herd.map((a,i)=>a.cow.position.distanceTo(startMeshes[i]));
assert.ok(meshDistances.every(d=>d>1),'Every rendered animal must move after two seconds');
const minimumMeshTravel=Math.min(...meshDistances);

const layer=makeClouds(THREE);
const clouds=layer.clouds.children,shadows=layer.shadows.children;
assert.equal(clouds.length,6);assert.equal(shadows.length,6);
layer.setAircraft(map);assert.equal(layer.aircraftShadows.children.length,1);
const centre=clouds.find(c=>c.userData.underPlane),projection=layer.aircraftShadows.children[0];
assert.ok(centre.geometry.parameters.width>270&&centre.renderOrder<24);
assert.ok(projection.renderOrder>centre.renderOrder&&projection.renderOrder<24);
layer.updateAircraft({x:10,y:-100,yaw:.3,scaleX:.95});
assert.equal(projection.material.uniforms.uPlaneCentre.value.x,32);
assert.equal(projection.material.uniforms.uPlaneCentre.value.y,-132);
assert.equal(projection.material.uniforms.uYaw.value,.3);
assert.ok(clouds[1].geometry.parameters.width>190&&clouds[1].geometry.parameters.height>180);
const origins=clouds.map(cloud=>({x:cloud.position.x,y:cloud.position.y,vertices:[...cloud.geometry.attributes.position.array]}));
for(let frame=0;frame<=720;frame++){
 const t=frame/60;layer.update(t);
 for(let i=0;i<clouds.length;i++){
  assert.equal(clouds[i].position.x,origins[i].x,'Clouds must not sway horizontally');
  const unwrapped=origins[i].y-t*clouds[i].userData.driftSpeed;
  const span=clouds[i].userData.wrapSpan;
  const expected=((unwrapped+span/2)%span+span)%span-span/2;
  assert.ok(Math.abs(clouds[i].position.y-expected)<1e-8,'Cloud movement must be linear with offscreen wrapping');
  assert.ok(Math.abs(shadows[i].position.y-clouds[i].position.y+66)<1e-8);
  assert.ok(Math.abs(shadows[i].position.x-clouds[i].position.x-42)<1e-8);
 }
 assert.equal(projection.position.x,centre.position.x);assert.equal(projection.position.y,centre.position.y);
}
clouds.forEach((cloud,i)=>{
 assert.deepEqual([...cloud.geometry.attributes.position.array],origins[i].vertices);
 assert.deepEqual(Object.keys(cloud.material.uniforms),['uSeed','uGrainScale'],'Cloud grain must have no animated uniform');
});
const bike=makeCyclist(THREE);
bike.rider.traverse(mesh=>{
 if(!mesh.isMesh)return;
 assert.equal(mesh.material.transparent,true,'Bicycle must share the ground transparent pass to remain visible');
 assert.ok(mesh.renderOrder>1&&mesh.renderOrder<7,'Bicycle must draw above ground and below cloud shadows');
});
for(let t=0;t<240;t+=.1){
 bike.update(t,.1);const p=bike.pose;
 assert.ok(Object.values(p).every(Number.isFinite));
 assert.ok(bike.width<p.roadWidth*.85,'Bicycle must fit even the narrow lit core of the road under tree shadows');
 assert.ok(Math.abs(p.y)<=55,'Cyclist must stay in the middle of the visible frame');
 assert.ok(Math.abs(p.x+TERRAIN.width/2-roadAt(p.virtualY).x)<1e-8,'Rider must follow the actual road');
}
for(const join of [0,80,144,1528,1592,TERRAIN.period]){
 assert.ok(Math.abs(roadAt(join-.001).x-roadAt(join+.001).x)<.02,'Road must be continuous at all patch transitions');
}
assert.notDeepEqual(sampleCyclist(0),sampleCyclist(2));
for(const [path,height] of [[MAIN_RIVER,1672],[PATCH_RIVER,704]]){
 const geometry=makeRiverGeometry(THREE,941,height,path),positions=geometry.attributes.position.array,uv=geometry.attributes.uv.array;
 assert.ok([...positions].every(Number.isFinite));
 for(let i=0;i<positions.length/3;i++){
  assert.ok(positions[i*3]+470.5>450,'River mesh must not cover the blue fields on the left');
  assert.ok(Math.abs(uv[i*2]-(positions[i*3]+470.5)/941)<1e-6,'Water must sample the original image coordinates');
 }
 geometry.dispose();
}
for(const [x,y] of [[100,800],[850,750],[400,1200]]){
 const river=sampleRiver(MAIN_RIVER,y);
 assert.ok(Math.abs(x-river.x)>river.halfWidth,'Blue farmland must remain outside the animated water corridor');
}
let previous=sampleFlight(0),minY=0,maxY=0,minX=0,maxX=0;
for(let frame=1;frame<=120*60;frame++){
 const pose=sampleFlight(frame/60);
 assert.ok(Object.values(pose).every(Number.isFinite));
 assert.ok(Math.abs(pose.x)<=136&&Math.abs(pose.y)<=48&&Math.abs(pose.yaw)<=.7);
 assert.ok(Math.hypot(pose.x-previous.x,pose.y-previous.y)<3,'Flight path must remain smooth');
 minY=Math.min(minY,pose.y);maxY=Math.max(maxY,pose.y);minX=Math.min(minX,pose.x);maxX=Math.max(maxX,pose.x);previous=pose;
}
assert.ok(maxY-minY>25&&maxX-minX>70,'Flight must wander vertically and horizontally');
console.log(JSON.stringify({...counts,allMoving:ANIMALS.length,uniqueTrajectories:trajectories.size,minimumMeshTravelIn2s:minimumMeshTravel,clouds:'static shape / constant x / linear y / synced shadows'}));
