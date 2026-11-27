import {autoProfile, exampleSvg, guideTips, orbitSvg, outlineSvg, profiles, steps} from './smart-camera-guides.js';
import {inspectPhoto, qualityWarningLabels} from './smart-camera-quality.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowedCounts = [12, 24, 36];
const spinAngles = count => Array.from({length:count}, (_, i) => i * 360 / count);
const exteriorAngles = steps.filter(step => step.angle != null).map(step => step.angle);
const sizes = {width:1920,height:1080};
const newCaptureId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('');

// Keep at most the unacknowledged, metadata-free image for this listing. Successful
// shots live in the listing's existing storage. Never hydrate a whole spin into RAM.
async function pendingRecord(key, action, capture) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('brumbrum-smart-camera-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage busy'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('pending', action === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('pending');
      const read = store.get(key);
      let current;
      read.onsuccess = () => {
        current = read.result;
        if (action === 'write') {
          if (current && current.captureId !== capture.captureId) { tx.abort(); return; }
          store.put(capture, key);
        }
        if (action === 'remove' && current?.captureId === capture.captureId) store.delete(key);
      };
      tx.oncomplete = () => resolve(current);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage busy'));
    });
  } finally { db.close(); }
}

async function canvasFile(source, width, height, maxSize = 2200) {
  if (!width || !height) throw new Error('Image unavailable');
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  try {
    // Draw only source pixels. Guides, grid, and level use independent DOM layers.
    const context = canvas.getContext('2d', {alpha:false});
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const encode = type => new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Encoding failed')), type, .91);
    });
    let blob = await encode('image/webp');
    if (blob.type !== 'image/webp') blob = await encode('image/jpeg');
    if (!['image/webp','image/jpeg'].includes(blob.type)) throw new Error('JPEG / WebP unavailable');
    return new File([blob], 'brumbrum.' + (blob.type === 'image/webp' ? 'webp' : 'jpg'), {type:blob.type});
  } finally { canvas.width = canvas.height = 1; }
}

async function cleanFile(file) {
  let source, url;
  try {
    if (typeof createImageBitmap === 'function') {
      try { source = await createImageBitmap(file, {imageOrientation:'from-image'}); } catch { /* Native decoder fallback. */ }
    }
    if (!source) {
      url = URL.createObjectURL(file);
      source = new Image();
      source.src = url;
      await source.decode();
    }
    return await canvasFile(source, source.naturalWidth || source.width, source.naturalHeight || source.height);
  } finally {
    source?.close?.();
    if (url) URL.revokeObjectURL(url);
  }
}

let activeDialog = null;
export async function openSmartCamera(bridge, options = {}) {
  if (activeDialog) return;
  const t = bridge.t;
  const e = escapeHtml;
  const pick = pair => t(...pair);
  if (!document.querySelector('link[data-smart-camera-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/assets/smart-camera.css?v=5';
    css.dataset.smartCameraCss = '';
    document.head.append(css);
  }
  const dialog = document.createElement('dialog');
  activeDialog = dialog;
  dialog.className = 'smart-camera-dialog';
  dialog.setAttribute('aria-labelledby', 'smart-camera-title');
  const button = (action, label, className = '') => `<button type="button" class="sc-button ${className}" data-sc-action="${action}">${e(label)}</button>`;
  const target = String(bridge.listingId);
  const settingsKey = 'bb:smart-camera:' + target;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch { /* Optional device preferences. */ }
  let mode = options.mode === 'spin' ? 'spin' : 'guided';
  const initialProfile = autoProfile(bridge.vehicle?.type, bridge.vehicle?.body);
  let override = Object.hasOwn(profiles, saved.override) ? saved.override : '';
  const profile = () => override || initialProfile;
  let count = allowedCounts.includes(saved.count) ? saved.count : 12;
  let index = 0;
  let skipped = new Set(Array.isArray(saved.skipped) ? saved.skipped : []);
  let fingerprints = saved.fingerprints && typeof saved.fingerprints === 'object' ? saved.fingerprints : {};
  const cursor = {...saved.cursor};
  const clamp = (n, min, max, fallback) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  let opacity = clamp(saved.opacity, 15, 100, 75);
  let scale = clamp(saved.scale, 60, 130, 100);
  let contourOn = saved.contourOn !== false, gridOn = saved.gridOn !== false;
  let media = {photos:[], spin:[]}, stream, streamEpoch = 0, requestBusy = false, levelActive = false;
  let lastCapture = null, pending = null, busy = false, closed = false, pendingUrl = '', previousFocus = document.activeElement;
  const events = new AbortController();
  const listen = (node, type, handler) => node.addEventListener(type, handler, {signal:events.signal});
  const plan = () => mode === 'spin' ? spinAngles(count).map(angle => ({id:'spin-' + angle, angle, label:[angle+'°',angle+'°']})) : steps;
  const current = () => plan()[index];
  const storeState = () => {
    cursor[mode] = current()?.id;
    try { localStorage.setItem(settingsKey, JSON.stringify({cursor, count, skipped:[...skipped], override, opacity, scale, contourOn, gridOn, fingerprints})); } catch { /* Server still owns the photos. */ }
  };
  const shots = () => mode === 'spin' ? media.spin : media.photos;
  const match = step => shots().find(item => mode === 'spin'
    ? item.angle === step.angle && Number(item.count) === count : item.shotKey === step.id);
  const hasSession = () => media.spin.some(item => allowedCounts.includes(Number(item.count)));
  const legacySpin = () => media.spin.some(item => item.angle == null || !allowedCounts.includes(Number(item.count)));
  const selectIndex = preferred => {
    const sequence = plan();
    let next = sequence.findIndex(step => step.id === preferred);
    if (next < 0) next = sequence.findIndex(step => !match(step) && (mode === 'spin' || !skipped.has(step.id)));
    index = Math.max(0, next);
  };
  const allDone = () => plan().every(step => match(step) || (mode === 'guided' && skipped.has(step.id)));
  const advance = () => {
    const sequence = plan();
    for (let i = 1; i <= sequence.length; i++) {
      const position = (index + i) % sequence.length;
      if (!match(sequence[position]) && (mode === 'spin' || !skipped.has(sequence[position].id))) { index = position; break; }
    }
    storeState();
  };
  const cacheMedia = async () => {
    media = await bridge.getMedia();
    const spin = media.spin.find(item => allowedCounts.includes(Number(item.count)));
    const serverCount = Number(media.smartCamera?.spinCount ?? spin?.count);
    if (allowedCounts.includes(serverCount)) count = serverCount;
    if (Array.isArray(media.smartCamera?.skipped)) skipped = new Set(media.smartCamera.skipped);
  };
  const doneLabel = t('Zapisane', 'Saved');
  const skipLabel = t('Pominięte', 'Skipped');
  const frameLabel = t('Ujęcie', 'Shot');
  dialog.innerHTML = `<section class="sc-studio">
    <header class="sc-head"><div><strong id="smart-camera-title">BRUMBRUM.VIN — SMART CAMERA 360° STUDIO</strong><p>${e(t('Nie musisz być fotografem. Wystarczy, że dopasujesz kontur.', 'Match the outline to frame your shot.'))}</p></div>
    ${button('close',t('Zamknij','Close'))}</header>
    <nav class="sc-tabs" aria-label="${e(t('Tryb studia','Studio mode'))}">${button('guided',t('Zdjęcia krok po kroku','Guided photos'))}${button('spin','360°')}${button('gallery',t('Galeria ogłoszenia','Listing gallery'))}</nav>
    <div class="sc-layout"><main class="sc-main">
      <div class="sc-title"><h2 data-sc-name></h2><span data-sc-count></span></div>
      <div class="sc-stage" data-sc-stage>
        <div class="sc-picture" data-sc-picture><video playsinline muted autoplay data-sc-feed></video><div class="sc-grid" data-sc-grid></div><div class="sc-ghost" data-sc-outline></div><div class="sc-horizon" data-sc-level hidden></div></div>
        <img class="sc-review" data-sc-review alt="" hidden><div class="sc-view-status" data-sc-view-status></div>
      </div>
      <div class="sc-actions" data-sc-actions></div><p class="sc-orientation-hint">${e(t('Aby uzyskać szeroki kadr, obróć telefon poziomo i obejmij cały pojazd.','For a wide frame, turn your phone sideways and include the whole vehicle.'))}</p><p class="sc-status" role="status" aria-live="polite" data-sc-status></p>
      <div class="sc-shot-note" data-sc-hint></div>
      <div class="sc-files"><input hidden type="file" accept="image/*" capture="environment" data-sc-native><input hidden type="file" accept="image/*" data-sc-file></div>
      <details class="sc-details"><summary>${e(t('Ustawienia kadru','Frame settings'))}</summary><div class="sc-options">
        <label>${e(t('Wzorzec nadwozia','Body template'))}<select data-sc-profile><option value="">${e(t('Automatycznie','Automatic'))}</option>${Object.entries(profiles).map(([id,label])=>`<option value="${e(id)}">${e(pick(label))}</option>`).join('')}</select></label>
        <label>${e(t('Skala konturu','Outline size'))}<input type="range" min="60" max="130" value="${scale}" data-sc-scale></label>
        <label>${e(t('Widoczność konturu','Outline opacity'))}<input type="range" min="15" max="100" value="${opacity}" data-sc-opacity></label>
        <label><input type="checkbox" data-sc-show-outline ${contourOn?'checked':''}> ${e(t('Kontur','Outline'))}</label>
        <label><input type="checkbox" data-sc-show-grid ${gridOn?'checked':''}> ${e(t('Siatka 3×3','3×3 grid'))}</label>
        ${'DeviceOrientationEvent' in window ? button('level',t('Poziomica','Level')):''}
        ${button('fullscreen',t('Pełny ekran','Full screen'))}
      </div></details>
      <details class="sc-details" data-sc-guide><summary>${e(t('Instrukcja fotografowania','Photography guide'))}</summary>
        <p class="sc-reference-name">Lamborghini Revuelto · ${e(t('Przykłady kadrowania','Framing examples'))}</p><div class="sc-examples"><figure><div data-sc-example-good></div><figcaption>${e(t('Cały pojazd i margines','Full vehicle with a margin'))}</figcaption></figure>
        <figure><div data-sc-example-bad></div><figcaption>${e(t('Zbyt ciasny kadr','Too tightly cropped'))}</figcaption></figure></div>
        <ul>${guideTips.map(tip=>`<li>${e(pick(tip))}</li>`).join('')}</ul></details>
    </main><aside class="sc-plan">
      <div data-sc-mode-config></div>
      <div class="sc-progress"><strong data-sc-progress-label></strong><progress data-sc-progress max="100"></progress></div>
      <div class="sc-orbit" data-sc-orbit></div>
      <div class="sc-angle-reference" data-sc-angle-reference></div>
      <div class="sc-prior" data-sc-prior></div>
      <div class="sc-list" data-sc-list></div>
    </aside></div></section>`;
  const $ = selector => dialog.querySelector(selector);
  const el = name => $('[data-sc-' + name + ']');
  const video = el('feed');
  el('profile').value = override;
  if (options.mode === 'guide') el('guide').open = true;
  const status = text => { el('status').textContent = text; };
  const syncedCounts = () => {
    const sequence = plan();
    const complete = sequence.filter(step => match(step)).length;
    const bypass = mode === 'guided' ? sequence.filter(s => !match(s) && skipped.has(s.id)).length : 0;
    return {sequence,complete,bypass};
  };
  const updateFit = () => {
    if (closed) return;
    const stage = el('stage');
    const ratio = stream && video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    const width = Math.min(stage.clientWidth, stage.clientHeight * ratio);
    const picture = el('picture');
    picture.style.width = width + 'px';
    picture.style.height = width / ratio + 'px';
  };
  const updateGuide = () => {
    const angle = current()?.angle;
    const ghost = el('outline');
    ghost.innerHTML = angle == null ? '' : outlineSvg(profile(),angle);
    ghost.hidden = !profile() || angle == null || !contourOn || !!pending;
    ghost.style.opacity = opacity / 100;
    ghost.style.transform = 'scale(' + scale / 100 + ')';
    el('grid').hidden = !gridOn || !!pending;
  };
  const activeLabel = () => mode === 'spin' ? frameLabel + ' ' + (index+1) + ' · ' + current().angle + '°' : pick(current().label);
  function actions() {
    const region = el('actions');
    let buttons;
    if (pending) {
      buttons = button('send', t('Zapisz ujęcie','Save shot'), 'sc-primary') + button('discard',t('Wykonaj ponownie','Retake'));
    } else {
      const locked = mode === 'spin' && legacySpin();
      buttons = locked ? '' : button(stream ? 'capture' : 'start',stream ? (match(current()) ? t('Powtórz zdjęcie','Retake photo') : t('Zrób zdjęcie','Take photo')) : t('Uruchom aparat','Start camera'),'sc-primary') +
        button('native', t('Aparat urządzenia','Device camera')) + button('file',t('Wybierz zdjęcie','Choose photo'));
      const candidate = mode === 'spin' && media.photos.some(photo => photo.angle === current().angle);
      if (candidate && !locked) buttons += button('reuse',confirmReuse ? t('Potwierdź użycie zdjęcia','Confirm reuse') : t('Użyj zdjęcia z tego kąta','Use photo from this angle'));
      if (mode === 'guided' && !match(current())) buttons += button('skip',skipped.has(current().id) ? t('Przywróć ujęcie','Restore shot') : t('Pomiń ujęcie','Skip shot'));
      if (stream) buttons += button('stop', t('Wyłącz aparat','Stop camera'));
      if (lastCapture && current().id !== lastCapture.key && lastCapture.mode === mode) buttons += button('retake', t('Powtórz ostatnie ujęcie','Retake last shot'));
    }
    region.innerHTML = buttons;
    const freeze = !!pending || busy;
    for (const node of dialog.querySelectorAll('button[data-sc-action],select,input')) {
      const act = node.dataset.scAction;
      if (act === 'close') continue;
      node.disabled = (busy || requestBusy) || (freeze && !['send','discard'].includes(act));
    }
    if (hasSession() && el('spin-count')) el('spin-count').disabled = true;
    if (legacySpin() && mode === 'spin') status(t('Ta prezentacja zawiera ręcznie dodane klatki bez kątów. Zarządzaj nią w galerii 360° ogłoszenia.', 'This presentation has manually added frames without angles. Manage it in the listing’s 360° gallery.'));
  }
  function redraw() {
    if (closed) return;
    const activeAngle = document.activeElement?.getAttribute('data-camera-angle');
    const activeIndex = document.activeElement?.getAttribute('data-sc-index');
    const {sequence,complete,bypass} = syncedCounts();
    const step = current();
    const referenceAngle = step.angle ?? 315;
    el('angle-reference').innerHTML=step.angle == null ? '' : `<small>${e(t('Przykładowy kadr · Lamborghini Revuelto','Example framing · Lamborghini Revuelto'))}</small>${exampleSvg('supercar',referenceAngle,true)}`;
    if (el('guide').dataset.exampleAngle !== String(referenceAngle)) {
      el('example-good').innerHTML = exampleSvg('supercar',referenceAngle,true);
      el('example-bad').innerHTML = exampleSvg('supercar',referenceAngle,false);
      el('guide').dataset.exampleAngle = String(referenceAngle);
    }
    el('name').textContent = activeLabel();
    el('count').textContent = (index + 1) + ' / ' + sequence.length;
    el('view-status').textContent = pending ? t('Podgląd ujęcia','Shot preview') : stream ? (step.angle == null ? '' : t('Kąt docelowy','Target angle')+' '+step.angle+'°') :
      (step.angle == null ? pick(step.label) : t('Wzorzec kadru','Framing guide')+' · '+step.angle+'°');
    el('hint').textContent = mode === 'spin' ? t('Obchodź nieruchomy pojazd zgodnie ze strzałką. Zachowaj stałą wysokość i odległość.','Walk around the stationary vehicle in the indicated direction. Keep the same height and distance.') :
      [pick(step.hint),step.distance].filter(Boolean).join(' · ');
    el('progress-label').textContent = doneLabel + ' ' + complete + '/' + sequence.length + ' · ' + Math.round(100 * complete / sequence.length)+'%' + (bypass?' · '+skipLabel+' '+bypass:'');
    el('progress').value = Math.round(100*complete/sequence.length);
    el('mode-config').innerHTML = mode === 'spin' ? `<label>${e(t('Sesja obrotowa','Orbit session'))}<select data-sc-spin-count>${allowedCounts.map((n,i)=>`<option value="${n}" ${n===count?'selected':''}>${['STANDARD','PREMIUM','ULTRA'][i]} · ${n} × ${360/n}°</option>`).join('')}</select></label>` : '';
    for (const node of dialog.querySelectorAll('.sc-tabs button')) node.setAttribute('aria-pressed',String(node.dataset.scAction===mode));
    const angles = mode === 'spin' ? sequence.map(s=>s.angle) : exteriorAngles;
    el('orbit').hidden = step.angle == null;
    el('orbit').innerHTML = step.angle == null ? '' : orbitSvg({angles,angle:step.angle,completed:sequence.filter(s=>s.angle!=null && match(s)).map(s=>s.angle),profile:mode==='spin'?profile():'supercar',lang:document.documentElement.lang});
    const nextAngle = mode === 'spin' ? sequence.slice(index+1).concat(sequence.slice(0,index)).find(s=>!match(s))?.angle : null;
    if (nextAngle != null) {
      const note = document.createElement('small');
      note.textContent = t('Następny kąt','Next angle') + ' ' + nextAngle + '°';
      el('orbit').append(note);
    }
    const latest = lastCapture?.mode===mode ? shots().find(item=>item.id===lastCapture.id) : shots().at(-1);
    el('prior').replaceChildren();
    if (latest?.thumb) {
      const img = new Image(); img.src = latest.thumb; img.alt = t('Ostatnio zapisane zdjęcie','Last saved photo');
      const caption = document.createElement('span'); caption.textContent=t('Ostatnie zdjęcie','Last photo');
      el('prior').append(img,caption);
    }
    el('list').innerHTML = sequence.map((s,i)=>{
      const found = match(s), skip = mode==='guided' && skipped.has(s.id) && !found;
      const marker = found ? '✓' : skip ? '–' : String(i+1);
      return `<button type="button" data-sc-index="${i}" aria-current="${i===index?'step':'false'}"><span aria-hidden="true">${marker}</span>${found?.thumb?`<img alt="" src="${e(found.thumb)}" loading="lazy">`:''}<span>${e(pick(s.label))}</span>${(found || skip)?`<small>${e(found?doneLabel:skipLabel)}</small>`:''}</button>`;
    }).join('');
    el('stage').classList.toggle('sc-live',!!stream);
    el('stage').classList.toggle('sc-previewing',!!pending);
    el('review').hidden = !pending;
    if (pending && pendingUrl !== el('review').getAttribute('src')) el('review').src = pendingUrl;
    if (!pending) el('review').removeAttribute('src');
    updateGuide(); updateFit(); actions();
    if (activeAngle != null) el('orbit').querySelector('[data-camera-angle="' + Number(activeAngle) + '"]')?.focus({preventScroll:true});
    if (activeIndex != null) el('list').querySelector('[data-sc-index="' + Number(activeIndex) + '"]')?.focus({preventScroll:true});
  }

  function stopLevel() {
    levelActive = false;
    window.removeEventListener('deviceorientation', orient);
    el('level').hidden = true;
    $('[data-sc-action="level"]')?.setAttribute('aria-pressed','false');
  }
  function orient(event) {
    if (event.beta == null || event.gamma == null || !levelActive) return;
    const radians = Math.PI / 180;
    const beta = event.beta * radians, gamma = event.gamma * radians;
    const x = Math.sin(gamma) * Math.cos(beta), y = Math.sin(beta);
    if (Math.hypot(x,y) < .14) { el('level').hidden = true; return; }
    const rotation = screen.orientation?.angle ?? window.orientation ?? 0;
    const degrees = Math.atan2(x,y) / radians + rotation;
    const tilt = ((degrees + 270) % 180 + 180) % 180 - 90;
    el('level').hidden = !!pending;
    el('level').style.transform = 'translate(-50%, -50%) rotate(' + tilt + 'deg)';
    el('level').classList.toggle('sc-straight',Math.abs(tilt)<2);
    el('level').title = t('Nachylenie','Tilt')+' '+Math.round(tilt)+'°';
  }
  async function toggleLevel() {
    if (levelActive) { stopLevel(); return; }
    const sensor = window.DeviceOrientationEvent;
    if (!sensor || (sensor.requestPermission && await sensor.requestPermission() !== 'granted')) {
      status(t('Poziomica wymaga dostępu do czujnika orientacji.', 'Allow access to the orientation sensor to use the level.')); return;
    }
    if (closed || document.hidden) return;
    levelActive = true;
    window.addEventListener('deviceorientation',orient);
    $('[data-sc-action="level"]')?.setAttribute('aria-pressed','true');
    status(t('Poziomica pojawi się po otrzymaniu pomiaru z urządzenia.', 'The level will appear when the device reports its orientation.'));
  }
  function stopCamera() {
    streamEpoch++; requestBusy = false;
    const old = stream;
    stream = null;
    old?.getTracks().forEach(track=>track.stop());
    video.srcObject = null;
    stopLevel();
  }
  async function startCamera() {
    if (stream || requestBusy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status(t('Podgląd na żywo jest niedostępny. Wybierz aparat urządzenia lub zdjęcie z galerii.','Live preview is unavailable. Use the device camera or choose a photo.')); return;
    }
    requestBusy = true;
    const epoch = ++streamEpoch;
    actions();
    status(t('Zezwól na użycie tylnego aparatu.', 'Allow access to the rear camera.'));
    try {
      const next = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:sizes.width},height:{ideal:sizes.height}}});
      if (closed || document.hidden || epoch !== streamEpoch) { next.getTracks().forEach(track=>track.stop()); return; }
      stream = next; video.srcObject = next;
      await video.play();
      if (closed || epoch !== streamEpoch) return;
      const track = next.getVideoTracks()[0];
      const zoom = track?.getCapabilities?.().zoom;
      if (zoom?.min <= 1 && zoom?.max >= 1) {
        try { await track.applyConstraints({advanced:[{zoom:1}]}); } catch { /* Camera still usable at its default zoom. */ }
      }
      if (closed || epoch !== streamEpoch) return;
      if (track) listen(track,'ended',()=>{ if (stream===next) {stopCamera(); redraw(); status(t('Aparat rozłączony. Możesz go uruchomić ponownie.', 'Camera disconnected. You can restart it.'));} });
      status(t('Dopasuj pojazd do konturu i wykonaj zdjęcie.', 'Align the vehicle to the outline and take the photo.'));
    } catch {
      if (epoch === streamEpoch && !closed) {
        stopCamera();
        status(t('Brak dostępu do podglądu. Użyj aparatu urządzenia lub wybierz zdjęcie.', 'Camera preview is unavailable. Use the device camera or choose a photo.'));
      }
    } finally {
      if (epoch === streamEpoch) requestBusy = false;
      redraw();
    }
  }
  function showPending(item) {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    pending = item;
    pendingUrl = item ? URL.createObjectURL(item.file) : '';
    if (pending) el('level').hidden = true;
  }
  async function discardPending() {
    if (!pending || busy) return;
    busy = true; actions();
    try {
      if (pending.durable !== false) await pendingRecord(target,'remove',pending);
      showPending(null);
      status(t('Możesz ponownie wykonać ujęcie.', 'You can take this shot again.'));
    } finally { busy=false; redraw(); }
  }
  function warningText(item) {
    return (item.warnings || []).filter(key=>qualityWarningLabels[key]).map(key=>pick(qualityWarningLabels[key])).join(' · ');
  }
  function afterSaved() {
    const step = current();
    const placed = match(step);
    lastCapture = placed ? {key:step.id,id:placed.id,mode} : null;
    advance(); redraw();
    status(allDone() ? t('Sesja zakończona. Zdjęcia są w ogłoszeniu.', 'Session complete. The photos are in the listing.') :
      doneLabel + ' · ' + pick(step.label));
  }
  async function sendPending() {
    if (!pending || busy) return;
    const item = pending;
    busy=true; actions();
    status(t('Zapisywanie zdjęcia…','Saving photo…'));
    try {
      await bridge.save(item);
      await cacheMedia();
      const placed = match(current());
      if (placed && item.fingerprint) fingerprints[placed.id] = item.fingerprint;
      if (item.durable !== false) await pendingRecord(target,'remove',item);
      showPending(null);
      afterSaved();
    } catch (error) {
      if (!closed) status(t('Ujęcie oczekuje na zapis. Ponów zapis.','Shot awaiting upload. Retry saving.') + (error?.message ? ' '+error.message : ''));
    } finally { busy=false; redraw(); }
  }
  async function acquire(file) {
    if (busy || pending) return;
    busy=true; actions();
    status(t('Sprawdzanie zdjęcia…','Checking photo…'));
    let send = false;
    try {
      if (file && file.size > 45*1024*1024) throw new Error(t('Wybierz zdjęcie mniejsze niż 45 MB.','Select a photo smaller than 45 MB.'));
      const image = file ? await cleanFile(file) : await canvasFile(video,video.videoWidth,video.videoHeight);
      const replaceId = match(current())?.id;
      const liveIds = new Set([...media.photos,...media.spin].map(item=>item.id));
      fingerprints = Object.fromEntries(Object.entries(fingerprints).filter(([id])=>liveIds.has(id)));
      const knownFingerprints = Object.entries(fingerprints).filter(([id])=>id!==replaceId).map(([,value])=>value);
      let report;
      try { report = await inspectPhoto(image,{knownFingerprints}); } catch { /* Manual review remains possible. */ }
      if (closed) return;
      const item={file:image,mode,key:current().id,angle:current().angle,count:mode==='spin'?count:undefined,replaceId,
        captureId:newCaptureId(),fingerprint:report?.fingerprint,warnings:report?.warnings||[]};
      try { await pendingRecord(target,'write',item); }
      catch (error) {
        if (error?.name==='AbortError' || error?.message==='Storage busy') throw new Error(t('Inne okno ma oczekujące ujęcie. Zapisz je lub powtórz w tamtym oknie.', 'Another window has a pending capture. Save or retake it in that window.'));
        item.durable=false;
      }
      if (closed) return;
      showPending(item);
      send = !!report && !item.warnings.length;
      if (!send) status((warningText(item) || t('Sprawdź podgląd zdjęcia.', 'Review the photo.'))+' '+t('Możesz zapisać ujęcie lub wykonać je ponownie.','Save the shot or retake it.'));
    } finally { busy=false; redraw(); }
    if (send) await sendPending();
  }
  let confirmReuse = false;
  async function reuse() {
    const photo = media.photos.find(item=>item.angle===current().angle);
    if (!photo) return;
    if (!confirmReuse) {
      confirmReuse=true;
      status(t('Upewnij się, że pozycja auta, odległość i wysokość aparatu pasują do tej serii.', 'Check that the vehicle position, distance and camera height match this series.'));
      actions(); return;
    }
    busy=true; actions();
    try {
      await bridge.reuse({id:photo.id,angle:current().angle,count,replaceId:match(current())?.id,captureId:newCaptureId()});
      await cacheMedia(); afterSaved();
    } finally { confirmReuse=false; busy=false; redraw(); }
  }
  async function toggleSkip() {
    const key = current().id, next = new Set(skipped);
    const restoring = next.has(key);
    if (restoring) next.delete(key); else next.add(key);
    busy=true; actions();
    try {
      await bridge.updateProgress({skipped:[...next]});
      await cacheMedia(); if (!restoring) advance(); else storeState();
      status(restoring ? t('Przywrócono ujęcie.','Shot restored.') : t('Pominięto ujęcie.','Shot skipped.'));
    } finally { busy=false; redraw(); }
  }
  async function changeMode(next) {
    storeState(); confirmReuse=false; mode=next;
    selectIndex(cursor[mode]); status(''); redraw();
  }
  async function changeCount(value) {
    const next=Number(value);
    if (!allowedCounts.includes(next) || hasSession() || legacySpin()) return;
    busy=true; actions();
    try {
      await bridge.updateProgress({spinCount:next});
      await cacheMedia(); count=next; selectIndex(); storeState(); status('');
    } finally { busy=false; redraw(); }
  }
  function goTo(next) {
    if (busy || pending || requestBusy || next<0 || next>=plan().length || !Number.isInteger(next)) return;
    confirmReuse=false; index=next; storeState(); status(''); redraw();
  }
  let showGallery=false, ownsFullscreen=false;
  function chooseFullscreen(on) {
    dialog.classList.toggle('sc-fullscreen',on);
    const control=$('[data-sc-action="fullscreen"]');
    control.setAttribute('aria-pressed',String(on));
    control.textContent=on?t('Zamknij pełny ekran','Exit full screen'):t('Pełny ekran','Full screen');
    updateFit();
  }
  async function toggleFullscreen() {
    const on = !dialog.classList.contains('sc-fullscreen');
    chooseFullscreen(on);
    try {
      if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        ownsFullscreen=true;
        if (closed) await document.exitFullscreen();
      } else if (!on && ownsFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch { /* The dialog already fills the visual viewport on browsers without fullscreen. */ }
  }
  listen(document,'fullscreenchange',()=>{
    if (ownsFullscreen && !document.fullscreenElement) {ownsFullscreen=false; chooseFullscreen(false);}
  });
  async function act(action) {
    if (action==='close') { dialog.close(); return; }
    if (busy || requestBusy || (pending && !['send','discard'].includes(action))) return;
    if (action!=='reuse') confirmReuse=false;
    switch (action) {
      case 'guided': case 'spin': await changeMode(action); break;
      case 'start': await startCamera(); break;
      case 'capture': await acquire(); break;
      case 'stop': stopCamera(); status(''); redraw(); break;
      case 'native': case 'file': el(action).click(); break;
      case 'send': await sendPending(); break;
      case 'discard': await discardPending(); break;
      case 'reuse': await reuse(); break;
      case 'retake': goTo(plan().findIndex(s=>s.id===lastCapture?.key)); break;
      case 'skip': await toggleSkip(); break;
      case 'level': await toggleLevel(); break;
      case 'gallery': showGallery=true; dialog.close(); break;
      case 'fullscreen': await toggleFullscreen(); break;
    }
  }
  function report(error) {
    if (!closed) status(error?.message || t('Operacja nie powiodła się. Ponów próbę.', 'Operation failed. Try again.'));
  }
  // Keep this listing's bridge alive until its save finishes, even if the seller
  // closes the dialog. A freshly opened studio must read the acknowledged state.
  const writes = new Set();
  function trackWrite(operation) {
    writes.add(operation);
    void operation.catch(report).finally(()=>writes.delete(operation));
  }
  listen(dialog,'click',event=>{
    const angle=event.target.closest('[data-camera-angle]');
    if (angle) { goTo(plan().findIndex(s=>s.angle===Number(angle.dataset.cameraAngle))); return; }
    const item=event.target.closest('[data-sc-index]');
    if (item) { goTo(Number(item.dataset.scIndex)); return; }
    const trigger=event.target.closest('[data-sc-action]');
    if (!trigger) return;
    const action = trigger.dataset.scAction;
    const operation = act(action);
    if (['capture','send','discard','reuse','skip'].includes(action)) trackWrite(operation);
    else void operation.catch(report);
  });
  listen(dialog,'keydown',event=>{
    const angle=event.target.closest('[data-camera-angle]');
    if (angle && ['Enter',' '].includes(event.key)) {
      event.preventDefault(); goTo(plan().findIndex(s=>s.angle===Number(angle.dataset.cameraAngle)));
    }
  });
  listen(dialog,'change',event=>{
    const node=event.target;
    if (node===el('native') || node===el('file')) {
      const file = node.files?.[0]; node.value='';
      if (file) trackWrite(acquire(file));
    } else if (node===el('spin-count')) {
      trackWrite(changeCount(node.value));
    } else if (node===el('profile')) {
      override=Object.hasOwn(profiles,node.value)?node.value:''; storeState(); redraw();
    } else if (node===el('show-grid') || node===el('show-outline')) {
      contourOn=el('show-outline').checked; gridOn=el('show-grid').checked; storeState(); updateGuide();
    }
  });
  listen(dialog,'input',event=>{
    if (event.target===el('scale') || event.target===el('opacity')) {
      scale=Number(el('scale').value); opacity=Number(el('opacity').value);
      el('outline').style.opacity=opacity/100;
      el('outline').style.transform='scale('+scale/100+')'; storeState();
    }
  });
  listen(video,'loadedmetadata',updateFit);
  listen(video,'resize',updateFit);
  listen(window,'resize',updateFit);
  listen(document,'visibilitychange',()=>{ if(document.hidden) {stopCamera(); redraw();} });
  listen(window,'pagehide',()=>{stopCamera();});
  const resize=typeof ResizeObserver==='function' ? new ResizeObserver(updateFit) : null;
  resize?.observe(el('stage'));
  const finished = new Promise(resolve=>{
    listen(dialog,'close',async()=>{
      closed=true; storeState(); stopCamera(); resize?.disconnect(); events.abort();
      if (ownsFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(()=>{});
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      dialog.remove();
      await Promise.allSettled([...writes]);
      activeDialog=null;
      if (showGallery) bridge.showGallery?.(); else previousFocus?.focus?.({preventScroll:true});
      resolve();
    });
  });
  try {
    await cacheMedia();
    const jump={interior:'cockpit',equipment:'equipment',damage:'damage'}[options.mode];
    selectIndex(jump || cursor[mode]);
    let item;
    try { item=await pendingRecord(target,'read'); } catch { /* Browsers may disable IndexedDB. */ }
    if (item?.file instanceof Blob && ['guided','spin'].includes(item.mode)) {
      mode=item.mode;
      if (mode==='spin' && allowedCounts.includes(item.count)) count=item.count;
      selectIndex(item.key); showPending(item);
      status(t('Oczekujące ujęcie. Sprawdź podgląd i ponów zapis.','Pending capture. Review it and retry saving.')+' '+warningText(item));
    }
    document.body.append(dialog);
    dialog.showModal(); redraw();
    if (options.mode==='guide') el('guide').scrollIntoView({block:'nearest'});
    if (['guided','spin'].includes(options.mode) && !pending) void startCamera();
    return await finished;
  } catch (error) {
    closed=true; stopCamera(); resize?.disconnect(); events.abort();
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    dialog.remove(); activeDialog=null; throw error;
  }
}
