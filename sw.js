const VERSION='quran-memorizer-pwa-v2';
const SHELL=VERSION+'-shell';
const RUNTIME=VERSION+'-runtime';
const APP_SHELL=['./','./index.html','./reader.html','./app.css','./home.js','./surahs.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys()) if(![SHELL,RUNTIME].includes(k)) await caches.delete(k); await self.clients.claim();})());});
function isQuranResource(url){return url.hostname==='api.quran.com'||url.hostname==='verses.quran.foundation';}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(isQuranResource(url)){
    e.respondWith((async()=>{const cache=await caches.open(RUNTIME);const hit=await cache.match(e.request);if(hit)return hit;const res=await fetch(e.request);if(res && (res.ok||res.type==='opaque')) cache.put(e.request,res.clone());return res;})()); return;
  }
  if(url.origin===self.location.origin){
    e.respondWith((async()=>{const hit=await caches.match(e.request,{ignoreSearch:e.request.mode==='navigate'});if(hit)return hit;try{const res=await fetch(e.request);const cache=await caches.open(SHELL);if(res.ok)cache.put(e.request,res.clone());return res;}catch(err){if(e.request.mode==='navigate')return (await caches.match('./index.html'));throw err;}})());
  }
});
self.addEventListener('message',e=>{
  const d=e.data||{}; if(d.type!=='CACHE_URLS'||!Array.isArray(d.urls)) return;
  e.waitUntil((async()=>{const cache=await caches.open(RUNTIME);let done=0;let hadError=false;for(const u of d.urls){try{const req=new Request(u,{mode:'cors'});let res=await cache.match(req);if(!res){res=await fetch(req);if(res&&(res.ok||res.type==='opaque'))await cache.put(req,res.clone());else throw new Error('bad response');}}catch(err){hadError=true;}done++;e.source?.postMessage({type:'CACHE_PROGRESS',id:d.id,done,total:d.urls.length});}e.source?.postMessage({type:hadError?'CACHE_ERROR':'CACHE_DONE',id:d.id,done,total:d.urls.length});})());
});