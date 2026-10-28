/** Original source-image positions; each animal is drawn once per map repeat. */
const brown=[
 [136,186],[169,191],[157,244],[184,258],[460,524],[480,540],
 [384,681],[399,711],[369,765],[94,772],[127,752],[407,1054],
 [779,982],[827,1163],[799,1186]
];
const black=[[316,922],[322,998],[350,1011]];
const sheep=[
 [695,229],[730,230],[754,249],[706,254],[740,276],[771,268],[769,282],[774,306],
 [829,651],[861,653],[812,684],[852,690],[801,721],[850,728],
 [138,856],[99,872],[128,894],[59,931],[95,932],[41,971],[85,973],
 [282,1257],
 [735,1515],[771,1518],[720,1547],[765,1556]
];
export const ANIMALS=[
 ...brown.map(([x,y],i)=>({x,y,kind:'cow',coat:'brown',size:28,headAngle:.68,phase:i*1.731,pace:.29+i%4*.025})),
 ...black.map(([x,y],i)=>({x,y,kind:'cow',coat:'black',size:28,headAngle:.64,phase:3.3+i*2.1,pace:.31+i*.015})),
 ...sheep.map(([x,y],i)=>({x,y,kind:'sheep',coat:'cream',size:17,headAngle:.5,phase:1.2+i*1.917,pace:.43+i%5*.022}))
];

/** Smooth, bounded local wandering; it never accumulates drift into the river. */
export function animalMotion(spec,t){
 const p=spec.phase,sheep=spec.kind==='sheep',radius=sheep?12:22;
 const a=t*spec.pace+p;
 const dx=radius*(Math.sin(a)-Math.sin(p));
 const dy=radius*.7*(Math.cos(a)-Math.cos(p));
 const vx=radius*spec.pace*Math.cos(a),vy=-radius*.7*spec.pace*Math.sin(a);
 const yaw=Math.atan2(vy,vx)-spec.headAngle;
 // Every animal uses a different walking/grazing rhythm and limb phase.
 const walk=.7+.3*(.5+.5*Math.sin(t*.61+p*1.4));
 return {dx,dy,yaw,walk,gait:t*(sheep?6.8:5.4)+p*2.1,vx,vy};
}
