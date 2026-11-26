import { e, embed, icon, titleOf } from './ui.js';

export function spinViewer(ctx,offer) {
  const t=ctx.t;
  const action=(name,symbol,label,attributes='')=>`<button type="button" class="icon-button" data-spin-${name} aria-label="${e(label)}" title="${e(label)}" ${attributes}>${icon(symbol,19)}</button>`;
  const frames=offer.spin.map(({url,thumb})=>({url,thumb}));
  return `<div class="spin-viewer" data-spin-frames="${embed(frames)}">
    <div class="spin-stage" tabindex="0" role="region" aria-label="${t('Widok 360°. Przeciągnij lub użyj strzałek.','360° view. Drag or use the arrow keys.')}">
      <img data-spin-image alt="${e(titleOf(offer))} · ${t('widok 360°','360° view')}" draggable="false" decoding="async" width="960" height="540">
      <span class="spin-hint">${icon('rotate',17)}${t('Przeciągnij, aby obrócić','Drag to rotate')}</span>
      <span class="spin-error" data-spin-error hidden>${t('Nie udało się wczytać tego ujęcia.','This frame could not be loaded.')}</span>
    </div>
    <div class="spin-controls">
      ${action('prev','back',t('Poprzednia klatka','Previous frame'))}
      <input type="range" data-spin-range min="1" max="${frames.length}" value="1" aria-label="${t('Klatka widoku 360°','360° view frame')}">
      <span data-spin-position>1 / ${frames.length}</span>
      ${action('next','arrow',t('Następna klatka','Next frame'))}
    </div>
    <div class="spin-tools">
      <button type="button" class="icon-button" data-spin-play aria-pressed="false" aria-label="${t('Automatyczny obrót','Automatic rotation')}" title="${t('Automatyczny obrót','Automatic rotation')}">${icon('play',19)}${icon('pause',19)}</button>
      ${action('zoom','zoom',t('Powiększenie','Zoom'),'aria-pressed="false"')}
      ${action('fullscreen','expand',t('Pełny ekran','Full screen'),'aria-pressed="false"')}
      ${action('reset','rotate',t('Wróć do pierwszego ujęcia','Reset to the first view'))}
    </div>
  </div>`;
}
