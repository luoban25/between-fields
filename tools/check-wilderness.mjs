import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {makeRover} from '../dist/works/wilderness/rover.js';
import {roadAt,TERRAIN} from '../dist/works/wilderness/road-path.js';
const rover=makeRover(THREE);let minimumRoad=Infinity,maximumRoad=0;
rover.body.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.material.transparent,true,'Vehicle must remain in the ground transparent pass');assert.ok(mesh.renderOrder>1&&mesh.renderOrder<7);}});
for(let time=0;time<240;time+=.1){rover.update(time,.1);const pose=rover.pose;assert.ok(Object.values(pose).every(Number.isFinite));assert.ok(Math.abs(pose.x+470.5-roadAt(pose.virtualY).x)<1e-8,'Vehicle must follow the actual dirt road');assert.ok(pose.y>=95&&pose.y<=165,'Vehicle remains visible near the original reference position');minimumRoad=Math.min(minimumRoad,pose.roadWidth);maximumRoad=Math.max(maximumRoad,pose.roadWidth);}
for(const y of [0,80,144,1528,1592,TERRAIN.period])assert.ok(Math.abs(roadAt(y-.001).x-roadAt(y+.001).x)<.03,'Road must remain continuous through the loop');
rover.update(0);const start=rover.body.position.clone();rover.update(2);assert.ok(rover.body.position.distanceTo(start)>4,'Vehicle motion must be perceptible');
console.log(JSON.stringify({vehicleCount:1,vehicleWidth:rover.width,minimumMeasuredRoadCore:minimumRoad,maximumMeasuredRoadCore:maximumRoad,route:'continuous',rendering:'above-ground-below-cloud-shadows',dryCreek:'no water pass'}));
