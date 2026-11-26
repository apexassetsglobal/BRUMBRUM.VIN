/* Automotive service text is processed entirely inside this dedicated worker. */
'use strict';
var Module = {};
const asset = new URL('./',self.location.href);
const cdn = 'https://storage.googleapis.com/download/storage/v1/b/moz-fx-translations-data--303e-prod-translations-data/o/';
const runtime = {bytes:5241884, hash:'735d4d95ede043c48f146b9a89336077f18885ad30b7e9a6a86c51a73ca02e7b'};
const problem = code => Object.assign(new Error(code),{code});
const progress = state => self.postMessage({progress:state});
const digest = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
let cache;
let consent = false;

async function bounded(response,size,report) {
  if (!response.ok || !response.body) throw problem('model_download_failed');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(size);
  let used = 0, notified = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (part.value.byteLength > size - used) throw problem('model_integrity_failed');
      bytes.set(part.value,used); used += part.value.byteLength;
      const now = performance.now();
      if (report && (used === size || now - notified > 400)) { report(used); notified = now; }
    }
  } finally { if (used !== size) await reader.cancel().catch(()=>{}); }
  if (used !== size) throw problem('model_integrity_failed');
  return bytes;
}

async function verifiedFile(file,url) {
  const key = new URL('cached/'+file.hash,asset);
  const prior = await cache?.match(key);
  if (prior) {
    try {
      const bytes = await bounded(prior,file.bytes);
      if (await digest(bytes) === file.hash) return bytes;
    } catch { /* Discard a partial cache entry before retrying. */ }
    await cache.delete(key).catch(()=>{});
  }
  if (!consent) throw problem('download_required');
  let response;
  try { response = await fetch(url,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'}); }
  catch { throw problem('model_download_failed'); }
  const bytes = await bounded(response,file.bytes,loaded=>progress({stage:'loading',file:file.kind || 'runtime',loaded,total:file.bytes}));
  if (await digest(bytes) !== file.hash) throw problem('model_integrity_failed');
  try { await cache?.put(key,new Response(bytes)); } catch { /* Inference works if persistent storage is full. */ }
  return bytes;
}

async function engine() {
  const wasm = await verifiedFile(runtime,new URL('bergamot.wasm',asset));
  const accelerators = {int8_prepare_a:'int8PrepareAFallback',int8_prepare_b:'int8PrepareBFallback',
    int8_prepare_b_from_transposed:'int8PrepareBFromTransposedFallback',int8_prepare_b_from_quantized_transposed:'int8PrepareBFromQuantizedTransposedFallback',
    int8_prepare_bias:'int8PrepareBiasFallback',int8_multiply_and_add_bias:'int8MultiplyAndAddBiasFallback',int8_select_columns_of_b:'int8SelectColumnsOfBFallback'};
  const gemm = Object.fromEntries(Object.entries(accelerators).map(([key,impl])=>[key,(...args)=>Module.asm[impl](...args)]));
  await new Promise((resolve,reject)=>{
    Module.instantiateWasm = (imports,accept) => {
      WebAssembly.instantiate(wasm,{...imports, wasm_gemm:gemm}).then(({instance})=>accept(instance),reject);
      return {};
    };
    Module.onRuntimeInitialized = resolve;
    Module.onAbort = () => reject(problem('translation_engine_unavailable'));
    importScripts('bergamot.js');
  });
}

const settings = [
  'beam-size: 1','normalize: 1.0','word-penalty: 0','cpu-threads: 0','gemm-precision: int8shiftAlphaAll','skip-cost: true',
  'alignment: soft','quiet: true','quiet-translation: true','max-length-break: 128','mini-batch-words: 1024','workspace: 128','max-length-factor: 2.0'
].join('\n')+'\n';

async function modelFor(files) {
  const memory = {};
  for (const file of files) {
    if (!/^models\/[a-z]{2}-[a-z]{2}\/[a-zA-Z0-9_-]+\/exported\/[a-zA-Z0-9_.-]+\.gz$/.test(file.file) ||
        !['lex','vocab','model'].includes(file.kind) || file.rawBytes > 45_000_000) throw problem('catalog_unavailable');
    const compressed = await verifiedFile(file,cdn+encodeURIComponent(file.file)+'?alt=media');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const raw = await bounded(new Response(stream),file.rawBytes);
    if (raw.length !== file.rawBytes || await digest(raw) !== file.rawHash) throw problem('model_integrity_failed');
    const aligned = new Module.AlignedMemory(raw.byteLength,file.kind==='model'?256:64);
    aligned.getByteArrayView().set(raw);
    memory[file.kind] = aligned;
    progress({stage:'model',file:file.kind,bytes:file.bytes});
  }
  const vocabs = new Module.AlignedMemoryList();
  vocabs.push_back(memory.vocab);
  return new Module.TranslationModel(settings,memory.model,memory.lex,vocabs,null);
}

self.onmessage = async ({data}) => {
  try {
    if (!/^(?:en-(?:pl|cs|sk|de|uk)|(?:pl|cs|sk|de|uk)-en)$/.test(data.key)) throw problem('language_unsupported');
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 26000) throw problem('invalid_translation_text');
    consent = data.allowDownload === true;
    try { cache = await caches.open('brumbrum-device-translation-v1'); } catch { /* Volatile storage. */ }
    const response = await fetch(new URL('models.json',asset),{credentials:'omit'});
    if (!response.ok) throw problem('catalog_unavailable');
    const files = (await response.json())[data.key];
    if (!files || files.length !== 3) throw problem('catalog_unavailable');
    progress({stage:'loading'});
    await engine();
    const model = await modelFor(files);
    const service = new Module.BlockingService({cacheSize:0});
    const input = new Module.VectorString();
    const options = new Module.VectorResponseOptions();
    input.push_back(data.text);
    options.push_back({alignment:false,html:false,qualityScores:false});
    progress({stage:'translating'});
    const result = service.translate(model,input,options).get(0).getTranslatedText().trim();
    if (!result) throw problem('translation_engine_unavailable');
    self.postMessage({text:result});
  } catch (error) {
    self.postMessage({error:error?.code || 'translation_engine_unavailable'});
  }
};
