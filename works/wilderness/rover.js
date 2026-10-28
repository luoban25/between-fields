import {sampleRover} from './road-path.js?v=17';
/** Small top-down white off-road vehicle, 20x40 source units including mirrors. */
export function makeRover(THREE){
 const group=new THREE.Group(),body=new THREE.Group();group.name='One white wilderness rover';group.add(body);
 function rect(w,h,color,x,y,z){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false}));mesh.position.set(x,y,z);mesh.renderOrder=5+z*.01;body.add(mesh);return mesh;}
 for(const x of [-8.3,8.3])for(const y of [-11,11])rect(2.5,7,0x24272a,x,y,.1);
 const outline=new THREE.Shape();outline.moveTo(-6,-19);outline.lineTo(6,-19);outline.quadraticCurveTo(8,-19,8,-16);outline.lineTo(8,15);outline.quadraticCurveTo(8,19,5,19);outline.lineTo(-5,19);outline.quadraticCurveTo(-8,19,-8,15);outline.lineTo(-8,-16);outline.quadraticCurveTo(-8,-19,-6,-19);
 const shell=new THREE.Mesh(new THREE.ShapeGeometry(outline),new THREE.MeshBasicMaterial({color:0xf4f0e5,transparent:true,depthTest:false,depthWrite:false}));shell.position.z=1;shell.renderOrder=5.01;body.add(shell);
 rect(14,10,0xfff9ec,0,12,1.2);rect(12.5,6,0x526979,0,7,1.5);
 rect(12.6,15,0xfaf8ef,0,-3,2);rect(12,4,0x475d68,0,-13,1.6);
 for(const x of [-5.7,5.7])rect(.85,15,0x5d6260,x,-3,2.1);
 for(const y of [-8,1.5])rect(11,.85,0x777a73,0,y,2.2);
 for(const x of [-9.1,9.1])rect(2.5,2.7,0xd6ddd8,x,6,1.7);
 rect(14,1.3,0xd4d3c8,0,-17,1.6);rect(3,1,0xc65945,-4.5,-16.5,1.7);rect(3,1,0xc65945,4.5,-16.5,1.7);
 for(const x of [-5,5])rect(2.5,1.5,0xfff4c7,x,17,1.7);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(24,44),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);float a=(1.-smoothstep(.4,1.,d))*.27;gl_FragColor=vec4(.18,.08,.025,a);}'
 }));shadow.renderOrder=3.2;group.add(shadow);
 let pose;
 function update(time,dt=0){pose=sampleRover(time);body.position.set(pose.x,pose.y,5);const blend=dt>0?1-Math.exp(-6*dt):1;body.rotation.z+=(pose.yaw-body.rotation.z)*blend;shadow.position.set(pose.x+5,pose.y-8,3.2);shadow.rotation.z=body.rotation.z;}
 update(0);return {group,body,shadow,update,get pose(){return pose;},width:20.7,length:38};
}
