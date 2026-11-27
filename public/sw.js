const cacheName='all4auto-public-v204';
const languages=['pl','en','cs','sk','de','uk'];
const offline=language=>'/offline.html?lang='+language;
const preference='/offline-language';
const essentials=[...languages.map(offline),'/styles.css','/styles.css?v=wizard-layout','/assets/vehicle-catalog-layout.css?v=4','/assets/service-shell.css?v=rail4',
  '/assets/robots.css?v=6','/assets/robot-appearance.css?v=3','/assets/robot-appearance.js?v=2','/assets/robots-demo.css?v=2','/appearance.js?v=13','/assets/sound-catalog.js?v=1','/assets/sound-engine.js?v=1','/assets/sound-garage.js?v=1','/assets/icon-192.png?v=engine-start','/assets/icon-512.png?v=engine-start','/assets/icon-maskable-192.png?v=engine-start','/assets/icon-maskable-512.png?v=engine-start',
  '/assets/robots/icon.svg','/assets/robots/icon-180.png','/assets/robots/icon-192.png','/assets/robots/icon-512.png'];

async function offlineResponse(url) {
  const selected=url.searchParams.get('lang');
  const cache=await caches.open(cacheName);
  const saved=await cache.match(preference);
  const stored=await saved?.text();
  const language=languages.includes(selected)?selected:languages.includes(stored)?stored:'pl';
  return await cache.match(offline(language))||new Response('Offline',{status:503});
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(essentials)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const key of await caches.keys()) {
      if (key.startsWith('all4auto-public-') && key!==cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  const language=event.data?.language;
  if (languages.includes(language)) {
    event.waitUntil(caches.open(cacheName).then(cache=>cache.put(preference,new Response(language))));
  }
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if (event.request.method!=='GET'||url.origin!==self.location.origin) return;
  if (event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).catch(()=>offlineResponse(url)));
    return;
  }
  if (!essentials.includes(url.pathname)&&!essentials.includes(url.pathname+url.search)&&!url.pathname.startsWith('/assets/')) return;
  event.respondWith((async()=>{
    try {
      const response=await fetch(event.request);
      if (response.ok && response.type==='basic' && !response.headers.get('Cache-Control')?.includes('no-store')) {
        const cache=await caches.open(cacheName);
        await cache.put(event.request,response.clone());
      }
      return response;
    } catch {return await caches.match(event.request)||new Response('',{status:503});}
  })());
});
