import { vehicleModels } from './vehicle-catalog.js';
import { marqueFiles } from './marque-files.js';
import { appleStartupImages } from './apple-startup.js';
import { brandLogoAsset, brandLogoIds } from './brand-logos.js';
import { id, isStaff, withAuthReturn } from './core.js';
import { buttonEmbroideryOptions, buttonFinishChoices, buttonFinishFields, buttonFinishPalettes, buttonFinishPresets, buttonFinishes, buttonHardwareChoices, buttonHardwareFields, carbonAndMetalFinishPresets, defaultButtonHardware, luxuryBrandPresetGroups, rollsRoyceFinishPresets } from './button-finishes.js';
import { options } from './data.js';
import { listingVideoLimit } from './listing-video-policy.js';
import { formatLocale, languages } from './i18n.js';
import { robotFrameControls } from './robot-appearance.js';

export const e = value => String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x]);
export function listingVideoLimitAttributes(t) {
  const message=t('Plik jest za duży. Wybierz film do {limit} MiB.','File too large. Choose a video up to {limit} MiB.',{limit:listingVideoLimit/1024**2});
  return `data-video-limit="${listingVideoLimit}" data-video-size-error="${e(message)}"`;
}

export const attr = e;
export const embed = data => e(JSON.stringify(data));
export const lang = (ctx,pair) => Array.isArray(pair) ? ctx.t(pair[0],pair[1]) : pair;
export const href = (ctx,path) => {
  const shared=/^\/(?:api|assets|asset|media|wideo|rolka|uslugi|moje-uslugi|moderacja-uslug|uslugi-media)(?:[/?#]|$)/.test(path)
    ||/^\/(?:moje-ogloszenia|administracja)\/import(?:[/?#]|$)/.test(path);
  const base=ctx.prefix+(ctx.robotics&&!shared&&!/^\/roboty(?:[/?#]|$)/.test(path)?'/roboty':'');
  return base+(path==='/'&&base?'':path);
};
export const iconPaths = {
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  home:'<path class="icon-body" d="m3.5 10.3 7.2-6a2 2 0 0 1 2.6 0l7.2 6v8.2a2 2 0 0 1-2 2h-4V15h-5v5.5h-4a2 2 0 0 1-2-2z"/>',
  grid:'<rect class="icon-body" x="3" y="3" width="7" height="7" rx="2"/><rect class="icon-detail" x="14" y="3" width="7" height="7" rx="2"/><rect class="icon-detail" x="3" y="14" width="7" height="7" rx="2"/><rect class="icon-body" x="14" y="14" width="7" height="7" rx="2"/>',
  search:'<circle class="icon-body" cx="10.5" cy="10.5" r="6.25"/><path class="icon-detail" d="m15 15 4.75 4.75"/>',
  star:'<path class="icon-body" d="m12 3 2.76 5.59 6.17.9-4.46 4.35 1.05 6.15L12 17.09l-5.52 2.9 1.05-6.15-4.46-4.35 6.17-.9L12 3z"/>',
  heart:'<path class="icon-body" d="M20.8 5.9a4.9 4.9 0 0 0-6.9 0L12 7.8l-1.9-1.9a4.9 4.9 0 0 0-6.9 6.9L12 21l8.8-8.2a4.9 4.9 0 0 0 0-6.9Z"/>',
  message:'<path class="icon-body" d="M7 4h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-4l-5 4v-4H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/><path class="icon-detail" d="M8 9h8m-8 4h5"/>',
  user:'<circle class="icon-body" cx="12" cy="7.5" r="3.5"/><path d="M5 20.5v-1a5.5 5.5 0 0 1 5.5-5.5h3a5.5 5.5 0 0 1 5.5 5.5v1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  listing:'<path d="M11 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h7.5l5 5v2m-5-7v5h5M8 10h2m-2 4h2"/><path class="icon-detail" d="M18.5 13v8m-4-4h8"/>',
  sliders:'<path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h4m4 0h8"/><g class="icon-detail"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></g>',
  pin:'<path class="icon-body" d="M19.5 10c0 5-7.5 10.5-7.5 10.5S4.5 15 4.5 10a7.5 7.5 0 1 1 15 0Z"/><circle class="icon-detail" cx="12" cy="10" r="2.4"/>',
  arrow:'<path d="M4.5 12h14.75m-5.5-5.5 5.5 5.5-5.5 5.5"/>',
  back:'<path d="M19.5 12H4.75m5.5-5.5L4.75 12l5.5 5.5"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  calendar:'<rect class="icon-body" x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M7.5 3.5v4m9-4v4m-13 3h17"/><path class="icon-detail" d="M8.5 14.5h2m3 0h2m-7 3h2"/>',
  gauge:'<path class="icon-body" d="M4.5 19a8.5 8.5 0 1 1 15 0z"/><path d="M6.75 14h1m4.25-5v1"/><path class="icon-detail" d="M12 15l4-4"/>',
  fuel:'<rect class="icon-body" x="5" y="4" width="9" height="17" rx="1.8"/><path d="M3.5 21h12M5 10.5h9"/><path class="icon-detail" d="M14 13h1.5a1.5 1.5 0 0 1 1.5 1.5v2.75a2 2 0 0 0 4 0V9l-3-3"/>',
  gear:'<path d="M5 6v6h14V6M12 6v12"/><g class="icon-detail"><circle cx="5" cy="4.5" r="1.5"/><circle cx="12" cy="4.5" r="1.5"/><circle cx="19" cy="4.5" r="1.5"/><circle cx="12" cy="19.5" r="1.5"/></g>',
  axle:'<rect class="icon-body" x="3" y="7" width="4" height="10" rx="1.6"/><rect class="icon-body" x="17" y="7" width="4" height="10" rx="1.6"/><path class="icon-detail" d="M7 12h10m-5-3v6"/>',
  scale:'<path d="M12 3.5V20m-6.5 0h13M4 6.5h16"/><path class="icon-detail icon-body" d="m6.5 6.5-3 6h6l-3-6Zm11 0-3 6h6l-3-6Z"/>',
  building:'<rect class="icon-body" x="5" y="3" width="14" height="18" rx="2"/><path class="icon-detail" d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-3 6v-3"/>',
  shield:'<path class="icon-body" d="M12 21.5s7-3 7-10.5V5l-7-2.5L5 5v6c0 7.5 7 10.5 7 10.5Z"/><path class="icon-detail" d="m9 12 2 2 4-4"/>',
  check:'<path d="m5 12 4 4 10-10"/>',
  image:'<rect class="icon-body" x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></g>',
  rotate:'<path d="M20 10a8 8 0 0 0-13.6-4L3.5 9m0-5v5h5m-4.5 5a8 8 0 0 0 13.6 4l2.9-3m0 5v-5h-5"/>',
  video:'<rect class="icon-body" x="3" y="5" width="18" height="14" rx="3"/><path class="icon-detail" d="m10 9 5 3-5 3V9Z"/>',
  play:'<path class="icon-body" d="M8 5.5a.7.7 0 0 1 1.1-.6l10 6.5a.7.7 0 0 1 0 1.2l-10 6.5a.7.7 0 0 1-1.1-.6z"/>',
  pause:'<path d="M9 5v14m6-14v14"/>',
  zoom:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4"/><path class="icon-detail" d="M8 12h8m-4-4v8"/>',
  expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  share:'<path class="icon-detail" d="m8 7 4-4 4 4m-4-4v12"/><path d="M6 11.5v6.75a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V11.5"/>',
  flag:'<path d="M5 21V3"/><path class="icon-detail icon-body" d="M5 4c5-3 9 3 15 0v10c-6 3-10-3-15 0z"/>',
  phone:'<path class="icon-body" d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2Z"/>',
  bell:'<path class="icon-body" d="M17.5 9a5.5 5.5 0 0 0-11 0c0 4.5-1.5 6-2.5 7.5h16c-1-1.5-2.5-3-2.5-7.5z"/><path class="icon-detail" d="M10 19.5a2.1 2.1 0 0 0 4 0"/>',
  car:'<path d="m5 10 2-5h10l2 5m-15 6v3m16-3v3"/><path class="icon-body" d="M3 16h18v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path class="icon-detail" d="M7 13h1m8 0h1"/>',
  mobile:'<rect class="icon-body" x="6" y="2" width="12" height="20" rx="3"/><path class="icon-detail" d="M11 18h2"/>',
  upload:'<path class="icon-detail" d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download:'<path class="icon-detail" d="M12 3v13m-5-5 5 5 5-5"/><path d="M4 17v4h16v-4"/>',
  edit:'<path d="m14 5 5 5m-14 9 4-1 11-11a2 2 0 0 0-4-4L5 14l-1 5Zm7 1h8"/>',
  logout:'<path d="M10 4H4v16h6m3-12 4 4-4 4m-5-4h12"/>',
  settings:'<path d="m10.1 3.4-.6 2.2-1.7 1-2.2-.6-1.9 3.3 1.6 1.6v2.2l-1.6 1.6 1.9 3.3 2.2-.6 1.7 1 .6 2.2h3.8l.6-2.2 1.7-1 2.2.6 1.9-3.3-1.6-1.6v-2.2l1.6-1.6-1.9-3.3-2.2.6-1.7-1-.6-2.2z"/><circle cx="12" cy="12" r="2.8"/>',
  test:'<path d="M9 3h6m-5 0v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3"/><path class="icon-detail" d="M7 15.5h10m-7 2.5h.1"/>',
  globe:'<circle class="icon-body" cx="12" cy="12" r="9"/><path class="icon-detail" d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  moon:'<path class="icon-body" d="M20 16.5A8.5 8.5 0 1 1 9 4a7 7 0 0 0 11 12.5Z"/>',
  sun:'<circle class="icon-body" cx="12" cy="12" r="4"/><path class="icon-detail" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  copy:'<rect class="icon-body" x="8" y="8" width="12" height="12" rx="2"/><path class="icon-detail" d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  'side-panel':'<rect class="icon-body" x="3" y="4.5" width="18" height="15" rx="2.5"/><path class="icon-detail" d="M15.5 4.5v15"/><path class="side-panel-arrow" d="m10.75 9-3 3 3 3"/>',
  'side-home':'<path class="icon-body" d="M4 10.5 11 4.4a1.5 1.5 0 0 1 2 0l7 6.1v7.7a2 2 0 0 1-2 2h-3.4v-5.1a1 1 0 0 0-1-1h-3.2a1 1 0 0 0-1 1v5.1H6a2 2 0 0 1-2-2Z"/><path class="icon-detail" d="m10.5 9.6 1.5-1.3 1.5 1.3"/>',
  'side-categories':'<rect class="icon-body" x="3.5" y="3.5" width="7" height="7" rx="1.9"/><rect class="icon-detail" x="13.5" y="3.5" width="7" height="7" rx="1.9"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.9"/><rect class="icon-body" x="13.5" y="13.5" width="7" height="7" rx="1.9"/>',
  'side-search':'<circle class="icon-body" cx="10.5" cy="10.5" r="6.5"/><path d="m15.25 15.25 4.85 4.85"/><path class="icon-detail" d="M7 10.5A3.5 3.5 0 0 1 10.5 7"/>',
  'side-sell':'<path class="icon-body" d="m3 11.5 2.7-2.7 1.6-3h5.9l1.6 3 2.7 2.7v5H3z"/><path d="M5 16.5v2m10.5-2v2M6 9h8.5"/><path class="icon-detail" d="m5.5 12.4 2.7 1m6.8-1-2.7 1m7.2-7.8h4m-2-2v4"/>',
  'side-favorites':'<path class="icon-body" d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1 1 5.8-5.2-2.75-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/><path class="icon-detail" d="m9 12 2-1 .9-2.5"/>',
  'side-compare':'<path d="M12 4v16m-5 0h10M4.5 7.5h15"/><path class="icon-body icon-detail" d="m6.5 7.5-3 6a3.1 3.1 0 0 0 6 0zm11 0-3 6a3.1 3.1 0 0 0 6 0z"/>',
  'side-messages':'<path class="icon-body" d="M8 4.5h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-4.8L6 20v-3.9a4 4 0 0 1-2-3.6v-4a4 4 0 0 1 4-4z"/><path class="icon-detail" d="M8 9.4h8m-8 3.1h5"/>',
  'side-notifications':'<path class="icon-body" d="M20 17H4l1.1-2.3c.5-1.15.7-2.4.7-3.7V9.5a6.2 6.2 0 1 1 12.4 0V11c0 1.3.2 2.55.7 3.7z"/><path class="icon-detail" d="M9.6 20a2.5 2.5 0 0 0 4.8 0"/>',
  'side-account':'<circle class="icon-body" cx="12" cy="7.4" r="3.65"/><path class="icon-body" d="M5 20v-1.2a4.8 4.8 0 0 1 4.8-4.8h4.4a4.8 4.8 0 0 1 4.8 4.8V20Z"/><path class="icon-detail" d="M10 17h4"/>',
  'side-moderation':'<path class="icon-body" d="M12 3.3 20 6v4.9c0 4.5-2.9 7.7-8 9.8-5.1-2.1-8-5.3-8-9.8V6z"/><path class="icon-detail" d="m8.5 11.8 2.35 2.35 4.7-4.7"/>',
  'side-admin':'<rect class="icon-body" x="4" y="4.5" width="16" height="15" rx="2.5"/><path d="M4 8.5h16"/><path class="icon-detail" d="M8 12h2.5M8 15.5h2.5m3-2 1.35 1.35 2.4-2.45"/>',
  'side-exit':'<path d="M10.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"/><path class="icon-detail" d="M10 12h10m-4-4 4 4-4 4"/>',
  'side-demo':'<path class="icon-body" d="M10 4v6L5.1 18a1.3 1.3 0 0 0 1.1 2h11.6a1.3 1.3 0 0 0 1.1-2L14 10V4z"/><path d="M9 4h6"/><path class="icon-detail" d="M8 14h8"/>',
  'side-switch':'<path d="M5 10a7 7 0 0 1 11.8-4.2L19 8m0-4v4h-4"/><path class="icon-detail" d="M19 14a7 7 0 0 1-11.8 4.2L5 16m0 4v-4h4"/>',
  'side-language':'<circle class="icon-body" cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><ellipse class="icon-detail" cx="12" cy="12" rx="3.6" ry="8.5"/>',
  'side-appearance':'<path class="icon-body" d="m9.5 5 1.55 4.45L15.5 11l-4.45 1.55L9.5 17l-1.55-4.45L3.5 11l4.45-1.55z"/><path class="icon-detail" d="M18 3.5v5m-2.5-2.5h5m-2 9v5m-2.5-2.5h5"/>',
  'side-theme':'<path class="side-moon icon-body" d="M20.1 15.4A8.2 8.2 0 0 1 9 4.1a8.45 8.45 0 1 0 11.1 11.3z"/><g class="side-sun"><circle class="icon-body" cx="12" cy="12" r="3.8"/><path class="icon-detail" d="M12 3v2m0 14v2M3 12h2m14 0h2M5.65 5.65l1.4 1.4m9.9 9.9 1.4 1.4m0-12.7-1.4 1.4m-9.9 9.9-1.4 1.4"/></g>',
  'side-sound':'<path class="icon-body" d="M3.75 9h4l4.75-3.75v13.5L7.75 15h-4z"/><path class="sound-waves icon-detail" d="M16 9.4a3.7 3.7 0 0 1 0 5.2m2.75-7.75a7.3 7.3 0 0 1 0 10.3"/><path class="sound-muted icon-detail" d="m16.3 10 4 4m0-4-4 4"/>'
};
// Closed silhouettes carry the fill in the solid variant and the secondary tone in Duotone.
const solidIconPaths = {
  home:'M2.5 10.3 12 2.8l9.5 7.5v9.2a1.5 1.5 0 0 1-1.5 1.5h-5v-6.5H9V21H4a1.5 1.5 0 0 1-1.5-1.5Z',
  search:'M10.5 3a7.5 7.5 0 1 0 4.33 13.62l4.14 4.14a1.25 1.25 0 0 0 1.77-1.77l-4.13-4.13A7.5 7.5 0 0 0 10.5 3Zm0 2.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  listing:'M5 2h8.8L19 7.2V10h-2V8h-4.5V4H5v16h6v2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 5h3v2H7Zm0 4h5v2H7Zm9 1h2.5v3.8H22v2.5h-3.5V22H16v-3.7h-3.5v-2.5H16Z',
  user:'M12 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 10.5a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Z',
  message:'M7 3h10a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5h-4l-6 4v-4a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 5v2h10V8Zm0 4v2h7v-2Z',
  bell:'M12 2a6.5 6.5 0 0 0-6.5 6.5c0 4.6-1.7 6.1-3 8V18h19v-1.5c-1.3-1.9-3-3.4-3-8A6.5 6.5 0 0 0 12 2ZM9 19.5a3 3 0 0 0 6 0Z',
  pin:'M12 2a8 8 0 0 1 8 8c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 8-8Zm0 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  heart:'M12 21 3.4 13a5.6 5.6 0 0 1 7.9-8l.7.7.7-.7a5.6 5.6 0 0 1 7.9 8Z',
  star:'m12 2 3 6.2 6.9 1-5 4.8 1.2 6.9-6.1-3.3-6.1 3.3 1.2-6.9-5-4.8 6.9-1Z',
  grid:'M3 3h8v8H3Zm10 0h8v8h-8ZM3 13h8v8H3Zm10 0h8v8h-8Z',
  calendar:'M7 2.5a1 1 0 0 1 1 1v1h8v-1a1 1 0 0 1 2 0v1h.5A3 3 0 0 1 21.5 7.5v11a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3H6v-1a1 1 0 0 1 1-1Zm-2.5 8v8a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8Zm3 2h3v2h-3Zm6 0h3v2h-3Zm-6 4h3v2h-3Z',
  image:'M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3ZM8 6.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM4.5 17v1.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2l-4.5-4.5-3 3-3.5-3.5Z',
  shield:'M12 2.5 20 5.4v5.1c0 5-3.2 9-8 11-4.8-2-8-6-8-11V5.4Zm4 7-1.4-1.4-3.8 3.8-1.6-1.6-1.4 1.4 3 3Z',
  building:'M7 2.5h10a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-4v-4h-2v4H7a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3ZM7 6v2h3V6Zm7 0v2h3V6Zm-7 4v2h3v-2Zm7 0v2h3v-2Z',
  moon:'M20.9 15.8a9.6 9.6 0 1 1-10.7-13 7.8 7.8 0 0 0 10.7 13Z',
  play:'M7 4.3 21 12 7 19.7Z',
};
const solidIconAliases = {
  'side-home':'home','side-search':'search','side-account':'user','side-messages':'message',
  'side-notifications':'bell','side-favorites':'star','side-categories':'grid','side-moderation':'shield',
};
export const icon = (name, size=20) => {
  const silhouette=solidIconPaths[solidIconAliases[name]??name];
  return `<svg class="ui-icon" data-icon-name="${e(name)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${silhouette?`<path class="ui-icon-silhouette" d="${silhouette}" fill="currentColor" fill-rule="evenodd" stroke="none"/>`:''}<g class="ui-icon-glyph">${iconPaths[name]||''}</g></svg>`;
};
const iconMaterials = `<svg class="icon-materials" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="icon-graphite" gradientUnits="userSpaceOnUse" x1="3" y1="2" x2="16" y2="22">
      <stop stop-color="#35495f"/><stop offset=".42" stop-color="#17283d"/><stop offset=".62" stop-color="#3e5670"/><stop offset="1" stop-color="#1a293c"/>
    </linearGradient>
    <linearGradient id="icon-platinum" gradientUnits="userSpaceOnUse" x1="3" y1="2" x2="16" y2="22">
      <stop stop-color="#fff"/><stop offset=".37" stop-color="#ebf3ff"/><stop offset=".55" stop-color="#a2b5cd"/><stop offset=".7" stop-color="#e1edf8"/><stop offset="1" stop-color="#b8c8dd"/>
    </linearGradient>
    <linearGradient id="icon-platinum-face" gradientUnits="userSpaceOnUse" x1="5" y1="3" x2="18" y2="22">
      <stop stop-color="#d9e8fb" stop-opacity=".46"/><stop offset=".48" stop-color="#7895ba" stop-opacity=".18"/><stop offset="1" stop-color="#93abc9" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="icon-graphite-face" gradientUnits="userSpaceOnUse" x1="5" y1="3" x2="18" y2="22">
      <stop stop-color="#92aac6" stop-opacity=".36"/><stop offset=".48" stop-color="#8ca6c2" stop-opacity=".09"/><stop offset="1" stop-color="#4a678c" stop-opacity=".22"/>
    </linearGradient>
  </defs>
</svg>`;
export const price = (ctx,value,currency='PLN') => value===null||value===undefined||value===''?'—':
  new Intl.NumberFormat(formatLocale(ctx.lang),{style:'currency',currency,currencyDisplay:currency==='PLN'&&ctx.lang==='pl'?'narrowSymbol':'code',maximumFractionDigits:2,minimumFractionDigits:Number.isInteger(value)?0:2}).format(value);
export const measure = (ctx,value,unit) => value==null||value===''?'—':new Intl.NumberFormat(formatLocale(ctx.lang)).format(value)+' '+unit;
export const km = (ctx,value) => measure(ctx,value,'km');
export const day = (ctx,value, includeTime=false) => !value?'—':new Intl.DateTimeFormat(formatLocale(ctx.lang),
  {dateStyle:'medium',...(includeTime?{timeStyle:'short'}:{}),timeZone:'Europe/Warsaw'}).format(new Date(value));
export const localized = (ctx,key,value) => lang(ctx,options[key]?.[value] ?? value ?? '') || '—';
export const tag = (ctx,status) => `<span class="status status-${e(status)}">${e(localized(ctx,'status',status))}</span>`;
export const pillCount = n => n?`<span class="count">${e(n>99?'99+':n)}</span>`:'';
export const titleOf = offer => [offer.make,offer.model].filter(Boolean).join(' ');
export const buttonEmbroideryLabel = text => `<span class="button-embroidery-label">${e(text)}</span>`;
const primaryLabel = (text,cls) => cls.split(/\s+/).includes('primary') ? buttonEmbroideryLabel(text) : e(text);
export const link = (ctx,path,label,cls='btn',symbol='',settings={}) => `<a class="${cls}" href="${e(href(ctx,path))}"${settings.buttonFinish?' data-button-finish-action':''}>${symbol?icon(symbol):''}${settings.buttonFinish?buttonEmbroideryLabel(label):primaryLabel(label,cls)}</a>`;
export const label = (name,content,required=false) => `<label class="field"><span>${e(name)}${required?' <span class="required" aria-hidden="true">*</span>':''}</span>${content}</label>`;
export const field = (name, caption, value='', settings={}) => label(caption,`<input name="${e(name)}" type="${e(settings.type||'text')}" value="${e(value)}"${settings.placeholder?` placeholder="${e(settings.placeholder)}"`:''}${settings.required?' required':''}${settings.attributes?' '+settings.attributes:''}>`,settings.required);
export const area = (name,caption,value='',settings={}) => label(caption,`<textarea name="${e(name)}" rows="${settings.rows||4}"${settings.required?' required':''}${settings.attributes?' '+settings.attributes:''}>${e(value)}</textarea>`,settings.required);
export const choice = (ctx,name,caption,items,value='',settings={}) => label(caption,`<select name="${e(name)}"${settings.required?' required':''}${settings.attributes?' '+settings.attributes:''}>${settings.placeholder!==false?`<option value="">${e(settings.placeholder||ctx.t('Wybierz','Select'))}</option>`:''}${Object.entries(items).map(([key,item])=>`<option value="${e(key)}"${String(key)===String(value)?' selected':''}>${e(lang(ctx,item))}</option>`).join('')}</select>`,settings.required);
export const check = (name,caption,on=false,required=false) => `<label class="check"><input type="checkbox" name="${e(name)}"${on?' checked':''}${required?' required':''}><span>${e(caption)}</span></label>`;
export const hidden = (name,value) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`;
export const formStatus = '<p class="form-status" data-form-status role="status" aria-live="polite"></p>';
export const submit = (name,symbol='',cls='btn primary') => `<button type="submit" class="${cls}">${symbol?icon(symbol):''}${primaryLabel(name,cls)}</button>`;
export const apiForm = (path,content,settings={}) => `<form method="post" class="stack${settings.className?' '+settings.className:''}" data-api="${e(path)}"${settings.id?` id="${e(settings.id)}"`:''}${settings.method?` data-method="${settings.method}"`:''}${settings.reload?' data-reload':''}${settings.success?` data-success="${e(settings.success)}"`:''}${settings.go?` data-go="${e(settings.go)}"`:''}${settings.confirm?` data-confirm="${e(settings.confirm)}"`:''}>${content}${formStatus}</form>`;
export const empty = (ctx,title,message='',action='',symbol='car') => `<div class="empty"><span class="empty-icon">${icon(symbol,28)}</span><h2>${e(title)}</h2>${message?`<p>${e(message)}</p>`:''}${action}</div>`;
export const sectionHead = (title,action='',sub='') => `<div class="section-head"><div><h2>${e(title)}</h2>${sub?`<p>${e(sub)}</p>`:''}</div>${action}</div>`;
export const pageHead = (title,description='',actions='') => `<div class="page-head"><div><h1>${e(title)}</h1>${description?`<p>${e(description)}</p>`:''}</div>${actions}</div>`;
export const panel = (heading,body,cls='') => `<section class="panel ${cls}">${heading?`<h2>${e(heading)}</h2>`:''}${body}</section>`;
export const loginPath = (ctx,next) => href(ctx,withAuthReturn('/zaloguj',next));
export const loginLink = (ctx,next,labelText,style='btn primary',symbol='user') => `<a class="${style}" href="${e(loginPath(ctx,next))}">${icon(symbol)}${primaryLabel(labelText,style)}</a>`;
export function enquiryAccess(ctx,next) {
  const t=ctx.t;
  const actions=ctx.demo
    ? loginLink(ctx,next,t('Wybierz konto demo','Choose a demo account'))
    : loginLink(ctx,next,t('Zaloguj się','Sign in'))+
      link(ctx,withAuthReturn('/zarejestruj',next),t('Załóż konto','Create an account'),'btn','plus');
  return `<div class="enquiry-access"><p>${ctx.demo
    ? t('Wybierz konto demonstracyjne, aby wysłać zapytanie w demo.','Choose a demo account to send an enquiry in the demo.')
    : t('Zaloguj się lub załóż konto, aby wysłać zapytanie.','Sign in or create an account to send your enquiry.')}</p>
    <div class="enquiry-access-actions">${actions}</div></div>`;
}
export const flash = (textValue,style='info') => `<p class="flash ${style}">${e(textValue)}</p>`;

const brumbrumCarPaths = `
    <g class="brumbrum-accent">
      <path d="M2 27l8-10 18-4L44 4h20l12 10 13 4-3 8H74a8 8 0 0 0-15 0H34a8 8 0 0 0-15 0H2Zm11-6h7l4-4-8 1Zm22-7h32l-5-6H46Zm39 3 4 4 8-1-4-2Z" fill-rule="evenodd"/>
      <path d="M8 30h11l-2 4H2Zm28 0h21l-2 4H34Zm39 0h9l-4 4h-7Z"/>
      <circle cx="26.5" cy="28" r="4.7"/><circle cx="66.5" cy="28" r="4.7"/>
    </g>
`;

const brumbrumWordmarkPaths = `
    <g transform="translate(91 8) skewX(-13)" fill-rule="evenodd">
      <path d="M7 0h15l4 4v5l-2 2 2 2v6l-4 4H7Zm5 5v4h8l1-1V6l-1-1Zm0 9v4h8l1-1v-2l-1-1Z"/>
      <path d="M29 0h16l4 4v7l-4 4 6 8h-6l-6-8h-5v8h-5Zm5 5v5h9l1-1V6l-1-1Z"/>
      <path d="M53 0h5v17l1 1h8l1-1V0h5v19l-4 4H57l-4-4Z"/>
      <path d="M77 0h5l7 9 7-9h5v23h-5V8l-7 9-7-9v15h-5Z"/>
      <path d="M105 0h15l4 4v5l-2 2 2 2v6l-4 4h-15Zm5 5v4h8l1-1V6l-1-1Zm0 9v4h8l1-1v-2l-1-1Z"/>
      <path d="M127 0h16l4 4v7l-4 4 6 8h-6l-6-8h-5v8h-5Zm5 5v5h9l1-1V6l-1-1Z"/>
      <path d="M151 0h5v17l1 1h8l1-1V0h5v19l-4 4h-12l-4-4Z"/>
      <path d="M175 0h5l7 9 7-9h5v23h-5V8l-7 9-7-9v15h-5Z"/>
      <path class="brumbrum-accent" d="M203 18h5v5h-5Zm7-12h5l6 12 6-12h5l-9 17h-4Zm25 0h4v17h-4Zm8 0h4l8 10V6h4v17h-4l-8-10v10h-4Z" transform="translate(32 0) scale(.84 1)"/>
    </g>`;

const brumbrumMarkPaths = brumbrumCarPaths+brumbrumWordmarkPaths;
const iconCollectionBrandDefinition = `<svg width="0" height="0" aria-hidden="true" focusable="false" class="icon-materials">
  <symbol id="brumbrum-collection-letters" viewBox="91 2 261 36">${brumbrumWordmarkPaths}</symbol>
</svg>`;

function iconCollectionBrand(collection) {
  const material=collection?'collection-metal-'+collection:'collection-metal-board';
  return `<span class="icon-collection-brand" ${collection?'aria-hidden="true"':'role="img" aria-label="BRUMBRUM.VIN"'}>
    ${icon('car',40)}
    <svg class="icon-collection-brand-letters" viewBox="0 0 261 36" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${material}" x2="0.23" y2="1">
        <stop class="collection-metal-rim"/><stop offset=".23" class="collection-metal-light"/>
        <stop offset=".47" class="collection-metal-face"/><stop offset=".53" class="collection-metal-shade"/>
        <stop offset=".76" class="collection-metal-mid"/><stop offset="1" class="collection-metal-light"/>
      </linearGradient></defs>
      <use class="collection-brand-extrusion" href="#brumbrum-collection-letters" x="1.3" y="1.9"/>
      <use class="collection-brand-face" href="#brumbrum-collection-letters" style="--collection-metal-paint:url(#${material})"/>
    </svg>
  </span>`;
}

export function logo(ctx) {
  const name=ctx.brand.name;
  if (ctx.brand.logo_key) return `<img src="${href(ctx,'/asset/logo/'+e(ctx.brand.logo_key))}" alt="${e(name)}" class="brand-image">`;
  if (name==='BRUMBRUM.VIN') return `<svg class="brumbrum-mark" viewBox="0 0 343 40" width="343" height="40" role="img" aria-label="${e(name)}" focusable="false">${brumbrumMarkPaths}</svg>`;
  const i=name.indexOf('4');
  return `<span class="wordmark">${i<0?e(name):e(name.slice(0,i))+'<b>4</b>'+e(name.slice(i+1))}</span>`;
}
function active(ctx,path) {
  if (path==='/') return ctx.path==='/';
  return ctx.path===path||ctx.path.startsWith(path+'/');
}
function navItem(ctx,path,textValue,symbol,extra='',css='',size=21,on=active(ctx,path),attributes='') {
  return `<a href="${e(href(ctx,path))}" class="${css}${on?' current':''}"${on?' aria-current="page"':''}${attributes?' '+attributes:''}>${icon(symbol,size)}<span${path==='/rolki'?' class="notranslate" lang="pl" translate="no"':''}>${e(textValue)}</span>${extra}</a>`;
}
const defaultIconStyle = 'sapphire-braid';
const lineIconStyles = [
  ['classic','Grafit','Graphite'],
  ['classic-solid','Platyna','Platinum'],
  ['classic-duotone','Szampan','Champagne'],
  ['classic-cobalt','Kobalt','Cobalt'],
  ['classic-sage','Szałwia','Sage'],
  ['classic-copper','Miedź','Copper'],
];
const threeDIconStyles = [
  ['amethyst-forge','Amethyst Forge','Amethyst Forge'], ['carrara-chrome','Carrara Chrome','Carrara Chrome'],
  ['deco-imperial','Déco Imperial','Déco Imperial'], ['cognac-coachwork','Cognac Coachwork','Cognac Coachwork'],
  ['emerald-coachwork','Emerald Coachwork','Emerald Coachwork'], ['cobalt-turbo','Cobalt Turbo','Cobalt Turbo'],
  ['damascus-copper','Damascus Copper','Damascus Copper'],
  ['rosso','Monza','Monza'], ['tourbillon','Tourbillon','Tourbillon'],
  ['silver-arrow','Silver Arrow','Silver Arrow'],['desert-rally','Desert Rally','Desert Rally'],
  ['midnight-gt','Midnight GT','Midnight GT'],
  ['alpine','Alpine','Alpine'], ['art-deco','Art déco','Art déco'], ['heritage','Heritage','Heritage'], ['aventurine','Aventurine','Aventurine'], ['aurora','Aurora','Aurora'], ['regulator','Regulator','Regulator'],
  ['porsche-gt','Porsche GT','Porsche GT'], ['super-trofeo','Super Trofeo','Super Trofeo'], ['night-endurance','Night Endurance','Night Endurance'],
  ['glacier-platinum','Glacier Platinum','Glacier Platinum'], ['imperial-jade','Imperial Jade','Imperial Jade'], ['obsidian-vault','Obsidian Vault','Obsidian Vault'], ['vermilion-calibre','Vermilion Calibre','Vermilion Calibre'], ['amethyst-moonphase','Amethyst Moonphase','Amethyst Moonphase'], ['copper-patina','Copper Patina','Copper Patina'], ['champagne-meteorite','Champagne Meteorite','Champagne Meteorite'], ['burgundy-enamel','Burgundy Enamel','Burgundy Enamel'], ['pearl-guilloche','Pearl Guilloché','Pearl Guilloché'], ['blue-bronze','Blue Bronze','Blue Bronze'],
  ['forged-carbon','Forged Carbon','Forged Carbon'], ['checkered-flag','Checkered Flag','Checkered Flag'], ['serpent','Serpent','Serpent'], ['green-gold','Green Gold','Green Gold'], ['rosso-corsa','Rosso Corsa','Rosso Corsa'], ['lime-superbike','Lime Superbike','Lime Superbike'], ['oil-slick','Oil Slick','Oil Slick'], ['classic-garage','Classic Garage','Classic Garage'],
  ['saffiano-gt','Saffiano GT','Saffiano GT'], ['saddle-touring','Saddle Touring','Saddle Touring'],
  ['bordeaux-nappa','Bordeaux Nappa','Bordeaux Nappa'], ['suede-rs','Suede RS','Suede RS'],
  ['ivory-atelier','Ivory Atelier','Ivory Atelier'], ['flat-six','Flat Six','Flat Six'],
  ['v12-corse','V12 Corse','V12 Corse'], ['gt1-pearl','GT1 Pearl','GT1 Pearl'],
  ['rally-martini','Rally Martini','Rally Martini'], ['riviera-1967','Riviera 1967','Riviera 1967'],
  ['coachbuilt-walnut','Coachbuilt Walnut','Coachbuilt Walnut'], ['smoked-crystal','Smoked Crystal','Smoked Crystal'],
  ['ruby-cabochon','Ruby Cabochon','Ruby Cabochon'], ['tiger-eye','Tiger Eye','Tiger Eye'],
  ['malachite-salon','Malachite Salon','Malachite Salon'], ['meteorite-black','Meteorite Black','Meteorite Black'],
  ['titanium-exhaust','Titanium Exhaust','Titanium Exhaust'], ['cnc-atelier','CNC Atelier','CNC Atelier'],
  ['woven-bronze','Woven Bronze','Woven Bronze'], ['luggage-club','Luggage Club','Luggage Club'],
  ['sapphire-braid','Sapphire Braid','Sapphire Braid'], ['platinum-tour','Platinum Tour','Platinum Tour'],
  ['green-fairway','Green Fairway','Green Fairway'], ['cognac-pave','Cognac Pavé','Cognac Pavé'],
  ['gti-jewel','GTI Jewel','GTI Jewel'], ['white-gold-links','White Gold Links','White Gold Links'],
  ['ivory-club','Ivory Club','Ivory Club'], ['riviera-cabochon','Riviera Cabochon','Riviera Cabochon'],
  ['bordeaux-coachline','Bordeaux Coachline','Bordeaux Coachline'], ['track-platinum','Track Platinum','Track Platinum'],
  ['ceramic-midnight','Ceramic Midnight','Ceramic Midnight'],
  ['ceramic-ivory','Ceramic Ivory','Ceramic Ivory'],
  ['ceramic-petrol','Ceramic Petrol','Ceramic Petrol'],
  ['ceramic-burgundy','Ceramic Burgundy','Ceramic Burgundy'],
  ['ceramic-forest','Ceramic Forest','Ceramic Forest'],
  ['sirocco-black','Sirocco Black','Sirocco Black'],
  ['arte-cognac','Arte Cognac','Arte Cognac'],
  ['sirocco-champagne','Sirocco Champagne','Sirocco Champagne'],
  ['arte-oxblood','Arte Oxblood','Arte Oxblood'],
  ['arte-deep-blue','Arte Deep Blue','Arte Deep Blue'],
  ['inferno-copper','Inferno Copper','Inferno Copper'],
  ['afterburner-blue','Afterburner Blue','Afterburner Blue'],
  ['crimson-manifold','Crimson Manifold','Crimson Manifold'],
  ['violet-heat','Violet Heat','Violet Heat'],
  ['amber-turbine','Amber Turbine','Amber Turbine'],
  ['brushed-aluminium','Brushed Aluminium','Brushed Aluminium'],
  ['black-titanium','Black Titanium','Black Titanium'],
  ['anodised-jade','Anodised Jade','Anodised Jade'],
  ['piston-bronze','Piston Bronze','Piston Bronze'],
  ['forged-copper','Forged Copper','Forged Copper'],
  ['pagani-atelier','Atelier Pagani','Atelier Pagani'],
  ['clockwork-gold','Clockwork Gold','Clockwork Gold'],
  ['platinum-jewel','Platinum Jewel','Platinum Jewel'],
  ['crystal-night','Crystal Night','Crystal Night'],
  ['neon-tachometer','Neon Tachometer','Neon Tachometer']
];
const iconStyleValues = [...lineIconStyles,...threeDIconStyles].map(([id])=>id).join(' ');

const iconCatalog = [
  ["Nawigacja", "Navigation", [
    ["menu", "Menu", "Menu"],
    ["home", "Start", "Home"],
    ["grid", "Kategorie", "Categories"],
    ["search", "Szukaj", "Search"],
    ["star", "Ulubione", "Saved"],
    ["heart", "Zapisz ogłoszenie", "Save listing"],
    ["message", "Wiadomości", "Messages"],
    ["user", "Konto", "Account"],
    ["listing", "Dodaj ogłoszenie", "Add listing"],
    ["bell", "Powiadomienia", "Notifications"],
    ["sliders", "Filtry i wygląd", "Filters and appearance"],
    ["globe", "Język", "Language"],
    ["moon", "Tryb ciemny", "Dark mode"],
    ["sun", "Tryb jasny", "Light mode"],
    ["mobile", "Telefon i aplikacja", "Mobile and app"],
  ]],
  ["Menu boczne", "Sidebar", [
    ["side-panel", "Panel boczny", "Sidebar"],
    ["side-home", "Start", "Home"],
    ["side-categories", "Kategorie", "Categories"],
    ["side-search", "Szukaj", "Search"],
    ["side-sell", "Sprzedaj pojazd", "Sell a vehicle"],
    ["side-favorites", "Ulubione", "Saved"],
    ["side-compare", "Porównywarka", "Compare"],
    ["side-messages", "Wiadomości", "Messages"],
    ["side-notifications", "Powiadomienia", "Notifications"],
    ["side-account", "Konto", "Account"],
    ["side-moderation", "Moderacja", "Moderation"],
    ["side-admin", "Administracja", "Administration"],
    ["side-exit", "Wyjdź z demo", "Exit demo"],
    ["side-demo", "Tryb demo", "Demo mode"],
    ["side-switch", "Zmień rolę", "Switch role"],
    ["side-language", "Język", "Language"],
    ["side-appearance", "Wygląd ikon", "Icon appearance"],
    ["side-theme", "Motyw", "Theme"],
    ["side-sound", "Dźwięk", "Sound"],
  ]],
  ["Ogłoszenia i pojazdy", "Listings and vehicles", [
    ["pin", "Lokalizacja", "Location"],
    ["calendar", "Data i rok", "Date and year"],
    ["gauge", "Przebieg", "Mileage"],
    ["fuel", "Paliwo", "Fuel"],
    ["gear", "Skrzynia biegów", "Transmission"],
    ["axle", "Napęd", "Drive"],
    ["scale", "Porównaj", "Compare"],
    ["building", "Firma", "Business"],
    ["shield", "Bezpieczeństwo", "Security"],
    ["car", "Pojazd", "Vehicle"],
    ["share", "Udostępnij", "Share"],
    ["flag", "Zgłoś", "Report"],
    ["phone", "Zadzwoń", "Call"],
  ]],
  ["Galeria i multimedia", "Gallery and media", [
    ["image", "Zdjęcia", "Photos"],
    ["rotate", "Obrót 360°", "360° spin"],
    ["video", "Wideo", "Video"],
    ["play", "Odtwórz", "Play"],
    ["pause", "Wstrzymaj", "Pause"],
    ["zoom", "Powiększ", "Zoom"],
    ["expand", "Pełny ekran", "Full screen"],
    ["upload", "Prześlij", "Upload"],
    ["download", "Pobierz", "Download"],
  ]],
  ["Akcje i ustawienia", "Actions and settings", [
    ["plus", "Dodaj", "Add"],
    ["arrow", "Dalej", "Forward"],
    ["back", "Wstecz", "Back"],
    ["chevron", "Przejdź", "Open"],
    ["down", "Rozwiń", "Expand"],
    ["up", "Zwiń", "Collapse"],
    ["close", "Zamknij", "Close"],
    ["check", "Potwierdź", "Confirm"],
    ["edit", "Edytuj", "Edit"],
    ["logout", "Wyloguj", "Sign out"],
    ["settings", "Ustawienia", "Settings"],
    ["test", "Demo", "Demo"],
    ["copy", "Kopiuj", "Copy"],
  ]],
];

export function iconStyleTrigger(ctx, compact=false) {
  const label=ctx.t('Wygląd ikon i przycisków','Icon and button appearance');
  return `<button type="button"${compact?` class="head-icon appearance" title="${label}"`:''} data-icon-style-open aria-haspopup="dialog" aria-controls="icon-style-dialog" aria-label="${label}">${icon('side-appearance',compact?18:24)}${compact?'':`<span>${label}</span>`}</button>`;
}

function iconStyleCards(ctx, styles) {
  return styles.map(([id,pl,en])=>`<label class="icon-style-card">
    <span class="icon-style-sample" data-icon-style="${id}">
      ${iconCollectionBrand(id)}
      <span class="icon-style-sample-icons">${['home','search','listing','user'].map(name=>icon(name,35)).join('')}</span>
    </span>
    <span class="icon-style-label"><input type="radio" name="icon-style" value="${id}"${id===defaultIconStyle?' checked':''}>${ctx.t(pl,en)}</span>
  </label>`).join('');
}

function appearanceDisclosure(title,content,className,attributes='') {
  return `<details class="appearance-disclosure ${className}"${attributes}>
    <summary>${e(title)}</summary>${content}
  </details>`;
}

function photoRevealChoices(ctx,group) {
  const t=ctx.t;
  const title=t('Efekt odsłaniania zdjęć','Photo reveal effect');
  const preview=t('Podgląd','Preview');
  const options=[['classic',t('Klasyczny','Classic')],['scatter',t('Rozproszenie','Scatter')]];
  const cards=options.map(([value,label])=>`<div class="reveal-choice">
    <label>
      <span class="reveal-choice-name"><input type="radio" data-photo-reveal-choice name="${e(group)}-photo-reveal" value="${value}"${value==='classic'?' checked':''}>${e(label)}</span>
      <span class="reveal-sample" data-photo-reveal-sample="${value}" aria-hidden="true">
        <span class="reveal-sample-chip">${icon('gauge',20)}<span>12 500 km</span></span>
        <span class="reveal-sample-chip">${icon('star',20)}</span>
      </span>
    </label>
    <button type="button" data-photo-reveal-replay="${value}" class="reveal-replay" aria-label="${e(preview+' · '+label)}">${icon('play',15)} ${e(preview)}</button>
  </div>`).join('');
  return appearanceDisclosure(title,`<div class="reveal-choices" role="radiogroup" aria-label="${e(title)}">${cards}</div>`,
    'reveal-settings',' data-photo-reveal-settings');
}

function iconBoard(ctx) {
  const t=ctx.t;
  return `<details class="icon-base-settings icon-board appearance-disclosure">
      <summary>${t('Pełna plansza wybranego zestawu','Full preview of the selected collection')}</summary>
      <div class="icon-board-groups" data-icon-board data-icon-style="${defaultIconStyle}">
        <header class="icon-board-toolbar">
          ${iconCollectionBrand()}
          <nav class="icon-board-actions" aria-label="${t('Przeglądaj kolekcje ikon','Browse icon collections')}">
            <button type="button" data-icon-board-step="-1" aria-label="${t('Poprzednia kolekcja','Previous collection')}"></button>
            <div class="icon-board-position" aria-live="polite" aria-atomic="true">
              <strong data-icon-board-name></strong><span data-icon-board-count></span>
            </div>
            <button type="button" data-icon-board-step="1" aria-label="${t('Następna kolekcja','Next collection')}"></button>
          </nav>
          <button type="button" class="icon-board-apply" data-icon-board-apply disabled>
            <span data-icon-board-use>${t('Ustaw zestaw','Use collection')}</span>
            <span data-icon-board-active hidden>${t('Aktywny zestaw','Active collection')}</span>
          </button>
        </header>
        ${iconCatalog.map(([pl,en,items])=>`<section><h3>${t(pl,en)}</h3><div class="icon-board-icons">
          ${items.map(([name,label,english])=>`<div class="icon-board-item">${icon(name,56)}<span>${t(label,english)}</span></div>`).join('')}
        </div></section>`).join('')}
      </div>
    </details>`;
}

function iconStyleControls(ctx) {
  const t=ctx.t;
  const surfaceTitle=t('Tło przycisków ikon','Icon button background');
  const linesTitle=t('Cienkie linie','Fine lines');
  const collectionsTitle=t('Kolekcje 3D','3D collections');
  const group=(id,title,content)=>appearanceDisclosure(title,content,'appearance-icon-group',` data-appearance-icon-group="${id}"`);
  return `<section class="appearance-icons">
    <h3>${t('Ikony','Icons')}</h3>
    ${group('size',t('Rozmiar ikon','Icon size'),`<div class="icon-size-controls">
      <p>${t('Dostosuj rozmiar ikon osobno dla każdego ekranu. Ustawienia zapisują się w tej przeglądarce.','Adjust icons separately for each screen size. Settings are saved in this browser.')}</p>
      ${[['phone',t('Telefon','Phone')],['tablet',t('Tablet','Tablet')],['desktop',t('Komputer','Desktop')]].map(([device,label])=>`<label class="icon-size-control"><span>${e(label)} <output data-icon-size-output="${device}">100%</output></span><input type="range" min="80" max="130" step="5" value="100" data-icon-size="${device}" aria-label="${e(t('Rozmiar ikon — ','Icon size — ')+label)}"></label>`).join('')}
    </div>`)}
    ${iconBoard(ctx)}
    ${group('surface',surfaceTitle,`<fieldset class="icon-surfaces" aria-label="${e(surfaceTitle)}">
      ${[['none','Bez tła','No background'],['glass','Szkło','Glass'],['dark','Ciemne','Dark']].map(([id,pl,en])=>`<label class="icon-surface-option">
        <input type="radio" name="icon-surface" value="${id}"${id==='none'?' checked':''}>
        <span class="icon-surface-preview" data-icon-surface="${id}"><span class="icon-surface-control">${icon('settings',32)}</span></span>
        <span>${t(pl,en)}</span>
      </label>`).join('')}
    </fieldset>`)}
    ${group('lines',linesTitle,`<fieldset class="icon-style-grid icon-style-grid-lines" aria-label="${e(linesTitle)}">
      ${iconStyleCards(ctx,lineIconStyles)}
    </fieldset>`)}
    ${group('collections',collectionsTitle,`<fieldset class="icon-style-grid" aria-label="${e(collectionsTitle)}">
      ${iconStyleCards(ctx,threeDIconStyles)}
    </fieldset>`)}
  </section>`;
}

const plainThemes=[
  ['light','light','Biały','White'],
  ['dark','dark','Granatowy','Navy'],
  ['black','dark','Czarny','Black'],
  ['graphite','dark','Grafitowy','Graphite'],
  ['system','system','System','System'],
];
const upholsteryThemes=[
  ['alcantara','dark','Grafitowa Alcantara','Graphite Alcantara'],
  ['nappa-black','dark','Czarna skóra Nappa','Black Nappa leather'],
  ['leather-cognac','dark','Skóra koniakowa','Cognac leather'],
  ['leather-ivory','light','Skóra kremowa','Ivory leather'],
  ['leather-pearl-rosso','light','Biała skóra · czerwona nić','White leather · Red stitching'],
  ['leather-pearl-violet','light','Biała skóra · fioletowa nić','White leather · Violet stitching'],
  ['leather-obsidian','dark','Pikowana czarna skóra','Black quilted leather'],
  ['alcantara-rs','dark','Alcantara RS','Alcantara RS'],
  ['copper-brushed','dark','Miedź szczotkowana','Brushed copper'],
  ['carbon-twill','dark','Karbon Twill','Twill carbon fiber'],
  ['titanium-brushed','dark','Szczotkowany tytan','Brushed titanium'],
  ['leather-crema-cross','light','Kremowa skóra · Ścieg krzyżykowy','Cream leather · Cross-stitch'],
  ['leather-bordeaux-double','dark','Bordowa Nappa · Podwójny szew','Burgundy Nappa · Double stitching'],
  ['alcantara-petrol-piping','dark','Morska Alcantara · Lamówka','Petrol Alcantara · Piping'],
  ['leather-forest-saddle','dark','Zielona skóra · Gruby szew','Forest leather · Saddle stitch'],
  ['leather-graphite-rs','dark','Grafitowa skóra RS','Graphite RS leather'],
  ['leather-black-acid','dark','Czarny Kwas','Acid Black'],
];
const themeModes=Object.fromEntries([...plainThemes,...upholsteryThemes].map(([value,mode])=>[value,mode]));
const themeMaterials=upholsteryThemes.map(([value])=>value).join(' ');
const themeStitchOptions={
  thread:{label:['Kolor nici','Thread color'],options:[
    ['auto','Z motywu','From theme'],['red','Czerwona','Red'],['violet','Fioletowa','Violet'],
    ['yellow','Żółta','Yellow'],['lime','Limonkowa','Lime'],['blue','Błękitna','Ice blue'],
    ['ivory','Kremowa','Ivory'],['copper','Miedziana','Copper'],
  ]},
  contrast:{label:['Kontrast przeszyć','Stitching contrast'],options:[
    ['standard','Wyraźny','Clear contrast'],['subtle','Subtelny','Subtle'],['strong','Mocny','Strong contrast'],
  ]},
};
const themeStitchValues=Object.fromEntries(Object.entries(themeStitchOptions)
  .map(([field,{options}])=>[field,options.map(([value])=>value)]));

function themeStitchControls(t,group) {
  const choices=Object.entries(themeStitchOptions).map(([field,{label,options}])=>{
    const title=e(t(...label));
    return `<div role="radiogroup" aria-label="${title}">
      <div class="theme-stitch-label">${title}</div>
      <div class="theme-stitch-options theme-${field}-options">
        ${options.map(([value,pl,en],index)=>`<label>
          <input type="radio" name="${e(group)}-${field}" value="${value}" data-theme-stitch-choice="${field}"${index===0?' checked':''}>
          <span>${field==='thread'?`<i class="theme-thread-swatch" data-thread="${value}" aria-hidden="true"></i>`:''}${e(t(pl,en))}</span>
        </label>`).join('')}
      </div>
    </div>`;
  }).join('');
  return `<details class="theme-stitch-settings" data-theme-stitch-settings hidden>
    <summary>${e(t('Przeszycie motywu','Theme stitching'))}</summary>
    <i class="theme-stitch-preview" aria-hidden="true"></i>
    ${choices}
  </details>`;
}

function themeOptions(ctx,group,includeStitches=true) {
  const t=ctx.t;
  const option=([value,,pl,en])=>`<label><input type="radio" name="${e(group)}" value="${value}" data-theme-choice${value==='light'?' checked':''}>
    <span><i class="theme-swatch" data-swatch="${value}" aria-hidden="true"></i><span>${e(t(pl,en))}</span></span></label>`;
  const materials=appearanceDisclosure(t('Materiały','Materials'),
    `<div class="settings-segments settings-theme-options settings-theme-materials">${upholsteryThemes.map(option).join('')}</div>`,
    'appearance-theme-materials');
  return `<div role="radiogroup" aria-label="${e(includeStitches?t('Motyw','Theme'):t('Tło strony','Site background'))}">
    <div class="settings-segments settings-theme-options">${plainThemes.map(option).join('')}</div>
    ${materials}
  </div>${includeStitches?themeStitchControls(t,group):''}`;
}

function accountButtonOptions(ctx,title) {
  const t=ctx.t;
  return `<div class="account-button-options" role="group" aria-label="${e(title)}">
      ${[['buttons',t('Z ikonami i ramką','Icons and borders')],['outline',t('Sama ramka','Outline only')],['text',t('Same napisy','Text only')]].map(([value,label])=>
        `<button type="button" class="account-button-choice" data-account-buttons="${value}" aria-pressed="${value==='buttons'}">
          <span class="account-button-preview" aria-hidden="true">${value!=='text'?icon('message',18):''}${t('Wiadomości','Messages')}</span>
          <span>${label}</span></button>`).join('')}
    </div>`;
}

function accountButtonColors(ctx) {
  const t=ctx.t;
  const colors={auto:t('Domyślny','Default'),blue:t('Niebieski','Blue'),green:t('Zielony','Green'),
    gold:t('Złoty','Gold'),purple:t('Fioletowy','Purple'),gray:t('Szary','Gray')};
  const picker=(state,label)=>`<div class="account-color-option">
    <label class="field"><span>${label}</span><select data-account-button-color="${state}">
      ${Object.entries(colors).map(([value,name])=>`<option value="${value}">${e(name)}</option>`).join('')}
    </select></label>
    <span class="account-button-preview account-color-preview" data-color-preview="${state}" aria-hidden="true">${t('Wiadomości','Messages')}</span>
  </div>`;
  return `<div class="account-color-options">${picker('hover',t('Po najechaniu','On hover'))}${picker('press',t('Po naciśnięciu','On press'))}</div>`;
}

const buttonFinishAttributes = finish=>Object.entries(finish).map(([field,value])=>`data-button-${field}="${value}"`).join(' ');
const buttonEmbroideryValues = buttonEmbroideryOptions.map(([value])=>value).join(' ');
const defaultButtonEmbroidery = buttonEmbroideryOptions[0][0];

function buttonFinishPreviewSample(ctx) {
  return `<span class="btn primary button-finish-preview-button">${icon('listing',18)}${buttonEmbroideryLabel(ctx.t('Dodaj ogłoszenie','Add listing'))}</span>`;
}

function buttonEmbroideryControls(t,group) {
  const title=t('Haft napisu','Label embroidery');
  return appearanceDisclosure(title,`<fieldset class="button-finish-group" aria-label="${e(title)}">
    <div class="button-embroidery-options">${buttonEmbroideryOptions.map(([value,pl,en])=>`<label class="button-finish-card button-embroidery-choice">
      <input type="radio" name="${e(group)}-button-embroidery" value="${value}" data-button-embroidery-choice${value===defaultButtonEmbroidery?' checked':''}>
      <span class="button-embroidery-sample" data-button-embroidery="${value}" aria-hidden="true">${buttonEmbroideryLabel('Aa')}</span>
      <span class="button-finish-name">${e(t(pl,en))}</span>
    </label>`).join('')}</div>
  </fieldset>`,'appearance-button-axis',' data-appearance-button-axis="embroidery"');
}

function buttonFinishCustomizer(ctx,group) {
  const t=ctx.t;
  const option=(field,[value,pl,en])=>{
    const sample={...buttonFinishes.stock,color:'graphite',[field]:value};
    if (field==='color') sample.material='nappa';
    if (field==='material') {
      const matchingPreset=carbonAndMetalFinishPresets.find(({finish})=>finish.material===value);
      if (matchingPreset) sample.color=matchingPreset.finish.color;
    }
    if (field==='thread') {
      sample.color=['black','navy','sepia','slate'].includes(value)?'ivory':'graphite';
      sample.stitch='double';
    }
    return `<label class="button-finish-card">
      <input type="radio" name="${e(group)}-button-${field}" value="${value}" data-button-finish-field="${field}"${buttonFinishes.stock[field]===value?' checked':''}>
      <span class="button-finish-swatch" aria-hidden="true" ${buttonFinishAttributes(sample)}></span>
      <span class="button-finish-name">${e(t(pl,en))}</span>
    </label>`;
  };
  const stage=(field,label,content)=>{
    const title=t(...label);
    return appearanceDisclosure(title,`<fieldset class="button-finish-group" data-button-finish-axis="${field}" aria-label="${e(title)}">${content}</fieldset>`,
      'appearance-button-axis',` data-appearance-button-axis="${field}"`);
  };
  const options=(field,variants)=>`<div class="button-finish-options">${variants.map(variant=>option(field,variant)).join('')}</div>`;
  return `<details class="button-finish-customizer">
    <summary>${e(t('Dostosuj tapicerkę','Customize upholstery'))}</summary>
    <div class="button-finish-config">
      ${stage('color',['Kolor tapicerki','Upholstery color'],buttonFinishPalettes.map(({id,label,colors})=>
        `<details class="button-finish-palette" data-button-finish-palette="${id}"${id==='standard'?' open':''}>
          <summary>${e(t(...label))}</summary>
          ${options('color',colors)}
        </details>`).join(''))}
      ${Object.entries(buttonFinishFields).map(([field,{label,options:variants}])=>
        stage(field,label,options(field,variants))).join('')}
    </div>
  </details>`;
}

function buttonFinishSection(ctx,group,title) {
  const t=ctx.t;
  const card=({id,pl,en,finish})=>{
    const diamond=['racing-green','aubergine','copper'].includes(id);
    return `<label class="button-finish-card"${id==='custom'?' hidden':''}>
      <input type="radio" name="${e(group)}-button-finish" value="${id}" data-button-finish-preset${id==='stock'?' checked':''}>
      <span class="button-finish-swatch" aria-hidden="true" ${buttonFinishAttributes(finish)}${diamond?' data-button-detail="diamond"':''}>${diamond?'<span></span>':''}</span>
      <span class="button-finish-name">${e(t(pl,en))}</span>
    </label>`;
  };
  return `<fieldset class="button-finish-settings" aria-label="${e(title)}">
    <div class="button-finish-options">
      ${buttonFinishPresets.map(card).join('')}
      ${card({id:'custom',pl:'Własny styl',en:'Custom finish',finish:buttonFinishes.stock})}
    </div>
    <details class="button-finish-palette button-finish-preset-group" data-button-finish-preset-group>
      <summary>${e(t('Gotowe wzory inspirowane Rolls‑Royce’em','Rolls-Royce inspired presets'))}</summary>
      <div class="button-finish-options">${rollsRoyceFinishPresets.map(card).join('')}</div>
    </details>
    <details class="button-finish-palette button-finish-preset-group" data-button-finish-preset-group>
      <summary>${e(t('Karbon i metale','Carbon and metals'))}</summary>
      <div class="button-finish-options">${carbonAndMetalFinishPresets.map(card).join('')}</div>
    </details>
    ${luxuryBrandPresetGroups.map(({id,label,presets})=>`<details class="button-finish-palette button-finish-preset-group" data-button-finish-preset-group data-luxury-brand="${id}">
      <summary>${e(t(...label))}</summary><div class="button-finish-options">${presets.map(card).join('')}</div>
    </details>`).join('')}
    ${buttonEmbroideryControls(t,group)}
    ${buttonFinishCustomizer(ctx,group)}
  </fieldset>`;
}

function buttonHardwareControls(ctx,group) {
  const t=ctx.t;
  const axis=(field,{label,options})=>{
    const title=t(...label);
    return appearanceDisclosure(title,`<fieldset class="button-finish-group hardware-choice-grid" data-button-hardware-axis="${field}" aria-label="${e(title)}">
      <div class="button-finish-options">${options.map(([value,pl,en])=>`<label class="button-finish-card hardware-choice">
        <input type="radio" name="${e(group)}-hardware-${field}" value="${value}" data-button-hardware-field="${field}"${defaultButtonHardware[field]===value?' checked':''}>
        <span class="hardware-swatch" data-hardware-${field}="${value}" aria-hidden="true"></span><span class="button-finish-name">${e(t(pl,en))}</span>
      </label>`).join('')}</div></fieldset>`,'appearance-button-axis',` data-appearance-button-axis="hardware-${field}"`);
  };
  return `<details class="button-finish-customizer hardware-customizer" data-button-hardware-settings>
    <summary>${e(t('Okucia, klamry i detale (Hardware)','Hardware & Trim'))}</summary>
    <div class="button-finish-config hardware-config">${Object.entries(buttonHardwareFields).map(([field,config])=>axis(field,config)).join('')}</div>
  </details>`;
}

function personalLogoOptions(ctx,group) {
  const t=ctx.t;
  const options=[
    ['default',t('Domyślne logo strony','Site default')],
    ['original',t('Oryginalne czarno-niebieskie','Original black and blue')],
    ...brandLogoIds.map(id=>[id,(Number(id)>20?t('Skóra','Leather')+' '+String(Number(id)-20).padStart(2,'0'):t('Metal','Metal')+' '+id)])
  ];
  const gallery=`<fieldset class="logo-choice-grid" aria-label="${e(t('Logo w nagłówku','Header logo'))}">
    ${options.map(([value,label])=>{
      const asset=brandLogoAsset(value==='default'?ctx.brand.home_logo:value);
      const preview=asset?`<img src="${asset}" width="510" height="170" loading="lazy" alt="">`:logo(ctx);
      return `<label class="logo-choice-card">
        <input type="radio" name="${e(group)}-header-logo" value="${value}" data-personal-logo-choice${value==='default'?' checked':''}>
        <span class="logo-choice-preview" aria-hidden="true">${preview}</span>
        <span class="logo-choice-caption">${e(label)}</span>
      </label>`;
    }).join('')}
  </fieldset>`;
  return appearanceDisclosure(t('Logo strony','Site logo'),gallery+`<fieldset class="logo-led-options"><legend>${t('Dodatkowa poświata LED logo','Additional logo LED glow')}</legend>
    ${[['off','Wyłączone'],['red','Czerwone'],['blue','Niebieskie'],['violet','Fioletowe'],['cyan','Turkusowe'],['green','Zielone'],['gold','Neonowy żółty'],['white','Białe']].map(([value,label])=>`<label><input type="radio" name="${e(group)}-logo-led" value="${value}" data-logo-led-choice${value==='off'?' checked':''}><span>${e(label)}</span></label>`).join('')}
    </fieldset>`,'appearance-logo',group==='inline-icon-theme'?' open':'');
}

const ultimateMaterials=[
  ['alcantara-graphite','Grafitowa Alcantara'],['nappa-black','Czarna skóra Nappa'],['carbon-black-leather','Carbon Black Leather'],
  ['cognac-leather','Skóra koniakowa'],['ivory-leather','Skóra kremowa'],['white-leather','Biała skóra'],['burgundy-leather','Burgundy Leather'],
  ['navy-leather','Navy Leather'],['quilted-black','Pikowana czarna skóra'],['alcantara-rs','Alcantara RS'],
  ['brushed-copper','Miedź szczotkowana'],['brushed-titanium','Szczotkowany tytan'],['dark-titanium','Dark Titanium'],['polished-chrome','Polerowany chrom'],
  ['brushed-steel','Szczotkowana stal'],['liquid-mercury','Liquid Mercury'],['black-anodized','Czarne aluminium'],['brushed-gold','Szczotkowane złoto'],
  ['rose-gold','Rose Gold'],['gunmetal','Gunmetal'],['iridescent-metal','Iridescent Metal'],['oil-slick','Oil Slick'],['forged-carbon','Forged Carbon'],
  ['carbon-twill','Karbon Twill'],['holographic-titanium','Holographic Titanium'],['obsidian-glass','Obsidian Glass'],['frosted-glass','Frosted Glass'],['matte-ceramic','Matte Ceramic']
];
const ultimateSelect=(name,label,options)=>`<label class="uve-field"><span>${label}</span><select data-uve-field="${name}">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></label>`;
const ultimateRange=(name,label,min,max,value,step=1)=>`<label class="uve-range"><span>${label}<output data-uve-output="${name}">${value}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-uve-field="${name}"></label>`;
const ultimateToggle=(name,label)=>`<label class="uve-toggle"><input type="checkbox" data-uve-field="${name}"><span>${label}</span></label>`;

function ultimateVisualEngineLegacy(ctx,group) {
  const t=ctx.t;
  const section=(id,title,content,open='')=>appearanceDisclosure(title,content,'uve-section',` data-uve-section="${id}"${open}`);
  const presets=['SUPERCAR RED','SILVER PHANTOM','TITANIUM AURORA','OIL SLICK RGB','CYBERPUNK PINK','ICE BLUE','GOLD EMPIRE','TOXIC GREEN','COPPER NIGHT','BLACK OPS','HYPERCHROME','NEON RAINBOW'];
  const stitches=[['single','Single Stitch'],['double','Double Stitch'],['cross','Cross Stitch'],['q-citura','Q‑Citura'],['racing','Racing Stitch'],['brogue','Brogue'],['piping','Contrast Piping']];
  const threads=[['#ff003c','Czerwony'],['#9d00ff','Fioletowy'],['#ffd700','Żółty / złoty'],['#ffffff','Biały'],['#c0c0c0','Srebrny'],['#0066ff','Niebieski'],['#050505','Czarny']];
  const ambience=[['ice-blue','#70bce8','Lodowy błękit'],['deep-blue','#356fa8','Głęboki niebieski'],['sea','#2a938f','Morski'],['emerald','#34765f','Szmaragd'],['royal-violet','#66518a','Fiolet królewski']];
  const oled=[['off','Wyłączony'],['pure-black','OLED Pure Black'],['neon-red','OLED Neon Red'],['cyber-blue','OLED Cyber Blue'],['ultra-violet','OLED Ultra Violet'],['silver','OLED Silver'],['spectrum','OLED RGB Spectrum'],['gold','OLED Gold Luxury'],['titanium','OLED Titanium']];
  const animations=['static','breathing','pulse','neon-flash','rgb-wave','rainbow-flow','aurora','cyber-strobe','dual-color','triple-gradient','neon-chase','ice-glow','fire-glow'].map(x=>[x,x.replaceAll('-',' ').toUpperCase()]);
  const borderMaterials=['silver-chrome','polished-steel','brushed-titanium','copper','black-chrome','satin-aluminum','gold','carbon-edge'].map(x=>[x,x.replaceAll('-',' ')]);
  const borderEffects=['solid-led','double-led','metal-led','neon-tube','rgb-gradient','moving-edge','flowing-energy','ambient-glow'].map(x=>[x,x.replaceAll('-',' ')]);
  return `<details class="appearance-disclosure ultimate-visual-engine" data-uve-root>
    <summary>${t('Bespoke Studio — materiały i ambiente','Bespoke Studio — materials and ambience')}</summary>
    <div class="uve-panel">
      ${ultimateToggle('engineEnabled','Włącz rozszerzony silnik wizualny')}
      ${section('presets','1. Gotowe Zestawy — 12 Presetów Bespoke',`<div class="uve-preset-grid">${presets.map((name,i)=>`<button type="button" data-uve-preset="${i+1}"><span></span>${name}</button>`).join('')}</div>`,' open')}
      ${section('materials','2. Materiały i Tekstury — Tło / Przyciski',`<div class="uve-two-zone"><fieldset><legend>Tło aplikacji</legend>${ultimateSelect('bgMaterial','Materiał',ultimateMaterials)}</fieldset><fieldset><legend>Przyciski i karty</legend>${ultimateSelect('buttonMaterial','Materiał',ultimateMaterials)}</fieldset></div><div class="uve-slider-grid">${ultimateRange('textureIntensity','Intensywność tekstury',0,100,65)}${ultimateRange('gloss','Połysk',0,100,35)}${ultimateRange('materialContrast','Kontrast',0,100,55)}${ultimateRange('darkening','Przyciemnienie',0,100,18)}${ultimateRange('patternScale','Skala wzoru',30,220,100)}${ultimateToggle('reflectionMotion','Ruch refleksów')}</div>`)}
      ${section('stitch-hardware','3. Przeszycia i Okucia',`${ultimateSelect('stitchType','Wariant szwu',stitches)}${ultimateSelect('threadPreset','Kolor nici',threads)}<label class="uve-field"><span>Dowolny kolor nici</span><input type="color" value="#ff003c" data-uve-field="threadColor"></label><div class="uve-slider-grid">${ultimateRange('stitchWidth','Grubość',1,8,2)}${ultimateRange('stitchDensity','Gęstość / odstępy',4,28,10)}${ultimateRange('stitchInset','Odległość od krawędzi',2,18,7)}${ultimateRange('stitchShadow','Cień nici',0,12,3)}</div><p class="uve-subtitle">Hardware & Trim</p>${ultimateSelect('hardwareMetal','Metal okuć',[['titanium','Szczotkowany Tytan'],['rose-gold','Różowe Złoto'],['dark-chrome','Ciemny Chrom'],['brass','Mosiądz'],['stainless','Stal']])}<div class="uve-toggle-grid">${ultimateToggle('torx','Śruby Torx')}${ultimateToggle('buckle','Klamra i pasek')}${ultimateToggle('debossing','Tłoczenie napisu')}</div>${ultimateSelect('decorTrim','Listwa dekoracyjna',[['none','Bez listwy'],['walnut','Orzech włoski'],['forged-carbon','Kuty karbon'],['slate','Kamień łupkowy']])}`)}
      ${section('oled','4. Tryb TRUE BLACK OLED',`${ultimateSelect('oledMode','Wariant OLED',oled)}${ultimateRange('oledGlow','Intensywność poświaty',0,100,45)}${ultimateRange('surfaceBrightness','Jasność powierzchni',0,100,18)}`)}
      ${section('rgb','5. Kolory RGB, Neon i Animacje',`<div class="uve-color-grid">${[['#ff003c','Electric Red'],['#ff00cc','Neon Pink'],['#9d00ff','Cyber Purple'],['#0066ff','Electric Blue'],['#00ccff','Ice Blue'],['#00ffff','Cyan Neon'],['#39ff14','Toxic Green'],['#bfff00','Acid Lime'],['#ff6600','Neon Orange'],['#ffd700','Gold'],['#ffffff','Pure White'],['#c0c0c0','Silver'],['#6500ff','Deep Violet'],['#ff00ff','Laser Magenta'],['#ffbf00','Amber'],['#00ff88','Emerald']].map(([color,name])=>`<button type="button" style="--swatch:${color}" data-uve-color="${color}" title="${name}"></button>`).join('')}</div><div class="uve-color-controls"><label class="uve-field"><span>Color Picker</span><input type="color" value="#ff003c" data-uve-field="ledColor"></label><label class="uve-field"><span>HEX</span><input type="text" value="#FF003C" maxlength="7" pattern="#[0-9A-Fa-f]{6}" data-uve-field="ledHex"></label></div><div class="uve-slider-grid">${ultimateRange('rgbR','R',0,255,255)}${ultimateRange('rgbG','G',0,255,0)}${ultimateRange('rgbB','B',0,255,60)}${ultimateRange('hue','HSL — Hue',0,360,346)}${ultimateRange('saturation','Nasycenie',0,100,100)}${ultimateRange('alpha','Przezroczystość',0,100,100)}</div>${ultimateToggle('lightEnabled','Włącz efekty świetlne')}${ultimateSelect('animation','Animacja',animations)}<div class="uve-slider-grid">${ultimateRange('speed','Szybkość',1,100,35)}${ultimateRange('brightness','Jasność',0,100,85)}${ultimateRange('glowBlur','Rozmycie poświaty',0,60,18)}${ultimateRange('direction','Kierunek ruchu',0,360,90)}</div>`)}
      ${section('borders','6. Ramki LED — Advanced Border System',`<div class="uve-two-zone"><fieldset><legend>Ramka przycisków</legend>${ultimateSelect('buttonBorderMaterial','Materiał',borderMaterials)}${ultimateSelect('buttonBorderEffect','Efekt',borderEffects)}</fieldset><fieldset><legend>Ramka kart</legend>${ultimateSelect('cardBorderMaterial','Materiał',borderMaterials)}${ultimateSelect('cardBorderEffect','Efekt',borderEffects)}</fieldset></div><div class="uve-slider-grid">${ultimateRange('borderWidth','Grubość',1,12,2)}${ultimateRange('edgeBrightness','Jasność krawędzi',0,100,80)}${ultimateRange('edgeGlow','Wielkość poświaty',0,60,16)}${ultimateRange('coreIntensity','Intensywność rdzenia',0,100,90)}${ultimateRange('borderRadius','Zaokrąglenie',0,40,12)}${ultimateRange('borderSpeed','Prędkość',1,100,30)}</div>`)}
      ${section('library','7. Ikony i Logo — zachowane',`<p class="uve-note">100 zestawów ikon i 20 wariantów logo pozostaje w istniejących sekcjach panelu. Silnik nie zmienia ich kolekcji ani zapisu.</p>`)}
      ${section('custom','8. Moje Presety',`<div class="uve-preset-tools"><input type="text" maxlength="48" placeholder="Nazwa mojego motywu" data-uve-preset-name><select data-uve-saved-list aria-label="Moje presety"><option value="">Wybierz zapisany preset</option></select><button type="button" data-uve-action="save">Zapisz mój motyw</button><button type="button" data-uve-action="save-as">Zapisz jako nowy</button><button type="button" data-uve-action="rename">Zmień nazwę</button><button type="button" data-uve-action="delete">Usuń</button><button type="button" data-uve-action="export">Eksportuj JSON</button><label class="uve-import">Importuj JSON<input type="file" accept="application/json,.json" data-uve-import></label><button type="button" data-uve-action="reset">Przywróć domyślne</button></div><p role="status" data-uve-status></p>`)}
      ${section('performance','9. Wydajność i Dostępność',`${ultimateToggle('disableAnimations','Wyłącz wszystkie animacje świetlne')}${ultimateToggle('reduceEffects','Tryb oszczędny GPU')}${ultimateToggle('highContrast','Wysoki kontrast')}<p class="uve-note">Animacje respektują ustawienie systemowe prefers-reduced-motion. Cyber Strobe jest ograniczony do 3 Hz.</p>`)}
      ${section('ambience','Podświetlenie Ambiente',`${ultimateToggle('ambientEnabled','Delikatne podświetlenie krawędzi')}<div class="uve-ambient-colors" role="radiogroup" aria-label="Kolor podświetlenia">${ambience.map(([value,color,label])=>`<label style="--ambient:${color}"><input type="radio" name="${e(group)}-ambient" value="${value}" data-uve-field="ambientColor"><span></span><strong>${label}</strong></label>`).join('')}</div>${ultimateRange('ambientIntensity','Intensywność ambiente',0,40,14)}${ultimateToggle('oledPureBlack','OLED Pure Black — głęboka czerń')}`,' open')}
    </div>
  </details>`;
}

function ultimateVisualEngine(ctx,group) {
  const t=ctx.t;
  const section=(id,title,content,open='')=>appearanceDisclosure(title,content,'uve-section',` data-uve-section="${id}"${open}`);
  const stitches=[['single','Single Stitch'],['double','Double Stitch'],['cross','Cross Stitch'],['q-citura','Q‑Citura'],['racing','Racing Stitch'],['brogue','Brogue'],['piping','Contrast Piping']];
  const threads=[['#ff003c','Czerwony'],['#9d00ff','Fioletowy'],['#ffd700','Złoty'],['#ffffff','Biały'],['#c0c0c0','Srebrny'],['#0066ff','Niebieski'],['#050505','Czarny']];
  return `<details class="appearance-disclosure ultimate-visual-engine" data-uve-root>
    <summary>${t('Bespoke Studio — materiały i wykończenia','Bespoke Studio — materials and finishes')}</summary>
    <div class="uve-panel">
      ${ultimateToggle('engineEnabled','Włącz materiały Bespoke')}
      ${section('materials','Materiały — Tło / Przyciski',`<div class="uve-two-zone"><fieldset><legend>Tło aplikacji</legend>${ultimateSelect('bgMaterial','Materiał',ultimateMaterials)}</fieldset><fieldset><legend>Przyciski i karty</legend>${ultimateSelect('buttonMaterial','Materiał',ultimateMaterials)}</fieldset></div>${ultimateRange('textureIntensity','Intensywność tekstury',0,100,45)}`,' open')}
      ${section('stitch-hardware','Przeszycia i okucia',`${ultimateSelect('stitchType','Wariant szwu',stitches)}${ultimateSelect('threadPreset','Kolor nici',threads)}<p class="uve-subtitle">Hardware & Trim</p>${ultimateSelect('hardwareMetal','Metal okuć',[['titanium','Szczotkowany Tytan'],['rose-gold','Różowe Złoto'],['dark-chrome','Ciemny Chrom'],['brass','Mosiądz'],['stainless','Stal']])}<div class="uve-toggle-grid">${ultimateToggle('torx','Śruby Torx')}${ultimateToggle('buckle','Klamra i pasek')}${ultimateToggle('debossing','Tłoczenie napisu')}</div>${ultimateSelect('decorTrim','Listwa dekoracyjna',[['none','Bez listwy'],['walnut','Orzech włoski'],['forged-carbon','Kuty karbon'],['slate','Kamień łupkowy']])}`)}
      ${ultimateToggle('oledPureBlack','OLED Pure Black — głęboka czerń')}
      <button class="uve-reset" type="button" data-uve-action="reset">Przywróć spokojne ustawienia</button>
    </div>
  </details>`;
}

export function appearanceControls(ctx,group) {
  const t=ctx.t;
  if(ctx.robotics)return `<div class="appearance-menu robot-appearance-menu">${robotFrameControls(ctx,group)}${iconStyleControls(ctx)}</div>`;
  const upholstery=t('Motyw tapicerki','Upholstery theme');
  const accountStyle=t('Przyciski w Moim koncie','My account buttons');
  const accountColors=t('Tło przycisków w Moim koncie','My account button backgrounds');
  const buttonGroup=(id,title,content)=>appearanceDisclosure(title,content,'appearance-button-group',` data-appearance-button-group="${id}"`);
  return `<div class="appearance-menu">
    <section class="appearance-theme"><h3>${t('Motyw strony','Site theme')}</h3>${themeOptions(ctx,group)}</section>
    ${iconStyleControls(ctx)}
    ${photoRevealChoices(ctx,group)}
    ${personalLogoOptions(ctx,group)}
    ${appearanceDisclosure(t('Przyciski','Buttons'),`<div class="appearance-button-options">
      ${buttonGroup('upholstery',upholstery,buttonFinishSection(ctx,group,upholstery))}
      ${buttonGroup('account-style',accountStyle,accountButtonOptions(ctx,accountStyle))}
      ${buttonGroup('account-colors',accountColors,accountButtonColors(ctx))}
    </div>`,'appearance-buttons',' data-appearance-section="buttons"')}
  </div>
  <div class="button-finish-preview-dock" role="group" aria-label="${e(t('Podgląd przycisku','Button preview'))}">
    <div class="uve-live-preview" data-uve-preview><span class="uve-preview-label">LIVE PREVIEW</span>
      ${buttonFinishPreviewSample(ctx)}
      <article class="uve-preview-card"><span class="uve-preview-photo">BRUMBRUM.VIN</span><strong>GT Performance</strong><small>2026 · 12 500 km</small></article>
      <label class="uve-preview-input"><span>Model pojazdu</span><input value="Supersport" readonly></label>
      <nav class="uve-preview-nav" aria-label="Podgląd ikon">${icon('home',18)}${icon('search',18)}${icon('reels',18)}${icon('favorite',18)}</nav>
      <span class="uve-preview-frame">MATERIAŁ + SZEW</span>
    </div>
  </div>`;
}

function iconStyleDialog(ctx) {
  const t=ctx.t;
  return `<dialog class="modal icon-style-dialog" id="icon-style-dialog" aria-labelledby="icon-style-title">
    <div class="icon-style-heading"><div><h2 id="icon-style-title">${ctx.robotics?t('Wygląd Strefy Robotów','Robot Zone appearance'):t('Wygląd ikon i przycisków','Icon and button appearance')}</h2></div>
      <form method="dialog"><button type="submit" class="icon-button" aria-label="${t('Zamknij','Close')}">${icon('close')}</button></form>
    </div>
    ${appearanceControls(ctx,'toolbar-theme')}
    ${ctx.robotics?'':`<div class="bottom-nav icon-dialog-nav-preview" aria-hidden="true">${[['home',t('Start','Home')],['search',t('Szukaj','Search')],['video','Rolki'],['listing',t('Sprzedaj','Sell')],['star',t('Ulubione','Saved')],['user',t('Mój profil','My profile')]].map(([symbol,label])=>`<a>${icon(symbol,21)}<span>${e(label)}</span></a>`).join('')}</div>`}
  </dialog>`;
}

function languagePicker(ctx) {
  const t=ctx.t;
  return `<dialog class="modal language-picker" id="language-picker" aria-labelledby="language-picker-title">
    <div class="modal-head"><h2 id="language-picker-title">${t('Wybierz język','Choose language')}</h2>
      <form method="dialog"><button type="submit" class="icon-button" aria-label="${t('Zamknij','Close')}">${icon('close',19)}</button></form></div>
    <div class="language-options">${Object.entries(languages).map(([code,name])=>{
      const url=new URL(ctx.url);
      url.searchParams.set('lang',code);
      return `<a class="language-option" href="${e(url.pathname.replace(/^\/+/, '/')+url.search)}" lang="${code}" hreflang="${code}"${code===ctx.lang?' aria-current="true"':''}>
        <span class="language-code" aria-hidden="true">${code.toUpperCase()}</span><span>${name}</span>${code===ctx.lang?icon('check',17):''}</a>`;
    }).join('')}</div></dialog>`;
}

const themeToggleIcons=icon('moon',19)+icon('sun',19);

function robotNav(ctx) {
  const t=ctx.t;
  const navs=[['/','Kategorie','Categories','grid'],['/szukaj','Szukaj','Search','search'],['/ulubione','Ulubione','Favorites','star'],
    ['/zamowienia','Rezerwacje','Reservations','calendar'],['/asystent','Asystent','Assistant','sliders'],['/konto','Konto','Account','user'],['/sprzedaj','Wystaw','List equipment','plus']];
  const links=navs.map(([path,pl,en,symbol],i)=>`<a href="${e(href(ctx,path))}" class="robot-nav-link${ctx.path===path?' is-active':''}${i===6?' robot-nav-add':''}${[3,4].includes(i)?' robot-nav-extra':''}"${ctx.path===path?' aria-current="page"':''}>${icon(symbol,25)}<span>${e(t(pl,en))}</span></a>`).join('');
  return `<a class="skip" href="#main">${t('Przejdź do treści','Skip to content')}</a>
    <header class="robot-header"><div class="robot-header-inner">
      <a href="${e(href(ctx,'/'))}" class="robot-wordmark"><span>ROBOTY</span><small>${t('I AUTOMATYKA','& AUTOMATION')}</small></a>
      <nav class="robot-top-nav" aria-label="${t('Menu Strefy Robotów','Robot zone navigation')}">
        ${link(ctx,'/szukaj',t('Ogłoszenia','Listings'),'robot-top-link')}
        ${link(ctx,'/zamowienia',t('Zamówienia i wynajem','Orders and rentals'),'robot-top-link')}
        ${link(ctx,'/wiadomosci',t('Wiadomości','Messages'),'robot-top-link')}
        ${link(ctx,'/konto',t('Konto','Account'),'robot-top-link')}
      </nav>
      <button class="robot-language" type="button" data-language-open aria-haspopup="dialog" aria-controls="language-picker" aria-label="${t('Wybierz język','Choose language')}">${icon('globe',18)} ${ctx.lang.toUpperCase()}</button>
      <button class="robot-appearance-trigger" type="button" data-icon-style-open aria-haspopup="dialog" aria-controls="icon-style-dialog" aria-label="${t('Wygląd: ramki i ikony','Appearance: frames and icons')}" title="${t('Wygląd: ramki i ikony','Appearance: frames and icons')}">${icon('side-appearance',23)}</button>
      ${link(ctx,'/sprzedaj',t('Wystaw sprzęt','List equipment'),'btn primary robot-header-add','plus')}
    </div></header>
    ${ctx.demo?`<div class="robot-demo-note">${t('Tryb demonstracyjny — dane testowe','Demo mode — test data')} · <a href="/roboty">${t('Przejdź do serwisu','Open live site')}</a></div>`:''}
    <nav class="robot-bottom-nav" aria-label="${t('Menu Strefy Robotów','Robot zone navigation')}">${links}</nav>`;
}

function projectLinks(ctx) {
  return `<div class="project-family"><h2>${ctx.t('NASZE PROJEKTY','OUR PROJECTS')}</h2><div>
    <a href="https://all4rent.app" rel="noopener">ALL4RENT.APP</a>
    <a href="${ctx.prefix||'/'}"${!ctx.robotics?' aria-current="page"':''}>BRUMBRUM.VIN</a>
    <a href="${ctx.prefix}/roboty"${ctx.robotics?' aria-current="page"':''}>${ctx.t('ROBOTY I AUTOMATYKA','ROBOTS & AUTOMATION')}</a>
  </div></div>`;
}

function sideNav(ctx,accountBadge) {
  const t=ctx.t;
  const sideLink=(path,label,name,extra='',css='')=>navItem(ctx,path,label,name,extra,css,24);
  const backgroundTitle=t('Tło strony','Site background');
  const group=(title,items)=>`<div class="side-nav-group" role="group" aria-label="${e(title)}">
    <p class="side-nav-group-title" aria-hidden="true">${e(title)}</p>${items}</div>`;
  const user=ctx.user;
  const signOut=user?apiForm('/auth/logout',`<button type="submit">${icon('logout',24)}<span>${t('Wyloguj się','Sign out')}</span></button>`,{className:'side-session'}):'';
  const modeLabel=ctx.demo?t('Przejdź do serwisu','Go to live site'):t('Tryb demo','Demo mode');
  return `<nav class="side-nav" id="side-navigation" data-side-nav inert aria-hidden="true" tabindex="-1" aria-label="${t('Menu główne','Main navigation')}">
    <button type="button" class="side-toggle" data-side-toggle aria-controls="side-nav-panel" aria-expanded="false" aria-label="${t('Rozwiń menu','Expand menu')}">${icon('side-panel',24)}<span data-side-toggle-label>${t('Menu','Menu')}</span></button>
    <div class="side-nav-panel" id="side-nav-panel">
      <div class="side-nav-quick" role="group" aria-label="${t('Twoje konto','Your account')}">
        ${sideLink('/aplikacja',t('Zainstaluj aplikację','Install the app'),'mobile')}
        ${sideLink('/ustawienia',t('Ustawienia konta','Account settings'),'settings')}
        <a class="side-labeled${active(ctx,'/uslugi')?' current':''}" href="${e(href(ctx,'/uslugi'))}"${active(ctx,'/uslugi')?' aria-current="page"':''}>
          ${icon('pin',24)}<span>${t('Usługi motoryzacyjne','Automotive services')}</span><small aria-hidden="true">${ctx.lang==='de'?'Service':t('Usługi','Services')}</small>
        </a>
      </div>
      <div class="side-nav-links">
        <details class="side-theme-picker" data-side-theme-picker>
          <summary>${icon('side-theme',24)}<span>${e(backgroundTitle)}</span></summary>
          <div class="side-theme-options">${themeOptions(ctx,'rail-theme',false)}</div>
        </details>
        ${group(t('Ogłoszenia','Listings'),`
        ${sideLink('/',t('Start','Home'),'home')}
        ${sideLink('/szukaj',t('Szukaj','Search'),'search')}
        ${sideLink('/sprzedaj',t('Sprzedaj pojazd','Sell a vehicle'),'listing','','side-sell')}
        <a href="${href(ctx,'/')}#kategorie">${icon('grid',24)}<span>${t('Kategorie','Categories')}</span></a>
        ${sideLink('/rolki','Rolki','video')}
        ${sideLink('/ulubione',t('Ulubione','Saved'),'star')}
        ${sideLink('/porownanie',t('Porównywarka','Compare'),'scale')}`)}
        ${group(t('Twoje konto','Your account'),`
        ${sideLink('/konto',t('Konto','Account'),'user',accountBadge)}
        ${user?sideLink('/moje-ogloszenia',t('Moje ogłoszenia','My listings'),'car'):''}
        ${sideLink('/wiadomosci',t('Wiadomości','Messages'),'message',pillCount(ctx.badges.messages))}
        ${sideLink('/powiadomienia',t('Powiadomienia','Notifications'),'bell',pillCount(ctx.badges.notifications))}
        ${user?.profile_type==='company'?sideLink('/panel-dealera',t('Panel dealera','Dealer dashboard'),'building'):''}
        ${isStaff(user)?sideLink('/moderacja',t('Moderacja','Moderation'),'side-moderation'):''}
        ${user?.role==='admin'?sideLink('/administracja',t('Administracja','Administration'),'side-admin'):''}
        ${signOut}`)}
        ${group(t('Wygląd aplikacji','App appearance'),`
        <button class="side-labeled" type="button" data-language-open aria-haspopup="dialog" aria-controls="language-picker">
          ${icon('globe',24)}<span>${t('Język','Language')} · ${e(languages[ctx.lang])}</span><small aria-hidden="true">${ctx.lang.toUpperCase()}</small>
        </button>
        <button class="side-theme-toggle" type="button" data-theme-toggle aria-pressed="false">${themeToggleIcons}<span>${t('Zmień motyw','Change theme')}</span></button>
        ${iconStyleTrigger(ctx)}
        ${user?sideLink('/ustawienia#rozmiar-tekstu',t('Rozmiar tekstu','Text size'),'edit'):''}
        <button type="button" data-side-sound aria-pressed="true" hidden>${icon('side-sound',24)}<span>${t('Dźwięk menu','Menu sound')}</span></button>`)}
        ${group(t('Pomoc','Help'),`
        ${sideLink('/pomoc',t('Pomoc i FAQ','Help & FAQ'),'shield')}
        ${sideLink('/kontakt',t('Kontakt','Contact'),'phone')}
        ${sideLink('/cookies',t('Ustawienia cookies','Cookie settings'),'sliders')}
        <a class="side-mode" href="${ctx.demo?'/':'/demo'}">${icon(ctx.demo?'side-exit':'test',24)}<span>${modeLabel}</span></a>
        ${ctx.demo&&user?sideLink('/zaloguj',t('Zmień rolę','Switch role'),'side-switch'):''}`)}
      </div>
    </div>
  </nav>`;
}
function logoPreset(ctx,key) {
  const asset=brandLogoAsset(ctx.brand[key]);
  return asset?`<img class="brand-logo-preset" src="${asset}" alt="${e(ctx.brand.name)}" width="510" height="170">`:logo(ctx);
}

function makeStrip(ctx) {
  const t=ctx.t;
  const makes=Object.keys(vehicleModels.car).map(name=>[name,name.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'')]).filter(([,slug])=>marqueFiles[slug]);
  const items=duplicate=>makes.map(([name,slug],index)=>`<a href="${e(href(ctx,'/szukaj?type=car&make='+encodeURIComponent(name)))}" aria-label="${e(t('Ogłoszenia marki ','Listings for ')+name)}"${duplicate?' tabindex="-1"':''}><img src="/assets/marques/${marqueFiles[slug]}" width="34" height="28" alt="" loading="lazy"><span class="visually-hidden">${e(name)}</span></a>`).join('');
  return `<div class="make-strip" data-make-strip role="region" aria-label="${e(t('Marki samochodów','Car brands'))}"><div class="make-strip-window" tabindex="0"><div class="make-strip-track"><div class="make-strip-group">${items(false)}</div><div class="make-strip-group" aria-hidden="true">${items(true)}</div></div></div><button type="button" class="make-strip-pause" data-make-pause aria-label="${e(t('Wstrzymaj przesuwanie marek','Pause brands'))}" aria-pressed="false">Ⅱ</button></div>`;
}

function nav(ctx,engravedHome) {
  const t=ctx.t;
  const headerAsset=brandLogoAsset(ctx.brand.home_logo);
  const accountBadge=pillCount(ctx.badges.messages+ctx.badges.notifications);
  const profileTrigger=css=>navItem(ctx,'/konto',t('Mój profil','My profile'),'user',accountBadge,css,21,
    active(ctx,'/konto')||['/ustawienia','/zaloguj'].includes(ctx.path),'data-profile-menu-toggle aria-controls="side-navigation" aria-expanded="false"');
  return `<a class="skip" href="#main">${t('Przejdź do treści','Skip to content')}</a><header class="site-head${engravedHome?' home-engraved-head':''}"><div class="wrap head-inner">
    <a href="${href(ctx,'/')}" class="brand header-brand" data-header-logo="${e(ctx.brand.home_logo)}">
      <span data-header-original${headerAsset?' hidden':''}>${logo(ctx)}</span>
      <img class="brand-logo-preset" data-header-preset${headerAsset?` src="${headerAsset}"`:' hidden'} alt="${e(ctx.brand.name)}" width="510" height="170">
    </a>
    ${ctx.demo?`<span class="head-demo-status">${icon('test',17)}${t('Tryb demonstracyjny','Demo mode')}</span>`:''}
    ${profileTrigger('head-profile')}
    <div class="head-actions">
      ${!ctx.demo?'<a class="btn head-demo" href="/demo">'+icon('test',17)+t('Tryb demo','Demo mode')+'</a>':''}
      <button type="button" class="head-icon language" data-language-open aria-haspopup="dialog" aria-controls="language-picker" aria-label="${t('Wybierz język','Choose language')}">${icon('globe',18)}<span>${ctx.lang.toUpperCase()}</span></button>
      ${iconStyleTrigger(ctx,true)}
      <button class="head-icon theme" data-theme-toggle aria-pressed="false" type="button" aria-label="${t('Zmień motyw','Change theme')}">${themeToggleIcons}</button>
      ${link(ctx,'/sprzedaj',t('Sprzedaj pojazd','Sell a vehicle'),'btn primary head-sell','listing')}
    </div>
  </div>
    <div class="exchange-strip" data-exchange-rates role="region" aria-label="${t('Kursy średnie walut w złotych','Average exchange rates in Polish złoty')}">
      <div class="wrap exchange-inner">
        <a class="exchange-source" href="https://nbp.pl/statystyka-i-sprawozdawczosc/kursy/"><strong>${t('Kursy NBP','NBP rates')}</strong><time></time></a>
        <div class="exchange-window" tabindex="0"><div class="exchange-track" data-rate-track></div>
          <span data-rate-status data-unavailable="${t('Kursy chwilowo niedostępne','Exchange rates temporarily unavailable')}">${t('Pobieranie kursów…','Loading exchange rates…')}</span>
        </div>
        <button class="exchange-pause" type="button" data-rate-pause aria-pressed="false" aria-label="${t('Wstrzymaj przewijanie kursów','Pause scrolling exchange rates')}"><span aria-hidden="true">Ⅱ</span><span aria-hidden="true">▶</span></button>
      </div>
    </div></header>
  ${sideNav(ctx,accountBadge)}
  ${ctx.demo?`<div class="demo-bar"><div class="wrap"><span>${icon('test',16)} <b>${t('Tryb demonstracyjny','Demo mode')}</b><span class="demo-desktop"> · ${t('Przykładowe ogłoszenia i zdjęcia poglądowe','Sample listings and illustrative images')}</span></span><div>${ctx.user?`<a href="${href(ctx,'/zaloguj')}">${t('Zmień rolę','Switch role')} ${icon('side-switch',15)}</a>`:''}<a href="/">${t('Przejdź do serwisu','Go to live site')} ${icon('side-exit',15)}</a></div></div></div>`:''}
  ${makeStrip(ctx)}
  <nav class="bottom-nav" aria-label="${t('Menu główne','Main navigation')}">
    ${navItem(ctx,'/',t('Start','Home'),'home')}
    ${navItem(ctx,'/szukaj',t('Szukaj','Search'),'search')}
    ${navItem(ctx,'/rolki','Rolki','video')}
    ${navItem(ctx,'/sprzedaj',t('Sprzedaj','Sell'),'listing','','sell-tab')}
    ${navItem(ctx,'/ulubione',t('Ulubione','Saved'),'star')}
    ${profileTrigger('')}
  </nav>`;
}
function footer(ctx) {
  const t=ctx.t;
  if (ctx.robotics) return `<footer class="robot-footer"><div class="robot-footer-inner">
    <div><a class="robot-footer-brand" href="${e(href(ctx,'/'))}">${t('Roboty i automatyka','Robots & automation')}</a>
      <p>${t('Sprzęt, który pracuje dla Ciebie.','Equipment that works for you.')}</p></div>${projectLinks(ctx)}
    <nav aria-label="${t('Informacje o serwisie','Site information')}">${link(ctx,'/kontakt',t('Kontakt','Contact'),'')}${link(ctx,'/regulamin',t('Regulamin','Terms'),'')}${link(ctx,'/prywatnosc',t('Prywatność','Privacy'),'')}${link(ctx,'/cookies',t('Cookies','Cookies'),'')}</nav>
    <small>© ${new Date().getFullYear()} BRUMBRUM.VIN · ${t('Strefa Robotów','Robot Zone')}</small>
  </div></footer>`;
  return `<footer class="site-foot"><div class="wrap foot-inner">
    <div><a class="brand" href="${href(ctx,'/')}">${logo(ctx)}</a><p>${t('Portal kupna i sprzedaży pojazdów.','A marketplace for buying and selling vehicles.')}</p></div>
    <div class="footer-links">${link(ctx,'/szukaj',t('Ogłoszenia','Listings'),'')}${link(ctx,'/uslugi',t('Usługi motoryzacyjne','Automotive services'),'')}${link(ctx,'/dealerzy',t('Dla dealerów','For dealers'),'')}${link(ctx,'/reklama',t('Reklama','Advertising'),'')}${link(ctx,'/kontakt',t('Kontakt','Contact'),'')}${link(ctx,'/pomoc',t('Pomoc i FAQ','Help & FAQ'),'')}${link(ctx,'/porownanie',t('Porównywarka','Compare'),'')}${link(ctx,'/aplikacja',t('Aplikacja','App'),'')}</div>
    <div class="footer-links">${link(ctx,'/regulamin',t('Regulamin','Terms'),'')}${link(ctx,'/prywatnosc',t('Prywatność','Privacy'),'')}${link(ctx,'/cookies',t('Ustawienia cookies','Cookie settings'),'')}
      <a href="/statystyki${ctx.lang==='pl'?'':'?lang='+ctx.lang}">${t('Statystyki portalu','Site statistics')}</a>
      <a href="/statystyki${ctx.lang==='pl'?'':'?lang='+ctx.lang}#statystyki-banerow">${t('Statystyki banerów','Banner statistics')}</a>
      <a href="${ctx.demo?'/':'/demo'}">${ctx.demo?t('Serwis właściwy','Live site'):t('Wypróbuj demo','Try the demo')}</a>
    </div>
  </div><div class="wrap">${projectLinks(ctx)}</div><div class="wrap foot-end"><span>© ${new Date().getFullYear()} ${e(ctx.brand.name)}</span><span>PLN · ${t('Polska','Poland')}</span></div></footer>`;
}
export function layout(ctx,view) {
  const name=ctx.robotics?ctx.t('Roboty i automatyka · BRUMBRUM.VIN','Robots & automation · BRUMBRUM.VIN'):ctx.brand.name;
  const title=view.title?view.title+' | '+name:name;
  const desc=view.description||(ctx.robotics?ctx.t('Kupuj, wynajmuj i wystawiaj roboty oraz sprzęt automatyki.','Buy, rent and list robots and automation equipment.'):ctx.t('Szukaj pojazdów i wystaw własne ogłoszenie.','Find vehicles and publish your own listing.'));
  const brandPreview=!view.image&&name==='BRUMBRUM.VIN';
  const og=new URL(view.image||(ctx.robotics?'/assets/robots/hero.png':brandPreview?'/assets/brumbrum-link-preview.jpg':'/assets/hero.webp'),ctx.origin).href;
  const canonical=new URL(view.canonical||ctx.url.pathname,ctx.origin);
  if (ctx.lang!=='pl') canonical.searchParams.set('lang',ctx.lang);
  const noindex=ctx.demo||!view.index||ctx.env.PUBLIC_INDEXING!=='1';
  const launchScreen=!ctx.robotics&&ctx.path==='/'&&name==='BRUMBRUM.VIN';
  return `<!doctype html><html lang="${ctx.lang}" data-market="${ctx.robotics?'robotics':'vehicles'}" data-theme="light" data-palette="light" data-theme-modes="${e(JSON.stringify(themeModes))}" data-theme-materials="${themeMaterials}" data-theme-stitch-values="${e(JSON.stringify(themeStitchValues))}" data-icon-surface="none" data-icon-style="${defaultIconStyle}" data-icon-styles="${iconStyleValues}" ${buttonFinishAttributes(buttonFinishes.stock)} data-button-finish-choices="${e(JSON.stringify(buttonFinishChoices))}" data-button-finish-presets="${e(JSON.stringify(buttonFinishes))}" data-button-hardware-choices="${e(JSON.stringify(buttonHardwareChoices))}" data-button-hardware="${e(JSON.stringify(defaultButtonHardware))}" data-button-embroidery="${defaultButtonEmbroidery}" data-button-embroidery-choices="${buttonEmbroideryValues}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-5QNJH39C"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());</script>
  <title>${e(title)}</title><meta name="description" content="${e(desc)}"><meta name="theme-color" content="${ctx.robotics?'#ffffff':'#000000'}"><meta name="robots" content="${noindex?'noindex, nofollow':'index, follow'}">
  <link rel="canonical" href="${e(canonical)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="${e(name)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(og)}">
  ${brandPreview?'<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="BRUMBRUM.VIN">':''}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${ctx.robotics?'/assets/robots/icon.svg':'/assets/icon-32.png?v=engine-start'}"><link rel="apple-touch-icon" href="${ctx.robotics?'/assets/robots/icon-180.png':'/assets/icon-180.png?v=engine-start'}"><link rel="manifest" href="${href(ctx,'/manifest.webmanifest')}?lang=${ctx.lang}" crossorigin="use-credentials">
  ${name==='BRUMBRUM.VIN'?appleStartupImages:''}
  <script src="/appearance.js?v=13"></script>
  ${ctx.robotics?'<script src="/assets/robot-appearance.js?v=2"></script>':''}
  ${view.watchPage||view.reelsPage?'':'<link rel="stylesheet" href="/assets/launch-screen.css?v=uniform-logo"><script defer src="/assets/header-logo.js?v=5"></script>'}
  ${launchScreen?'<script src="/assets/launch-screen.js"></script>':''}
  <link rel="stylesheet" href="/styles.css?v=wizard-layout"><link rel="stylesheet" href="/assets/vehicle-catalog-layout.css?v=4"><link rel="stylesheet" href="/assets/service-shell.css?v=rail4">
  ${view.services?'<link rel="stylesheet" href="/assets/services-map.css"><link rel="stylesheet" href="/assets/services-promo.css"><script type="module" src="/assets/services-ui.js"></script><script type="module" src="/assets/services-map.js"></script><script type="module" src="/assets/services-promo.js"></script>':''}
  <link rel="stylesheet" href="/assets/robots.css?v=6">${ctx.robotics?'<link rel="stylesheet" href="/assets/robots-demo.css?v=2"><link rel="stylesheet" href="/assets/robot-appearance.css?v=3"><script type="module" src="/assets/robots.js?v=3"></script>':''}
  ${view.automation?'<script type="module" src="/assets/automation-ui.js"></script>':''}${view.structured?'<script type="application/ld+json">'+JSON.stringify(view.structured).replace(/</g,'\\u003c')+'</script>':''}
  ${view.watchPage?'':view.reelsPage?'<script type="module" src="/assets/reels-feed.js?v=9"></script>':'<script type="module" src="/app.js?v=listingvideo90"></script><script type="module" src="/assets/exchange-rates.js?v=4"></script>'}</head>
  <body class="${ctx.robotics?'robot-app ':''}${view.watchPage?'watch-page':view.listingPage?'listing-page':view.reelsPage?'reels-screen':''}" data-market="${ctx.robotics?'robotics':'vehicles'}" style="--accent:${e(ctx.brand.accent)}" data-prefix="${ctx.prefix}" data-user="${e(ctx.user?.id||'')}" data-lang="${ctx.lang}" data-demo="${ctx.demo?'1':'0'}">
  ${launchScreen?`<div class="launch-screen" aria-hidden="true"><div class="launch-badge${brandLogoAsset(ctx.brand.launch_logo)?' launch-badge-preset':''}">${logoPreset(ctx,'launch_logo')}</div>
    <button class="launch-engine-start" type="button" data-engine-start hidden><img src="/assets/icon-192.png?v=engine-start" width="42" height="42" alt=""> <span>ENGINE START</span></button></div>`:''}
  ${iconMaterials}${(view.watchPage||view.reelsPage)?`<main id="main">${view.body}</main>`:
    `${iconCollectionBrandDefinition}${ctx.robotics?robotNav(ctx):nav(ctx,launchScreen)}<main id="main">${view.body}</main>${footer(ctx)}${languagePicker(ctx)}${view.inlineIconSettings?'':iconStyleDialog(ctx)}<aside class="compare-tray" data-compare-tray hidden></aside><div class="toast" data-toast role="status" aria-live="polite" hidden></div>`}</body></html>`;
}

export const wrap = (html,className='') => `<div class="wrap page${className?' '+className:''}">${html}</div>`;
export const keyInput = () => hidden('key',id());
