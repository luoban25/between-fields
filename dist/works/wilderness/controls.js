const defaults={speed:1,strength:1.25,density:1,wind:.7,lifetime:16,decay:.07,debug:'final'};

/** Native controls are event-driven; the render loop never measures this panel. */
export function makeWakeControls({onChange=()=>{},onPause=()=>{},onReplay=()=>{}}={}){
 const panel=document.querySelector('#wake-controls');
 const params={...defaults},abort=new AbortController();
 const options={signal:abort.signal};
 const pause=panel.querySelector('#wake-pause');
 for(const input of panel.querySelectorAll('input[type="range"]')){
  const output=panel.querySelector(`#${input.id}-value`);
  function sync(){
   const value=Number(input.value);params[input.name]=value;
   output.value=input.name==='lifetime'?`${value} 秒`:input.name==='decay'?value.toFixed(2):`${value.toFixed(2)} 倍`;
  }
  sync();
  input.addEventListener('input',()=>{sync();onChange(params);},options);
 }
 const debug=panel.querySelector('#wake-debug');
 debug.addEventListener('change',()=>{params.debug=debug.value;onChange(params);},options);
 pause.addEventListener('click',()=>onPause(),options);
 panel.querySelector('#wake-replay').addEventListener('click',()=>onReplay(),options);
 function setPlaying(playing){pause.textContent=playing?'暂停':'继续';pause.setAttribute('aria-pressed',String(!playing));}
 setPlaying(true);
 return {params,setPlaying,dispose:()=>abort.abort()};
}
