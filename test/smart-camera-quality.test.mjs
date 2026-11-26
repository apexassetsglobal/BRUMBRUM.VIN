import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectPhoto, measurePhotoSample} from '../public/smart-camera-quality.js';

function sample(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = pixel(x,y);
    data.set([value, value, value, 255], (y*width+x)*4);
  }
  return {width,height,data};
}

test('local inspection distinguishes exposure and edge contrast from dimensions', () => {
  const normal = measurePhotoSample(sample(32,20,(x,y) => (x+y)%2 ? 100 : 160), 1920,1080);
  assert.deepEqual(normal.warnings, []);
  assert.equal(normal.meanLuma, 130);
  assert.deepEqual(measurePhotoSample(sample(24,20,() => 10),1920,1080).warnings, ['blur','dark']);
  assert.deepEqual(measurePhotoSample(sample(24,20,() => 254),1920,1080).warnings, ['blur','overexposed']);
  const portrait = measurePhotoSample(sample(20,32,(x,y) => (x+y)%2 ? 100 : 160), 480,640);
  assert.deepEqual(portrait.warnings,['lowResolution','portrait']);
});

test('inspection fingerprints decoded samples, requests EXIF orientation and releases decoded images', async t => {
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (originalBitmap) Object.defineProperty(globalThis,'createImageBitmap',originalBitmap);
    else delete globalThis.createImageBitmap;
    if (originalDocument) Object.defineProperty(globalThis,'document',originalDocument);
    else delete globalThis.document;
  });
  let closed = 0, level = 128, width = 1500;
  Object.defineProperty(globalThis, 'createImageBitmap', {configurable:true, value:async (_file, options) => {
    assert.equal(options.imageOrientation, 'from-image');
    return {width,height:1000,close() { closed++; }};
  }});
  const ctx = {
    fillRect(){}, drawImage(){},
    getImageData(_x,_y,w,h) {
      assert.equal(w,320);
      return sample(w,h,() => level);
    }
  };
  Object.defineProperty(globalThis, 'document', {configurable:true, value:{
    createElement() { return {getContext:() => ctx}; }
  }});
  const file = new Blob(['test']);
  const first = await inspectPhoto(file);
  assert.match(first.fingerprint,/^320x213:[0-9a-f]{64}$/);
  const second = await inspectPhoto(file,{knownFingerprints:[first.fingerprint]});
  assert.ok(second.warnings.includes('duplicate'));
  level++;
  const different = await inspectPhoto(file,{knownFingerprints:[first.fingerprint]});
  assert.ok(!different.warnings.includes('duplicate'));
  width = 100000;
  await assert.rejects(inspectPhoto(file),/photo-dimensions/);
  assert.equal(closed,4);
  await assert.rejects(inspectPhoto({size:13*1024*1024}),/photo-size/);
});
