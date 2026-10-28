import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(project,'dist');
if(!process.argv[2])throw new Error('Pass the installed esbuild module path as the first argument.');
const esbuild=await import(pathToFileURL(process.argv[2]).href);
const works={
 pasture:{dir:'works/pasture',html:'index.html',assets:['pasture-ground-v7.png','pasture-seam-v11.png','plane.png','pasture-cow-top-v8-1.png','pasture-black-cow-top-v8-1.png','pasture-sheep-v7.png']},
 patchwork:{dir:'.',html:'scene.html',assets:['patchwork-ground-v13.png','patchwork-seam-v13.png','plane.png','pasture-black-cow-top-v8-1.png','pasture-sheep-v7.png']},
 wilderness:{dir:'works/wilderness',html:'index.html',assets:['wilderness-ground-v17.png','wilderness-seam-v17.png','plane.png']},
 islands:{dir:'works/islands',html:'index.html',assets:['islands-ground-v23.png','plane.png']}
};
const scenes={},assets={};
for(const [name,work] of Object.entries(works)){
 const dir=path.join(dist,work.dir);let entry=await readFile(path.join(dir,'main.js'),'utf8');
 for(const file of work.assets){const data=await readFile(path.join(dir,'assets',file)),token='__SCENE_ASSET_'+createHash('sha256').update(data).digest('hex').slice(0,16)+'__';assets[token]='data:image/png;base64,'+data.toString('base64');entry=entry.replaceAll(`'./assets/${file}'`,JSON.stringify(token));}
 const result=await esbuild.build({stdin:{contents:entry,resolveDir:dir,sourcefile:'main.js',loader:'js'},bundle:true,format:'iife',target:'es2020',minify:true,write:false,legalComments:'inline'});
 const css=await readFile(path.join(dir,'style.css'),'utf8');let html=await readFile(path.join(dir,work.html),'utf8');
 html=html.replace(/<link[^>]+href=["'](?:\.\/|\/)?style\.css(?:\?[^"']*)?["'][^>]*>/,()=>'<style>'+css+'</style>');
 html=html.replace(/<script[^>]+src=["'](?:\.\/|\/)?main\.js(?:\?[^"']*)?["'][^>]*><\/script>/,()=>'<script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 if(!/__SCENE_ASSET_[a-f0-9]{16}__/.test(html))throw new Error(`Missing embedded asset references in ${name}`);
 scenes[name]=html;
}
let gallery=await readFile(path.join(dist,'index.html'),'utf8');
const galleryCss=await readFile(path.join(dist,'gallery.css'),'utf8'),galleryJs=await readFile(path.join(dist,'gallery.js'),'utf8');
gallery=gallery.replace('<link rel="stylesheet" href="./gallery.css">',()=>'<style>'+galleryCss+'</style>');
gallery=gallery.replace(/<script src="\.\/gallery\.js(?:\?[^\"]*)?"><\/script>/,()=>'<script>window.__SCENE_ASSETS__='+JSON.stringify(assets).replace(/</g,'\\u003c')+';window.__SCENE_BUNDLE__='+JSON.stringify(scenes).replace(/</g,'\\u003c')+';\n'+galleryJs+'</script>');
await mkdir(path.join(project,'delivery'),{recursive:true});
const out=path.join(project,'delivery','田野之间-直接打开.html');await writeFile(out,gallery);
process.stdout.write(JSON.stringify({path:out,bytes:Buffer.byteLength(gallery),works:Object.keys(scenes)})+'\n');
