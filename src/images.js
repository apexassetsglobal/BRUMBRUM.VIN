import { fail, isId, missing, now, row } from './core.js';

export const maxUpload = 12 * 1024 * 1024;
export const thumbLimit = 800 * 1024;
const u16 = (a,p) => a[p]*256+a[p+1];
const u24le = (a,p) => a[p] + a[p+1]*256 + a[p+2]*65536;
const str = (a,p,n) => String.fromCharCode(...a.subarray(p,p+n));
const malformed = () => fail(422,'Wybierz prawidłowy obraz JPEG, PNG lub WebP (maks. 12 MB).','Choose a valid JPEG, PNG or WebP image (max 12 MB).');
function joined(parts) {
  const output = new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let offset = 0;
  for (const part of parts) { output.set(part,offset); offset += part.length; }
  return output;
}
function dimensions(w,h,limit) {
  if (!w || !h || w>limit || h>limit || w*h>48e6) malformed();
}

function jpeg(a, limit) {
  const parts = [a.subarray(0,2)];
  let i = 2, w = 0, h = 0, scanned = false, ended = false;
  while (i < a.length) {
    const start = i;
    if (a[i++] !== 255) malformed();
    while (a[i] === 255) i++;
    const marker = a[i++];
    if (marker === 0xd9) {
      parts.push(Uint8Array.of(255,0xd9));
      ended = true;
      break;
    }
    const length = u16(a,i);
    const end = i+length;
    if (!Number.isFinite(length) || length < 2 || end > a.length || marker < 0xc0 || (marker>=0xd0 && marker<=0xd8)) malformed();
    if ([0xc0,0xc1,0xc2].includes(marker)) {
      if (w || length < 11) malformed();
      h = u16(a,i+3);
      w = u16(a,i+5);
      dimensions(w,h,limit);
    }
    if (marker < 0xe0 || (marker > 0xef && marker !== 0xfe)) parts.push(a.subarray(start,end));
    i = end;
    if (marker === 0xda) {
      if (!w) malformed();
      scanned = true;
      const entropyStart = i;
      while (i < a.length) {
        if (a[i++] !== 255) continue;
        const prefix = i-1;
        while (a[i] === 255) i++;
        if (a[i] === 0 || (a[i]>=0xd0 && a[i]<=0xd7)) { i++; continue; }
        i = prefix;
        break;
      }
      if (i === entropyStart || i >= a.length) malformed();
      parts.push(a.subarray(entropyStart,i));
    }
  }
  if (!scanned || !ended) malformed();
  return {bytes:joined(parts),width:w,height:h,mime:'image/jpeg'};
}

const pngSig = [137,80,78,71,13,10,26,10];
function png(a, limit) {
  const view = new DataView(a.buffer,a.byteOffset,a.byteLength);
  const parts = [a.subarray(0,8)];
  let i=8, w=0, h=0, scanned=false, ended=false;
  while (i+12 <= a.length) {
    const size = view.getUint32(i);
    const name = str(a,i+4,4);
    const end = i+12+size;
    if (end>a.length || (i===8 && name!=='IHDR')) malformed();
    if (name === 'IHDR') {
      if (i!==8 || size!==13) malformed();
      w = view.getUint32(i+8); h = view.getUint32(i+12);
      dimensions(w,h,limit);
      const bits = a[i+16], color = a[i+17];
      if (!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]})[color]?.includes(bits) || a[i+18] || a[i+19] || a[i+20]>1) malformed();
    }
    if (name === 'IDAT' && size>0) scanned = true;
    if (['IHDR','PLTE','IDAT','IEND','tRNS','sRGB','gAMA','cHRM'].includes(name)) parts.push(a.subarray(i,end));
    else if (/^[A-Z]/.test(name) || name === 'acTL') malformed();
    i = end;
    if (name === 'IEND') { ended = size===0; break; }
  }
  if (!w || !scanned || !ended) malformed();
  return {bytes:joined(parts),width:w,height:h,mime:'image/png'};
}

function webp(a, limit) {
  const view = new DataView(a.buffer,a.byteOffset,a.byteLength);
  if (view.getUint32(4,true)+8 !== a.length) malformed();
  const parts = [a.slice(0,12)];
  let i=12, w=0, h=0, canvas=null;
  while (i+8<=a.length) {
    const name = str(a,i,4);
    const size = view.getUint32(i+4,true);
    const end = i+8+size+(size%2);
    const p=i+8;
    if (end>a.length) malformed();
    if (name === 'VP8X') {
      if (size!==10 || i!==12 || (a[p]&2)) malformed();
      canvas = [u24le(a,p+4)+1,u24le(a,p+7)+1];
      dimensions(...canvas,limit);
      const data = a.slice(i,end);
      data[8] &= 16;
      parts.push(data);
    }
    if (name === 'VP8 ') {
      if (w || size<10 || (a[p]&1) || a[p+3]!==157 || a[p+4]!==1 || a[p+5]!==42) malformed();
      w = (a[p+6]+a[p+7]*256)&16383; h = (a[p+8]+a[p+9]*256)&16383;
      parts.push(a.subarray(i,end));
    }
    if (name === 'VP8L') {
      if (w || size<5 || a[p]!==47 || (a[p+4]&224)) malformed();
      const fields = view.getUint32(p+1,true);
      w = (fields&16383)+1; h = ((fields>>>14)&16383)+1;
      parts.push(a.subarray(i,end));
    }
    if (name === 'ALPH') parts.push(a.subarray(i,end));
    if (name === 'ANIM' || name === 'ANMF') malformed();
    i=end;
  }
  dimensions(w,h,limit);
  if (i!==a.length || (canvas && (canvas[0]!==w || canvas[1]!==h))) malformed();
  const bytes=joined(parts);
  new DataView(bytes.buffer).setUint32(4,bytes.length-8,true);
  return {bytes,width:w,height:h,mime:'image/webp'};
}

export function cleanImage(bytes, limit = 8500, size = maxUpload) {
  if (bytes.length > size) fail(413,'Plik zdjęcia przekracza dozwolony rozmiar.','The image file exceeds the size limit.');
  if (bytes.length < 24) malformed();
  if (bytes[0]===255 && bytes[1]===216) return jpeg(bytes,limit);
  if (pngSig.every((x,i)=>bytes[i]===x)) return png(bytes,limit);
  if (str(bytes,0,4)==='RIFF' && str(bytes,8,4)==='WEBP') return webp(bytes,limit);
  malformed();
}

export async function objectImage(ctx,key,mime,privateImage = false) {
  const item = await ctx.env.BUCKET.get(key);
  if (!item) missing();
  return new Response(item.body,{headers:{'Content-Type':mime || item.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control':privateImage ? 'private, no-store' : 'private, max-age=0, must-revalidate', 'X-Content-Type-Options':'nosniff'}});
}

export async function publicAsset(ctx,kind,key) {
  if (!isId(key)) missing();
  let exists;
  if (kind==='banner') {
    const at = now();
    exists = await row(ctx.db,`SELECT id FROM banners WHERE scope=? AND image_key=? AND
      ((active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?)) OR ?='admin')`,
      ctx.scope,key,at,at,ctx.user?.role || '');
  }
  if (kind==='logo') exists = await row(ctx.db,"SELECT key FROM settings WHERE scope=? AND key='logo_key' AND value=?",ctx.scope,key);
  if (kind==='company') exists = await row(ctx.db,`SELECT u.id FROM companies c JOIN users u ON u.id=c.user_id
    WHERE c.logo_key=? AND u.scope=? AND u.deleted_at IS NULL AND u.profile_type='company'
      AND (u.show_profile_images=1 OR u.id=?)`,key,ctx.scope,ctx.user?.id||'');
  if (kind==='avatar'||kind==='panorama') {
    const column=kind==='avatar'?'avatar_key':'panorama_key';
    exists=await row(ctx.db,`SELECT id FROM users WHERE ${column}=? AND scope=? AND deleted_at IS NULL
      AND (?='avatar' OR profile_type='company') AND (show_profile_images=1 OR id=?)`,key,ctx.scope,kind,ctx.user?.id||'');
  }
  if (!exists) missing();
  return objectImage(ctx,'assets/'+kind+'/'+key,null,true);
}
