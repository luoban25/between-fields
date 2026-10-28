/** Original source-image positions; each animal is drawn once per map repeat. */
const brown=[];
const black=[[388,760],[411,781],[367,796],[391,818],[123,1141],[144,1170],[106,1195]];
const sheep=[
 [880,735],[869,761],[833,773],[797,766],[860,811]
];
export const ANIMALS=[
 ...brown.map(([x,y],i)=>({x,y,kind:'cow',coat:'brown',size:28,headAngle:.68,phase:i*1.731,pace:.29+i%4*.025})),
 ...black.map(([x,y],i)=>({x,y,kind:'cow',coat:'black',size:20,headAngle:.64,phase:3.3+i*2.1,pace:.31+i*.015})),
 ...sheep.map(([x,y],i)=>({x,y,kind:'sheep',coat:'cream',size:14,headAngle:.5,phase:1.2+i*1.917,pace:.43+i%5*.022}))
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
