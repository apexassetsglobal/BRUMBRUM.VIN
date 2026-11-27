import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { storedVideoMime } from '../src/stored-video-mime.js';
import { videoMime } from '../src/videos.js';

function rangedBucket(read) {
  const ranges=[];
  return {ranges,async get(key,{range}) {
    assert.equal(key,'movie');
    assert.ok(range.length<=64*1024);
    ranges.push(range);
    return {body:read(range.offset,range.length)};
  }};
}

test('storage-backed validation seeks past a large mdat to the trailing camera index',async()=>{
  const file=await readFile(new URL('./fixtures/vehicle.mp4',import.meta.url));
  const boxes={};
  for (let offset=0;offset<file.length;) {
    const size=file.readUInt32BE(offset);
    boxes[file.toString('ascii',offset+4,offset+8)]=file.subarray(offset,offset+size);
    offset+=size;
  }
  const mediaSize=80*1024*1024;
  const header=Buffer.alloc(8);
  header.writeUInt32BE(mediaSize);
  header.write('mdat',4);
  const start=Buffer.concat([boxes.ftyp,header]);
  const indexOffset=boxes.ftyp.length+mediaSize;
  const size=indexOffset+boxes.moov.length;
  const bucket=rangedBucket((offset,length)=>{
    if (offset===0) {
      const bytes=Buffer.alloc(length);
      start.copy(bytes);
      return bytes;
    }
    assert.equal(offset,indexOffset);
    return boxes.moov;
  });
  assert.equal(await storedVideoMime(bucket,'movie',size),'video/mp4');
  assert.equal(bucket.ranges.length,2);
  const avc=boxes.moov.indexOf('avc1');
  assert.ok(avc>=0);
  boxes.moov.write('hvc1',avc);
  await assert.rejects(storedVideoMime(bucket,'movie',size),{status:422});
});

test('WebM validation checks the video track codec for both sources',async()=>{
  const data=await readFile(new URL('./fixtures/vehicle.webm',import.meta.url));
  const bucket=rangedBucket((offset,length)=>data.subarray(offset,offset+length));
  assert.equal(videoMime(data),'video/webm');
  assert.equal(await storedVideoMime(bucket,'movie',data.length),'video/webm');
  const codec=data.indexOf('V_VP');
  assert.ok(codec>=0);
  data.write('X',codec);
  assert.throws(()=>videoMime(data),{status:422});
  await assert.rejects(storedVideoMime(bucket,'movie',data.length),{status:422});
});

test('frequently fragmented MP4 validates every top-level box using one streaming fallback',async()=>{
  const camera=await readFile(new URL('./fixtures/vehicle.mp4',import.meta.url));
  const segmentSize=96*1024;
  const segment=Buffer.alloc(segmentSize);
  segment.writeUInt32BE(8);
  segment.write('moof',4);
  segment.writeUInt32BE(segmentSize-8,8);
  segment.write('mdat',12);
  const movie=Buffer.concat([camera,...Array(120).fill(segment)]);
  let streamReads=0,totalGets=0;
  const bucket={async get(key,{range:{offset,length}}) {
    totalGets++;
    const end=offset+length;
    if (length<=64*1024) return {body:movie.subarray(offset,end)};
    streamReads++;
    return {body:new ReadableStream({pull(controller) {
      if (offset===end) return controller.close();
      const next=Math.min(end,offset+32003);
      controller.enqueue(movie.subarray(offset,next));
      offset=next;
    }})};
  }};
  assert.equal(await storedVideoMime(bucket,'movie',movie.length),'video/mp4');
  assert.equal(streamReads,1);
  assert.ok(totalGets<=16);
  await assert.rejects(storedVideoMime(bucket,'movie',movie.length-1),{status:422});
});
