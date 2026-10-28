(()=>{
 const works={
  pasture:{url:'./works/pasture/index.html?v=16',title:'草原河流动态场景'},
  patchwork:{url:'./scene.html?v=22',title:'蓝金田野 · 穿云漫游'},
  wilderness:{url:'./works/wilderness/index.html?v=21',title:'风过荒野 · 穿云实验'},
  islands:{url:'./works/islands/index.html?v=23',title:'风过浅湾 · 碧海沙洲'}
 };
 const frame=document.querySelector('#work'),buttons=[...document.querySelectorAll('[data-work]')];
 let current='';
 function select(id,updateHash=true){
  if(!Object.hasOwn(works,id))id='islands';
  if(id===current)return;
  current=id;const work=works[id];
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.work===id)));
  frame.title=work.title;
  if(window.__SCENE_BUNDLE__)frame.srcdoc=window.__SCENE_BUNDLE__[id].replace(/__SCENE_ASSET_[a-f0-9]{16}__/g,token=>window.__SCENE_ASSETS__?.[token]??token);
  else frame.src=work.url;
  if(updateHash&&location.protocol!=='file:')history.replaceState(null,'','#'+id);
 }
 buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.work)));
 window.addEventListener('hashchange',()=>select(location.hash.slice(1),false));
 select(location.hash.slice(1)||'islands',false);
})();
