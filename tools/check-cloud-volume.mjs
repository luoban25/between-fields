import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {makeCloudVolume,sampleCloudPass,VOLUME_SETTINGS} from '../dist/works/wilderness/cloud-volume.js';
import {sampleFlight} from '../dist/flight-motion.js';
const cloud=makeCloudVolume(THREE),mapId=cloud.passes.front.material.uniforms.uNoise.value.uuid;
let minimum=1,maximum=0,maxWingDifference=0,largestFrameChange=0,previous;
for(let time=0;time<=60;time+=1/60){
 cloud.update(time);const pose=sampleFlight(time),y=-941*.11+pose.y;
 const t=cloud.transmittanceAt(pose.x,y);
 const left=cloud.transmittanceAt(pose.x-26*Math.cos(pose.yaw),y-26*Math.sin(pose.yaw));
 const right=cloud.transmittanceAt(pose.x+26*Math.cos(pose.yaw),y+26*Math.sin(pose.yaw));
 assert.ok(Number.isFinite(t)&&t>=0&&t<=1);
 minimum=Math.min(minimum,t);maximum=Math.max(maximum,t);maxWingDifference=Math.max(maxWingDifference,Math.abs(left-right));
 if(previous!==undefined)largestFrameChange=Math.max(largestFrameChange,Math.abs(t-previous));previous=t;
}
assert.ok(minimum<.12,'Aircraft must pass inside dense cloud');
assert.ok(maximum>.99,'Aircraft must emerge into clear air');
assert.ok(maxWingDifference>.15,'Wings must be occluded individually, not whole-sprite fading');
assert.ok(largestFrameChange<.08,'Cloud transmittance must vary continuously');
assert.equal(cloud.passes.front.material.uniforms.uNoise.value.uuid,mapId,'Motion must not rebuild/randomize the density texture');
assert.ok(cloud.passes.back.renderOrder<24&&cloud.passes.front.renderOrder>24);
for(const mesh of Object.values(cloud.passes))assert.equal(mesh.material.depthWrite,false);
cloud.update(6.5);const fixed=cloud.transmittanceAt(20,-100);cloud.update(6.5);assert.equal(cloud.transmittanceAt(20,-100),fixed);
const firstReset=VOLUME_SETTINGS.period-362/VOLUME_SETTINGS.speed;
assert.ok(sampleCloudPass(firstReset-.001).y<-900&&sampleCloudPass(firstReset+.001).y>640,'Cloud resets only beyond view');
cloud.resize(460,460,2);assert.equal(cloud.state.bufferSize,506);cloud.resize(900,900,2);assert.equal(cloud.state.bufferSize,512);
cloud.dispose();
console.log(JSON.stringify({minimumTransmittance:minimum,maximumTransmittance:maximum,maxWingDifference,largestFrameChange,fixedNoise:true,splitAtAltitude:24,maxVolumeBuffer:512,background:'unwarped',otherWorks:'unchanged'}));
