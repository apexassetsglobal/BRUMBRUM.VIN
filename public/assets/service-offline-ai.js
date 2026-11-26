const source = new URL('./service-offline-ai-vendor/', import.meta.url);
const cacheName = 'brumbrum-device-translation-v1';
const runtime = { bytes: 5241884, hash:'735d4d95ede043c48f146b9a89336077f18885ad30b7e9a6a86c51a73ca02e7b' };
const supported = new Set(['pl','en','de','cs','sk','uk']);
let manifest;

function problem(code) {
  return Object.assign(new Error(code), {code});
}

function path(from, to) {
  if (!supported.has(from) || !supported.has(to)) throw problem('language_unsupported');
  if (from === to) return [];
  return from === 'en' || to === 'en' ? [from+'-'+to] : [from+'-en','en-'+to];
}

function modelCatalog() {
  if (!manifest) manifest = fetch(new URL('models.json',source),{credentials:'omit'}).then(response=>{
    if (!response.ok) throw problem('catalog_unavailable');
    return response.json();
  }).catch(error=>{ manifest = null; throw error; });
  return manifest;
}

/** Queries only local assets and browser storage. No model download starts here. */
export async function offlineTranslationPlan(from, to) {
  const route = path(from,to);
  const available = typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof DecompressionStream !== 'undefined' && Boolean(globalThis.crypto?.subtle);
  if (!route.length) return {available:true,route,runtimeBytes:0,modelBytes:0,downloadBytes:0};
  const catalog = await modelCatalog();
  const files = route.flatMap(key => catalog[key]);
  if (files.some(file => !file)) throw problem('catalog_unavailable');
  let cache;
  try { cache = await caches.open(cacheName); } catch { /* Private mode can disable model caching. */ }
  const unique = new Map([runtime,...files].map(file=>[file.hash,file]));
  let downloadBytes = 0;
  for (const file of unique.values()) {
    const present = await cache?.match(new URL('cached/'+file.hash,source));
    if (!present) downloadBytes += file.bytes;
  }
  return { available, route, runtimeBytes:runtime.bytes, modelBytes:files.reduce((n,f)=>n+f.bytes,0), downloadBytes };
}

function translateLeg(text, key, allowDownload, progress, signal) {
  return new Promise((resolve,reject)=>{
    const worker = new Worker(new URL('translate-worker.js',source));
    let done = false, timer;
    const finish = (value,error) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener('abort',cancel);
      worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(null, new DOMException('Translation cancelled','AbortError'));
    const monitor = () => {
      clearTimeout(timer);
      timer = setTimeout(()=>finish(null,problem('translation_timeout')),240000);
    };
    monitor();
    signal?.addEventListener('abort',cancel,{once:true});
    if (signal?.aborted) { cancel(); return; }
    worker.onerror = () => finish(null,problem('translation_engine_unavailable'));
    worker.onmessage = ({data}) => {
      if (data.progress) { monitor(); progress?.({...data.progress, pair:key}); return; }
      if (data.error) finish(null,problem(data.error));
      else finish(data.text);
    };
    worker.postMessage({text,key,allowDownload});
  });
}

/** Downloads require allowDownload:true. A failed or cancelled translation leaves the editor to its caller. */
export async function translateServiceOnDevice({text,from,to,allowDownload=false,onProgress,signal} = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw problem('invalid_translation_text');
  if (signal?.aborted) throw new DOMException('Translation cancelled','AbortError');
  const plan = await offlineTranslationPlan(from,to);
  if (!plan.available) throw problem('translation_engine_unavailable');
  if (plan.downloadBytes && !allowDownload) throw problem('download_required');
  let translated = text;
  for (const key of plan.route) translated = await translateLeg(translated,key,allowDownload,onProgress,signal);
  return {text:translated,from,to,via:plan.route.length>1?'en':null};
}
