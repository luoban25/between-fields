/** Image-free, softly shaded cloud layer. The caller owns time and rendering. */
export function makeClouds(THREE, { size = 941 } = {}) {
  const clouds = new THREE.Group();
  const shadows = new THREE.Group();
  const aircraftShadows = new THREE.Group();
  clouds.name = 'Procedural clouds';
  shadows.name = 'Procedural cloud shadows';
  clouds.position.z = 30;
  shadows.position.z = 3;
  aircraftShadows.name='Aircraft shadows on clouds';aircraftShadows.position.z=30;
  // Keep groupOrder neutral; per-mesh renderOrder controls the actual passes.
  clouds.renderOrder = 0;
  shadows.renderOrder = 0;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const common = `
    precision highp float;
    varying vec2 vUv;
    uniform float uSeed;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                 mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.;
      float a = .5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = mat2(.8, -.6, .6, .8) * p * 2.04 + 6.3;
        a *= .5;
      }
      return v;
    }
    float smoothMin(float a, float b, float k) {
      float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
      return mix(b, a, h) - k * h * (1. - h);
    }
    vec2 lobeCentre(vec2 centre, float index) {
      vec2 jitter = vec2(hash(vec2(index + 9.2, uSeed * 3.7)), hash(vec2(uSeed * 8.1, index + 2.5))) - .5;
      // Each cloud gets a different arrangement of shoulders and taller lobes.
      float variant = step(2., uSeed);
      centre *= mix(vec2(1., 1.), vec2(.88, 1.09), variant);
      centre.x += centre.y * mix(-.10, .20, variant);
      return centre + jitter * .14;
    }
    float lobeRadius(float radius, float index) {
      return radius * mix(.86, 1.15, hash(vec2(index * 4.3 + 1.7, uSeed * 5.9)));
    }
    float lobeDistance(vec2 p, vec2 centre, float radius, float index) {
      return length(p - lobeCentre(centre, index)) - lobeRadius(radius, index);
    }
    float outline(vec2 p) {
      // Separate lobes retain a scalloped silhouette instead of summing into
      // one broad elliptical density mound.
      float d = lobeDistance(p, vec2(-.56, -.10), .32, 0.);
      d = smoothMin(d, lobeDistance(p, vec2(-.42, .27), .34, 1.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(-.10, .42), .35, 2.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(.26, .34), .37, 3.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(.56, .06), .33, 4.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(.41, -.28), .33, 5.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(.02, -.38), .37, 6.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(-.34, -.32), .31, 7.), .075);
      d = smoothMin(d, lobeDistance(p, vec2(.0, .0), .43, 8.), .075);
      return d + (fbm(p * 18. + uSeed * 7.1) - .49) * .014;
    }
    float cap(vec2 p, vec2 c, float r, float elevation, float bulge, float index) {
      c = lobeCentre(c, index);
      r = lobeRadius(r, index);
      vec2 q = (p - c) / r;
      float lift = mix(.89, 1.13, hash(vec2(uSeed * 2.3, index * 1.7)));
      return exp(-dot(q,q)*1.32) * (elevation + r * bulge * lift);
    }
    float heightAt(vec2 p) {
      // The visible surface is the top of overlapping sphere caps. Their
      // unequal elevations make both rounded shoulders and soft inner valleys.
      float h = cap(p, vec2(-.56, -.10), .32, .015, .87, 0.);
      h = -smoothMin(-h, -cap(p, vec2(-.42, .27), .34, .045, 1.12, 1.), .16);
      h = -smoothMin(-h, -cap(p, vec2(-.10, .42), .35, .080, 1.30, 2.), .16);
      h = -smoothMin(-h, -cap(p, vec2(.26, .34), .37, .040, 1.13, 3.), .16);
      h = -smoothMin(-h, -cap(p, vec2(.56, .06), .33, .005, .90, 4.), .16);
      h = -smoothMin(-h, -cap(p, vec2(.41, -.28), .33, -.005, .83, 5.), .16);
      h = -smoothMin(-h, -cap(p, vec2(.02, -.38), .37, .010, .96, 6.), .16);
      h = -smoothMin(-h, -cap(p, vec2(-.34, -.32), .31, -.010, .82, 7.), .16);
      h = -smoothMin(-h, -cap(p, vec2(.0, .0), .43, .100, 1.28, 8.), .16);
      return max(h, 0.) + (fbm(p * 11. + uSeed * 8.2) - .5) * .012;
    }
  `;
  const cloudShader = common + `
    uniform vec2 uGrainScale;
    void main() {
      vec2 p = (vUv - .5) * 2.10;
      p.x += sin(uSeed * 2.0) * p.y * .10;
      float d = outline(p);
      float aa = max(fwidth(d) * 1.25, .025);
      float alpha = 1. - smoothstep(-aa, aa, d);
      // Seeded UV-space stipple is baked once, never randomized during playback.
      float edgeBand=1.-smoothstep(.025,.14,abs(d));
      float grain=hash(floor(vUv*uGrainScale*1.5)+uSeed*19.7);
      alpha=mix(alpha,step(grain,alpha),edgeBand*.44);
      vec2 grid=vUv*uGrainScale/5.,cell=floor(grid),local=fract(grid);
      vec2 centre=.28+.44*vec2(hash(cell+uSeed),hash(cell+uSeed+47.1));
      float radius=.14+.12*hash(cell+uSeed+81.3);
      float dotAlpha=1.-smoothstep(radius,radius+.10,length(local-centre));
      float scatter=dotAlpha*step(.84,hash(cell+uSeed+113.9));
      scatter*=smoothstep(-.005,.02,d)*(1.-smoothstep(.025,.15,d))*.70;
      alpha=max(alpha,scatter);
      alpha *= smoothstep(0.,.045,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
      if (alpha < .002) discard;
      float eps = .014;
      float h = heightAt(p);
      float hl = heightAt(p - vec2(eps, 0.));
      float hr = heightAt(p + vec2(eps, 0.));
      float hd = heightAt(p - vec2(0., eps));
      float hu = heightAt(p + vec2(0., eps));
      vec3 normal = normalize(vec3(-(hr - hl) / (eps * 2.), -(hu - hd) / (eps * 2.), 1.));
      vec3 lightDir = normalize(vec3(-.70, .85, 1.20));
      float diffuse = max(0., dot(normal, lightDir));
      float cavity = clamp((hl + hr + hd + hu - 4. * h) * 65., 0., .7);
      float occlusion = clamp((heightAt(p + vec2(-.09, .10)) - h) * 2.8, 0., .17);
      float shade = clamp(.29 + diffuse * .83 - cavity * .11 - occlusion * .55, 0., 1.);
      float whiteCloud = step(2., uSeed);
      vec3 low = mix(vec3(.72, .81, .90), vec3(.93), whiteCloud);
      vec3 high = mix(vec3(1., 1., .995), vec3(1.), whiteCloud);
      vec3 col = mix(low, high, shade);
      col+=(grain-.5)*.026*edgeBand;
      gl_FragColor = vec4(min(col, vec3(1.)), alpha);
    }
  `;
  const shadowShader = common + `
    void main() {
      vec2 p = (vUv - .5) * 2.10;
      p.x += sin(uSeed * 2.0) * p.y * .10;
      float d = outline(p);
      float alpha = (1. - smoothstep(-.13, .15, d)) * .44;
      alpha *= smoothstep(0.,.065,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
      if (alpha < .001) discard;
      // Multiply the existing ground colour, preserving flowers and water detail.
      gl_FragColor = vec4(mix(vec3(1.),vec3(.25,.30,.36),alpha),1.);
    }
  `;

  const units = [
    { x: .455, y: -.13, w: 260, h: 240, seed: 1.21, speed: 27 },
    { x: -.435, y: .34, w: 270, h: 250, seed: 3.83, speed: 34 },
    { x: -.455, y: -.27, w: 110, h: 92, seed: 5.21, speed: 39 },
    { x: .43, y: .43, w: 122, h: 104, seed: 7.43, speed: 31 },
    { x: -.40, y: -.02, w: 80, h: 68, seed: 9.16, speed: 44 },
    { x: .03, y: .03, w: 400, h: 340, seed: 12.31, speed: 35, underPlane:true },
  ].map((spec) => {
    const uniforms = { uSeed: { value: spec.seed },uGrainScale:{value:new THREE.Vector2(spec.w,spec.h)} };
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader: cloudShader, uniforms,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shadowUniforms = { uSeed: { value: spec.seed } };
    const shadowMaterial = new THREE.ShaderMaterial({
      vertexShader, fragmentShader: shadowShader, uniforms: shadowUniforms,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
    });
    const factor = size / 941;
    const geometry = new THREE.PlaneGeometry(spec.w * factor, spec.h * factor);
    const cloud = new THREE.Mesh(geometry, material);
    const shadow = new THREE.Mesh(geometry, shadowMaterial);
    cloud.name = `Cloud ${spec.seed}`;
    cloud.userData.driftSpeed=spec.speed;
    cloud.userData.underPlane=Boolean(spec.underPlane);
    cloud.userData.wrapMargin=spec.underPlane?300:225;
    cloud.userData.wrapSpan=size+cloud.userData.wrapMargin*2;
    shadow.name = `Cloud shadow ${spec.seed}`;
    cloud.renderOrder = spec.underPlane?16:30;
    shadow.renderOrder = 7;
    shadow.scale.set(1.12, 1.12, 1);
    clouds.add(cloud);
    shadows.add(shadow);
    return { ...spec, cloud, shadow, uniforms, shadowUniforms, factor, rawCloud:material,rawShadow:shadowMaterial };
  });
  const modulo = (value, period) => ((value % period) + period) % period;
  let baked=false,bakedTargets=[];

  function setAircraft(planeMap){
    planeMap.updateMatrix();
    for(const unit of units){
      if(!unit.underPlane)continue;
      if(unit.aircraftShadow){aircraftShadows.remove(unit.aircraftShadow);unit.aircraftShadow.material.dispose();}
      const material=new THREE.ShaderMaterial({
        transparent:true,depthTest:false,depthWrite:false,
        uniforms:{uCloudMap:{value:unit.cloud.material.map||null},uPlaneMap:{value:planeMap},uPlaneUv:{value:planeMap.matrix},uPlaneCentre:{value:new THREE.Vector2()},uPlaneSize:{value:new THREE.Vector2(66,39)},uYaw:{value:0}},
        vertexShader:`varying vec2 vUv;varying vec2 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xy;gl_Position=projectionMatrix*viewMatrix*world;}`,
        fragmentShader:`precision highp float;varying vec2 vUv;varying vec2 vWorld;
          uniform sampler2D uCloudMap;uniform sampler2D uPlaneMap;uniform mat3 uPlaneUv;
          uniform vec2 uPlaneCentre;uniform vec2 uPlaneSize;uniform float uYaw;
          float mask(vec2 p){return texture2D(uPlaneMap,(uPlaneUv*vec3(p,1.)).xy).a;}
          void main(){
            float cloud=texture2D(uCloudMap,vUv).a;if(cloud<.002)discard;
            vec2 q=vWorld-uPlaneCentre;float c=cos(uYaw),s=sin(uYaw);
            vec2 local=vec2(c*q.x+s*q.y,-s*q.x+c*q.y);
            if(abs(local.x)>uPlaneSize.x*.6||abs(local.y)>uPlaneSize.y*.6)discard;
            vec2 p=local/uPlaneSize+.5,d=vec2(.012,.020);float a=mask(p)*.28;
            a+=(mask(p+vec2(d.x,0.))+mask(p-vec2(d.x,0.))+mask(p+vec2(0.,d.y))+mask(p-vec2(0.,d.y)))*.12;
            a+=(mask(p+d)+mask(p-d)+mask(p+vec2(d.x,-d.y))+mask(p+vec2(-d.x,d.y)))*.06;
            gl_FragColor=vec4(.08,.12,.15,a*cloud*.42);
          }`
      });
      const overlay=new THREE.Mesh(unit.cloud.geometry,material);overlay.renderOrder=17;
      overlay.name='Aircraft projection clipped to centre cloud';aircraftShadows.add(overlay);unit.aircraftShadow=overlay;
    }
    update(0);
  }

  function updateAircraft({x,y,yaw,scaleX=1}){
    for(const unit of units){
      if(!unit.aircraftShadow)continue;
      const uniforms=unit.aircraftShadow.material.uniforms;
      uniforms.uPlaneCentre.value.set(x+22*unit.factor,y-32*unit.factor);
      uniforms.uYaw.value=yaw;uniforms.uPlaneSize.value.set(66*scaleX*unit.factor,39*unit.factor);
    }
  }

  // Render each fixed shape once. Playback uses only filtered bitmap quads,
  // avoiding per-frame procedural shading and its subpixel grain shimmer.
  function bake(renderer){
    const previousTarget=renderer.getRenderTarget();
    const previousClear=renderer.getClearColor(new THREE.Color()),previousAlpha=renderer.getClearAlpha();
    const previousAutoClear=renderer.autoClear;
    const bakeScene=new THREE.Scene(),bakeCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);
    bakeCamera.position.z=1;
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));bakeScene.add(quad);
    const nextTargets=[];
    function renderTexture(raw,resolution){
      const target=new THREE.WebGLRenderTarget(resolution,resolution,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});
      target.texture.generateMipmaps=true;target.texture.colorSpace=THREE.NoColorSpace;
      const fragmentShader=raw.fragmentShader.replace(/(gl_FragColor\s*=\s*vec4\([^;]+;)/,
        '$1\n vec3 rawRGB=gl_FragColor.rgb;gl_FragColor.rgb=mix(rawRGB/12.92,pow((rawRGB+.055)/1.055,vec3(2.4)),step(vec3(.04045),rawRGB));')
        .replace(/(if\s*\(\s*alpha\s*<\s*[\d.]+\s*\))\s*discard;/g,'$1{gl_FragColor=vec4(1.,1.,1.,0.);return;}');
      const material=new THREE.ShaderMaterial({vertexShader:raw.vertexShader,fragmentShader,uniforms:raw.uniforms,blending:THREE.NoBlending,depthTest:false,depthWrite:false});
      quad.material=material;renderer.setRenderTarget(target);renderer.setClearColor(0xffffff,0);renderer.clear();renderer.render(bakeScene,bakeCamera);
      material.dispose();nextTargets.push(target);return target.texture;
    }
    try{
      renderer.autoClear=true;
      for(const unit of units){
        const small=unit.w<180;
        const cloudMap=renderTexture(unit.rawCloud,small?512:1024),shadowMap=renderTexture(unit.rawShadow,small?256:512);
        if(unit.cloud.material!==unit.rawCloud)unit.cloud.material.dispose();
        if(unit.shadow.material!==unit.rawShadow)unit.shadow.material.dispose();
        unit.cloud.material=new THREE.MeshBasicMaterial({map:cloudMap,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
        unit.shadow.material=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,blending:THREE.MultiplyBlending,premultipliedAlpha:true,toneMapped:false});
        if(unit.aircraftShadow)unit.aircraftShadow.material.uniforms.uCloudMap.value=cloudMap;
      }
      bakedTargets.forEach(target=>target.dispose());bakedTargets=nextTargets;baked=true;
    }finally{
      quad.geometry.dispose();renderer.setRenderTarget(previousTarget);renderer.setClearColor(previousClear,previousAlpha);renderer.autoClear=previousAutoClear;
    }
  }

  function update(time = 0) {
    const t = Number.isFinite(time) ? time : 0;
    for (const unit of units) {
      // Static cloud shapes travel at constant speed with no horizontal sway.
      // Vertical wrapping happens beyond the frame and the whole shadow extent.
      const margin = unit.cloud.userData.wrapMargin * unit.factor;
      const span = size + margin * 2;
      const x = unit.x * size;
      const y = modulo(unit.y * size - t * unit.speed * unit.factor + size / 2 + margin, span) - size / 2 - margin;
      unit.cloud.position.set(x, y, unit.underPlane?-14:0);
      // One upper-left sun direction matches the original trees and windmill.
      // The expanded soft footprint keeps part of the right shadow in frame.
      unit.shadow.position.set(x + 42 * unit.factor, y - 66 * unit.factor, 0);
      if(unit.aircraftShadow){unit.aircraftShadow.position.copy(unit.cloud.position);unit.aircraftShadow.position.z+=.01;}
    }
  }
  update(0);
  return { clouds, shadows, aircraftShadows, update, updateAircraft, setAircraft, bake, get cached(){return baked;} };
}
