import { favorites } from './inbox.js';
import { listingsByKeys, publicOffer, search } from './market.js';
import { e, href, icon, link, loginLink, price, tag, titleOf, wrap } from './ui.js';

export function offlinePage(ctx) {
  const t=ctx.t;
  const title=t('Brak połączenia','You’re offline');
  const help=t('Sprawdź połączenie i ponownie otwórz stronę. Wiadomości i ogłoszenia wymagają dostępu do sieci.',
    'Reconnect and reopen the page to send messages or submit listings.');
  return new Response(`<!doctype html><html lang="${ctx.lang}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
    <title>${e(title)}</title><link rel="stylesheet" href="/styles.css"></head>
    <body><main class="wrap page"><div class="error-view"><h1>${e(title)}</h1><p>${e(help)}</p>
    <a class="btn primary" href="/?lang=${ctx.lang}">${e(t('Strona główna','Home'))}</a></div></main></body></html>`,
  {headers:{'Content-Type':'text/html; charset=utf-8','Content-Language':ctx.lang,'Cache-Control':'private, no-store'}});
}

export function installPage(ctx) {
  const t=ctx.t;
  const title=t('Zainstaluj aplikację','Install the app');
  return {title,body:wrap(`
    <section class="device-intro">
      <img src="/assets/icon-192.png?v=emblem" width="80" height="80" alt="">
      <div>
        <h1>${e(title)}</h1>
        <p>${t('Dodaj aplikację do ekranu głównego, by otwierać ogłoszenia, ulubione i wiadomości jednym dotknięciem.','Add the app to your home screen for one-tap access to listings, saved vehicles and messages.')}</p>
        <button type="button" class="btn primary" data-install hidden>${icon('download',18)} ${e(title)}</button>
        <p class="device-install-status" data-install-status role="status" hidden></p>
      </div>
    </section>
    <div class="device-grid">
      <section class="panel device-card">
        <span class="mini-icon">${icon('mobile',23)}</span>
        <h2>${t('iPhone i iPad','iPhone and iPad')}</h2>
        <ol>
          <li>${t('Otwórz tę stronę w Safari.','Open this page in Safari.')}</li>
          <li>${t('Wybierz <strong>Udostępnij</strong>, a następnie <strong>Do ekranu początkowego</strong>.','Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.')}</li>
          <li>${t('Włącz <strong>Otwórz jako aplikację internetową</strong>, jeśli ta opcja jest widoczna. Stuknij <strong>Dodaj</strong>.','Turn on <strong>Open as Web App</strong> if available, then tap <strong>Add</strong>.')}</li>
        </ol>
      </section>
      <section class="panel device-card">
        <span class="mini-icon">${icon('download',23)}</span>
        <h2>Android</h2>
        <ol>
          <li>${t('Otwórz tę stronę w Chrome.','Open this page in Chrome.')}</li>
          <li>${t('Dotknij przycisku instalacji u góry lub otwórz menu Chrome <strong>⋮</strong>.','Tap the install button above or open the Chrome menu <strong>⋮</strong>.')}</li>
          <li>${t('W menu wybierz <strong>Dodaj do ekranu głównego</strong> i zatwierdź instalację.','In the menu, choose <strong>Add to Home screen</strong> and confirm the installation.')}</li>
        </ol>
      </section>
      <section class="panel device-card">
        <span class="mini-icon">${icon('download',23)}</span>
        <h2>${t('Komputer','Computer')}</h2>
        <p>${t('Jeśli przeglądarka obsługuje instalację, wybierz przycisk u góry strony lub opcję instalacji w menu przeglądarki.',
          'If your browser supports installation, use the button above or the install option in your browser menu.')}</p>
      </section>
      <section class="panel device-card">
        <span class="mini-icon">${icon('globe',23)}</span>
        <h2>Smartwatch</h2>
        <p>${t('Jeśli Twój zegarek otwiera strony internetowe, użyj uproszczonego widoku z najnowszymi ofertami, cenami i ulubionymi z konta.','If your watch can open websites, use the compact view for new listings, prices and your account favorites.')}</p>
        ${link(ctx,'/zegarek',t('Otwórz widok na zegarek','Open the watch view'),'btn','arrow')}
      </section>
    </div>`)};
}

function watchPath(saved=false,slug='') {
  const query=new URLSearchParams();
  if (saved) query.set('widok','ulubione');
  if (slug) query.set('oferta',slug);
  return '/zegarek'+(query.size?'?'+query:'');
}

function watchView(ctx,title,body) {
  return {title,watchPage:true,body:`<div class="watch-shell">
    <header class="watch-brand"><span>${e(ctx.brand.name)}</span>${ctx.demo?'<span class="watch-demo">Demo</span>':''}</header>
    ${body}</div>`};
}

export function watchError(ctx,message) {
  const t=ctx.t;
  return watchView(ctx,t('Widok zegarkowy','Watch view'),`<p class="watch-empty">${e(message)}</p>
    ${link(ctx,watchPath(),t('Wróć do ofert','Back to listings'),'watch-action','back')}`);
}

export async function watchPage(ctx) {
  const t=ctx.t;
  const saved=ctx.url.searchParams.get('widok')==='ulubione';
  const key=ctx.url.searchParams.get('oferta');
  const amount=offer=>e(price(ctx,offer.price,offer.currency));
  if (key) {
    const offer=await publicOffer(ctx,key);
    return watchView(ctx,titleOf(offer),`
      ${link(ctx,watchPath(saved),t('Wróć do listy','Back to the list'),'watch-action','back')}
      <article class="watch-detail">
        <h1>${e(titleOf(offer))}</h1>
        ${offer.variant?`<p>${e(offer.variant)}</p>`:''}
        <strong class="watch-price">${amount(offer)}</strong>
        <p>${[offer.year,offer.city].filter(Boolean).map(e).join(' · ')}</p>
        ${offer.status==='sold'?tag(ctx,'sold'):''}
      </article>
      ${link(ctx,'/oferta/'+offer.slug,t('Pełne ogłoszenie','Full listing'),'watch-action','arrow')}`);
  }
  const tabs=[
    [false,t('Najnowsze','Latest'),'car'],
    [true,t('Ulubione','Saved'),'star']
  ];
  let list;
  if (saved&&!ctx.user) {
    list=`<p class="watch-empty">${t('Zaloguj się, aby zobaczyć ulubione z konta.','Sign in to see your saved vehicles.')}</p>
      ${loginLink(ctx,href(ctx,watchPath(true)),t('Zaloguj się','Sign in'),'watch-action')}`;
  } else {
    const offers=saved?await listingsByKeys(ctx,(await favorites(ctx)).slice(0,6)):
      (await search(ctx,new URLSearchParams(),{limit:6})).offers;
    list=offers.length?`<ul class="watch-list">${offers.map(offer=>`<li><a href="${e(href(ctx,watchPath(saved,offer.slug)))}">
      <span><strong>${e(titleOf(offer))}</strong><small>${amount(offer)}${offer.status==='sold'?' · '+t('Sprzedane','Sold'):''}</small></span>
      ${icon('chevron',15)}</a></li>`).join('')}</ul>`:
      `<p class="watch-empty">${saved?t('Nie masz zapisanych ofert.','You have no saved listings.'):t('Brak opublikowanych ofert.','There are no published listings.')}</p>
      ${!saved&&!ctx.demo?`<a class="watch-action" href="/demo/zegarek">${icon('test',16)}${t('Wypróbuj demo','Try the demo')}</a>`:''}`;
  }
  return watchView(ctx,t('Widok zegarkowy','Watch view'),`
    <nav class="watch-tabs" aria-label="${t('Oferty na zegarku','Listings on your watch')}">${tabs.map(([mode,label,symbol])=>
      `<a href="${e(href(ctx,watchPath(mode)))}"${mode===saved?' aria-current="page"':''}>${icon(symbol,15)}${e(label)}</a>`).join('')}</nav>
    ${list}
    ${link(ctx,saved?'/ulubione':'/szukaj',t('Pełna lista','Full list'),'watch-action','arrow')}`);
}
