import { digest, fail, json, limitedBody, missing } from './core.js';

export const adMediaPath='/assets/ad-banners/';
export const adMediaSetup='/api/ad-media/';
export const firstAdFile='all4rent-rental-banner.jpg';

const files={
  [firstAdFile]:'eb6b15ad7702db74e880b84ccb47012e9e45a6ea38e14e03947b5616c643d799',
  'jcb-rental-banner.png':'2c89e976d6d55498542c1962fbc732874775b6b80df050f3d36c9c9159287c28',
  'fazicars-banner.png':'e615bdfe5435025f065b3df6e14648df55e42755d4b2e9f2acfea13ce22c19cd',
  'cars-collection-banner.png':'42f74948ddd8eb844d5d85335c02c8c63917dd741557d8e7d8f4ad103aeda64f',
  'cars-rent-banner.png':'f1df5d2f03603db07edb95a0fd84bf538bbb615ad61e63f57114250ba513c163',
  'rankomat-banner.png':'cea426651b9c3d14ec119e1d77b6f1e7c5f3f426ec44cbeb4a79cae728fc3f09',
  'jet-partner-banner.png':'5c0960bc9a589164e8385e0baf599419748da50dd993d0bcb16b2c62d2b8328f',
  'all4rent-advertise-banner.png':'be6b29ca08de5d8f47d57fc2c9caf18cbb9998e4968c11d8c2b8e2746a416221',
  'ar-home-512.png':'5d27165bdd43321addcb55ccbbe621cbb3aab46dd22575749fa6c17e222a0d97'
};
const key=filename=>'ad-banners/'+files[filename];
const contentType=filename=>filename.endsWith('.jpg')?'image/jpeg':'image/png';

export async function adMediaReady(ctx) {
  if (ctx.env.runtime==='node') return true;
  try {
    const bundled=await ctx.asset(adMediaPath+firstAdFile,'HEAD');
    if (bundled?.ok) return true;
    // Provisioning uploads this file last, after verifying the remaining originals.
    return Boolean(await ctx.env.BUCKET.head(key(firstAdFile)));
  } catch (error) {
    console.error('Could not check advertising media',error);
    return false;
  }
}

export async function readAdMedia(ctx,path) {
  const filename=path.slice(adMediaPath.length);
  if (!Object.hasOwn(files,filename)) return null;
  const head=ctx.req.method==='HEAD';
  const object=await ctx.env.BUCKET.get(key(filename));
  if (!object) return null;
  if (head) await object.body.cancel();
  return new Response(head?null:object.body,{headers:{
    'Content-Type':contentType(filename),'Cache-Control':'public, max-age=86400'
  }});
}

export async function installAdMedia(ctx,filename) {
  const secret=ctx.env.AD_CAROUSEL_MEDIA_TOKEN;
  const supplied=ctx.req.headers.get('X-Ad-Media-Token')||'';
  if (ctx.req.method!=='PUT'||!Object.hasOwn(files,filename)||!secret||secret.length<32||
      supplied.length!==secret.length||await digest(supplied)!==await digest(secret)) missing();
  const bytes=await limitedBody(ctx.req,3*1024*1024);
  const sha256=await digest(bytes);
  if (sha256!==files[filename]) fail(422,'Plik różni się od oryginału.','The file differs from the original.');
  await ctx.env.BUCKET.put(key(filename),bytes,{httpMetadata:{contentType:contentType(filename)}});
  return json({ok:true,sha256});
}
