import { isStaff, missing, requireUser, row, rows } from './core.js';
import { options } from './data.js';
import { listingVideoLimit } from './listing-video-policy.js';
import { favorites } from './inbox.js';
import { listingsByKeys, search, spinLimits } from './market.js';
import { robotBrands, robotCategories, robotCurrencies, robotRentalUnits, robotTradeModes } from './robot-catalog.js';
import { featuredRobotDemos, getRobotDemo, listRobotDemos } from './robot-demo.js';
import { robotOrderLimits } from './robot-orders.js';
import { apiForm, area, check, choice, day, e, embed, empty, field, flash, formStatus, hidden, href, icon, keyInput, lang, link, listingVideoLimitAttributes, localized, loginLink, pageHead, panel, price, sectionHead, submit, tag, titleOf } from './ui.js';
import { photoGallery, reportDialog } from './views-market.js';

const shell=body=>`<div class="robot-page">${body}</div>`;
const category=(ctx,key)=>lang(ctx,robotCategories[key]||['Roboty','Robots']);
const unit=(ctx,key)=>lang(ctx,robotRentalUnits[key]||robotRentalUnits.day);
const robotContext=ctx=>({...ctx,robotics:true});
const optionsOf=items=>Object.fromEntries(items.map(item=>[item,item]));
const categoryIndex=key=>Object.keys(robotCategories).indexOf(key);
const robotIllustration=key=>{
  const i=Math.max(0,categoryIndex(key));
  return `<span class="robot-category-art" style="--robot-x:${(i%4)*100/3}%;--robot-y:${Math.floor(i/4)*50}%" aria-hidden="true"></span>`;
};

export function banner(ctx,{carousel=false}={}) {
  const r=robotContext(ctx);
  return `<a class="robot-entry-banner" href="${e(href(r,'/'))}"${carousel?' data-banner-click':''} aria-label="${ctx.t('Przejdź do Strefy Robotów','Enter the Robot Zone')}">
    ${carousel?`<span class="ad-carousel-strip"><span class="ad-carousel-company">${ctx.t('ROBOTY I AUTOMATYKA','ROBOTS & AUTOMATION')}</span><span class="ad-carousel-action">${ctx.t('Przejdź do strefy','Enter zone')}${icon('arrow',15)}</span></span>`:''}
    <div class="robot-entry-copy"><span class="robot-entry-eyebrow">${ctx.t('ODKRYJ NOWY DZIAŁ','DISCOVER A NEW WORLD')}</span>
      <h2>${ctx.t('Roboty','Robots')}<br><span>${ctx.t('i automatyka','& automation')}</span></h2>
      <span class="robot-entry-cta">${ctx.t('Przejdź do Strefy Robotów','Enter the Robot Zone')}</span></div>
    <img src="/assets/robots/hero.png" width="1536" height="1024" alt="" loading="lazy" decoding="async">
  </a>`;
}

function categoryCards(ctx) {
  const entries=Object.entries(robotCategories);
  const render=([key,words])=>`<a class="robot-category-card" href="${e(href(ctx,'/szukaj?category='+key))}">
    ${robotIllustration(key)}<span>${e(lang(ctx,words))}</span></a>`;
  return `<div class="robot-category-grid">${entries.map(render).join('')}
    <a class="robot-category-card robot-category-all" href="${e(href(ctx,'/szukaj'))}">
      <span class="robot-category-art robot-category-overview" aria-hidden="true"><img src="/assets/robots/hero.png" width="1536" height="1024" alt="" loading="lazy" decoding="async"></span>
      <span>${ctx.t('Wszystkie roboty','All robots')}</span>
    </a></div>`;
}

function amount(ctx,offer) {
  return offer.tradeMode==='rent'?`${price(ctx,offer.rentalPrice,offer.currency)} / ${unit(ctx,offer.rentalUnit)}`:price(ctx,offer.price,offer.currency);
}

export function card(ctx,offer,marked=false) {
  const r=robotContext(ctx),t=ctx.t;
  return `<article class="robot-offer-card"><div class="robot-offer-photo"><a href="${e(href(r,'/oferta/'+offer.slug))}">
      ${offer.cover?`<img src="${e(offer.cover)}" alt="${e(titleOf(offer))}" width="640" height="480" loading="lazy">`:robotIllustration(offer.robotCategory)}</a>
      <span class="robot-mode-badge">${e(lang(ctx,robotTradeModes[offer.tradeMode]||robotTradeModes.sale))}</span>
      <button class="robot-favorite${marked?' selected':''}" type="button" data-favorite="${e(offer.id)}" aria-pressed="${marked}" aria-label="${t('Dodaj do ulubionych','Save as favorite')}">${icon('star',21)}</button></div>
    <div class="robot-offer-info"><p class="robot-overline">${e(category(ctx,offer.robotCategory))}</p><h3><a href="${e(href(r,'/oferta/'+offer.slug))}">${e(titleOf(offer))}</a></h3>
      <p class="robot-card-price">${e(amount(ctx,offer))}</p>${offer.tradeMode==='both'?`<p class="robot-small">${t('Wynajem od','Rental from')} ${e(price(ctx,offer.rentalPrice,offer.currency))} / ${e(unit(ctx,offer.rentalUnit))}</p>`:''}
      <div class="robot-card-meta"><span>${e(localized(ctx,'condition',offer.condition))}${offer.year?' · '+offer.year:''}</span><span>${e(offer.city)}${offer.country?' · '+e(offer.country):''}</span></div>
      <div class="robot-card-bottom"><span>${e(offer.seller_name||t('Sprzedawca','Seller'))}</span><button type="button" class="robot-compare" data-compare="${e(offer.id)}" aria-pressed="false" aria-label="${t('Porównaj','Compare')}">${icon('scale',20)}</button></div>
    </div></article>`;
}
async function cards(ctx,offers) {
  const saved=new Set(await favorites(ctx));
  return `<div class="robot-offer-grid">${offers.map(offer=>card(ctx,offer,saved.has(offer.id))).join('')}</div>`;
}

const demoTitle=(ctx,example)=>ctx.lang==='en'?example.title_en:example.title;
const demoDescription=(ctx,example)=>ctx.lang==='en'?example.description_en:example.description;
function demoNotice(ctx) {
  return `<div class="robot-demo-notice"><span class="robot-demo-badge">DEMO</span><p>${ctx.t(
    'Przykładowe modele i ceny. Oferty służą prezentacji — nie są dostępne do zakupu ani wynajmu.',
    'Example models and prices. These listings demonstrate the marketplace and are not available for purchase or rental.')}</p></div>`;
}
function demoCard(ctx,example) {
  const t=ctx.t,target='/demo/'+example.slug;
  return `<article class="robot-offer-card robot-demo-card" data-robot-demo="${e(example.slug)}">
    <a class="robot-demo-photo" href="${e(href(ctx,target))}" aria-label="${e(t('Zobacz przykład: ','View example: ')+demoTitle(ctx,example))}">
      <span class="robot-demo-badge">DEMO</span>${robotIllustration(example.robotCategory)}<span class="robot-demo-illustration">${t('Ilustracja','Illustration')}</span>
    </a><div class="robot-offer-info"><p class="robot-overline">${e(category(ctx,example.robotCategory))}</p>
      <h3>${link(ctx,target,demoTitle(ctx,example),'')}</h3><span class="robot-demo-mode">${e(lang(ctx,robotTradeModes[example.tradeMode]))}</span>
      <p class="robot-demo-price-label">${t('Cena przykładowa','Example price')}</p><p class="robot-card-price">${e(amount(ctx,example))}</p>
      ${example.tradeMode==='both'?`<p class="robot-small">${t('Przykładowy najem','Example rental')}: ${e(price(ctx,example.rentalPrice,example.currency))} / ${e(unit(ctx,example.rentalUnit))}</p>`:''}
      <dl class="robot-demo-spec-preview">${example.parameters.slice(0,3).map(([pl,en,value])=>`<div><dt>${t(pl,en)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
      <div class="robot-demo-card-bottom"><span>${e(localized(ctx,'condition',example.condition))} · ${example.year}</span>${link(ctx,target,t('Zobacz przykład','View example'),'robot-text-link','grid')}</div>
    </div></article>`;
}
function demoPath(params) {
  const query=new URLSearchParams(params);query.delete('page');
  return '/demo'+(query.size?'?'+query:'');
}
function demoSection(ctx,examples,{limit=8,allPath='/demo',realEmpty=false}={}) {
  const t=ctx.t;
  return `<section class="robot-market-section robot-demo-section" aria-labelledby="robot-demo-heading" data-robot-demo-count="${examples.length}">
    <div class="section-head"><h2 id="robot-demo-heading">${t('Przykładowe ogłoszenia','Example listings')} <span class="robot-demo-heading-mark">• DEMO</span></h2>${allPath?link(ctx,allPath,t('Pokaż wszystkie przykłady','View all examples'),'robot-text-link'):''}</div>
    ${realEmpty?`<div class="robot-demo-real-status"><p>${t('0 prawdziwych ogłoszeń. Poniżej zobaczysz przykładowe oferty.','0 real listings. Explore example listings below.')}</p>${link(ctx,'/sprzedaj',t('Wystaw sprzęt','List equipment'),'robot-text-link','plus')}</div>`:''}
    ${demoNotice(ctx)}<p class="robot-demo-count">${examples.length} ${t('przykładów DEMO — poza liczbą prawdziwych ogłoszeń','DEMO examples — separate from real listing counts')}</p>
    ${examples.length?`<div class="robot-offer-grid robot-demo-grid">${examples.slice(0,limit).map(example=>demoCard(ctx,example)).join('')}</div>`:
      `<div class="robot-demo-empty"><p>${t('Brak przykładów DEMO dla tych filtrów.','No DEMO examples match these filters.')}</p>${link(ctx,'/demo',t('Zobacz wszystkie przykłady','View all examples'),'robot-text-link')}</div>`}
  </section>`;
}

export function demoPage(ctx) {
  const t=ctx.t,params=ctx.url.searchParams,examples=listRobotDemos(params);
  return {title:t('Ogłoszenia przykładowe — DEMO','Example listings — DEMO'),index:false,body:shell(
    pageHead(t('Zobacz, jak działa Strefa Robotów','Explore the Robot Zone'),t('Galeria fikcyjnych ogłoszeń w 11 kategoriach.','A gallery of fictional listings in 11 categories.'),
      link(ctx,'/szukaj',t('Prawdziwe ogłoszenia','Real listings'),'btn robot-outline','search'))+
    searchForm(ctx,params,false,'/demo')+demoSection(ctx,examples,{limit:examples.length,allPath:''}))};
}

export function demoDetail(ctx,slug) {
  const example=getRobotDemo(slug);if(!example)missing();
  const t=ctx.t,sale=example.tradeMode!=='rent',rent=example.tradeMode!=='sale';
  const details=[['Producent przykładowy','Example manufacturer',t('Fikcyjny producent DEMO','Fictional DEMO manufacturer')],
    ['Model przykładowy','Example model',example.model],['Kategoria','Category',category(ctx,example.robotCategory)],
    ['Stan przykładowy','Example condition',localized(ctx,'condition',example.condition)],['Rok przykładowy','Example year',example.year],
    ['Lokalizacja przykładowa','Example location',example.city+', '+t('Polska','Poland')]];
  return {title:demoTitle(ctx,example)+' — DEMO',index:false,body:shell(`<div class="robot-demo-detail" data-robot-demo-detail="${e(example.slug)}">
    <nav class="robot-breadcrumb" aria-label="${t('Nawigacja okruszkowa','Breadcrumb')}">${link(ctx,'/',t('Roboty','Robots'),'')} / ${link(ctx,'/demo',t('Przykłady DEMO','DEMO examples'),'')} / ${link(ctx,'/demo?category='+example.robotCategory,category(ctx,example.robotCategory),'')}</nav>
    ${demoNotice(ctx)}<div class="robot-detail-top"><figure class="robot-demo-figure"><span class="robot-demo-badge">DEMO</span>
      ${robotIllustration(example.robotCategory)}<figcaption>${t('Ilustracja poglądowa kategorii. Nie przedstawia rzeczywistego egzemplarza oferowanego do sprzedaży.','Category illustration. It does not depict an actual unit offered for sale.')}</figcaption></figure>
      <aside class="robot-detail-summary"><p class="robot-overline">${e(category(ctx,example.robotCategory))} · DEMO</p><h1>${e(demoTitle(ctx,example))}</h1>
        <div class="robot-details-tags"><span>${e(lang(ctx,robotTradeModes[example.tradeMode]))}</span><span>${t('Fikcyjny model','Fictional model')}</span></div>
        ${sale?`<div class="robot-price-block"><small>${t('Przykładowa cena sprzedaży','Example sale price')}</small><strong>${e(price(ctx,example.price,example.currency))}</strong></div>`:''}
        ${rent?`<div class="robot-price-block${sale?' secondary':''}"><small>${t('Przykładowa stawka najmu','Example rental rate')}</small><strong>${e(price(ctx,example.rentalPrice,example.currency))}<span> / ${e(unit(ctx,example.rentalUnit))}</span></strong></div>`:''}
        <div class="robot-detail-actions">${link(ctx,'/sprzedaj',t('Wystaw własny sprzęt','List your own equipment'),'btn primary','plus')}${link(ctx,'/szukaj?category='+example.robotCategory,t('Przeglądaj prawdziwe ogłoszenia','Browse real listings'),'btn robot-outline','search')}</div>
      </aside></div><div class="robot-detail-columns"><section class="robot-form-section"><h2>${t('Przykładowy opis','Example description')}</h2><p class="prose">${e(demoDescription(ctx,example))}</p>
        <h2>${t('Przykładowe parametry','Example specifications')}</h2><dl class="robot-specs">${example.parameters.map(([pl,en,value])=>`<div><dt>${t(pl,en)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
        </section>
      <section class="robot-form-section"><h2>${t('Informacje DEMO','DEMO information')}</h2><dl class="robot-specs">${details.map(([pl,en,value])=>`<div><dt>${t(pl,en)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
        ${link(ctx,'/demo',t('Wróć do przykładów','Back to examples'),'robot-text-link','back')}</section></div></div>`)};
}

export async function home(ctx) {
  const t=ctx.t;
  const latest=await search(ctx,new URLSearchParams(),{robotics:true,limit:6});
  return {title:t('Roboty i automatyka','Robots & automation'),index:true,image:'/assets/robots/hero.png',
    description:t('Kupuj, wystawiaj i wynajmuj roboty. Humanoidy, roboty przemysłowe, kroczące, usługowe i drony.','Buy, list and rent robots. Humanoids, industrial, legged and service robots, and drones.'),
    body:shell(`<section class="robot-showcase" aria-labelledby="robot-title"><div class="robot-hero">
      <div class="robot-hero-copy"><h1 id="robot-title"><span>${t('ROBOTY','ROBOTS')}</span><em>${t('I AUTOMATYKA','& AUTOMATION')}</em></h1>
        <p>${t('Technologia gotowa do działania.','Technology ready to work.')}</p>
        <a class="robot-hero-cta" href="${e(href(ctx,'/szukaj'))}">${t('PRZEJDŹ DO STREFY ROBOTÓW','EXPLORE THE ROBOT ZONE')}</a>
        <div class="robot-hero-links">${link(ctx,'/sprzedaj',t('Wystaw sprzęt','List equipment'),'robot-text-link','plus')}${link(ctx,'/szukaj?tradeMode=rent',t('Znajdź do wynajęcia','Find a rental'),'robot-text-link','calendar')}</div>
      </div><div class="robot-hero-art"><img src="/assets/robots/hero.png" width="1536" height="1024" alt="${t('Humanoid, robot kroczący i dron na białym tle','Humanoid, legged robot and drone on a white background')}" fetchpriority="high" decoding="async"></div>
    </div><section id="kategorie" class="robot-categories" aria-label="${t('Kategorie robotów','Robot categories')}">${categoryCards(ctx)}</section></section>
    <section class="robot-market-section">${sectionHead(t('Znajdź swojego robota','Find your robot'))}${searchForm(ctx,new URLSearchParams(),true)}</section>
    ${latest.total?`<section class="robot-market-section">${sectionHead(t('Najnowsze ogłoszenia','Latest listings'),link(ctx,'/szukaj',t('Wszystkie ogłoszenia','All listings'),'robot-text-link'))}${await cards(ctx,latest.offers)}</section>`:''}
    ${demoSection(ctx,featuredRobotDemos,{realEmpty:!latest.total})}
    <section class="robot-seller-callout"><div>${icon('building',32)}<div><h2>${t('Produkujesz lub sprzedajesz roboty?','Do you manufacture or sell robots?')}</h2><p>${t('Konto firmowe, własne ogłoszenia i kontakt z klientami w jednym miejscu.','Your business profile, listings and customer conversations in one place.')}</p></div></div>
      ${link(ctx,ctx.user?'/konto':'/zarejestruj?dalej='+encodeURIComponent(href(ctx,'/sprzedaj')),t('Dołącz jako sprzedawca','Join as a seller'),'btn primary')}</section>`)};
}

function searchForm(ctx,params,compact=false,action='/szukaj') {
  const t=ctx.t;
  const illustrative=action==='/demo';
  return `<form class="robot-search-form${compact?' is-compact':''}" method="get" action="${e(href(ctx,action))}">
    <div class="robot-search-main">${field('q',t('Czego szukasz?','What are you looking for?'),params.get('q')||'',{placeholder:t('Marka, model lub zastosowanie','Brand, model or application'),attributes:'maxlength="100"'})}
      ${choice(ctx,'category',t('Kategoria','Category'),robotCategories,params.get('category')||'',{placeholder:t('Wszystkie roboty','All robots')})}
      ${choice(ctx,'tradeMode',t('Rodzaj oferty','Offer type'),{sale:['Kupno','Purchase'],rent:['Wynajem','Rental']},params.get('tradeMode')||'',{placeholder:t('Kupno i wynajem','Purchase and rental')})}
      <button type="submit" class="btn primary">${icon('search',20)}${illustrative?t('Filtruj przykłady','Filter examples'):t('Szukaj','Search')}</button></div>
    ${compact?'':`<details class="robot-search-more"${['make','model','minPrice','maxPrice','condition','city','currency'].some(key=>params.get(key))?' open':''}><summary>${t('Marka, cena i pozostałe filtry','Brand, price and more filters')}</summary><div class="field-grid">
      ${field('make',t('Producent','Manufacturer'),params.get('make')||'',{attributes:'list="robot-makes" maxlength="50"'})}${field('model',t('Model','Model'),params.get('model')||'',{attributes:'maxlength="60"'})}
      ${field('minPrice',t('Cena od','Price from'),params.get('minPrice')||'',{type:'number',attributes:'min="0" step="0.01"'})}
      ${field('maxPrice',t('Cena do','Price to'),params.get('maxPrice')||'',{type:'number',attributes:'min="0" step="0.01"'})}
      ${choice(ctx,'currency',t('Waluta ceny','Price currency'),optionsOf(robotCurrencies),params.get('currency')||'',{placeholder:t('Wszystkie','All')})}
      ${choice(ctx,'condition',t('Stan','Condition'),options.condition,params.get('condition')||'',{placeholder:t('Każdy stan','Any condition')})}
      ${field('city',t('Lokalizacja','Location'),params.get('city')||'',{attributes:'maxlength="90"'})}
      ${choice(ctx,'sort',t('Sortowanie','Sort'),{latest:['Najnowsze','Newest'],price_asc:['Cena rosnąco','Price ascending'],price_desc:['Cena malejąco','Price descending'],year:['Rok: od najnowszych','Year: newest first']},params.get('sort')||'latest',{placeholder:false})}</div>
      <p class="robot-small">${t('Przy filtrze „Wynajem” ceny dotyczą stawki najmu. Wybierz walutę, aby porównywać kwoty w tej samej walucie.','With the Rental filter, prices refer to the rental rate. Choose a currency to compare prices in the same currency.')}</p></details>`}
    <datalist id="robot-makes">${(illustrative?['Producent DEMO']:robotBrands).map(make=>`<option value="${e(make)}"></option>`).join('')}</datalist>
  </form>`;
}

export async function searchPage(ctx) {
  const t=ctx.t,params=ctx.url.searchParams;
  const result=await search(ctx,params,{robotics:true,limit:12});
  const title=params.get('category')&&robotCategories[params.get('category')]?category(ctx,params.get('category')):t('Wszystkie roboty','All robots');
  const pagination=result.pages>1?`<nav class="robot-pagination" aria-label="${t('Strony wyników','Result pages')}">${Array.from({length:Math.min(9,result.pages)},(_,i)=>{
    const p=Math.max(1,Math.min(result.pages-8,result.page-4))+i;
    if(p>result.pages)return '';
    const query=new URLSearchParams(params);query.set('page',p);
    return `<a class="${p===result.page?'is-active':''}" href="${e(href(ctx,'/szukaj?'+query))}"${p===result.page?' aria-current="page"':''}>${p}</a>`;
  }).join('')}</nav>`:'';
  return {title,index:false,body:shell(pageHead(title,`${result.total} ${t('prawdziwych ogłoszeń','real listings')}`,link(ctx,'/sprzedaj',t('Wystaw sprzęt','List equipment'),'btn primary','plus'))+
    searchForm(ctx,params)+(result.total?`<section class="robot-market-section">${await cards(ctx,result.offers)}${pagination}</section>`:'')+
      demoSection(ctx,listRobotDemos(params),{allPath:demoPath(params),realEmpty:!result.total}))};
}

export async function favoritesPage(ctx) {
  const offers=(await listingsByKeys(ctx,await favorites(ctx))).filter(item=>item.type==='robot');
  return {title:ctx.t('Ulubione roboty','Saved robots'),body:shell(pageHead(ctx.t('Ulubione roboty','Saved robots'),ctx.t('Twoje zapisane urządzenia.','Your saved equipment.'),link(ctx,'/porownanie',ctx.t('Porównaj','Compare'),'btn','scale'))+
    `<div data-saved-page>${offers.length?await cards(ctx,offers):empty(ctx,ctx.t('Jeszcze nie masz ulubionych robotów','No saved robots yet'),ctx.t('Wybierz gwiazdkę przy ogłoszeniu.','Select the star on a listing.'),link(ctx,'/szukaj',ctx.t('Przeglądaj roboty','Browse robots'),'btn primary'),'star')}</div>`)};
}
export async function renderSaved(ctx,keys) {
  const offers=(await listingsByKeys(ctx,keys)).filter(item=>item.type==='robot');
  return offers.length?cards(ctx,offers):'';
}
export function comparePage(ctx) {
  return {title:ctx.t('Porównaj roboty','Compare robots'),body:shell(pageHead(ctx.t('Porównaj roboty','Compare robots'),ctx.t('Dodaj do czterech urządzeń, aby zestawić ich parametry.','Add up to four devices to compare their specifications.'))+
    `<div data-compare-page>${empty(ctx,ctx.t('Wybierz roboty do porównania','Choose robots to compare'),'',link(ctx,'/szukaj',ctx.t('Przeglądaj ogłoszenia','Browse listings'),'btn primary'),'scale')}</div>`)};
}
export async function renderCompare(ctx,keys) {
  const offers=(await listingsByKeys(ctx,keys)).filter(item=>item.type==='robot');
  if(!offers.length)return '';
  const fields=[['Kategoria','Category',o=>category(ctx,o.robotCategory)],['Rodzaj oferty','Offer type',o=>lang(ctx,robotTradeModes[o.tradeMode])],
    ['Cena zakupu','Purchase price',o=>price(ctx,o.price,o.currency)],['Stawka najmu','Rental rate',o=>o.rentalPrice?price(ctx,o.rentalPrice,o.currency)+' / '+unit(ctx,o.rentalUnit):'—'],
    ['Kaucja za sztukę','Deposit per unit',o=>o.rentalPrice?price(ctx,o.deposit,o.currency):'—'],['Stan','Condition',o=>localized(ctx,'condition',o.condition)],
    ['Rok','Year',o=>o.year||'—'],['Lokalizacja','Location',o=>[o.city,o.country].filter(Boolean).join(', ')],['Specyfikacja','Specifications',o=>o.specs||'—']];
  return `<div class="robot-compare-table"><table><thead><tr><th>${ctx.t('Parametr','Specification')}</th>${offers.map(o=>`<th>${link(ctx,'/oferta/'+o.slug,titleOf(o),'robot-text-link')}</th>`).join('')}</tr></thead>
    <tbody>${fields.map(([pl,en,get])=>`<tr><th>${ctx.t(pl,en)}</th>${offers.map(o=>`<td>${e(get(o))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function sellStart(ctx) {
  return {title:ctx.t('Wystaw robota','List a robot'),body:shell(`<section class="robot-start"><span class="robot-start-icon">${icon('plus',38)}</span>
    <h1>${ctx.t('Twój sprzęt. Nowe możliwości.','Your equipment. New possibilities.')}</h1><p>${ctx.t('Dodaj robota na sprzedaż, wynajem lub w obu wariantach. Podstawowe ogłoszenie jest bezpłatne.','List your robot for sale, rental or both. A basic listing is free.')}</p>
    ${apiForm('/listings',keyInput()+hidden('market','robotics')+submit(ctx.t('Rozpocznij ogłoszenie','Start a listing'),'plus'))}
    ${link(ctx,'/moje-ogloszenia',ctx.t('Moje ogłoszenia i szkice','My listings and drafts'),'robot-text-link')}</section>`)};
}

export function wizard(ctx,offer,state) {
  const t=ctx.t,d=state.data;
  const f=(name,label,settings={})=>field(name,label,d[name]??'',settings);
  const n=(name,label,{min=0,max=1e8,required=false,money=false}={})=>f(name,label,{type:'number',required,attributes:`min="${min}" max="${max}" step="${money?'0.01':'1'}" inputmode="${money?'decimal':'numeric'}"`});
  const c=(name,label,items,required=false)=>choice(ctx,name,label,items,d[name]??'',{required,placeholder:required?t('Wybierz','Select'):false});
  return {title:t('Wystaw sprzęt','List equipment'),body:shell(pageHead(offer.status==='draft'?t('Wystaw sprzęt','List equipment'):t('Edytuj ogłoszenie','Edit listing'),t('Dane zapisują się na Twoim koncie.','Your data is saved to your account.'),link(ctx,'/moje-ogloszenia',t('Moje ogłoszenia','My listings'),'btn'))+
    (offer.status==='published'?flash(t('Publikacja zmian wymaga ponownej moderacji. Dotychczasowe zamówienia zachowują uzgodnione ceny.','Publishing changes requires another review. Existing orders keep their agreed prices.'),'warn'):'')+
    `<form method="post" novalidate class="robot-editor" data-robot-editor="${e(offer.id)}" ${listingVideoLimitAttributes(t)} data-version="${state.version}" data-photos="${embed(state.photos)}" data-spin="${embed(state.spin)}" data-video="${e(state.video||'')}">
      ${hidden('type','robot')}${hidden('market','robotics')}
      <section class="robot-form-section"><h2>${t('Sprzęt i zastosowanie','Equipment and application')}</h2><div class="field-grid">
        ${c('robotCategory',t('Kategoria robota','Robot category'),robotCategories,true)}${c('tradeMode',t('Rodzaj ogłoszenia','Listing type'),robotTradeModes,true)}
        ${f('make',t('Producent','Manufacturer'),{required:true,attributes:'list="robot-brands" maxlength="50"'})}${f('model',t('Model','Model'),{required:true,attributes:'maxlength="60"'})}
        ${f('variant',t('Wersja / konfiguracja','Version / configuration'),{attributes:'maxlength="95"'})}${n('year',t('Rok produkcji (opcjonalnie)','Year (optional)'),{min:1900,max:new Date().getFullYear()+1})}
        ${c('condition',t('Stan','Condition'),options.condition,true)}${c('damage',t('Uszkodzenia','Damage'),options.damage,true)}</div>
        <datalist id="robot-brands">${robotBrands.map(brand=>`<option value="${e(brand)}"></option>`).join('')}</datalist>
        ${area('description',t('Opis ogłoszenia','Listing description'),d.description,{required:true,rows:6,attributes:'minlength="12" maxlength="7000"'})}
        ${area('specs',t('Parametry techniczne i wyposażenie','Technical specifications and equipment'),d.specs,{rows:4,attributes:'maxlength="3000" placeholder="Udźwig, czas pracy, zasilanie, wymiary, sterowanie, oprogramowanie…"'})}
        <details><summary>${t('Opis w języku angielskim','English description')}</summary>${area('description_en',t('Opis po angielsku','English description'),d.description_en,{rows:4,attributes:'maxlength="7000"'})}</details>
      </section>
      <section class="robot-form-section"><h2>${t('Ceny i dostępność','Pricing and availability')}</h2><div class="field-grid">
        ${c('currency',t('Waluta','Currency'),optionsOf(robotCurrencies),true)}
        <div data-robot-sale>${n('price',t('Cena sprzedaży za sztukę','Sale price per unit'),{min:.01,required:true,money:true})}</div>
        <div data-robot-rental>${n('rentalPrice',t('Stawka najmu za sztukę','Rental rate per unit'),{min:.01,required:true,money:true})}</div>
        <div data-robot-rental>${c('rentalUnit',t('Okres rozliczeniowy najmu','Rental billing period'),robotRentalUnits,true)}</div>
        <div data-robot-rental>${n('deposit',t('Kaucja za sztukę','Deposit per unit'),{money:true})}</div>
        <div data-robot-rental>${n('minimumRental',t('Minimalna liczba okresów najmu','Minimum rental billing periods'),{min:1,max:3650,required:true})}</div>
        ${n('stock',t('Pula dostępnych sztuk','Total unit pool'),{max:100000,required:true})}${n('leadTime',t('Czas przygotowania / realizacji (dni)','Preparation / lead time (days)'),{max:3650})}
      </div><p class="robot-small">${t('Zakupy i potwierdzone rezerwacje pomniejszają dostępność automatycznie. Zwiększ pulę, gdy uzupełniasz sprzęt. Tydzień najmu to 7 dni, miesiąc to 30 dni.','Purchases and confirmed reservations reduce availability automatically. Increase the pool when adding stock. A rental week is 7 days and a month is 30 days.')}</p>
      ${check('negotiable',t('Cena do negocjacji','Price negotiable'),d.negotiable)}</section>
      <section class="robot-form-section"><h2>${t('Zdjęcia i film','Photos and video')}</h2><p>${t('Dodaj zdjęcia sprzedawanego sprzętu. Pierwsze zdjęcie będzie okładką.','Add photos of the equipment you are offering. The first photo becomes the cover.')}</p>
        <label class="robot-upload">${icon('upload',28)}<strong>${t('Wybierz zdjęcia','Choose photos')}</strong><span>JPEG, PNG, WebP · ${t('do 12 MB / plik · maks. 30','up to 12 MB / file · max. 30')}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" data-robot-photos></label>
        <div class="robot-edit-photos" data-robot-photo-grid></div>
        <details><summary>${t('Film i zdjęcia 360°','Video and 360° photos')}</summary><div class="stack">
          ${field('videoFile',t('Film MP4 (H.264) lub WebM do {limit} MiB','MP4 (H.264) or WebM video up to {limit} MiB',{limit:listingVideoLimit/1024**2}),'',{type:'file',attributes:'accept="video/mp4,video/webm" data-robot-video'})}
          <div data-robot-video-preview></div><button type="button" class="btn" data-robot-video-remove hidden>${t('Usuń film','Remove video')}</button>
          ${field('spinFiles',t('Ujęcia 360°: od 8 do 24 zdjęć','360° sequence: 8–24 photos'),'',{type:'file',attributes:'multiple accept="image/jpeg,image/png,image/webp" data-robot-spin'})}
          <div class="robot-edit-photos" data-robot-spin-grid></div></div></details>
      </section>
      <section class="robot-form-section"><h2>${t('Lokalizacja i kontakt','Location and contact')}</h2><div class="field-grid">
        ${f('country',t('Kraj','Country'),{required:true,attributes:'maxlength="80"'})}${f('city',t('Miejscowość','City'),{required:true,attributes:'maxlength="90"'})}
        ${f('region',t('Region / województwo','Region / province'),{attributes:'maxlength="90"'})}${c('contact',t('Preferowany kontakt','Preferred contact'),options.contact,true)}
        ${f('listingPhone',t('Publiczny numer telefonu (opcjonalnie)','Public phone number (optional)'),{type:'tel',attributes:'maxlength="30" autocomplete="tel"'})}</div>
      </section><div class="robot-editor-actions"><p data-robot-status role="status" aria-live="polite">${t('Szkic zapisany na koncie.','Draft saved to your account.')}</p>
        <button class="btn" type="submit" name="action" value="save">${t('Zapisz szkic','Save draft')}</button><button class="btn primary" type="submit" name="action" value="preview">${t('Podgląd i publikacja','Preview and publish')}</button></div>
    </form>`)};
}

function orderDialog(ctx,offer,kind,quantityLimit) {
  const t=ctx.t,rental=kind==='rental';
  const name=rental?t('Wynajmij sprzęt','Rent equipment'):t('Zamów produkt','Order product');
  const leadDays=Math.max(0,Number(offer.leadTime)||0);
  const rentalDays=Math.max(1,Number(offer.minimumRental)||1)*({day:1,week:7,month:30}[offer.rentalUnit]||1);
  const calendarDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateAfter=days=>new Date(Date.parse(calendarDay+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  const contents=hidden('listingId',offer.id)+hidden('kind',kind)+keyInput()+
    `<p>${e(titleOf(offer))}</p><strong>${e(rental?price(ctx,offer.rentalPrice,offer.currency)+' / '+unit(ctx,offer.rentalUnit):price(ctx,offer.price,offer.currency))}</strong>`+
    field('quantity',t('Liczba sztuk','Quantity'),1,{type:'number',required:true,attributes:`min="1" max="${quantityLimit}" step="1"`})+
    (rental?`<div class="field-grid">${field('startsOn',t('Początek najmu','Rental start'),'',{type:'date',required:true,attributes:`min="${dateAfter(leadDays)}"`})}${field('endsOn',t('Koniec najmu / zwrot','Rental end / return'),'',{type:'date',required:true,attributes:`min="${dateAfter(leadDays+rentalDays)}"`})}</div>
      <p class="robot-small">${t('Dzień zwrotu nie jest naliczany. Tydzień = 7 dni, miesiąc = 30 dni. Minimum','The return day is not charged. A week = 7 days, a month = 30 days. Minimum')}: ${e(offer.minimumRental||1)} × ${e(unit(ctx,offer.rentalUnit))}. ${t('Kaucja za sztukę','Deposit per unit')}: ${e(price(ctx,offer.deposit||0,offer.currency))}.</p>
      <p class="robot-small">${t('Dostępność sztuk sprawdzimy dla wybranego terminu po wysłaniu prośby.','Unit availability is checked for the selected dates when you send the request.')}</p>`:'')+
    area('note',t('Wiadomość dla sprzedawcy (opcjonalnie)','Message to seller (optional)'),'',{rows:3,attributes:'maxlength="2000"'})+
    `<p class="robot-order-help">${t('Zgłoszenie trafi do sprzedawcy do potwierdzenia. Dostawę i płatność ustalicie bezpośrednio. Na tym etapie nie pobieramy płatności.','Your request goes to the seller for confirmation. Arrange delivery and payment directly. No payment is collected at this step.')}</p>`+
    submit(rental?t('Wyślij prośbę o rezerwację','Request a reservation'):t('Złóż zamówienie','Place order'));
  return `<dialog class="robot-dialog" data-dialog="robot-${kind}"${rental?` data-robot-lead-days="${leadDays}" data-robot-rental-days="${rentalDays}"`:''} aria-label="${e(name)}"><div class="robot-dialog-head"><h2>${e(name)}</h2><button class="icon-button" type="button" data-close aria-label="${t('Zamknij','Close')}">${icon('close')}</button></div>${apiForm('/robot-orders',contents)}</dialog>`;
}

export async function detail(ctx,offer,{mode='public',extras=''}={}) {
  const t=ctx.t,isPublic=mode==='public',owner=ctx.user?.id===offer.user_id;
  const enabled=isPublic&&offer.status==='published'&&!owner;
  const sale=['sale','both'].includes(offer.tradeMode),rent=['rent','both'].includes(offer.tradeMode);
  const limits=enabled?await robotOrderLimits(ctx,offer.id):{purchase:0,rental:0};
  const hasStock=(sale&&limits.purchase>0)||(rent&&limits.rental>0);
  const action=(kind,label)=>limits[kind]>0&&!ctx.user?loginLink(ctx,href(ctx,'/oferta/'+offer.slug),label,'btn primary','user'):
    `<button class="btn ${kind==='purchase'?'primary':'robot-outline'}" type="button"${limits[kind]>0?` data-open="robot-${kind}"`:' disabled'}>${icon(kind==='purchase'?'listing':'calendar',20)}${e(label)}</button>`;
  const specs=[['Kategoria','Category',category(ctx,offer.robotCategory)],['Producent','Manufacturer',offer.make],['Model','Model',offer.model],['Stan','Condition',localized(ctx,'condition',offer.condition)],
    ['Rok produkcji','Year',offer.year||'—'],['Uszkodzenia','Damage',localized(ctx,'damage',offer.damage)],['Lokalizacja','Location',[offer.city,offer.region,offer.country].filter(Boolean).join(', ')],
    ['Czas przygotowania','Preparation time',offer.leadTime==null?t('Do ustalenia','To be agreed'):offer.leadTime+' '+t('dni','days')]];
  const phone=offer.listingPhone?.replace(/[^+0-9]/g,'');
  const message=ctx.user?apiForm('/offers/'+offer.id+'/message',keyInput()+area('body',t('Wiadomość do sprzedawcy','Message to seller'),'',{required:true,rows:3,attributes:'maxlength="3000"'})+submit(t('Wyślij wiadomość','Send message'),'message'),{go:'thread'}):loginLink(ctx,href(ctx,'/oferta/'+offer.slug),t('Zaloguj się, aby napisać','Sign in to message'),'btn','message');
  return {title:titleOf(offer),index:isPublic&&offer.status==='published',image:offer.photos[0]?.url||offer.cover,description:offer.description?.slice(0,155),
    body:shell(`<nav class="robot-breadcrumb" aria-label="${t('Nawigacja okruszkowa','Breadcrumb')}">${link(ctx,'/',t('Roboty','Robots'),'')}/${link(ctx,'/szukaj?category='+offer.robotCategory,category(ctx,offer.robotCategory),'')} / <span>${e(titleOf(offer))}</span></nav>
      ${!isPublic?flash(mode==='moderation'?t('Widok moderatora','Moderator view'):t('Podgląd przed publikacją','Preview before publication')):''}
      ${offer.status==='sold'?flash(t('Oferta zakończona — sprzęt został sprzedany.','Listing closed — equipment sold.'),'warn'):''}
      <div class="robot-detail-top"><div class="robot-detail-media">${photoGallery(ctx,offer)}
        ${offer.video?`<video class="robot-detail-video" src="${e(offer.video)}" controls playsinline preload="metadata" aria-label="${t('Film z działania sprzętu','Equipment demonstration video')}"></video>`:''}
        ${offer.spin?.length>=spinLimits.min?`<details><summary>${t('Obrót 360°','360° view')}</summary><div class="robot-spin-view" data-robot-spin-view="${embed(offer.spin.map(p=>p.url))}"><img src="${e(offer.spin[0].url)}" alt="${e(titleOf(offer))}"><input type="range" min="0" max="${offer.spin.length-1}" value="0" aria-label="${t('Obróć robota','Rotate robot')}"></div></details>`:''}
      </div><aside class="robot-detail-summary"><p class="robot-overline">${e(category(ctx,offer.robotCategory))}</p><h1>${e(titleOf(offer))}</h1>${offer.variant?`<p class="robot-variant">${e(offer.variant)}</p>`:''}
        <div class="robot-details-tags"><span>${e(localized(ctx,'condition',offer.condition))}</span><span>${e(lang(ctx,robotTradeModes[offer.tradeMode]||robotTradeModes.sale))}</span>${offer.year?`<span>${offer.year}</span>`:''}</div>
        ${sale?`<div class="robot-price-block"><small>${t('Cena sprzedaży za sztukę','Sale price per unit')}</small><strong>${e(price(ctx,offer.price,offer.currency))}</strong></div>`:''}
        ${rent?`<div class="robot-price-block${sale?' secondary':''}"><small>${t('Wynajem za sztukę','Rental per unit')}</small><strong>${e(price(ctx,offer.rentalPrice,offer.currency))}<span> / ${e(unit(ctx,offer.rentalUnit))}</span></strong><p>${t('Kaucja','Deposit')}: ${e(price(ctx,offer.deposit||0,offer.currency))}</p></div>`:''}
        ${offer.negotiable?`<p class="robot-small">${t('Cena do negocjacji','Price negotiable')}</p>`:''}
        <p class="robot-location">${icon('pin',18)} ${e([offer.city,offer.country].filter(Boolean).join(', '))}</p>
        <div class="robot-detail-actions">${enabled?(sale?action('purchase',t('Zamów produkt','Order product')):'')+(rent?action('rental',t('Wynajmij','Rent')):''):owner?link(ctx,'/sprzedaj/'+offer.id,t('Zarządzaj ogłoszeniem','Manage listing'),'btn primary','edit'):''}</div>
        ${enabled&&!hasStock?`<p class="robot-small">${t('Brak wolnych sztuk do zamówienia. Skontaktuj się ze sprzedawcą w sprawie kolejnej dostępności.','No units are available to order. Contact the seller about future availability.')}</p>`:''}
        ${enabled&&hasStock&&sale&&limits.purchase===0?`<p class="robot-small">${t('Zakup jest obecnie niedostępny z powodu potwierdzonych zamówień lub rezerwacji.','Purchase is currently unavailable because of confirmed orders or rentals.')}</p>`:''}
        ${enabled?`<p class="robot-small">${t('Zamówienia i terminy potwierdza sprzedawca.','Orders and dates are confirmed by the seller.')}</p>`:''}
        <div class="robot-detail-tools"><button class="btn" type="button" data-favorite="${e(offer.id)}" aria-pressed="false">${icon('star',19)}${t('Zapisz','Save')}</button><button class="btn" type="button" data-compare="${e(offer.id)}" aria-pressed="false">${icon('scale',19)}${t('Porównaj','Compare')}</button><button class="btn" type="button" data-share="${e(href(ctx,'/oferta/'+offer.slug))}">${icon('share',19)}${t('Udostępnij','Share')}</button></div>
      </aside></div>${extras?`<section class="robot-preview-actions">${extras}</section>`:''}
      <div class="robot-detail-columns"><section class="robot-form-section"><h2>${t('Opis sprzętu','Equipment description')}</h2><p class="prose">${e(ctx.lang==='en'&&offer.description_en?offer.description_en:offer.description)}</p>
        ${offer.specs?`<h2>${t('Parametry techniczne','Technical specifications')}</h2><p class="prose">${e(offer.specs)}</p>`:''}
        <dl class="robot-specs">${specs.map(([pl,en,value])=>`<div><dt>${t(pl,en)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
        <p class="robot-small">${t('Informacje i parametry podaje sprzedawca.','Information and specifications are supplied by the seller.')} · ID ${e(offer.id)}</p></section>
      <section class="robot-form-section robot-seller"><h2>${t('Sprzedawca','Seller')}</h2><h3>${link(ctx,(offer.profile_type==='company'?'/dealer/':'/sprzedawca/')+offer.user_id,offer.seller_name||t('Sprzedawca','Seller'),'robot-text-link')}</h3>
        ${phone?`<a class="btn robot-outline" href="tel:${e(phone)}">${icon('phone',20)} ${e(offer.listingPhone)}</a>`:''}
        ${isPublic&&offer.status==='published'&&!owner?message:''}${isPublic?`<button type="button" class="robot-text-link" data-open="report">${t('Zgłoś ogłoszenie','Report listing')}</button>`:''}
      </section></div>${isPublic?reportDialog(ctx,'listing',offer.id):''}
      ${enabled&&ctx.user?(sale&&limits.purchase>0?orderDialog(ctx,offer,'purchase',limits.purchase):'')+(rent&&limits.rental>0?orderDialog(ctx,offer,'rental',limits.rental):''):''}`)};
}

export function previewActions(ctx,offer,state) {
  const t=ctx.t;
  if(offer.status==='pending')return flash(t('Ogłoszenie czeka na decyzję moderacji.','Listing is awaiting review.'));
  return `<div class="robot-preview-controls">${link(ctx,'/sprzedaj/'+offer.id,t('Wróć do edycji','Back to editing'),'btn','edit')}
    ${apiForm('/listings/'+offer.id+'/submit',hidden('version',state.version)+(offer.status==='published'?check('confirm',t('Potwierdzam ponowną moderację ogłoszenia','I confirm resubmission for review'),false,true):'')+submit(t('Prześlij do publikacji','Submit for publication'),'check'),{go:'listing-submitted'})}</div>`;
}

export function assistantPage(ctx) {
  const t=ctx.t;
  return {title:t('Asystent wyboru robota','Robot selection assistant'),body:shell(pageHead(t('Dobierz robota do zadania','Find the robot for your task'),t('Wybierz zastosowanie i formę zakupu. Pokażemy pasujące ogłoszenia.','Choose an application and how you want to acquire equipment. We will show matching listings.'))+
    `<form class="robot-assistant-form robot-form-section" method="get" action="${e(href(ctx,'/szukaj'))}">
      ${choice(ctx,'category',t('Do czego potrzebujesz robota?','What do you need the robot for?'),robotCategories,'',{required:true,placeholder:t('Wybierz zastosowanie','Choose an application')})}
      ${choice(ctx,'tradeMode',t('Kupno czy wynajem?','Purchase or rental?'),{sale:['Chcę kupić','I want to buy'],rent:['Chcę wynająć','I want to rent']},'',{placeholder:t('Rozważam obie opcje','Considering both')})}
      ${field('maxPrice',t('Maksymalna cena / stawka najmu','Maximum price / rental rate'),'',{type:'number',attributes:'min="0" step="0.01"'})}
      ${choice(ctx,'currency',t('Waluta budżetu','Budget currency'),optionsOf(robotCurrencies),'PLN',{placeholder:false})}
      ${submit(t('Pokaż pasujące roboty','Show matching robots'),'search')}</form>`)};
}

const orderNames={requested:['Oczekuje na sprzedawcę','Awaiting seller'],accepted:['Potwierdzone','Confirmed'],rejected:['Odrzucone','Declined'],cancelled:['Anulowane','Cancelled'],completed:['Zrealizowane','Completed']};
const orderName=(ctx,value)=>lang(ctx,orderNames[value]||[value,value]);

export function ordersPage(ctx,orders) {
  const t=ctx.t;
  const tab=ctx.url.searchParams.get('widok')||'all';
  const visible=orders.filter(order=>tab==='purchases'?order.isBuyer:tab==='sales'?order.isSeller:tab==='rentals'?order.kind==='rental':true);
  return {title:t('Zamówienia i rezerwacje','Orders and reservations'),body:shell(pageHead(t('Zamówienia i rezerwacje','Orders and reservations'),t('Twoje zakupy, wynajem i zamówienia klientów.','Your purchases, rentals and customer orders.'))+
    `<nav class="robot-order-tabs">${[['all','Wszystkie','All'],['purchases','Moje zamówienia','My orders'],['sales','Od klientów','From customers'],['rentals','Wynajem','Rentals']].map(([key,pl,en])=>link(ctx,'/zamowienia?widok='+key,t(pl,en),tab===key?'chip active-chip':'chip')).join('')}</nav>
    <div class="robot-orders">${visible.length?visible.map(order=>`<a class="robot-order-row" href="${e(href(ctx,'/zamowienia/'+order.id))}"><div><span class="robot-overline">${order.kind==='rental'?t('Wynajem','Rental'):t('Zakup','Purchase')} · ${order.isSeller?t('Zamówienie od klienta','Customer order'):t('Twoje zamówienie','Your order')}</span><h2>${e(order.title)}</h2><p>${e(order.isSeller?order.buyerName:order.sellerName)} · ${e(day(ctx,order.created_at))}</p>
      ${order.kind==='rental'?`<p>${e(order.starts_on)} — ${e(order.ends_on)}</p>`:''}</div><div><strong>${e(price(ctx,order.subtotal_amount/100,order.currency))}</strong><span class="robot-order-status status-${e(order.status)}">${e(orderName(ctx,order.status))}</span></div></a>`).join(''):
      empty(ctx,t('Tu pojawią się Twoje zamówienia','Your orders will appear here'),t('Zamów sprzęt lub odpowiedz na pierwsze zgłoszenie klienta.','Order equipment or respond to your first customer request.'),link(ctx,'/szukaj',t('Przeglądaj roboty','Browse robots'),'btn primary'),'calendar')}</div>`)};
}

export function orderPage(ctx,order) {
  const t=ctx.t,rental=order.kind==='rental';
  const change=(status,label,primary=false)=>apiForm('/robot-orders/'+order.id+'/status',hidden('status',status)+submit(label,'',primary?'btn primary':'btn'),{reload:true});
  const actions=order.status==='requested'?[
    ...(order.canAccept?[change('accepted',rental?t('Potwierdź rezerwację','Confirm reservation'):t('Przyjmij zamówienie','Accept order'),true),change('rejected',t('Odrzuć','Decline'))]:[]),
    ...(order.canCancel?[change('cancelled',t('Anuluj zgłoszenie','Cancel request'))]:[])]:order.status==='accepted'&&order.isSeller?[...(order.canComplete?[change('completed',t('Oznacz jako zrealizowane','Mark completed'),true)]:[]),...(order.canCancel?[change('cancelled',t('Anuluj zamówienie','Cancel order'))]:[])]:[];
  return {title:t('Szczegóły zamówienia','Order details'),body:shell(pageHead(rental?t('Rezerwacja sprzętu','Equipment reservation'):t('Zamówienie produktu','Product order'),order.title,link(ctx,'/zamowienia',t('Wszystkie zamówienia','All orders'),'btn'))+
    `<section class="robot-order-detail robot-form-section"><span class="robot-order-status status-${e(order.status)}">${e(orderName(ctx,order.status))}</span><h2>${e(order.title)}</h2>
      <p>${link(ctx,'/oferta/'+order.listingSlug,t('Zobacz ogłoszenie','View listing'),'robot-text-link')}</p>
      <dl class="robot-specs"><div><dt>${t('Kupujący / najemca','Buyer / renter')}</dt><dd>${e(order.buyerName)}</dd></div><div><dt>${t('Sprzedawca','Seller')}</dt><dd>${e(order.sellerName)}</dd></div>
      <div><dt>${t('Liczba sztuk','Quantity')}</dt><dd>${order.quantity}</dd></div><div><dt>${t('Cena / stawka za sztukę','Price / rate per unit')}</dt><dd>${e(price(ctx,order.unit_amount/100,order.currency))}${rental?' / '+e(unit(ctx,order.billing_unit)):''}</dd></div>
      ${rental?`<div><dt>${t('Okres najmu','Rental dates')}</dt><dd>${e(order.starts_on)} — ${e(order.ends_on)}</dd></div><div><dt>${t('Liczba okresów rozliczeniowych','Billing periods')}</dt><dd>${order.billing_periods}</dd></div>`:''}
      <div class="robot-order-total"><dt>${t('Wartość zamówienia','Order amount')}</dt><dd>${e(price(ctx,order.subtotal_amount/100,order.currency))}</dd></div>
      ${rental?`<div><dt>${t('Kaucja (oddzielnie)','Deposit (separate)')}</dt><dd>${e(price(ctx,order.deposit_amount/100,order.currency))}</dd></div>`:''}</dl>
      ${order.note?`<h3>${t('Wiadomość kupującego','Buyer message')}</h3><p class="prose">${e(order.note)}</p>`:''}
      <p class="robot-order-help">${t('Płatność, dostawę i pozostałe warunki ustalacie bezpośrednio. Ten status nie oznacza opłacenia zamówienia.','Arrange payment, delivery and remaining terms directly. This status does not indicate that payment has been made.')}${rental?' '+t('Dzień zwrotu nie jest naliczany.','The return day is not charged.'):''}</p>
      <div class="robot-order-actions">${actions.join('')}</div><small>ID ${e(order.id)} · ${e(day(ctx,order.created_at,true))}</small>
    </section>`)};
}
