import qr from 'qrcode-generator';
import { search, publicOffer } from './market.js';
import { e, price, km, titleOf, loginPath, href } from './ui.js';
import { cleanReturn, redirect } from './core.js';

const categories=[['car','Samochody'],['motorcycle','Motocykle'],['machinery','Maszyny'],['yachts','Jachty'],['trailer','Przyczepy'],['/dealerzy','Firmy'],['/uslugi','Usługi']];
const field=(name,label,value='',type='text',attrs='')=>`<label class="tv-field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value)}" ${attrs}></label>`;
function qrSvg(url){const code=qr(0,'M');code.addData(url);code.make();return code.createSvgTag(5,2);}
function pageShell(ctx,content,title='BRUMBRUM.VIN na TV'){
 return new Response(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08090c"><meta name="description" content="BRUMBRUM.VIN — ogłoszenia na ekranie telewizora"><title>${e(title)}</title><link rel="manifest" href="${e(href(ctx,'/tv/manifest.webmanifest'))}"><link rel="stylesheet" href="/tv.css?v=1"><script type="module" src="/tv.js?v=1"></script></head><body class="tv-mode" data-tv-root="${e(ctx.prefix+'/tv')}" data-api-root="${e(ctx.prefix+'/api')}" data-user="${e(ctx.user?.id||'')}"><main class="tv-shell">${content}</main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
}
const base=(ctx)=>{const root=ctx.prefix+'/tv';return `<header class="tv-header"><a class="tv-brand" href="${root}" data-focus><b>BRUMBRUM<span>.VIN</span></b><small>SMART TV</small></a><nav><a href="${root}" data-focus>Start</a><a href="${root}?search=1" data-focus>Szukaj</a><a href="${e(href(ctx,'/ulubione'))}" data-focus>Ulubione</a>${ctx.user?`<a href="${e(href(ctx,'/konto'))}" data-focus>Konto</a>`:`<a href="${e(loginPath(ctx,root))}" data-focus>Zaloguj</a>`}</nav></header>`;};
function card(ctx,item){const image=item.cover||'/assets/hero.webp';const back=ctx.url.pathname+ctx.url.search;return `<a class="tv-card" href="${ctx.prefix}/tv/oferta/${encodeURIComponent(item.slug)}?back=${encodeURIComponent(back)}" data-focus><img src="${e(image)}" alt="" loading="lazy"><div class="tv-card-copy"><h2>${e(titleOf(item)||'Pojazd')}</h2><strong>${e(price(ctx,item.price,item.currency))}</strong><div>${e(item.year||'—')} · ${e(item.mileage!=null?km(ctx,item.mileage):item.hours?item.hours+' mth':'—')} · ${e(item.city||'Lokalizacja niepodana')}</div></div></a>`;}
export async function tvHome(ctx){
 const params=new URLSearchParams(ctx.url.searchParams);params.delete('search');
 const result=await search(ctx,params,{limit:16});
 const query=ctx.url.searchParams;
 const active=query.get('search')==='1';
 const root=ctx.prefix+'/tv';
 const content=`${base(ctx)}<section class="tv-hero"><div><p class="tv-kicker">RYNEK MOTORYZACYJNY NA DUŻYM EKRANIE</p><h1>Znajdź swój<br><span>następny pojazd.</span></h1><p>Poruszaj się pilotem. Wybierz kategorię lub wyszukaj ogłoszenie.</p><a class="tv-primary" href="${root}?search=1" data-focus>Wyszukaj ogłoszenie <b>→</b></a></div><div class="tv-hero-art" aria-hidden="true">VIN</div></section>
 <section class="tv-categories"><h2>Kategorie</h2><div class="tv-category-grid">${categories.map(([key,label])=>`<a href="${key.startsWith('/')?href(ctx,key):root+'?category='+encodeURIComponent(key)}" data-focus><span>${label.slice(0,1)}</span>${label}</a>`).join('')}</div></section>
 ${active?`<form class="tv-search" method="get"><input type="hidden" name="search" value="1"><h2>Wyszukiwarka ogłoszeń</h2><div class="tv-search-grid">${field('make','Marka',query.get('make')||'')}${field('model','Model',query.get('model')||'')}${field('minPrice','Cena od',query.get('minPrice')||'','number','min="0"')}${field('maxPrice','Cena do',query.get('maxPrice')||'','number','min="0"')}${field('minYear','Rok od',query.get('minYear')||'','number','min="1900" max="2100"')}${field('maxMileage','Przebieg do (km)',query.get('maxMileage')||'','number','min="0"')}${field('city','Lokalizacja',query.get('city')||'')}${field('body','Nadwozie',query.get('body')||'')}${field('fuel','Paliwo',query.get('fuel')||'')}</div><button class="tv-primary" type="submit" data-focus>Pokaż wyniki</button></form>`:''}
 <section class="tv-results"><div class="tv-section-head"><h2>${query.get('category')?'Wybrana kategoria':'Najnowsze ogłoszenia'}</h2><span>${result.total} ofert</span></div>${result.offers.length?`<div class="tv-cards">${result.offers.map(item=>card(ctx,item)).join('')}</div>`:`<div class="tv-empty"><h3>Brak ogłoszeń w tej kategorii</h3><p>Zmień kategorię albo kryteria wyszukiwania.</p><a href="${root}" data-focus>Wróć do wszystkich</a></div>`}</section><footer class="tv-footer">↑ ↓ Nawigacja <i>•</i> OK Wybierz <i>•</i> ESC / BACK Wróć</footer>`;
 return pageShell(ctx,content);
}
export async function tvDetail(ctx,slug){
 const offer=await publicOffer(ctx,slug,{includePhone:true});
 const photos=offer.photos.length?offer.photos.map(p=>p.url):[offer.cover].filter(Boolean);
 const listingPath=href(ctx,'/oferta/'+offer.slug);
 const listingUrl=new URL(listingPath,ctx.origin).href;
 const root=ctx.prefix+'/tv';
 const requestedBack=cleanReturn(ctx.url.searchParams.get('back'),'/tv');
 const backUrl=requestedBack===root||requestedBack.startsWith(root+'?')?requestedBack:root;
 const qr=qrSvg(listingUrl);
 const params=[['Marka',offer.make],['Model',offer.model],['Rok',offer.year],['Przebieg',offer.mileage!=null?km(ctx,offer.mileage):offer.hours?offer.hours+' mth':'—'],['Nadwozie',offer.body||'—'],['Paliwo',offer.fuel||'—'],['Lokalizacja',[offer.city,offer.region].filter(Boolean).join(', ')||'—'],['Numer ogłoszenia',offer.id]];
 const contact=`${ctx.user?`<button data-favorite="${e(offer.id)}" data-focus class="tv-action">☆ Zapisz ogłoszenie</button>`:`<a class="tv-action" href="${e(loginPath(ctx,root+'/oferta/'+offer.slug))}" data-focus>☆ Zapisz ogłoszenie</a>`}<a class="tv-action" href="${root}/oferta/${encodeURIComponent(offer.slug)}/wiadomosc?back=${encodeURIComponent(backUrl)}" data-focus>✉ Wyślij wiadomość</a>${offer.phone_available?`<button class="tv-action" data-phone="${e(offer.id)}" data-focus>☎ Zadzwoń</button>`:`<span class="tv-action disabled">☎ Telefon niedostępny</span>`}<a class="tv-action" href="${e(backUrl)}" data-focus>← Wróć</a>`;
 const sent=ctx.url.searchParams.get('wyslano')==='1';
 const content=`${base(ctx)}<section class="tv-detail"><div class="tv-detail-top"><div><p class="tv-kicker">OGŁOSZENIE ${e(offer.id)}</p><h1>${e(titleOf(offer))}</h1><strong class="tv-price">${e(price(ctx,offer.price,offer.currency))}</strong></div><a class="tv-back" href="${e(backUrl)}" data-back data-focus>← Wróć</a></div>${sent?'<p class="tv-success" role="status">Wiadomość została wysłana do sprzedawcy.</p>':''}<div class="tv-detail-grid"><div class="tv-gallery" data-gallery data-index="0" data-photos="${e(JSON.stringify(photos))}"><img data-gallery-image src="${e(photos[0]||'')}" alt="${e(titleOf(offer))}"><button class="tv-gallery-prev" data-gallery-prev data-focus aria-label="Poprzednie zdjęcie">←</button><button class="tv-gallery-next" data-gallery-next data-focus aria-label="Następne zdjęcie">→</button><div class="tv-gallery-count"><span data-gallery-current>1</span> / ${photos.length}</div></div><aside class="tv-info"><h2>Informacje o pojeździe</h2><dl>${params.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v??'—')}</dd></div>`).join('')}</dl><h2>Sprzedawca</h2><p class="tv-seller">${e(offer.seller_name||'Sprzedawca')}</p><p class="tv-description">${e(offer.description||'Brak opisu sprzedawcy.')}</p><div class="tv-actions">${contact}</div></aside><aside class="tv-qr"><h2>Pokaż na telefonie</h2><div class="tv-qr-code" data-qr-url="${e(listingUrl)}">${qr}</div><p>Zeskanuj kod aparatem telefonu, aby otworzyć dokładnie to ogłoszenie.</p><a class="tv-action" href="${e(listingUrl)}" data-focus>Pokaż pełne ogłoszenie</a></aside></div></section><footer class="tv-footer">← → Galeria <i>•</i> ↑ ↓ Nawigacja <i>•</i> ESC / BACK Wróć</footer>`;
 return pageShell(ctx,content,titleOf(offer)+' | BRUMBRUM.VIN TV');
}
export async function tvMessage(ctx,slug){
 const offer=await publicOffer(ctx,slug);
 const path=ctx.url.pathname+ctx.url.search;
 const root=ctx.prefix+'/tv';
 const requestedBack=cleanReturn(ctx.url.searchParams.get('back'),root);
 const returnTo=requestedBack===root||requestedBack.startsWith(root+'?')?requestedBack:root;
 const backUrl=root+'/oferta/'+offer.slug+'?back='+encodeURIComponent(returnTo);
 if(!ctx.user)return redirect(loginPath(ctx,path));
 const key=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 const content=`${base(ctx)}<section class="tv-message"><a class="tv-back" href="${e(backUrl)}" data-back data-focus>← Wróć do ogłoszenia</a><p class="tv-kicker">WIADOMOŚĆ DO SPRZEDAWCY</p><h1>${e(titleOf(offer))}</h1><p>Twoja wiadomość trafi do skrzynki sprzedawcy w BRUMBRUM.VIN.</p><form data-tv-message data-listing="${e(offer.id)}" data-slug="${e(offer.slug)}" data-back-url="${e(returnTo)}"><input type="hidden" name="key" value="${e(key)}"><label class="tv-field"><span>Treść wiadomości</span><textarea name="body" rows="5" maxlength="3000" required data-focus></textarea></label><p class="tv-form-error" data-form-error tabindex="-1" hidden></p><button class="tv-primary" type="submit" data-focus>Wyślij wiadomość</button></form></section><footer class="tv-footer">↑ ↓ Nawigacja <i>•</i> OK Wybierz <i>•</i> ESC / BACK Wróć</footer>`;
 return pageShell(ctx,content,'Wyślij wiadomość | BRUMBRUM.VIN TV');
}
