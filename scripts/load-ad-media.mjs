import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { adMediaPath, adMediaSetup, firstAdFile } from '../src/ad-media.js';

const origin=new URL(process.argv[2]);
if (origin.protocol!=='https:'||origin.href!==origin.origin+'/'||origin.username||origin.password) {
  throw new Error('Pass the HTTPS origin of the Worker.');
}
const token=process.env.AD_CAROUSEL_MEDIA_TOKEN;
if (!token||token.length<32) throw new Error('Set AD_CAROUSEL_MEDIA_TOKEN for this upload.');
const source=new URL('../public'+adMediaPath,import.meta.url);
const filenames=(await readdir(source)).filter(name=>name.endsWith('.png')||name.endsWith('.jpg'));

async function upload(filename) {
  const body=await readFile(new URL(filename,source));
  const response=await fetch(new URL(adMediaSetup+filename,origin),{
    method:'PUT',body,headers:{'X-Ad-Media-Token':token},redirect:'error',signal:AbortSignal.timeout(40000)
  });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const expected=createHash('sha256').update(body).digest('hex');
  if ((await response.json()).sha256!==expected) throw new Error(`${filename}: checksum mismatch`);
  console.log(`${filename}: verified`);
}

// The home page becomes active when this file is available.
for (const filename of filenames) {
  if (filename!==firstAdFile) await upload(filename);
}
await upload(firstAdFile);
