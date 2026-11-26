const feed = document.querySelector('[data-reels-scroll]');
const viewport = window.visualViewport;
if (viewport) {
  const frame = feed.closest('.reels-viewport');
  function fitVisibleViewport() {
    if (viewport.scale === 1) {
      frame.style.setProperty('--reels-visible-height', viewport.height + 'px');
    }
  }
  viewport.addEventListener('resize', fitVisibleViewport);
  fitVisibleViewport();
}
const stepper = document.querySelector('[data-reels-stepper]');
const slides = Array.from(feed.querySelectorAll('[data-reel-slide]'));
const previous = stepper.querySelector('[data-reels-prev]');
const next = stepper.querySelector('[data-reels-next]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const photoNavigation = new WeakMap();
const panelNavigation = new WeakMap();
const reelInfoTimers = new WeakMap();
const reelPanelTimers = new WeakMap();
let activeSlide;
let photoHintShown = false;

function bindHint(controls) {
  const hint = controls.querySelector('[data-reel-control-hint]');
  let timeout;

  function show() {
    if (!controls.getClientRects().length) return false;
    clearTimeout(timeout);
    hint.hidden = false;
    timeout = setTimeout(() => { hint.hidden = true; }, 3000);
    return true;
  }

  controls.addEventListener('pointerenter', show);
  controls.addEventListener('focusin', show);
  return show;
}

function showPhotoHint() {
  if (photoHintShown) return;
  photoHintShown = photoNavigation.get(activeSlide)?.showHint() || false;
}

function setReelInfo(slide, hidden, schedule = false) {
  const info = slide?.querySelector('[data-reel-info]');
  const tab = slide?.querySelector('[data-reel-info-tab]');
  const cue = slide?.querySelector('[data-reel-details-cue]');
  if (!info || !tab) return;
  clearTimeout(reelInfoTimers.get(slide));
  info.classList.toggle('is-hidden', hidden);
  tab.classList.toggle('is-visible', hidden);
  cue?.classList.toggle('is-visible', hidden);
  tab.setAttribute('aria-expanded', String(!hidden));
  if (!hidden && schedule && !reducedMotion.matches) {
    reelInfoTimers.set(slide, setTimeout(() => setReelInfo(slide, true), 6500));
  }
}

function showReelInfo(slide) {
  if (slide?.matches('[data-photo-reel]')) setReelInfo(slide, false, true);
}

function showPanelControls(slide, schedule = true) {
  const controls = slide?.querySelector('[data-reel-panel-controls]');
  if (!controls) return;
  clearTimeout(reelPanelTimers.get(slide));
  controls.classList.remove('is-hidden');
  if (schedule && !reducedMotion.matches) {
    reelPanelTimers.set(slide, setTimeout(() => controls.classList.add('is-hidden'), 3000));
  }
}

function index() {
  return Math.max(0, Math.min(slides.length - 1, Math.round(feed.scrollTop / Math.max(1, feed.clientHeight))));
}

function update() {
  const current = index();
  previous.disabled = current === 0;
  next.disabled = current === slides.length - 1;
  const slide = slides[current];
  if (slide !== activeSlide) {
    activeSlide?.querySelector('video')?.pause();
    activeSlide = slide;
    showReelInfo(slide);
    showPanelControls(slide);
  }
  showPhotoHint();
}

function move(delta) {
  const target = slides[index() + delta];
  if (!target) return;
  feed.scrollTo({
    top: (index() + delta) * feed.clientHeight,
    behavior: reducedMotion.matches ? 'instant' : 'smooth'
  });
}

previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
feed.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', update);
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.('input, textarea, select, [contenteditable], video')) return;

  switch (event.key) {
    case 'ArrowDown':
    case 'PageDown':
      event.preventDefault();
      move(1);
      break;
    case 'ArrowUp':
    case 'PageUp':
      event.preventDefault();
      move(-1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight': {
      const navigation = panelNavigation.get(slides[index()]) || photoNavigation.get(slides[index()]);
      if (!navigation?.controls.getClientRects().length) return;
      event.preventDefault();
      navigation.move(event.key === 'ArrowRight' ? 1 : -1);
      break;
    }
  }
});

for (const slide of feed.querySelectorAll('[data-photo-reel]')) {
  const info = slide.querySelector('[data-reel-info]');
  const tab = slide.querySelector('[data-reel-info-tab]');
  if (!info || !tab) continue;
  const toggle = () => {
    const wasHidden = info.classList.contains('is-hidden');
    setReelInfo(slide, !wasHidden, wasHidden);
  };
  tab.addEventListener('click', event => {
    event.stopPropagation();
    setReelInfo(slide, !info.classList.contains('is-hidden'), info.classList.contains('is-hidden'));
  });
  info.addEventListener('click', event => {
    if (event.target.closest('a,button,input,label')) return;
    setReelInfo(slide, true);
  });
  info.addEventListener('keydown', event => {
    if (event.target !== info || !['Enter',' '].includes(event.key)) return;
    event.preventDefault();
    toggle();
  });
}

for (const track of feed.querySelectorAll('[data-reel-panel-track]')) {
  const slide = track.closest('[data-reel-slide]');
  const panels = Array.from(track.querySelectorAll('[data-reel-panel]'));
  const controls = slide.querySelector('.reel-panel-controls');
  const previousPanel = slide.querySelector('[data-reel-panel-prev]');
  const nextPanel = slide.querySelector('[data-reel-panel-next]');
  const count = slide.querySelector('[data-reel-panel-count]');
  const currentPanel = () => Math.max(0, Math.min(panels.length - 1,
    Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));

  function updatePanels() {
    const current = currentPanel();
    previousPanel.disabled = current === 0;
    nextPanel.disabled = current === panels.length - 1;
    count.textContent = (current + 1) + ' / ' + panels.length;
    panels.forEach((panel,index) => {
      panel.toggleAttribute('data-reel-panel-active', index === current);
      if (index !== current) panel.querySelectorAll('video').forEach(video => video.pause());
    });
  }

  function movePanel(delta) {
    const target = Math.max(0, Math.min(panels.length - 1, currentPanel() + delta));
    track.scrollTo({left: target * track.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    showPanelControls(slide);
  }

  panelNavigation.set(slide, {controls, move: movePanel});
  slide.querySelector('[data-reel-details-cue]')?.addEventListener('click', () => movePanel(1));
  previousPanel.addEventListener('click', () => movePanel(-1));
  nextPanel.addEventListener('click', () => movePanel(1));
  controls.addEventListener('pointerenter', () => showPanelControls(slide));
  controls.addEventListener('focusin', () => showPanelControls(slide));
  track.addEventListener('pointerdown', () => showPanelControls(slide));
  track.addEventListener('scroll', updatePanels, {passive:true});
  window.addEventListener('resize', updatePanels);
  updatePanels();
}

if (feed.querySelector('[data-spin-frames]')) {
  import('./spin-viewer.js?v=1').then(({bindSpinViewers})=>bindSpinViewers(feed));
}

for (const slide of feed.querySelectorAll('[data-photo-reel]:has(.reel-photo-controls)')) {
  const gallery = slide.querySelector('.reel-photo-stack');
  const controls = slide.querySelector('.reel-photo-controls');
  const previousPhoto = slide.querySelector('[data-reel-photo-prev]');
  const nextPhoto = slide.querySelector('[data-reel-photo-next]');
  const count = slide.querySelector('[data-reel-photo-count]');
  const total = gallery.children.length;
  const pageTotal = () => {
    const size = Number(getComputedStyle(gallery).getPropertyValue('--reel-photo-page-size')) || 1;
    return Math.ceil(total / size);
  };
  const photoIndex = () => Math.max(0,
    Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth)));

  function updatePhotos() {
    const pages = pageTotal();
    const current = Math.min(pages - 1, photoIndex());
    previousPhoto.disabled = current === 0;
    nextPhoto.disabled = current === pages - 1;
    const position = (current + 1) + ' / ' + pages;
    if (count.textContent !== position) count.textContent = position;
  }

  function movePhoto(delta) {
    const target = Math.max(0, Math.min(pageTotal() - 1, photoIndex() + delta));
    gallery.scrollTo({
      left: target * gallery.clientWidth,
      behavior: reducedMotion.matches ? 'instant' : 'smooth'
    });
  }

  photoNavigation.set(slide, {controls, move: movePhoto, showHint: bindHint(controls)});
  previousPhoto.addEventListener('click', () => movePhoto(-1));
  nextPhoto.addEventListener('click', () => movePhoto(1));
  gallery.addEventListener('scroll', updatePhotos, { passive: true });
  window.addEventListener('resize', updatePhotos);
  updatePhotos();
}

stepper.hidden = slides.length < 2;
bindHint(stepper)();
update();
