import { adMediaPath } from './ad-media.js';
import { carouselBanners, houseBannerId } from './banners.js';
import { buttonEmbroideryLabel, e, href, icon, logo } from './ui.js';

function houseAd(ctx) {
  const {t,brand}=ctx;
  const name=brand.name;
  const headline=t('Kupuj i sprzedawaj <span>pojazdy</span>','Buy and sell <span>vehicles</span>');
  const title=t('Kupuj i sprzedawaj pojazdy','Buy and sell vehicles');
  const action=t('Dodaj pojazd','Add a vehicle');
  const strip=`<span class="ad-carousel-strip"><span class="ad-carousel-company">${e(name)}</span>
    <span class="ad-carousel-action">${action}${icon('arrow',15)}</span></span>`;
  return {
    id:houseBannerId,
    alt:`${name} · ${title}`,
    content:`<div class="ad-carousel-house">
      <div class="ad-carousel-house-art">
        <img class="ad-carousel-house-photo" src="/assets/banner.webp" width="1480" height="604" alt="" loading="lazy" decoding="async" draggable="false">
        <div class="ad-carousel-house-copy">
          <span class="ad-carousel-house-brand">${logo(ctx)}</span>
          <strong>${headline}</strong>
          <span class="ad-carousel-house-caption">${t('Ogłoszenia bez opłat','Free listings')}</span>
        </div>
        <div class="ad-carousel-house-actions">
          <a class="ad-carousel-house-link" href="${href(ctx,'/sprzedaj')}" data-banner-click draggable="false"
            aria-label="${e(`${action} · ${name} · ${title}`)}">${strip}
            <span class="ad-carousel-action ad-carousel-house-add">${buttonEmbroideryLabel(action)}${icon('arrow',15)}</span>
          </a>
          <a class="ad-carousel-house-contact" href="${href(ctx,'/reklama')}" data-banner-click draggable="false">${t('Zapytaj o reklamę','Ask about advertising')}</a>
        </div>
      </div>
    </div>`
  };
}

export function adCarousel(ctx,mediaReady) {
  const t=ctx.t;
  const ads=mediaReady?carouselBanners(ctx):[];
  const slides=[houseAd(ctx),...ads.map(({id,name,file,width=2172,url,title,action:label})=>{
    const alt=t(...title);
    const action=label?t(...label):t('Zobacz ofertę','View offer');
    const imageUrl=adMediaPath+file;
    const photo=`<img class="ad-carousel-image" src="${imageUrl}" width="${width}" height="${width/3}" alt="${e(alt)}" loading="lazy" decoding="async" draggable="false"${url?'':' tabindex="-1"'}>`;
    const strip=`<span class="ad-carousel-strip">
      ${name==='ALL4RENT'?`<img class="ad-carousel-logo" src="${adMediaPath}ar-home-512.png" width="32" height="32" alt="" loading="lazy">`:''}
      <span class="ad-carousel-company">${e(name)}</span>
      ${url?`<span class="ad-carousel-action">${e(action)}${icon('arrow',15)}</span>`:
        `<button type="button" class="ad-carousel-action" data-ad-preview>${t('Pokaż baner','Show banner')}${icon('down',15)}</button>`}
    </span>`;
    return {
      id, alt,
      content:url?`<a class="ad-carousel-link" href="${e(url)}" data-banner-click target="_blank" rel="noopener noreferrer" draggable="false"
        aria-label="${e(alt+' · '+t('otwiera w nowej karcie','opens in a new tab'))}">${strip}${photo}</a>`:`${strip}${photo}`
    };
  })];
  const count=slides.length;
  const openingIndex=Math.floor(Math.random()*count);
  const [openingSlide]=slides.splice(openingIndex,1);
  slides.unshift(openingSlide);
  const position=i=>t('{index} z {count}','{index} of {count}',{index:i+1,count});
  return `<section class="ad-carousel" id="reklamy" data-ad-carousel aria-label="${t('Reklamy','Advertisements')}" aria-roledescription="${t('karuzela','carousel')}">
    <div class="ad-carousel-stage" data-ad-stage>
      ${slides.map(({id,alt,content},i)=>`<div data-ad-slide="${e(alt)}" data-banner-id="${id}" role="group" aria-roledescription="${t('slajd','slide')}"
        aria-label="${position(i)}"${i?' hidden':''}>${content}</div>`).join('')}
    </div>
    <div class="ad-carousel-controls" data-ad-controls hidden>
      <div class="ad-carousel-status"><span>${t('Reklama','Ad')}</span>
        <span class="ad-carousel-position" data-ad-position aria-hidden="true">1 / ${count}</span></div>
      <div class="ad-carousel-navigation">
        <div class="ad-carousel-dots" role="group" aria-label="${t('Wybór reklamy','Choose an ad')}">
          ${slides.map(({alt},i)=>`<button type="button" class="ad-carousel-dot" data-ad-dot="${i}" aria-label="${e(t('Pokaż reklamę','Show ad')+' '+(i+1)+' · '+alt)}"${i?'':' aria-current="true"'}><span aria-hidden="true"></span></button>`).join('')}
        </div>
        <button type="button" class="ad-carousel-control" data-ad-previous aria-label="${t('Poprzednia reklama','Previous ad')}">${icon('chevron',17)}</button>
        <button type="button" class="ad-carousel-control" data-ad-forward aria-label="${t('Następna reklama','Next ad')}">${icon('chevron',17)}</button>
        <button type="button" class="ad-carousel-control" data-ad-rotation aria-label="${t('Wstrzymaj automatyczną zmianę reklam','Pause ad rotation')}">
          <span data-ad-pause aria-hidden="true">${icon('pause',16)}</span><span data-ad-play aria-hidden="true" hidden>${icon('play',16)}</span>
        </button>
      </div>
    </div>
    <span class="visually-hidden" data-ad-announcement aria-live="polite" aria-atomic="true"></span>
  </section>`;
}
