// Run after the shutter, one decoded photograph at a time. These measurements concern
// the photograph as a whole. They do not locate the vehicle or assess its condition.
export const qualityWarningLabels = {
  blur: ['Mało ostrych detali. Sprawdź ostrość zdjęcia.', 'Little edge detail. Check the focus.'],
  dark: ['Zdjęcie jest ciemne. Sprawdź, czy widać szczegóły.', 'The photo is dark. Check that details are visible.'],
  overexposed: ['Duże jasne obszary tracą szczegóły. Sprawdź ekspozycję.', 'Large bright areas are losing detail. Check the exposure.'],
  lowResolution: ['Niska rozdzielczość. Zalecane co najmniej 1280 × 720 px.', 'Low resolution. At least 1280 × 720 px is recommended.'],
  portrait: ['Kadr pionowy. Do ujęć całego pojazdu zalecany jest poziomy.', 'Portrait photo. Landscape is recommended for full-vehicle shots.'],
  duplicate: ['Taki sam podgląd zdjęcia jest już w tej sesji.', 'An identical photo preview already exists in this session.']
};

// Variance of the four-neighbour Laplacian estimates edge contrast. A smooth
// painted panel can also score low, hence all checks are advisory.
export function measurePhotoSample({data, width, height}, originalWidth, originalHeight) {
  const size = width * height;
  const luma = new Uint8Array(size);
  let sum = 0, dark = 0, highlights = 0;
  for (let i = 0; i < size; i++) {
    const p = i * 4;
    const light = (54 * data[p] + 183 * data[p + 1] + 19 * data[p + 2] + 128) >> 8;
    luma[i] = light;
    sum += light;
    if (light <= 24) dark++;
    if (light >= 248) highlights++;
  }
  let edges = 0, edgeSquares = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const edge = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width];
      edges += edge;
      edgeSquares += edge * edge;
    }
  }
  const edgeCount = Math.max(0, width - 2) * Math.max(0, height - 2);
  const sharpness = edgeCount ? Math.max(0, edgeSquares / edgeCount - (edges / edgeCount) ** 2) : 0;
  const meanLuma = sum / size;
  const highlightFraction = highlights / size;
  const darkFraction = dark / size;
  const warnings = [];
  if (edgeCount && sharpness < 35) warnings.push('blur');
  if (meanLuma < 45 || darkFraction > 0.68) warnings.push('dark');
  if (highlightFraction > 0.32 && meanLuma > 180) warnings.push('overexposed');
  if (Math.max(originalWidth, originalHeight) < 1280 || Math.min(originalWidth, originalHeight) < 720) warnings.push('lowResolution');
  if (originalWidth < originalHeight) warnings.push('portrait');
  return {width:originalWidth, height:originalHeight, meanLuma, sharpness, highlightFraction, darkFraction, warnings};
}

export async function inspectPhoto(file, {knownFingerprints = []} = {}) {
  // Same input bounds as the wizard's uploader. Browser decode honours EXIF before
  // computing dimensions and orientation. The source file is never modified here.
  if (!file || file.size > 12 * 1024 * 1024) throw new RangeError('photo-size');
  let image, url, canvas;
  try {
    if (typeof createImageBitmap === 'function') {
      try { image = await createImageBitmap(file, {imageOrientation:'from-image'}); } catch { /* Try the native image decoder. */ }
    }
    if (!image) {
      image = new Image();
      url = URL.createObjectURL(file);
      image.src = url;
      await image.decode();
    }
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (!width || !height || width * height > 48e6) throw new RangeError('photo-dimensions');
    const scale = Math.min(1, 320 / Math.max(width, height));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const sample = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = measurePhotoSample(sample, width, height);
    result.fingerprint = null;
    if (globalThis.crypto?.subtle) {
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', sample.data));
      result.fingerprint = canvas.width + 'x' + canvas.height + ':' + Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
      if (new Set(knownFingerprints).has(result.fingerprint)) result.warnings.push('duplicate');
    }
    return result;
  } finally {
    image?.close?.();
    if (url) URL.revokeObjectURL(url);
    if (canvas) canvas.width = canvas.height = 1;
  }
}
