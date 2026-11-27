import { fail, limitedBody } from './core.js';
import { listingVideoLimit } from './listing-video-policy.js';
import { storedVideoMime } from './stored-video-mime.js';
import { invalidVideo, videoLimit, videoMime } from './videos.js';

const sizeMismatch = () => fail(422,'Rozmiar przesłanego filmu jest niezgodny z deklaracją.','The received video size does not match the declared size.');
const tooLarge = () => fail(413,'Film przekracza limit 90 MiB.','Video exceeds the 90 MiB limit.');

function declaredSize(request) {
  const lengths = ['Content-Length','X-Video-Size'].map(name => request.headers.get(name)).filter(value => value !== null);
  if (!lengths.length) return null;
  if (lengths.some(value => !/^\d+$/.test(value))) sizeMismatch();
  const [size,hint] = lengths.map(Number);
  if (size > listingVideoLimit || hint > listingVideoLimit) tooLarge();
  if (hint !== undefined && size !== hint) sizeMismatch();
  return size;
}

// Keep older clients that send chunked bodies without either size header working.
async function bufferedUpload(request,bucket,key,size) {
  let bytes;
  try {
    bytes = await limitedBody(request,size ?? videoLimit);
  } catch (error) {
    if (error.status === 413) {
      if (size !== null) sizeMismatch();
      fail(411,'Podaj rozmiar większego filmu w nagłówku Content-Length lub X-Video-Size.','Include Content-Length or X-Video-Size for a larger video.');
    }
    throw error;
  }
  if (size !== null && size !== bytes.byteLength) sizeMismatch();
  const mime = videoMime(bytes);
  await bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
  return {size:bytes.byteLength,mime};
}

async function streamedUpload(request,bucket,key,size) {
  if (!request.body) sizeMismatch();
  const reader = request.body.getReader();
  const header = new Uint8Array(8);
  const prefix = [];
  let count = 0;

  async function nextChunk() {
    const {done,value} = await reader.read();
    if (done) {
      if (count !== size) sizeMismatch();
      return null;
    }
    count += value.byteLength;
    if (count > listingVideoLimit) tooLarge();
    if (count > size) sizeMismatch();
    return value;
  }

  let transfer,write;
  const aborter = new AbortController();
  const bridge = typeof FixedLengthStream === 'function' ? new FixedLengthStream(size) : new TransformStream();
  try {
    while (count < header.length) {
      const offset = count;
      const chunk = await nextChunk();
      if (!chunk) invalidVideo();
      header.set(chunk.subarray(0,header.length-offset),offset);
      if (chunk.byteLength) prefix.push(chunk);
    }
    let mime;
    if (String.fromCharCode(...header.subarray(4)) === 'ftyp') mime = 'video/mp4';
    else if (new DataView(header.buffer).getUint32(0) === 0x1a45dfa3) mime = 'video/webm';
    else invalidVideo();
    const body = new ReadableStream({
      start(controller) {
        for (const chunk of prefix) controller.enqueue(chunk);
        prefix.length = 0;
      },
      async pull(controller) {
        const chunk = await nextChunk();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel(reason) { return reader.cancel(reason); }
    });
    transfer = body.pipeTo(bridge.writable,{signal:aborter.signal});
    write = bucket.put(key,bridge.readable,{httpMetadata:{contentType:mime}});
    await Promise.all([transfer,write]);
    return {size,mime:await storedVideoMime(bucket,key,size)};
  } catch (error) {
    aborter.abort(error);
    await Promise.allSettled([reader.cancel(error),bridge.readable.cancel(error),transfer,write]);
    if (write) await bucket.delete(key).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function storeListingVideo(request,bucket,key) {
  const size = declaredSize(request);
  if (size === null || size <= 1024 * 1024) return bufferedUpload(request,bucket,key,size);
  return streamedUpload(request,bucket,key,size);
}
