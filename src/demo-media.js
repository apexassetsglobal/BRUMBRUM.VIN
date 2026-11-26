import { digest, encoder, fail, json, limitedBody, missing } from './core.js';
import { demoCatalogReadyKey, demoGalleries, externalCatalogGalleries } from './data.js';
import { cleanImage } from './images.js';

const demoMediaPath = '/assets/showcase-hd/';
const demoThumbPath = '/assets/showcase/';
export const demoMediaSetup = '/api/demo-media/';
const variants = new Map([...demoGalleries.values()].flat().flatMap(({url,thumb})=>[[url,thumb],[thumb,url]]));
const catalogPaths = new Set(externalCatalogGalleries.flat().flatMap(({url,thumb})=>[url,thumb]));
const keyOf = path=>path.slice('/assets/'.length,-5);
const fileLimit = 1024*1024;

export async function readDemoMedia(ctx,path,{fallback=true}={}) {
  const alternative=variants.get(path);
  if (!alternative) return null;
  const object=await ctx.env.BUCKET.get(keyOf(path));
  if (object) return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=86400'}});
  if (!fallback||catalogPaths.has(path)) return null;
  const substitute=await ctx.asset(alternative) ?? await ctx.env.BUCKET.get(keyOf(alternative)) ?? await ctx.asset('/assets/category-car.webp');
  return substitute&&new Response(substitute.body,{headers:{'Content-Type':'image/webp','Cache-Control':'no-store'}});
}

export async function installDemoMedia(ctx,filename) {
  const finalize=filename==='catalog-ready';
  const thumbnail=filename.startsWith('thumbs/');
  const path=thumbnail?demoThumbPath+filename.slice('thumbs/'.length):demoMediaPath+filename;
  const secret=finalize||catalogPaths.has(path)?ctx.env.DEMO_CATALOG_MEDIA_TOKEN:ctx.env.DEMO_MEDIA_SETUP_TOKEN;
  const provided=ctx.req.headers.get('X-Demo-Media-Token')||'';
  if (ctx.req.method!=='PUT'||(!finalize&&!variants.has(path))||!secret||secret.length<32||provided.length!==secret.length||
      await digest(provided)!==await digest(secret)) missing();
  if (finalize) return publishDemoCatalog(ctx);
  const image=cleanImage(await limitedBody(ctx.req,fileLimit),thumbnail?640:1920,fileLimit);
  const validSize=thumbnail?image.width<=640&&image.height<=360:image.width===1920&&image.height===1080;
  if (image.mime!=='image/webp'||!validSize) {
    fail(422,thumbnail?'Miniatura demo musi być plikiem WebP do 640 × 360 px.':'Zdjęcie demo musi być plikiem WebP o wymiarach 1920 × 1080 px.',
      thumbnail?'A demo thumbnail must be a WebP file up to 640 × 360 px.':'A demo photo must be a 1920 × 1080 WebP file.');
  }
  await ctx.env.BUCKET.put(keyOf(path),image.bytes,{httpMetadata:{contentType:image.mime}});
  return json({ok:true,sha256:await digest(image.bytes)});
}

async function publishDemoCatalog(ctx) {
  const bucket=ctx.env.BUCKET;
  const outstanding=new Set([...catalogPaths].map(keyOf));
  for (const prefix of ['showcase-hd/','showcase/']) {
    let cursor;
    do {
      const listing=await bucket.list({prefix,cursor,limit:1000});
      for (const object of listing.objects) outstanding.delete(object.key);
      cursor=listing.truncated?listing.cursor:undefined;
    } while (cursor);
  }
  if (outstanding.size) fail(409,'Katalog demo czeka na komplet zdjęć.','The demo catalog is waiting for all photos.',{missing:outstanding.size});
  const count=catalogPaths.size;
  await bucket.put(demoCatalogReadyKey,encoder.encode(JSON.stringify({count})),{httpMetadata:{contentType:'application/json'}});
  return json({ok:true,count});
}
