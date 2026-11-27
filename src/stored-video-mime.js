import { invalidVideo, videoHeaders } from './videos.js';

const windowSize=64*1024;
const sequentialAfter=12;
const maxReads=24;
const maxHeaders=8192;

async function openRange(bucket,key,offset,length) {
  const object=await bucket.get(key,{range:{offset,length}});
  if (!object) throw new Error('Stored video unavailable');
  return new Response(object.body);
}

// Fragmented MP4 recordings may have a moof/mdat pair for every second.
// Walk those headers in one storage read, retaining only the current chunk.
async function openSequentialRange(bucket,key,offset,size) {
  const response=await openRange(bucket,key,offset,size-offset);
  const reader=response.body.getReader();
  let chunk=new Uint8Array();
  let start=offset;
  return {
    canRead(from) { return from>=start; },
    async read(from,length) {
      const bytes=new Uint8Array(length);
      let copied=0;
      while (copied<length) {
        if (from+copied>=start+chunk.length) {
          start+=chunk.length;
          const {value,done}=await reader.read();
          if (done) throw new Error('Incomplete stored video range');
          chunk=value;
          continue;
        }
        const index=from+copied-start;
        const count=Math.min(length-copied,chunk.length-index);
        bytes.set(chunk.subarray(index,index+count),copied);
        copied+=count;
      }
      return bytes;
    },
    cancel() { return reader.cancel(); }
  };
}

export async function storedVideoMime(bucket,key,size) {
  const parser=videoHeaders(size);
  const windows=[];
  let reads=0,headers=0,lastOffset=0;
  let stream=null;
  let usedStream=false;
  let step=parser.next();
  try {
    while (!step.done) {
      const {offset,length}=step.value;
      if (++headers>maxHeaders) invalidVideo();
      let entry=windows.find(window=>offset>=window.offset&&offset+length<=window.offset+window.bytes.length);
      if (!entry) {
        if (!usedStream&&reads>=sequentialAfter&&offset>=lastOffset) {
          stream=await openSequentialRange(bucket,key,offset,size);
          usedStream=true;
          reads++;
        }
        lastOffset=offset;
        if (stream?.canRead(offset)) {
          step=parser.next(await stream.read(offset,length));
          continue;
        }
        // A camera can write its movie index after the media. Seek directly
        // to the requested header, caching recent windows for track lookups.
        if (++reads>maxReads) invalidVideo();
        const count=Math.min(windowSize,size-offset);
        const response=await openRange(bucket,key,offset,count);
        const bytes=new Uint8Array(await response.arrayBuffer());
        if (bytes.length!==count) throw new Error('Incomplete stored video range');
        entry={offset,bytes};
        windows.unshift(entry);
        if (windows.length>4) windows.pop();
      }
      const start=offset-entry.offset;
      step=parser.next(entry.bytes.subarray(start,start+length));
    }
    return step.value;
  } finally {
    if (stream) await stream.cancel();
  }
}
