import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {sampleFlight} from '../dist/flight-motion.js';
import {makeCloudVolume,sampleCloudPass} from '../dist/works/wilderness/cloud-volume.js';
import {sampleWakeField,WAKE_LIFETIME,WAKE_SAMPLE_COUNT} from '../dist/works/wilderness/cloud-wake.js';

const cloud=makeCloudVolume(THREE);
function flightAt(time){const pose=sampleFlight(time);return {x:pose.x,y:-941*.11+pose.y,yaw:pose.yaw};}
function update(time){const pose=flightAt(time);cloud.update(time);cloud.updateAircraft(pose.x,pose.y,pose.yaw,1);return pose;}
const aircraft=update(7),base=cloud.transmittanceAt(aircraft.x,aircraft.y,false),opened=cloud.transmittanceAt(aircraft.x,aircraft.y);
assert.ok(base<.1&&opened>.35&&opened<.85,'Local airflow must open cloud softly while retaining translucent mist');
assert.equal(cloud.state.wakeSamples.length,WAKE_SAMPLE_COUNT);
assert.equal(cloud.state.wakeSamples.at(-1).strength,0,'Oldest wake must have fully closed');
assert.ok(cloud.state.wakeSamples.some(s=>s.age>1&&s.y<aircraft.y-30&&s.strength>.3),'Airflow must remain behind the plane');
const middle=cloud.state.wakeSamples[6],offset=23+middle.age*3.5;
const rim=cloud.wakeAtPoint(middle.x+Math.cos(middle.yaw)*offset,middle.y+Math.sin(middle.yaw)*offset);
assert.ok(rim.rim>.25,'Wingtip flow must retain soft rolling mist');
assert.ok(Math.hypot(rim.dx,rim.dy)>.01,'Cloud texture must be advected by the wingtip flow');
const isolated=[{x:0,y:0,width:24,strength:1,yaw:0,age:1,time:7}];
const leftFlow=sampleWakeField(isolated,-26.5,10),rightFlow=sampleWakeField(isolated,26.5,10);
assert.ok(leftFlow.dx*rightFlow.dx<0,'The two wingtip vortices must rotate in opposite directions');
const fixed=JSON.stringify(cloud.state.wakeSamples);update(7);assert.equal(JSON.stringify(cloud.state.wakeSamples),fixed,'Wake must be deterministic when paused or restored');
update(6);const deposited={...cloud.state.wakeSamples[0]},origin=sampleCloudPass(6);
update(7.5);let current=sampleCloudPass(7.5);const early=cloud.wakeAtPoint(deposited.x+current.x-origin.x,deposited.y+current.y-origin.y).cut;
assert.ok(early<.2,'The long wake must refill instead of keeping a clear trench');
const advectedRim=cloud.wakeAtPoint(deposited.x+current.x-origin.x+Math.cos(deposited.yaw)*28,deposited.y+current.y-origin.y+Math.sin(deposited.yaw)*28);
assert.ok(advectedRim.rim>.15,'The rolling mist must continue travelling with the cloud');
update(11.2);current=sampleCloudPass(11.2);const healed=cloud.wakeAtPoint(deposited.x+current.x-origin.x,deposited.y+current.y-origin.y).cut;
assert.ok(healed<.08,'Cleared cloud must close after the finite wake lifetime');
let previousFlow,maxFlowStep=0;
for(let time=7;time<9;time+=1/60){const p=update(time),flow=cloud.wakeAtPoint(p.x+28,p.y-45);if(previousFlow)maxFlowStep=Math.max(maxFlowStep,Math.abs(flow.rim-previousFlow.rim),Math.hypot(flow.dx-previousFlow.dx,flow.dy-previousFlow.dy));previousFlow=flow;}
assert.ok(maxFlowStep<.15,'Vortex advection must remain continuous without frame-random jumps');
update(16);assert.ok(cloud.state.wakeSamples.every(s=>s.strength===0),'Plane in clear air must not carve the ground');
update(10.5);assert.ok(cloud.state.shadowVisibility>.99,'Cloud-surface shadow must remain visible when aircraft is above the cloud edge');
assert.ok(cloud.passes.surfaceShadow.renderOrder>cloud.passes.front.renderOrder&&cloud.passes.surfaceShadow.renderOrder<30,'Surface shadow must be composed on top of the central cloud');
cloud.dispose();
console.log(JSON.stringify({baseTransmittance:base,openedTransmittance:opened,refilledCore:early,advectedMist:advectedRim.rim,healedWake:healed,lifetime:WAKE_LIFETIME,historySamples:WAKE_SAMPLE_COUNT,cloudSurfaceShadow:true,deterministic:true}));
