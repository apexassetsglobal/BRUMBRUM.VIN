/* Owner-only service media exporter. All rendering and downloads happen on this device. */
const languages = ['pl','en','de','cs','sk','uk'];
const copy = {
  heading:['Materiały na Instagram i TikTok','Instagram and TikTok media','Medien für Instagram und TikTok','Materiály pro Instagram a TikTok','Materiály pre Instagram a TikTok','Матеріали для Instagram і TikTok'],
  empty:['Dodaj do profilu zdjęcie lub film z realizacji, aby przygotować materiał.','Add a project photo or video to your profile to create a post.','Fügen Sie Ihrem Profil ein Foto oder Video Ihrer Arbeit hinzu, um einen Beitrag zu erstellen.','Přidejte do profilu fotografii nebo video své práce a vytvořte příspěvek.','Pridajte do profilu fotografiu alebo video svojej práce a vytvorte príspevok.','Додайте до профілю фото або відео своєї роботи, щоб створити допис.'],
  choose:['Wybierz ujęcia','Choose shots','Aufnahmen wählen','Vyberte záběry','Vyberte zábery','Виберіть кадри'],
  format:['Grafika wykorzysta pierwsze wybrane ujęcie. Pionowy klip połączy do 8 ujęć w kolejności galerii.','The poster uses your first selected shot. The vertical clip combines up to 8 shots in gallery order.','Das Bild verwendet die erste gewählte Aufnahme. Der vertikale Clip kombiniert bis zu 8 Aufnahmen in Galeriereihenfolge.','Grafika použije první vybraný záběr. Svislý klip spojí až 8 záběrů v pořadí galerie.','Grafika použije prvý vybraný záber. Zvislý klip spojí až 8 záberov v poradí galérie.','Графіка використовує перший вибраний кадр. Вертикальний кліп об’єднає до 8 кадрів у порядку галереї.'],
  note:['Podpis na materiale','Caption on the media','Bildunterschrift','Popisek na materiálu','Popis na materiáli','Підпис на матеріалі'],
  image:['Zdjęcie','Photo','Foto','Fotografie','Fotografia','Фото'],
  video:['Film','Video','Video','Video','Video','Відео'],
  consent:['Mam prawa do wybranych materiałów i zgadzam się użyć ich do promocji firmy.','I hold the rights to the selected media and agree to use them to promote my business.','Ich besitze die Rechte an den gewählten Medien und stimme ihrer Nutzung zur Werbung für mein Unternehmen zu.','Mám práva k vybraným materiálům a souhlasím s jejich použitím k propagaci firmy.','Mám práva na vybrané materiály a súhlasím s ich použitím na propagáciu firmy.','Я маю права на вибрані матеріали й погоджуюся використати їх для просування компанії.'],
  poster:['Utwórz grafikę PNG','Create PNG poster','PNG-Grafik erstellen','Vytvořit grafiku PNG','Vytvoriť grafiku PNG','Створити графіку PNG'],
  clip:['Utwórz klip 9:16','Create 9:16 clip','9:16-Clip erstellen','Vytvořit klip 9:16','Vytvoriť klip 9:16','Створити кліп 9:16'],
  noClip:['Ta przeglądarka obsługuje eksport grafiki PNG.','This browser supports PNG export.','Dieser Browser unterstützt den PNG-Export.','Tento prohlížeč podporuje export PNG.','Tento prehliadač podporuje export PNG.','Цей браузер підтримує експорт PNG.'],
  preparing:['Przygotowywanie materiału…','Preparing media…','Medien werden vorbereitet…','Příprava materiálu…','Príprava materiálu…','Підготовка матеріалу…'],
  progress:['Tworzenie klipu','Creating clip','Clip wird erstellt','Vytváření klipu','Vytváranie klipu','Створення кліпу'],
  cancel:['Anuluj eksport','Cancel export','Export abbrechen','Zrušit export','Zrušiť export','Скасувати експорт'],
  cancelled:['Eksport anulowany.','Export cancelled.','Export abgebrochen.','Export zrušen.','Export zrušený.','Експорт скасовано.'],
  ready:['Plik jest gotowy.','Your file is ready.','Die Datei ist bereit.','Soubor je připraven.','Súbor je pripravený.','Файл готовий.'],
  failed:['Nie udało się odczytać materiału lub zapisać pliku. Wybierz dostępne ujęcie i ponów eksport.','The media could not be read or the file could not be created. Select an available shot and retry.','Die Medien konnten nicht gelesen oder gespeichert werden. Wählen Sie eine verfügbare Aufnahme und versuchen Sie es erneut.','Materiál nelze načíst nebo uložit. Vyberte dostupný záběr a zkuste export znovu.','Materiál sa nedá načítať alebo uložiť. Vyberte dostupný záber a export zopakujte.','Не вдалося прочитати матеріал або зберегти файл. Виберіть доступний кадр і повторіть експорт.'],
  download:['Pobierz','Download','Herunterladen','Stáhnout','Stiahnuť','Завантажити'],
  max:['Wybierz maksymalnie 8 ujęć.','Select up to 8 shots.','Wählen Sie höchstens 8 Aufnahmen.','Vyberte nejvýše 8 záběrů.','Vyberte najviac 8 záberov.','Виберіть до 8 кадрів.']
};
const posterWidth = 1080;
const posterHeight = 1920;
const maxShots = 8;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function ownMedia(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(item=>item && typeof item==='object').flatMap(item=>{
    const src=item.url||item.src;
    if(typeof src!=='string' || !src.trim()) return [];
    let url;
    try { url = new URL(src,location.href); } catch { return []; }
    const kind = item.kind || item.type || item.mime;
    const mediaType = kind==='video' || typeof kind==='string' && kind.startsWith('video/') ? 'video' :
      kind==='image' || kind==='photo' || typeof kind==='string' && kind.startsWith('image/') ? 'image' : '';
    if (!mediaType || !['https:','http:'].includes(url.protocol) || url.origin!==location.origin || url.username || url.password || seen.has(url.href)) return [];
    seen.add(url.href);
    return [{url:url.href,kind:mediaType,alt:typeof item.alt==='string'?item.alt.trim().slice(0,160):''}];
  });
}

function availableVideoTypes() {
  if (typeof MediaRecorder==='undefined' || !HTMLCanvasElement.prototype.captureStream) return [];
  return ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm']
    .filter(type=>MediaRecorder.isTypeSupported(type));
}

function waitForEvent(node, name, signal, timeoutMs = 15000) {
  return new Promise((resolve,reject)=>{
    const finish = issue=>{
      clearTimeout(timer);
      node.removeEventListener(name,loaded);
      node.removeEventListener('error',failed);
      signal?.removeEventListener('abort',aborted);
      issue ? reject(issue) : resolve();
    };
    const loaded=()=>finish();
    const failed=()=>finish(new Error('Unreadable media'));
    const aborted=()=>finish(new DOMException('Cancelled','AbortError'));
    const timer = setTimeout(failed,timeoutMs);
    node.addEventListener(name,loaded,{once:true});
    node.addEventListener('error',failed,{once:true});
    signal?.addEventListener('abort',aborted,{once:true});
    if (signal?.aborted) aborted();
  });
}

function releaseMedia(node) {
  if (node instanceof HTMLVideoElement) {
    node.pause();
    node.removeAttribute('src');
    node.load();
  } else node.removeAttribute('src');
}

async function loadMedia(shot, signal) {
  signal.throwIfAborted();
  const video = shot.kind==='video';
  const node=element(video?'video':'img');
  if (video) {
    node.muted=true;
    node.playsInline=true;
    node.preload='auto';
  }
  try {
    const ready=waitForEvent(node,video?'loadeddata':'load',signal);
    node.src=shot.url;
    await ready;
    // A later frame avoids a frequent blank opening frame in uploaded clips.
    if (video && Number.isFinite(node.duration) && node.duration>.24) {
      const sought=waitForEvent(node,'seeked',signal);
      node.currentTime=Math.min(.15,node.duration/3);
      await sought;
    }
    return node;
  } catch (error) {
    releaseMedia(node);
    throw error;
  }
}

function paintedLines(ctx, raw, x, y, width, lineHeight, maxLines) {
  const words=String(raw||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  let lines=[],line='';
  for (const word of words) {
    const trial=line?line+' '+word:word;
    if (line && ctx.measureText(trial).width>width) {lines.push(line);line='';}
    // Segment long company names or words that have no spaces.
    if (ctx.measureText(word).width>width) {
      for (const char of word) {
        if (line && ctx.measureText(line+char).width>width) {lines.push(line);line='';}
        line+=char;
      }
    } else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);
  if(lines.length>maxLines) {
    lines=lines.slice(0,maxLines);
    let last=lines[maxLines-1];
    while (last && ctx.measureText(last+'…').width>width) last=Array.from(last).slice(0,-1).join('');
    lines[maxLines-1]=last.trimEnd()+'…';
  }
  for (const [i,value] of lines.entries()) ctx.fillText(value,x,y+i*lineHeight);
  return y+lines.length*lineHeight;
}

function buildBackdrop(media) {
  const backdrop=element('canvas');
  backdrop.width=135;backdrop.height=240;
  const ctx=backdrop.getContext('2d',{alpha:false});
  const w=media.naturalWidth||media.videoWidth,h=media.naturalHeight||media.videoHeight;
  const scale=Math.max((backdrop.width+12)/w,(backdrop.height+12)/h);
  ctx.filter='blur(4px)';
  ctx.drawImage(media,(backdrop.width-w*scale)/2,(backdrop.height-h*scale)/2,w*scale,h*scale);
  ctx.filter='none';
  ctx.fillStyle='rgba(5,13,22,.73)';
  ctx.fillRect(0,0,backdrop.width,backdrop.height);
  return backdrop;
}

function paint(canvas, media, business, caption, backdrop) {
  const ctx=canvas.getContext('2d',{alpha:false});
  const w=media.naturalWidth||media.videoWidth, h=media.naturalHeight||media.videoHeight;
  if (!w || !h) throw new Error('No decoded frame');
  ctx.drawImage(backdrop,0,0,posterWidth,posterHeight);
  const frame={x:0,y:270,w:posterWidth,h:952};
  const ratio=Math.min(frame.w/w,frame.h/h),renderWidth=w*ratio,renderHeight=h*ratio;
  ctx.drawImage(media,(posterWidth-renderWidth)/2,frame.y+(frame.h-renderHeight)/2,renderWidth,renderHeight);
  const footer=ctx.createLinearGradient(0,1150,0,posterHeight);
  footer.addColorStop(0,'rgba(6,16,28,0)');footer.addColorStop(.3,'rgba(6,16,28,.86)');footer.addColorStop(1,'#06101c');
  ctx.fillStyle=footer;ctx.fillRect(0,1150,posterWidth,posterHeight-1150);
  ctx.fillStyle='#55bbff';ctx.fillRect(70,143,58,7);
  ctx.fillStyle='#ffffff';ctx.font='700 32px system-ui, sans-serif';
  ctx.fillText('BRUMBRUM.VIN',70,204);
  if(business.city) {
    ctx.fillStyle='#bae5ff';ctx.font='600 36px system-ui, sans-serif';
    paintedLines(ctx,business.city,70,1310,940,44,1);
  }
  ctx.fillStyle='#ffffff';ctx.font='750 72px system-ui, sans-serif';
  const next=paintedLines(ctx,business.name,70,1409,940,84,2);
  ctx.fillStyle='#e0eaf3';ctx.font='400 39px system-ui, sans-serif';
  paintedLines(ctx,caption,70,next+15,940,53,3);
  if(business.displayUrl) {
    ctx.font='500 31px system-ui, sans-serif';ctx.fillStyle='#91cfff';
    paintedLines(ctx,business.displayUrl,70,1825,940,39,1);
  }
}

function newCanvas() {
  const canvas=document.createElement('canvas');
  canvas.width=posterWidth;canvas.height=posterHeight;
  return canvas;
}

async function makePoster(shot,business,caption,signal) {
  const media=await loadMedia(shot,signal);
  try {
    const canvas=newCanvas();
    paint(canvas,media,business,caption,buildBackdrop(media));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    signal.throwIfAborted();
    if (!blob?.size) throw new Error('PNG encoder unavailable');
    return blob;
  } finally {releaseMedia(media);}
}

async function makeClip(shots,business,caption,signal,onShot) {
  const canvas=newCanvas(), nodes=[];
  let recorder,stream,finished;
  try {
    // Check every selected asset before starting a recording; a failed shot should be repairable.
    for(const shot of shots) nodes.push(await loadMedia(shot,signal));
    let backdrop=buildBackdrop(nodes[0]);
    paint(canvas,nodes[0],business,caption,backdrop);
    stream=canvas.captureStream(24);
    for(const mimeType of availableVideoTypes()) {
      try {recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:5500000});break;} catch {}
    }
    if (!recorder) throw new Error('Video encoder unavailable');
    const chunks=[];
    recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data);});
    finished=waitForEvent(recorder,'stop',signal,45000);
    // A media/error event can occur before the last animation frame.
    finished.catch(()=>{});
    recorder.start(200);
    for(const [index,node] of nodes.entries()) {
      signal.throwIfAborted();
      onShot(index+1,nodes.length);
      if(index) backdrop=buildBackdrop(node);
      let seconds=2.35;
      if(node instanceof HTMLVideoElement) {
        if(Number.isFinite(node.duration)) seconds=Math.max(.25,Math.min(3.1,node.duration-node.currentTime));
        await node.play();
      }
      const start=performance.now();
      await new Promise((resolve,reject)=>{
        let animation,timer,lastFrame=-Infinity;
        function finish(error) {
          clearTimeout(timer);cancelAnimationFrame(animation);signal.removeEventListener('abort',abort);
          if(error) reject(error);else resolve();
        }
        const abort=()=>finish(new DOMException('Cancelled','AbortError'));
        const frame=()=>{
          if(signal.aborted) {abort();return;}
          try {
            if(recorder.state!=='recording') throw new Error('Recording interrupted');
            const now=performance.now();
            if(now-lastFrame>=1000/24-1) {
              paint(canvas,node,business,caption,backdrop);
              lastFrame=now;
            }
            if(now-start>=seconds*1000) finish();
            else animation=requestAnimationFrame(frame);
          } catch(error) {finish(error);}
        };
        timer=setTimeout(()=>finish(new Error('Recording interrupted')),10000);
        signal.addEventListener('abort',abort,{once:true});
        frame();
      });
      if(node instanceof HTMLVideoElement) node.pause();
    }
    recorder.stop();
    await finished;
    const blob=new Blob(chunks,{type:recorder.mimeType});
    if (!blob.size) throw new Error('Empty recording');
    return blob;
  } finally {
    if (recorder && recorder.state!=='inactive') recorder.stop();
    stream?.getTracks().forEach(track=>track.stop());
    nodes.forEach(releaseMedia);
  }
}

function mount(root) {
  let data;
  try { data=JSON.parse(root.getAttribute('data-services-promo')); } catch { return; }
  if (!data || typeof data.name!=='string' || !data.name.trim()) return;
  const language=(data.lang||document.documentElement.lang||'pl').slice(0,2);
  const index=languages.includes(language)?languages.indexOf(language):1;
  const t=key=>copy[key][index];
  const media=ownMedia(data.media);
  let displayUrl='';
  try {
    const url=new URL(data.url,location.origin);
    if(data.url && ['http:','https:'].includes(url.protocol) && !url.username && !url.password) displayUrl=url.hostname+url.pathname.replace(/\/$/,'');
  } catch {}
  const business={name:data.name.slice(0,160),city:String(data.city||'').slice(0,100),displayUrl};
  root.classList.add('services-promo');
  root.append(element('h2','',t('heading')));
  if(!media.length) { root.append(element('p','muted',t('empty')));return; }
  const shots=element('fieldset','promo-shots'),options=element('div','promo-options');
  shots.append(element('legend','',t('choose')),element('p','muted',t('format')),options);
  const checks=media.map((shot,i)=>{
    const label=element('label','promo-pick'),input=element('input');
    input.type='checkbox';input.checked=i<Math.min(3,maxShots);
    const title=shot.alt||t(shot.kind==='image'?'image':'video')+' '+(i+1);
    label.append(input);
    if(shot.kind==='image') {
      const thumb=element('img','promo-shot-thumb');thumb.src=shot.url;thumb.alt='';thumb.loading='lazy';thumb.decoding='async';
      label.append(thumb);
    }
    label.append(element('span','',title));options.append(label);return input;
  });
  const captionLabel=element('label','promo-caption',t('note')),caption=element('textarea');
  caption.maxLength=180;caption.rows=2;caption.value=String(data.description||'').slice(0,180);
  captionLabel.append(caption);
  const grant=element('label','promo-grant'),consent=element('input');
  consent.type='checkbox';grant.append(consent,element('span','',t('consent')));
  const controls=element('div','promo-actions');
  const poster=element('button','btn primary',t('poster')),clip=element('button','btn',t('clip')),cancel=element('button','btn',t('cancel'));
  for(const button of [poster,clip,cancel])button.type='button';
  cancel.hidden=true;
  const videoSupported=availableVideoTypes().length>0;
  controls.append(poster);
  if(videoSupported)controls.append(clip);
  controls.append(cancel);
  if(!videoSupported)controls.append(element('small','muted',t('noClip')));
  const status=element('p','promo-status');status.setAttribute('role','status');
  const output=element('div','promo-output');output.hidden=true;
  root.append(shots,captionLabel,grant,controls,status,output);
  let controller=null,resultUrl='';
  const selected=()=>media.filter((_,i)=>checks[i].checked);
  function resetOutput() {
    if(resultUrl)URL.revokeObjectURL(resultUrl);
    resultUrl='';output.replaceChildren();output.hidden=true;
  }
  function updateControls() {
    const valid=consent.checked&&selected().length>0&&!controller;
    poster.disabled=!valid;clip.disabled=!valid;
    cancel.hidden=!controller;
    shots.disabled=Boolean(controller);caption.disabled=Boolean(controller);
  }
  function clear() {
    controller?.abort();resetOutput();status.textContent='';updateControls();
  }
  checks.forEach(input=>input.addEventListener('change',()=>{
    clear();
    if(selected().length>maxShots) {input.checked=false;status.textContent=t('max');updateControls();}
  }));
  caption.addEventListener('input',clear);
  consent.addEventListener('change',clear);
  cancel.addEventListener('click',()=>controller?.abort());
  const slug=business.name.normalize('NFKD').replace(/\p{Mark}+/gu,'').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu,'-').replace(/^-|-$/g,'').slice(0,64)||'firma';
  async function create(wantVideo) {
    if(controller || !consent.checked || !selected().length)return;
    const active=new AbortController();controller=active;
    resetOutput();updateControls();status.textContent=t('preparing');
    try {
      const shots=selected(),description=caption.value.trim();
      const blob=wantVideo?await makeClip(shots,business,description,active.signal,(i,n)=>{status.textContent=t('progress')+' · '+i+' / '+n;})
        :await makePoster(shots[0],business,description,active.signal);
      active.signal.throwIfAborted();
      resultUrl=URL.createObjectURL(blob);
      const ext=blob.type.startsWith('video/mp4')?'mp4':wantVideo?'webm':'png';
      const download=element('a','btn primary',t('download')+' '+ext.toUpperCase());
      download.href=resultUrl;download.download=slug+'-9x16.'+ext;
      const preview=element(wantVideo?'video':'img','promo-preview');preview.src=resultUrl;
      if(wantVideo){preview.controls=true;preview.playsInline=true;} else preview.alt=business.name;
      output.append(preview,download);output.hidden=false;status.textContent=t('ready');
    } catch(error) {status.textContent=active.signal.aborted?t('cancelled'):t('failed');}
    finally {controller=null;updateControls();}
  }
  poster.addEventListener('click',()=>create(false));
  clip.addEventListener('click',()=>create(true));
  window.addEventListener('pagehide',()=>{controller?.abort();resetOutput();});
  updateControls();
}

document.querySelectorAll('[data-services-promo]').forEach(mount);
