/** Fixed white, irregular feathered frame in screen space. */
export function makeFrame(THREE){
 const edge=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`precision highp float;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(float p,float seed){float i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(hash(vec2(i,seed)),hash(vec2(i+1.,seed)),f);}
   float wave(float t,float seed){return .014+.008*sin(t*17.+seed)+.004*sin(t*43.+seed*1.7)+.009*(noise(t*9.,seed)-.5)+.003*(noise(t*63.,seed+8.)-.5);}
   void main(){
    float dl=vUv.x-wave(vUv.y,1.3),dr=1.-vUv.x-wave(vUv.y,5.8);
    float db=vUv.y-wave(vUv.x,8.2),dt=1.-vUv.y-wave(vUv.x,3.6);
    float d=min(min(dl,dr),min(db,dt));float grain=hash(floor(gl_FragCoord.xy));
    float coverage=smoothstep(-.005,.012,d+(grain-.5)*.014);
    gl_FragColor=vec4(1.,1.,1.,1.-coverage);
   }`
 }));edge.frustumCulled=false;edge.renderOrder=1000;return edge;
}
