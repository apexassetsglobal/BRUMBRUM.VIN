import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { demoBaseCount, demoGalleries, externalCatalogGalleries } from '../src/data.js';

const origin=new URL(process.argv[2]);
if (origin.href!==origin.origin+'/'||origin.username||origin.password||
    (origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))) {
  throw new Error('Pass the HTTPS origin of the Worker.');
}
const catalog=process.argv[3]==='--catalog';
const tokenName=catalog?'DEMO_CATALOG_MEDIA_TOKEN':'DEMO_MEDIA_SETUP_TOKEN';
const token=process.env[tokenName];
if (!token||token.length<32) throw new Error(`Set ${tokenName} for this upload.`);
const headers={'X-Demo-Media-Token':token,'Content-Type':'image/webp'};
const siteAccess=process.env.DEMO_MEDIA_SITE_BEARER;
if (siteAccess) headers['OAI-Sites-Authorization']='Bearer '+siteAccess;
const galleries=catalog?externalCatalogGalleries:[...demoGalleries.values()].slice(0,demoBaseCount);
const first=catalog?1:Number(process.argv[3]??1);
if (!Number.isInteger(first)||first<1||first>galleries.length) throw new Error('Pass a valid first listing number for Full HD upload.');
const files=[...galleries.slice(first-1).flat().map(({url})=>({path:url,folder:''})),
  ...galleries.flat().map(({thumb})=>({path:thumb,folder:'thumbs/'}))];

const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function put(path,body) {
  for (let attempt=0;;attempt++) {
    let response;
    try {
      response=await fetch(new URL('/api/demo-media/'+path,origin),{
        method:'PUT',body,headers,redirect:'error',signal:AbortSignal.timeout(40000)
      });
    } catch (error) {
      if (attempt>=3) throw new Error(`${path}: ${error.name}`);
    }
    if (response?.ok) return response.json();
    if (response) {
      await response.body?.cancel();
      const transient=response.status===408||response.status===429||response.status>=500;
      if (!transient||attempt>=3) throw new Error(`${path}: HTTP ${response.status}`);
    }
    await delay(900*2**attempt);
  }
}

async function upload({path,folder}) {
  const file=path.split('/').at(-1);
  const body=await readFile(new URL('../public'+path,import.meta.url));
  const result=await put(folder+file,body);
  if (!result.ok||result.sha256!==createHash('sha256').update(body).digest('hex')) throw new Error(`${path}: checksum mismatch`);
}

const concurrency=catalog?12:8;
for (let offset=0;offset<files.length;offset+=concurrency) {
  const group=files.slice(offset,offset+concurrency);
  await Promise.all(group.map(upload));
  console.log(`${offset+group.length}/${files.length} demo gallery files uploaded`);
}
if (catalog) {
  const result=await put('catalog-ready');
  if (!result.ok||result.count!==files.length) throw new Error('The expanded demo catalog was not activated.');
  console.log('Expanded demo catalog activated.');
}
