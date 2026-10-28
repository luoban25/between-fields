import {sampleCyclist} from './road-path.js?v=13';
/** A small readable bicycle, sized to the road and the reference's tiny cows. */
export function makeCyclist(THREE){
 const group=new THREE.Group(),rider=new THREE.Group();group.name='One road cyclist';group.add(rider);
 const scale=1.25;rider.scale.setScalar(scale);
 const axis=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
 const materials=new Map();
 // Ground sprites are in Three's transparent pass. The bicycle must share that
 // pass so its renderOrder is respected instead of being covered by the ground.
 function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false}));return materials.get(color);}
 function mesh(geometry,color,x,y,z){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.renderOrder=5+z*.01;rider.add(m);return m;}
 function bar(a,b,r,color){const m=mesh(new THREE.CylinderGeometry(r,r,1,6),color,0,0,0);setBar(m,a,b);return m;}
 function setBar(m,a,b){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b);delta.subVectors(vb,va);m.position.copy(va).add(vb).multiplyScalar(.5);m.scale.y=delta.length();m.quaternion.setFromUnitVectors(axis,delta.normalize());m.renderOrder=5+m.position.z*.01;}
 for(const y of [-6,6]){const wheel=mesh(new THREE.TorusGeometry(3,.46,5,16),0x142022,0,y,.55);wheel.rotation.y=Math.PI/2;}
 const rear=[0,-6,.7],front=[0,6,.7],crank=[0,-1.3,1.3],seat=[0,-2.1,3],stem=[0,4.6,3.1];
 for(const [a,b] of [[rear,crank],[rear,seat],[seat,crank],[seat,stem],[crank,stem],[stem,front]])bar(a,b,.30,0xdf6b24);
 bar([0,-2.5,3.15],[0,-1.5,3.15],.46,0x283332);
 bar([-2.65,4.55,3.2],[2.65,4.55,3.2],.22,0x354242);
 const torso=mesh(new THREE.SphereGeometry(1,8,6),0x0876c9,0,1.1,4);torso.scale.set(1.3,2,1);
 const helmet=mesh(new THREE.SphereGeometry(1,8,6),0xf8f2dc,0,3.15,4.7);helmet.scale.set(.95,1.25,.7);
 bar([0,2.8,5.38],[0,3.6,5.38],.15,0x57655c);
 for(const s of [-1,1])bar([s*.9,1.8,3.9],[s*2.3,4.4,3.2],.32,0xe4bb8c);
 const legs=[];
 for(const s of [-1,1])legs.push({s,thigh:bar([0,0,0],[0,1,0],.42,0x32404b),calf:bar([0,0,0],[0,1,0],.30,0xd7ac80)});
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(10,23),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.);float a=(1.-smoothstep(.35,1.,r))*.19;gl_FragColor=vec4(.16,.19,.10,a);}'
 }));shadow.renderOrder=3.2;shadow.scale.setScalar(scale);group.add(shadow);
 let pose;
 function update(time,dt=0){
  pose=sampleCyclist(time);rider.position.set(pose.x,pose.y,5);
  const blend=dt>0?1-Math.exp(-7*dt):1;rider.rotation.z+=(pose.yaw-rider.rotation.z)*blend;
  for(const leg of legs){const p=time*7+(leg.s<0?Math.PI:0),foot=[leg.s*1.15,-1.3+Math.sin(p)*1.3,1.4+Math.cos(p)*.7],knee=[leg.s*1.5,-.7+Math.sin(p)*.7,2.8];setBar(leg.thigh,[leg.s*.8,-.3,3.8],knee);setBar(leg.calf,knee,foot);}
  shadow.position.set(pose.x+3*scale,pose.y-4*scale,3.2);shadow.rotation.z=rider.rotation.z;
 }
 update(0);return {group,rider,shadow,update,get pose(){return pose;},width:6*scale,length:19*scale};
}
