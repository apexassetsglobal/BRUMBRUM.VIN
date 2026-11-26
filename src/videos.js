import { fail, missing } from './core.js';

export const videoLimit = 24 * 1024 * 1024;
const textAt = (bytes, from, to) => String.fromCharCode(...bytes.subarray(from,to));
const invalidVideo = () => fail(422,'Wybierz prawidłowe wideo MP4 (H.264) lub WebM.','Choose a valid MP4 (H.264) or WebM video.');

function* boxes(view,from,to) {
  for (let offset=from;offset<to;) {
    if (offset+8>to) invalidVideo();
    let size=view.getUint32(offset);
    const type=textAt(new Uint8Array(view.buffer,view.byteOffset,view.byteLength),offset+4,offset+8);
    let header=8;
    if (size===1) {
      if (offset+16>to) invalidVideo();
      size=Number(view.getBigUint64(offset+8));
      header=16;
    } else if (size===0) size=to-offset;
    if (size<header||size>to-offset) invalidVideo();
    yield {type,start:offset+header,end:offset+size};
    offset+=size;
  }
}

function childBox(view,box,type) {
  if (!box) return;
  for (const child of boxes(view,box.start,box.end)) if (child.type===type) return child;
}

function isMp4(bytes,view) {
  let movie,hasMedia=false;
  for (const box of boxes(view,0,bytes.length)) {
    if (box.type==='moov') movie=box;
    if (box.type==='mdat'&&box.end>box.start) hasMedia=true;
  }
  if (!movie||!hasMedia) return false;
  for (const track of boxes(view,movie.start,movie.end)) {
    if (track.type!=='trak') continue;
    const media=childBox(view,track,'mdia');
    const handler=childBox(view,media,'hdlr');
    if (!handler||handler.end-handler.start<12||textAt(bytes,handler.start+8,handler.start+12)!=='vide') continue;
    const table=childBox(view,childBox(view,media,'minf'),'stbl');
    const descriptions=childBox(view,table,'stsd');
    if (!descriptions||descriptions.end-descriptions.start<8) continue;
    for (const entry of boxes(view,descriptions.start+8,descriptions.end)) {
      if (['avc1','avc3'].includes(entry.type)&&entry.end-entry.start>=78) return true;
    }
  }
  return false;
}

function ebmlNumber(bytes,from,to,identifier=false) {
  if (from>=to||!bytes[from]) invalidVideo();
  const length=Math.clz32(bytes[from])-23;
  if (from+length>to||(identifier&&length>4)) invalidVideo();
  const mask=(1<<(8-length))-1;
  let value=identifier?bytes[from]:bytes[from]&mask;
  let unknown=!identifier&&value===mask;
  for (let index=1;index<length;index++) {
    const digit=bytes[from+index];
    value=value*256+digit;
    unknown&&=digit===255;
  }
  return {value,after:from+length,unknown};
}

function* elements(bytes,from,to) {
  for (let offset=from;offset<to;) {
    const id=ebmlNumber(bytes,offset,to,true);
    const length=ebmlNumber(bytes,id.after,to);
    const end=length.unknown?to:length.after+length.value;
    if (end>to) invalidVideo();
    yield {id:id.value,start:length.after,end};
    offset=end;
  }
}

function webmTrack(bytes,tracks) {
  for (const track of elements(bytes,tracks.start,tracks.end)) {
    if (track.id!==0xae) continue;
    let video=false,codec='';
    for (const field of elements(bytes,track.start,track.end)) {
      if (field.id===0x83) video=field.end-field.start===1&&bytes[field.start]===1;
      if (field.id===0x86&&field.end-field.start<20) codec=textAt(bytes,field.start,field.end);
    }
    if (video&&['V_VP8','V_VP9','V_AV1'].includes(codec)) return true;
  }
  return false;
}

function isWebm(bytes) {
  let documentType=false;
  for (const root of elements(bytes,0,bytes.length)) {
    if (root.id===0x1a45dfa3) {
      for (const header of elements(bytes,root.start,root.end)) {
        if (header.id===0x4282&&header.end-header.start===4) documentType=textAt(bytes,header.start,header.end)==='webm';
      }
    } else if (root.id===0x18538067&&documentType) {
      let video=false,cluster=false;
      for (const element of elements(bytes,root.start,root.end)) {
        if (element.id===0x1654ae6b) video=webmTrack(bytes,element);
        if (element.id===0x1f43b675&&element.end>element.start) cluster=true;
        if (video&&cluster) return true;
      }
    }
  }
  return false;
}

export function videoMime(bytes) {
  if (bytes.length<32) invalidVideo();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (textAt(bytes,4,8)==='ftyp'&&isMp4(bytes,view)) return 'video/mp4';
  if (view.getUint32(0)===0x1a45dfa3&&isWebm(bytes)) return 'video/webm';
  invalidVideo();
}

function byteRange(value,size) {
  const match=/^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match||(!match[1]&&!match[2])) return null;
  const end=match[2]?Number(match[2]):null;
  const offset=match[1]?Number(match[1]):Math.max(0,size-end);
  const last=match[1]&&end!==null?Math.min(size-1,end):size-1;
  if (!Number.isSafeInteger(offset)||!Number.isSafeInteger(last)||offset>last||offset>=size) return null;
  return {offset,length:last-offset+1};
}

export async function videoObject(ctx,video,visible) {
  const {id,mime,size}=video;
  const rangeHeader=ctx.req.headers.get('Range');
  const range=rangeHeader?byteRange(rangeHeader,size):null;
  const headers=new Headers({'Content-Type':mime,'Accept-Ranges':'bytes',
    'Cache-Control':visible?'private, max-age=0, must-revalidate':'private, no-store'});
  if (rangeHeader&&!range) {
    headers.set('Content-Range','bytes */'+size);
    return new Response(null,{status:416,headers});
  }
  if (range) headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${size}`);
  headers.set('Content-Length',String(range?.length??size));
  const status=range?206:200;
  if (ctx.req.method==='HEAD') return new Response(null,{status,headers});
  const item=await ctx.env.BUCKET.get('videos/'+id,range?{range}:undefined);
  if (!item) missing();
  return new Response(item.body,{status,headers});
}
