// Lighting moves over water only. Source coordinates and every land pixel stay
// fixed: no UV distortion, displacement, or animated scaling of the reference.
export function makeSea(THREE,{map,width,height}){
 const uniforms={uMap:{value:map},uTime:{value:0},uSize:{value:new THREE.Vector2(width,height)}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`
 precision highp float;varying vec2 vUv;uniform sampler2D uMap;uniform float uTime;uniform vec2 uSize;
 float water(vec3 c){return smoothstep(.012,.09,min(c.g-c.r*1.12,c.b-c.r*1.07))*smoothstep(.06,.20,c.b);}
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 void main(){
  vec4 source=texture2D(uMap,vUv);vec3 color=source.rgb;float wet=water(color);
  if(wet>.001){
   vec2 p=vUv*uSize;
   float shallow=smoothstep(.12,.58,color.r+color.g*.36);
   vec2 drift=vec2(p.x*.043+uTime*.20,p.y*.034-uTime*.26);
   float interference=sin(drift.x+sin(drift.y*.83)*1.8)*sin(drift.y+sin(drift.x*.64)*1.5);
   float caustic=pow(max(interference,0.),7.)*shallow;
   float swell=sin(p.y*.052+sin(p.x*.021+uTime*.12)*2.2-uTime*.65);
   color*=1.+wet*(swell*.018+caustic*.065);
   // Fixed cells pulse smoothly rather than regenerating random glints.
   vec2 grid=vec2(p.x/17.,p.y/23.);vec2 cell=floor(grid),f=fract(grid);
   vec2 centre=vec2(.18+hash(cell)*.64,.18+hash(cell+91.7)*.64);
   vec2 d=(f-centre)/vec2(.042,.12);
   float glint=exp(-dot(d,d))*pow(max(0.,sin(uTime*.85+hash(cell+37.)*6.283)),8.)*step(.66,hash(cell+13.));
   vec2 texel=vec2(3.5)/uSize;
   float shore=(1.-water(texture2D(uMap,vUv+vec2(texel.x,0.)).rgb))+(1.-water(texture2D(uMap,vUv-vec2(texel.x,0.)).rgb))+(1.-water(texture2D(uMap,vUv+vec2(0.,texel.y)).rgb))+(1.-water(texture2D(uMap,vUv-vec2(0.,texel.y)).rgb));
   float wash=smoothstep(.15,.85,.5+.5*sin(uTime*.62+p.y*.042+noise(p*.018)*2.));
   float foam=clamp(shore*.21,0.,.50)*wash*shallow;
   color=mix(color,vec3(.92,.99,1.),wet*clamp(glint*.35+foam*.32,0.,.35));
  }
  gl_FragColor=vec4(color,source.a);
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);mesh.name='Unwarped island ground with water-only light';mesh.renderOrder=0;
 return {mesh,update(time){uniforms.uTime.value=time;},dispose(){mesh.geometry.dispose();material.dispose();}};
}
