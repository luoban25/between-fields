/** Source-image river corridor: blue farmland must never receive flowing glints. */
export function sampleRiver(path,y){
 let i=0;while(i<path.length-2&&path[i+1][0]<y)i++;
 const a=path[i],b=path[i+1],u=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
 return {x:a[1]+(b[1]-a[1])*u,halfWidth:(a[2]+(b[2]-a[2])*u)/2};
}
export function makeRiverGeometry(THREE,width,height,path){
 const positions=[],uvs=[],indices=[],rows=Math.ceil(height/12);
 for(let i=0;i<=rows;i++){
  const y=i/rows*height,p=sampleRiver(path,y),half=Math.max(8,p.halfWidth-2);
  for(const x of [p.x-half,p.x+half]){positions.push(x-width/2,height/2-y,0);uvs.push(x/width,1-y/height);}
  if(i<rows){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
