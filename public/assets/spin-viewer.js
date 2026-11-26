// A viewer only holds its displayed photograph and two adjacent frames.
function mountSpin(viewer) {
  const frames=JSON.parse(viewer.dataset.spinFrames);
  const find=name=>viewer.querySelector('[data-spin-'+name+']');
  const stage=viewer.querySelector('.spin-stage');
  const image=find('image'),range=find('range'),position=find('position'),error=find('error');
  const play=find('play'),zoom=find('zoom'),fullscreen=find('fullscreen');
  const neighbors=new Map();
  let current=0,drag=null,timer=null,active=false,dialog=null,zoomed=false;
  const wrap=index=>(index%frames.length+frames.length)%frames.length;
  const expanded=()=>document.fullscreenElement===viewer || !!dialog;
  function source(index) {
    const frame=frames[index];
    const small=!zoomed && !expanded() && stage.clientWidth*(window.devicePixelRatio||1)<=480;
    return small && frame.thumb ? frame.thumb : frame.url;
  }
  function showFrame(index) {
    current=wrap(index);
    if (active && image.getAttribute('src')!==source(current)) {
      error.hidden=true;
      image.src=source(current);
    }
    range.value=String(current+1);
    position.textContent=(current+1)+' / '+frames.length;
  }
  image.addEventListener('load',()=>{
    if (!active) return;
    const adjacent=[source(wrap(current-1)),source(wrap(current+1))];
    for (const url of neighbors.keys()) if (!adjacent.includes(url)) neighbors.delete(url);
    for (const url of adjacent) {
      if (neighbors.has(url)) continue;
      const preload=new Image();
      preload.decoding='async';
      preload.src=url;
      neighbors.set(url,preload);
    }
  });
  image.addEventListener('error',()=>{
    if (!active) return;
    if (image.getAttribute('src')!==frames[current].url) image.src=frames[current].url;
    else { error.hidden=false; stop(); }
  });
  function stop() {
    clearInterval(timer);
    timer=null;
    play.setAttribute('aria-pressed','false');
  }
  function manual(index) { stop(); showFrame(index); }
  function setZoom(on) {
    zoomed=on;
    zoom.setAttribute('aria-pressed',String(on));
    stage.classList.toggle('is-zoomed',on);
    showFrame(current);
  }
  play.addEventListener('click',()=>{
    if (timer!==null) return stop();
    play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>{
      if (document.hidden || !active) return stop();
      if (image.complete) showFrame(current+1);
    },180);
  });
  zoom.addEventListener('click',()=>setZoom(!zoomed));
  find('reset').addEventListener('click',()=>{stop(); current=0; setZoom(false);});
  find('prev').addEventListener('click',()=>manual(current-1));
  find('next').addEventListener('click',()=>manual(current+1));
  range.addEventListener('input',()=>manual(Number(range.value)-1));
  viewer.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.stopPropagation();
    if (event.target===range) return;
    event.preventDefault();
    manual(current+(event.key==='ArrowLeft'?-1:1));
  });
  stage.addEventListener('pointerdown',event=>{
    if (!event.isPrimary || event.button!==0) return;
    event.stopPropagation();
    stop();
    drag={id:event.pointerId,x:event.clientX,frame:current};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if (drag?.id!==event.pointerId) return;
    event.stopPropagation();
    const step=Math.max(8,Math.min(48,stage.clientWidth/frames.length));
    const index=wrap(drag.frame+Math.trunc((drag.x-event.clientX)/step));
    if (index!==current) showFrame(index);
  });
  stage.addEventListener('lostpointercapture',()=>{drag=null;});
  function syncFullscreen() {
    fullscreen.setAttribute('aria-pressed',String(expanded()));
    showFrame(current);
  }
  viewer.addEventListener('fullscreenchange',syncFullscreen);
  fullscreen.addEventListener('click',async()=>{
    if (dialog) return dialog.close();
    if (document.fullscreenElement===viewer) return document.exitFullscreen();
    if (document.fullscreenEnabled && viewer.requestFullscreen) {
      try { await viewer.requestFullscreen(); return; }
      catch { /* Embedded pages and iOS can restrict native fullscreen. */ }
    }
    const anchor=document.createComment('spin');
    viewer.before(anchor);
    dialog=document.createElement('dialog');
    dialog.className='spin-dialog';
    dialog.setAttribute('aria-label',stage.getAttribute('aria-label'));
    document.body.append(dialog);
    dialog.append(viewer);
    dialog.addEventListener('close',()=>{
      anchor.replaceWith(viewer);
      dialog.remove();
      dialog=null;
      syncFullscreen();
      fullscreen.focus({preventScroll:true});
    },{once:true});
    dialog.showModal();
    syncFullscreen();
    fullscreen.focus();
  });
  return {
    enter() { active=true; showFrame(current); },
    leave() {
      active=false;
      stop();
      neighbors.clear();
      image.removeAttribute('src');
    }
  };
}

export function bindSpinViewers(root) {
  const viewers=root.querySelectorAll('[data-spin-frames]');
  if (!viewers.length) return;
  const mounted=new WeakMap();
  const visible=new Set();
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) {
      const viewer=entry.target;
      if (entry.isIntersecting && entry.intersectionRatio>0) {
        if (!mounted.has(viewer)) mounted.set(viewer,mountSpin(viewer));
        visible.add(viewer);
        if (!document.hidden) mounted.get(viewer).enter();
      } else if (visible.delete(viewer)) mounted.get(viewer).leave();
    }
  },{threshold:[0,0.01]});
  for (const viewer of viewers) observer.observe(viewer);
  document.addEventListener('visibilitychange',()=>{
    for (const viewer of visible) {
      if (document.hidden) mounted.get(viewer).leave();
      else mounted.get(viewer).enter();
    }
  });
}
