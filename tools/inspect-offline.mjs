import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const text=readFileSync('delivery/田野之间-直接打开.html','utf8');
const assetMarker='window.__SCENE_ASSETS__=',assetStart=text.indexOf(assetMarker)+assetMarker.length,assetEnd=text.indexOf(';window.__SCENE_BUNDLE__=',assetStart);
const assets=JSON.parse(text.slice(assetStart,assetEnd));
const marker='window.__SCENE_BUNDLE__=',start=text.indexOf(marker)+marker.length,end=text.indexOf(';\n(()=>{',start);
const scenes=JSON.parse(text.slice(start,end));
for(const [name,source] of Object.entries(scenes)){
 const html=source.replace(/__SCENE_ASSET_[a-f0-9]{16}__/g,token=>{assert.ok(assets[token]?.startsWith('data:image/png;base64,'),`Missing shared asset ${token}`);return assets[token];});
 const startScript=html.indexOf('<script>')+8,endScript=html.indexOf('</script>',startScript),body=html.slice(startScript,endScript);
 const markers=[...html.matchAll(/<\/?script\b/gi)].map(m=>({tag:m[0],index:m.index}));
 assert.deepEqual(markers.map(m=>m.tag),['<script','</script'],`${name} must contain one complete executable script`);
 assert.ok(html.includes('<style>')&&!html.includes('href="./style.css'),`${name} must contain its embedded stylesheet`);
 assert.ok(html.includes('data:image/png;base64,')&&!/__SCENE_ASSET_[a-f0-9]{16}__/.test(html),`${name} must resolve every image locally`);
 new vm.Script(body);
 console.log(name,'embedded script is valid');
}
assert.ok(Buffer.byteLength(text)<32*1024*1024,'Offline bundle must fit the source repository object limit');
console.log(JSON.stringify({uniqueAssets:Object.keys(assets).length,bytes:Buffer.byteLength(text)}));
