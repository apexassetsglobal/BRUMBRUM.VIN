import { fail, missing } from './core.js';

export const videoLimit = 24 * 1024 * 1024;
const textAt = (bytes, from=0, to=bytes.length) => String.fromCharCode(...bytes.subarray(from,to));
export const invalidVideo = () => fail(422,'Wybierz prawidłowe wideo MP4 (H.264) lub WebM.','Choose a valid MP4 (H.264) or WebM video.');

// The parser requests only container headers, track flags and codec names.
// Both storage-backed and in-memory validation drive this same parser.
function* mp4Box(offset,limit) {
  if (offset+8>limit) invalidVideo();
  const bytes=yield {offset,length:Math.min(16,limit-offset)};
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let size=view.getUint32(0);
  const type=textAt(bytes,4,8);
  let header=8;
  if (size===1) {
    if (bytes.length<16) invalidVideo();
    size=Number(view.getBigUint64(8));
    header=16;
  } else if (size===0) size=limit-offset;
  if (size<header||size>limit-offset) invalidVideo();
  return {type,start:offset+header,end:offset+size};
}

function* childBox(parent,type) {
  if (!parent) return;
  for (let offset=parent.start;offset<parent.end;) {
    const child=yield* mp4Box(offset,parent.end);
    if (child.type===type) return child;
    offset=child.end;
  }
}

function* isMp4(size) {
  let movie,hasMedia=false;
  for (let offset=0;offset<size;) {
    const box=yield* mp4Box(offset,size);
    if (box.type==='moov') movie=box;
    if (box.type==='mdat'&&box.end>box.start) hasMedia=true;
    offset=box.end;
  }
  if (!movie||!hasMedia) return false;
  for (let offset=movie.start;offset<movie.end;) {
    const track=yield* mp4Box(offset,movie.end);
    offset=track.end;
    if (track.type!=='trak') continue;
    const media=yield* childBox(track,'mdia');
    const handler=yield* childBox(media,'hdlr');
    if (!handler||handler.end-handler.start<12) continue;
    const kind=yield {offset:handler.start+8,length:4};
    if (textAt(kind)!=='vide') continue;
    const mediaInfo=yield* childBox(media,'minf');
    const table=yield* childBox(mediaInfo,'stbl');
    const descriptions=yield* childBox(table,'stsd');
    if (!descriptions||descriptions.end-descriptions.start<8) continue;
    for (let pos=descriptions.start+8;pos<descriptions.end;) {
      const entry=yield* mp4Box(pos,descriptions.end);
      if (['avc1','avc3'].includes(entry.type)&&entry.end-entry.start>=78) return true;
      pos=entry.end;
    }
  }
  return false;
}

function ebmlNumber(bytes,from,identifier=false) {
  if (from>=bytes.length||!bytes[from]) invalidVideo();
  const length=Math.clz32(bytes[from])-23;
  if (from+length>bytes.length||(identifier&&length>4)) invalidVideo();
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

function* ebmlElement(offset,limit) {
  const bytes=yield {offset,length:Math.min(12,limit-offset)};
  const id=ebmlNumber(bytes,0,true);
  const length=ebmlNumber(bytes,id.after);
  const start=offset+length.after;
  const end=length.unknown?limit:start+length.value;
  if (end>limit) invalidVideo();
  return {id:id.value,start,end};
}

function* webmTrack(tracks) {
  for (let offset=tracks.start;offset<tracks.end;) {
    const track=yield* ebmlElement(offset,tracks.end);
    offset=track.end;
    if (track.id!==0xae) continue;
    let video=false,codec='';
    for (let pos=track.start;pos<track.end;) {
      const field=yield* ebmlElement(pos,track.end);
      pos=field.end;
      const length=field.end-field.start;
      if (field.id===0x83) {
        video=length===1&&(yield {offset:field.start,length})[0]===1;
      }
      if (field.id===0x86&&length<20) codec=textAt(yield {offset:field.start,length});
    }
    if (video&&['V_VP8','V_VP9','V_AV1'].includes(codec)) return true;
  }
  return false;
}

function* isWebm(size) {
  let documentType=false;
  for (let offset=0;offset<size;) {
    const root=yield* ebmlElement(offset,size);
    offset=root.end;
    if (root.id===0x1a45dfa3) {
      for (let pos=root.start;pos<root.end;) {
        const header=yield* ebmlElement(pos,root.end);
        pos=header.end;
        if (header.id===0x4282&&header.end-header.start===4) {
          documentType=textAt(yield {offset:header.start,length:4})==='webm';
        }
      }
    } else if (root.id===0x18538067&&documentType) {
      let video=false,cluster=false;
      for (let pos=root.start;pos<root.end;) {
        const element=yield* ebmlElement(pos,root.end);
        pos=element.end;
        if (element.id===0x1654ae6b) video=yield* webmTrack(element);
        if (element.id===0x1f43b675&&element.end>element.start) cluster=true;
        if (video&&cluster) return true;
      }
    }
  }
  return false;
}

export function* videoHeaders(size) {
  if (!Number.isSafeInteger(size)||size<32) invalidVideo();
  const signature=yield {offset:0,length:8};
  if (textAt(signature,4,8)==='ftyp'&&(yield* isMp4(size))) return 'video/mp4';
  const view=new DataView(signature.buffer,signature.byteOffset,signature.byteLength);
  if (view.getUint32(0)===0x1a45dfa3&&(yield* isWebm(size))) return 'video/webm';
  invalidVideo();
}

export function videoMime(bytes) {
  const parser=videoHeaders(bytes.length);
  let step=parser.next();
  while (!step.done) {
    const {offset,length}=step.value;
    step=parser.next(bytes.subarray(offset,offset+length));
  }
  return step.value;
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
