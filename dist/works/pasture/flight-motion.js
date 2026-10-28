// Smooth deterministic irregular motion, with heading derived from lateral velocity.
function hash(index,seed){if(index===0)return 0;const h=Math.sin(index*127.1+seed*311.7)*43758.5453;return (h-Math.floor(h))*2-1;}
function noise(t,seed){const i=Math.floor(t),f=t-i,u=f*f*f*(f*(f*6-15)+10);return hash(i,seed)+(hash(i+1,seed)-hash(i,seed))*u;}
function lateral(t){return noise(t*.16,17)*106+noise(t*.39,43)*30;}
export function sampleFlight(time){
 const t=Math.max(0,time),x=lateral(t),vx=(lateral(t+.12)-lateral(Math.max(0,t-.12)))/(t<.12?.12+t:.24);
 const yaw=Math.max(-.70,Math.min(.70,-Math.atan2(vx,34)*.85+noise(t*.24,73)*.06));
 return {x,y:noise(t*.20,89)*36+noise(t*.43,109)*12,yaw};
}
