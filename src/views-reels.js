import { AppError, integer, isId, missing, rows } from './core.js';
import { spinViewer } from './spin-viewer.js';
import { companyReels, feedReels, listingReel } from './reels.js';
import { demoGalleries, demoListingCount, ensureDemo, features } from './data.js';
import { byId, hydrate, phoneFor, search, spinLimits } from './market.js';
import { robotRentalUnits } from './robot-catalog.js';
import { apiForm, buttonEmbroideryLabel, choice, day, e, field, formStatus, href, icon, link, localized, panel, price, sectionHead, submit, titleOf } from './ui.js';

function reelCards(ctx,reels,manage=false) {
  const t = ctx.t;
  return `<div class="reel-grid">${reels.map(reel => `<article class="reel-card">
    <video controls playsinline preload="none" src="${href(ctx,'/rolka/'+reel.id)}"
      aria-label="${e(reel.caption||t('Rolka firmy','Company reel'))}"></video>
    ${reel.seller_id?link(ctx,'/dealer/'+reel.seller_id,reel.seller_name,'text-link'):''}
    ${reel.caption?`<p class="prose">${e(reel.caption)}</p>`:''}
    ${reel.offer_slug?link(ctx,(reel.listing_type==='robot'&&!ctx.robotics?'/roboty':'')+'/oferta/'+reel.offer_slug,t('Zobacz ogłoszenie','View listing'),'btn','arrow',{buttonFinish:true}):''}
    ${manage?apiForm('/reels/'+reel.id+'/remove',submit(t('Usuń rolkę','Delete reel'),'trash'),{
      reload:true,confirm:t('Usunąć tę rolkę z wizytówki firmy?','Delete this reel from the business profile?')
    }):''}
  </article>`).join('')}</div>`;
}

export async function publicReels(ctx,userId) {
  const reels = await companyReels(ctx,userId);
  return reels.length ? `<section class="market-section" id="rolki">${sectionHead(ctx.t('Rolki firmy','Company reels'))}${reelCards(ctx,reels)}</section>` : '';
}

export async function manageReels(ctx) {
  const t = ctx.t;
  const [reels,listings] = await Promise.all([
    companyReels(ctx,ctx.user.id),
    rows(ctx.db,`SELECT id,make,model,year FROM listings
      WHERE user_id=? AND scope=? AND status='published' ${ctx.robotics?"AND type='robot'":''} ORDER BY updated_at DESC`,ctx.user.id,ctx.scope)
  ]);
  if (ctx.robotics && !listings.length) return `<div id="rolki">${panel(t('Rolki robotów','Robot reels'),
    `<p>${t('Najpierw opublikuj ogłoszenie robota. Następnie powiążesz z nim film demonstracyjny.','Publish a robot listing first, then attach a demonstration video.')}</p>`+
    link(ctx,'/sprzedaj',t('Wystaw robota','List a robot'),'btn'))}</div>`;
  return `<div id="rolki">${panel(t('Rolki firmy','Company reels'),`
    <form class="stack" method="post" data-reel-upload${ctx.robotics?' data-market="robotics"':''}>
      <p>${t('Dodaj film z telefonu lub komputera. Rolka pojawi się na wizytówce firmy. MP4 (H.264) lub WebM do 24 MB.','Upload a video from your phone or computer. The reel appears on your business profile. MP4 (H.264) or WebM up to 24 MB.')}</p>
      ${field('video',t('Plik wideo','Video file'),'',{type:'file',required:true,attributes:'accept="video/mp4,video/webm,.mp4,.webm"'})}
      ${field('caption',t('Opis rolki','Reel caption'),'',{attributes:'maxlength="240"'})}
      ${listings.length?choice(ctx,'listing',t('Powiązane ogłoszenie','Related listing'),
        Object.fromEntries(listings.map(item=>[item.id,[item.make,item.model,item.year].filter(Boolean).join(' ')])),
        '',{placeholder:ctx.robotics?t('Wybierz robota','Select a robot'):t('Bez powiązanego ogłoszenia','No related listing'),required:ctx.robotics}):''}
      <div class="inline">${submit(t('Opublikuj rolkę','Publish reel'),'upload')}</div>
      ${formStatus}
    </form>
    ${reels.length?reelCards(ctx,reels,true):''}`)}</div>`;
}

const feedSize = 12;

function photosFor(offer) {
  return (offer.photos.length ? offer.photos :
    demoGalleries.get(offer.demo_photo) ?? (offer.demo_photo?[{url:offer.demo_photo,thumb:offer.demo_photo}]:[]));
}

function reelPrice(ctx,offer) {
  const robot=offer.type==='robot'||offer.listing_type==='robot';
  const rental=robot&&offer.tradeMode==='rent';
  const label=rental?ctx.t('Wynajem','Rental'):ctx.t('Cena','Price');
  const amount=rental?offer.rentalPrice:offer.price;
  const unit=robotRentalUnits[offer.rentalUnit];
  return `<strong class="reel-slide-price"><span>${label}</span> ${e(price(ctx,amount,offer.currency))}${rental&&unit?' / '+e(ctx.t(...unit)):''}</strong>`;
}

async function listingPhone(ctx,slug) {
  if (!slug) return '';
  try {
    return await phoneFor(ctx,slug);
  } catch (error) {
    if (error instanceof AppError && error.status===404) return '';
    throw error;
  }
}

function reelCall(ctx,phone) {
  const number=phone?.replace(/[^+0-9]/g,'');
  if (!/^\+?\d{7,15}$/.test(number||'')) {
    return `<p class="reel-no-phone">${ctx.t('Brak numeru telefonu','No phone number available')}</p>`;
  }
  return `<a class="btn reel-call" href="tel:${e(number)}" data-button-finish-action>${icon('phone',18)}
    ${buttonEmbroideryLabel(ctx.t('Zadzwoń','Call')+' · '+phone)}</a>`;
}

const financeEligibleTypes=new Set(['car','van','truck','garden','farm','construction','forestry','industrial','special']);
const reelDataBlock=(ctx,title,symbol,body)=>`<section class="reel-data-block"><h3>${icon(symbol,19)}<span>${title}</span></h3>${body}</section>`;

function reelFullData(ctx,offer) {
  const t=ctx.t;
  const specification=[
    [t('Rodzaj pojazdu','Vehicle type'),localized(ctx,'type',offer.type)],[t('Marka','Make'),offer.make],[t('Model','Model'),offer.model],
    [t('Wersja','Trim'),offer.variant],[t('Moc','Power'),offer.power?offer.power+' '+(offer.powerUnit||'KM'):'' ],
    [t('Napęd','Drivetrain'),localized(ctx,'drive',offer.drive)],[t('Kolor','Color'),offer.color],
    [t('Kraj pochodzenia','Country of origin'),offer.countryOrigin],[t('Pierwsza rejestracja','First registration'),offer.registered]
  ].filter(([,value])=>value&&value!=='—');
  const equipment=Object.values(features).flatMap(([, ,choices])=>Object.entries(choices)
    .filter(([key])=>offer.equipment?.includes(key)).map(([,pair])=>ctx.t(pair[0],pair[1])));
  const extras=Array.isArray(offer.importEquipment)?offer.importEquipment:[];
  const history=[offer.damage?`${t('Uszkodzenia','Damage')}: ${localized(ctx,'damage',offer.damage)}`:'',offer.history].filter(Boolean);
  const financing=financeEligibleTypes.has(offer.type)&&Number(offer.price)>0?reelDataBlock(ctx,t('Finansowanie / leasing','Financing / leasing'),'sliders',`<p>${t('Finansowanie dostępne dla tej oferty.','Financing is available for this listing.')}</p>`):'';
  const vin=String(offer.vin||'').trim();
  return `<div class="reel-data-content">
    <dl class="reel-detail-facts">${[
      ['calendar',t('Rok produkcji','Year'),offer.year],['gauge',t('Przebieg','Mileage'),offer.mileage?offer.mileage+' km':'—'],
      ['fuel',t('Paliwo','Fuel'),localized(ctx,'fuel',offer.fuel)],['gear',t('Skrzynia biegów','Transmission'),localized(ctx,'gearbox',offer.gearbox)]
    ].filter(([, ,value])=>value&&value!=='—').map(([symbol,label,value])=>`<div>${icon(symbol,25)}<span><dt>${e(label)}</dt><dd>${e(value)}</dd></span></div>`).join('')}</dl>
    ${specification.length?reelDataBlock(ctx,t('Pełna specyfikacja','Full specifications'),'sliders',`<dl class="reel-full-specs">${specification.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`):''}
    ${(equipment.length||extras.length)?reelDataBlock(ctx,t('Wyposażenie','Equipment'),'check',`<ul class="reel-equipment-list">${[...equipment,...extras].map(item=>`<li>${icon('check',16)}${e(item)}</li>`).join('')}</ul>`):''}
    ${history.length?reelDataBlock(ctx,t('Historia i stan','History and condition'),'shield',`<p>${e(history.join('\n'))}</p>`):''}
    ${financing}
    ${reelDataBlock(ctx,t('Dane ogłoszenia','Listing details'),'calendar',`<p>${t('Opublikowano','Published')}: ${e(day(ctx,offer.published_at))}</p>`)}
    <div class="reel-detail-actions">
      ${link(ctx,'/oferta/'+offer.slug+'?kontakt=wiadomosc',t('Napisz wiadomość','Send a message'),'btn primary','message',{buttonFinish:true})}
      ${link(ctx,'/oferta/'+offer.slug+'?kontakt=ogledziny',t('Umów oględziny','Arrange a viewing'),'btn','calendar',{buttonFinish:true})}
      ${link(ctx,'/oferta/'+offer.slug+'#sprawdz-vin',vin?t('Sprawdź VIN','Check VIN'):t('Zapytaj o VIN','Ask for VIN'),'btn','search',{buttonFinish:true})}
      ${link(ctx,'/oferta/'+offer.slug,t('Pełne ogłoszenie','Full listing'),'btn','arrow',{buttonFinish:true})}
    </div>
  </div>`;
}

function photoReel(ctx,offer,phone) {
  const t = ctx.t;
  const name = titleOf(offer);
  const photos = photosFor(offer);
  const hasSpin=offer.spin?.length>=spinLimits.min;
  const videos=[...(Array.isArray(offer.videos)?offer.videos:[]),...(offer.video?[offer.video]:[])].filter((video,index,list)=>video&&list.indexOf(video)===index);
  const videoPanels=videos.map((video,index)=>`<section class="reel-panel reel-media-panel" data-reel-panel="media" aria-label="${t('Film','Video')} ${index+1}">
      <video class="reel-panel-video" controls playsinline preload="metadata" src="${e(video)}" poster="${e(photos[0]?.thumb||photos[0]?.url||'')}" aria-label="${e(name+' · '+t('Film','Video')+' '+(index+1))}"></video>
    </section>`).join('');
  const spinPanel=hasSpin?`<section class="reel-panel reel-media-panel has-spin" data-reel-panel="spin" aria-label="${t('Widok 360°','360° view')}">
      <div class="reel-panel-spin" data-reel-panel-spin>${spinViewer(ctx,offer)}</div>
    </section>`:'';
  const mediaCount=videos.length+(hasSpin?1:0)||1;
  const media=videoPanels+spinPanel||( `<section class="reel-panel reel-media-panel" data-reel-panel="media" aria-label="${t('Film','Video')}"><div class="reel-video-empty">${icon('video',34)}<strong>${t('Film nie został dodany','No video added')}</strong><span>${t('Sprzedawca nie dodał jeszcze pionowej rolki do tego ogłoszenia.','The seller has not added a vertical reel to this listing yet.')}</span></div></section>` );
  const details=`<section class="reel-panel reel-description-panel" data-reel-panel="details" aria-label="${t('Opis ogłoszenia','Listing description')}">
      <div class="reel-detail-sheet">
        <h2>${e(name)}</h2>
        ${offer.variant?`<p class="reel-detail-model">${e(offer.variant)}</p>`:''}
        ${reelPrice(ctx,offer)}
        <p>${e(offer.description||t('Opis sprzedawcy jest dostępny w ogłoszeniu.','The seller description is available in the listing.'))}</p>
        ${reelFullData(ctx,offer)}
      </div>
    </section>`;
  return `<article class="reel-slide" data-reel-slide data-photo-reel>
    <div class="reel-panel-track" data-reel-panel-track aria-label="${t('Przesuwaj w bok: zdjęcia, dane i film','Swipe sideways: photos, details and video')}">
      <section class="reel-panel reel-photos-panel" data-reel-panel="photos">
        <div class="reel-photo-stack" style="--photo-count:${Math.min(3,photos.length)}" role="group" aria-label="${e(name+' · '+t('Zdjęcia','Photos'))}">
          ${photos.map((shot,index)=>`<img src="${e(shot.thumb||shot.url)}"
            ${shot.wide?`srcset="${e(shot.thumb)} 640w, ${e(shot.url)} 1920w" sizes="100vw"`:''}
            alt="${e(name+' · '+t('Zdjęcie','Photo')+' '+(index+1))}" loading="lazy" decoding="async">`).join('')}
        </div>
        ${photos.length>1?`<div class="reel-photo-controls" role="group" aria-label="${t('Zmień zdjęcie','Switch photo')}">
          <button type="button" data-reel-photo-prev data-button-finish-action="icon" aria-label="${t('Poprzednie zdjęcie','Previous photo')}" disabled>${icon('back',18)}</button>
          <span class="reel-control-hint" data-reel-control-hint hidden>${ctx.robotics?t('← / → Zmieniaj zdjęcia robota','← / → Browse photos of this robot'):t('← / → Zmieniaj zdjęcia auta','← / → Browse photos of this vehicle')}</span>
          <span data-reel-photo-count aria-live="polite">1 / ${photos.length}</span>
          <button type="button" data-reel-photo-next data-button-finish-action="icon" aria-label="${t('Następne zdjęcie','Next photo')}">${icon('arrow',18)}</button>
        </div>`:''}
        <div class="reel-slide-info" data-reel-info tabindex="0" role="button" aria-label="${t('Ukryj informacje o ogłoszeniu','Hide listing information')}">
          <h2>${e(name)}</h2>
          ${offer.variant?`<p>${e(offer.variant)}</p>`:''}
          ${reelPrice(ctx,offer)}
        </div>
        <button class="reel-info-tab" type="button" data-reel-info-tab data-button-finish-action aria-expanded="true" aria-label="${t('Pokaż nagłówek ogłoszenia','Show listing heading')}">${icon('back',18)}<span>${t('Pokaż cenę i model','Show price and model')}</span></button>
      </section>
      ${details}${media}
    </div>
    <div class="reel-panel-controls" data-reel-panel-controls role="group" aria-label="${t('Widok ogłoszenia','Listing view')}">
      <button type="button" data-reel-panel-prev data-button-finish-action="icon" aria-label="${t('Poprzedni widok','Previous view')}">${icon('back',18)}</button>
      <span data-reel-panel-count aria-live="polite">1 / ${2+mediaCount}</span>
      <button type="button" data-reel-panel-next data-button-finish-action="icon" aria-label="${t('Następny widok','Next view')}">${icon('arrow',18)}</button>
    </div>
  </article>`;
}

function videoReel(ctx,reel,phone,pagination) {
  const t = ctx.t;
  return `<article class="reel-slide" data-reel-slide>
    <video class="reel-slide-video" controls playsinline preload="none" src="${href(ctx,(reel.listing_video?'/wideo/':'/rolka/')+reel.id)}"
      aria-label="${e(reel.caption||titleOf(reel)||t('Rolka sprzedawcy','Seller reel'))}"></video>
    <div class="reel-slide-info">
      <h2>${e(titleOf(reel)||reel.seller_name)}</h2>
      ${reel.listing_video?reelPrice(ctx,reel):''}
      ${reel.city?`<p class="reel-seller">${icon('pin',15)}${e(reel.city)}</p>`: ''}
      ${reel.caption?`<p>${e(reel.caption)}</p>`:''}
      <div class="inline">
        ${reel.offer_slug?link(ctx,'/oferta/'+reel.offer_slug,t('Przejdź do ogłoszenia','View listing'),'btn reel-listing-link','arrow',{buttonFinish:true}):''}
        ${link(ctx,(reel.profile_type==='company'?'/dealer/':'/sprzedawca/')+reel.seller_id,reel.seller_name,'text-link')}
        ${pagination}
      </div>
      ${reelCall(ctx,phone)}
    </div>
  </article>`;
}

export async function demoSellerReels(ctx,userId) {
  if (!ctx.demo || ctx.robotics) return '';
  const result=await search(ctx,new URLSearchParams(),{sampleOnly:true,seller:userId,limit:3});
  return result.total?`<section class="market-section">${sectionHead(ctx.t('Rolki demo','Demo reels'),
    link(ctx,'/rolki?sprzedawca='+userId,ctx.t('Zobacz wszystkie','View all'),'btn','arrow'))}
    <div class="reel-grid">${result.offers.map(offer=>{
      const [cover]=photosFor(offer);
      return `<a class="reel-preview" href="${e(href(ctx,'/rolki/'+offer.slug))}">
      <img src="${e(cover.thumb||cover.url)}" alt="" loading="lazy">
      <strong>${e(titleOf(offer))}</strong>${icon('video',18)}</a>`;
    }).join('')}</div></section>`:'';
}

export async function reelsPage(ctx,slug) {
  const t=ctx.t;
  const robot=Boolean(ctx.robotics);
  const title=robot?t('Rolki robotów','Robot reels'):'Rolki';
  const sample=robot||ctx.demo?ctx:{...ctx,demo:true,prefix:'/demo',scope:'demo:seed',user:null};
  const params=ctx.url.searchParams;
  const sellerParam=params.get('sprzedawca')||'';
  const seller=isId(sellerParam)?sellerParam:undefined;
  const companyPage=integer(params.get('firmy'),1,1000000)||1;
  const liveReel=slug?await listingReel(ctx,slug):null;
  const companiesOnly=!slug&&params.get('typ')==='firmy';
  const demosOnly=!robot&&(Boolean((slug&&!liveReel)||seller)||params.get('typ')==='demo');
  if (!robot&&!ctx.demo&&!companiesOnly&&!liveReel) await ensureDemo(sample);
  const [companies,demo,record]=await Promise.all([
    liveReel?[liveReel]:demosOnly?[]:feedReels(ctx,feedSize+1,(companyPage-1)*feedSize,companiesOnly,robot?seller:undefined),
    companiesOnly||liveReel?{offers:[]}:search(sample,new URLSearchParams(robot?{page:String(companyPage)}:{}),
      {sampleOnly:!robot,seller,limit:robot?feedSize:demoListingCount,includePhone:true}),
    slug&&!liveReel?byId(sample,slug):null
  ]);
  if (slug&&!liveReel&&(!record||!['published','sold'].includes(record.status)||
    (robot?record.type!=='robot'||!hydrate(ctx,record).photos.length:!record.demo_photo||record.type==='robot'))) missing();
  const selected=record?hydrate(sample,record,null,record.status==='published'):null;
  const candidates=robot?(companyPage<=(demo.pages||1)?demo.offers.filter(offer=>offer.type==='robot'&&!offer.video&&photosFor(offer).length):[]):demo.offers;
  const offers=selected?[selected,...candidates.filter(offer=>offer.id!==selected.id)]:candidates;
  const root=href(ctx,'/rolki');
  const tabs=`<nav class="reels-tabs" aria-label="${t('Rodzaj rolek','Reel type')}">
    <a href="${root}" data-button-finish-action="tab"${!companiesOnly&&!demosOnly?' aria-current="page"':''}>${t('Wszystkie','All')}</a>
    <a href="${root}?typ=firmy" data-button-finish-action="tab"${companiesOnly?' aria-current="page"':''}>${t('Firmy','Companies')}</a>
    ${robot?'':`<a href="${root}?typ=demo" data-button-finish-action="tab"${demosOnly?' aria-current="page"':''}>${t('Demo','Demo')}</a>`}
  </nav>`;
  const visibleCompanies=companies.slice(0,feedSize);
  const hasMore=companies.length>feedSize||robot&&demo.pages>companyPage;
  const hasPrevious=!liveReel&&companyPage>1;
  const pageLink='/rolki?'+(companiesOnly?'typ=firmy&':'')+(robot&&seller?'sprzedawca='+encodeURIComponent(seller)+'&':'')+'firmy=';
  const [companyPhones,demoPhones]=await Promise.all([
    Promise.all(visibleCompanies.map(reel=>listingPhone(ctx,reel.offer_slug))),
    Promise.all(offers.map(offer=>offer.listingPhone||(offer.phone_available?listingPhone(sample,offer.slug):'')))
  ]);
  const companySlides=visibleCompanies.map((reel,index)=>videoReel(ctx,reel,companyPhones[index],
    (hasPrevious&&index===0?link(ctx,pageLink+(companyPage-1),t('Poprzednia strona','Previous page'),'btn','back',{buttonFinish:true}):'')+
    (hasMore&&index===visibleCompanies.length-1?link(ctx,pageLink+(companyPage+1),
      t('Więcej rolek','More reels'),'btn','arrow',{buttonFinish:true}):'')
  )).join('');
  return {title:selected||liveReel?title+' · '+titleOf(selected||liveReel):title,reelsPage:true,body:`
    <section class="reels-viewport" aria-label="${title}">
      <header class="reels-toolbar">
        ${liveReel?link(ctx,'/oferta/'+liveReel.offer_slug,t('Wróć','Back'),'reels-exit','back',{buttonFinish:true}):selected?link(sample,'/oferta/'+selected.slug,t('Wróć','Back'),'reels-exit','back',{buttonFinish:true}):
          link(ctx,'/',t('Start','Home'),'reels-exit','back',{buttonFinish:true})}
        <h1 class="reels-heading notranslate" lang="pl" translate="no">${title}</h1>
        ${tabs}
      </header>
      <div class="reels-scroll" data-reels-scroll tabindex="0" aria-label="${t('Przewijaj w pionie, aby zmienić rolkę','Scroll vertically to switch reels')}">
        ${companySlides}
        ${offers.map((offer,index)=>photoReel(sample,offer,demoPhones[index])).join('')}
        ${robot&&offers.length?`<div class="reel-feed-message" data-reel-slide><div class="inline">${hasPrevious?link(ctx,pageLink+(companyPage-1),t('Poprzednia strona','Previous page'),'btn','back',{buttonFinish:true}):''}${hasMore?link(ctx,pageLink+(companyPage+1),t('Więcej rolek','More reels'),'btn','arrow',{buttonFinish:true}):link(ctx,'/szukaj',t('Wszystkie roboty','All robots'),'btn')}</div></div>`:''}
        ${!companies.length&&!offers.length?`<div class="reel-feed-message" data-reel-slide><p>${robot?t('Brak rolek robotów do wyświetlenia. Dodaj film lub zdjęcia do ogłoszenia robota.','No robot reels to show. Add a video or photos to a robot listing.'):t('Brak rolek do wyświetlenia.','No reels to show.')}</p>${robot?link(ctx,'/sprzedaj',t('Wystaw robota','List a robot'),'btn'):''}</div>`:''}
      </div>
      <div class="reels-stepper" data-reels-stepper hidden>
        <span class="reel-control-hint" data-reel-control-hint hidden>${t('↑ / ↓ Przechodź między ogłoszeniami','↑ / ↓ Browse other listings')}</span>
        <button type="button" data-reels-prev data-button-finish-action="icon" aria-label="${t('Poprzednia rolka','Previous reel')}">${icon('up',20)}</button>
        <button type="button" data-reels-next data-button-finish-action="icon" aria-label="${t('Następna rolka','Next reel')}">${icon('down',20)}</button>
      </div>
    </section>`};
}
