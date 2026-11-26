import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { offlineTranslationPlan, translateServiceOnDevice } from '../public/assets/service-offline-ai.js';

const vendor = new URL('../public/assets/service-offline-ai-vendor/',import.meta.url);
const models = JSON.parse(await readFile(new URL('models.json',vendor),'utf8'));

test('the pinned catalog covers 30 directed translations without requesting model files for previews',async t=>{
  const files = Object.values(models).flat();
  for (const group of Object.values(models)) assert.deepEqual(group.map(f=>f.kind).sort(),['lex','model','vocab']);
  for (const file of files) {
    assert.match(file.file,/^models\/[a-z]{2}-[a-z]{2}\/[a-zA-Z0-9_-]+\/exported\/[a-zA-Z0-9_.-]+\.gz$/);
    assert.match(file.hash,/^[a-f0-9]{64}$/);
    assert.match(file.rawHash,/^[a-f0-9]{64}$/);
    assert.ok(file.bytes>0 && file.rawBytes>file.bytes && file.rawBytes<45_000_000);
  }
  const requests = [];
  t.mock.method(globalThis,'fetch',async url=>{
    requests.push(String(url));
    assert.equal(String(url),new URL('models.json',vendor).href);
    return Response.json(models);
  });
  const langs = ['pl','en','cs','sk','de','uk'];
  let checked = 0;
  for (const from of langs) for (const to of langs) {
    if (from===to) continue;
    const result=await offlineTranslationPlan(from,to);
    const route=from==='en'||to==='en' ? [from+'-'+to] : [from+'-en','en-'+to];
    assert.deepEqual(result.route,route);
    assert.equal(result.downloadBytes,result.runtimeBytes+route.flatMap(key=>models[key]).reduce((sum,file)=>sum+file.bytes,0));
    checked++;
  }
  assert.equal(checked,30);
  assert.equal(requests.length,1);
});

test('runtime fingerprint, identity and author consent', async t=>{
  const wasm = await readFile(new URL('bergamot.wasm',vendor));
  assert.equal(wasm.byteLength,5241884);
  assert.equal(createHash('sha256').update(wasm).digest('hex'),'735d4d95ede043c48f146b9a89336077f18885ad30b7e9a6a86c51a73ca02e7b');
  const original=globalThis.Worker;
  globalThis.Worker = class { constructor() { throw new Error('Worker created before consent.'); } };
  t.after(()=>{ if(original===undefined) delete globalThis.Worker; else globalThis.Worker=original; });
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(String(url),new URL('models.json',vendor).href);
    return Response.json(models);
  });
  await assert.rejects(translateServiceOnDevice({text:'Przykład',from:'pl',to:'de'}),e=>e.code==='download_required');
  const identity=await translateServiceOnDevice({text:'Przykład',from:'pl',to:'pl'});
  assert.equal(identity.text,'Przykład');
  assert.equal(identity.via,null);
  await assert.rejects(offlineTranslationPlan('pl','unknown'),e=>e.code==='language_unsupported');
});
