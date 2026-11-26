import { activeBanners, carouselBanners, houseBannerId, managedBannerId } from './banners.js';
import { brandCopy } from './data.js';
import { readBannerStats, readPageViews } from './traffic.js';
import { formatLocale } from './i18n.js';
import { e, field, icon, pageHead, submit, wrap } from './ui.js';

const bannerStatsAnchor='#statystyki-banerow';

async function bannerStatistics(ctx,stats,numbers) {
  const t=ctx.t;
  const periods={today:t('Dzisiaj','Today'),week:t('Ostatnie 7 dni','Last 7 days'),all:t('Od początku pomiaru','Since tracking began')};
  const selected=ctx.url.searchParams.get('banery');
  const range=Object.hasOwn(periods,selected)?selected:'all';
  const [active,counts]=await Promise.all([activeBanners(ctx),readBannerStats(ctx.db,range,stats.todayDate)]);
  const labels=new Map([[houseBannerId,ctx.brand.name+' – '+t('Kupuj i sprzedawaj pojazdy','Buy and sell vehicles')],
    ...carouselBanners(ctx).map(banner=>[banner.id,t(...banner.title)])]);
  function managedLabel(banner) {
    const title=ctx.lang==='pl'?banner.title_pl:banner.title_en||banner.title_pl;
    return [banner.advertiser,title].filter(Boolean).map(brandCopy).join(' · ');
  }
  for (const banner of active) labels.set(managedBannerId(banner.id),managedLabel(banner));
  for (const banner of counts) {
    if (!labels.has(banner.id)) labels.set(banner.id,managedLabel(banner)||t('Baner archiwalny','Archived banner'));
  }
  const countsById=new Map(counts.map(banner=>[banner.id,banner]));
  const total=name=>numbers.format(counts.reduce((sum,banner)=>sum+banner[name],0));
  function periodLink(key,label) {
    const params=new URLSearchParams();
    if (ctx.lang!=='pl') params.set('lang',ctx.lang);
    if (stats.endDay!==stats.todayDate) params.set('do',stats.endDay);
    if (key!=='all') params.set('banery',key);
    const path='/statystyki'+(params.size?'?'+params:'')+bannerStatsAnchor;
    const selected=key===range;
    return `<a class="chip${selected?' active-chip':''}" href="${e(path)}"${selected?' aria-current="true"':''}>${e(label)}</a>`;
  }

  return `<section class="panel traffic-banners" id="${bannerStatsAnchor.slice(1)}" aria-labelledby="banner-stats-title">
    <div class="traffic-history-head">
      <h2 id="banner-stats-title">${t('Statystyki banerów','Banner statistics')}</h2>
      <nav class="traffic-periods" aria-label="${t('Okres statystyk banerów','Banner statistics period')}">${Object.entries(periods).map(([key,label])=>periodLink(key,label)).join('')}</nav>
    </div>
    <table class="traffic-table traffic-banner-table" aria-labelledby="banner-stats-title">
      <thead><tr><th scope="col">${t('Baner','Banner')}</th><th scope="col">${t('Wyświetlenia','Views')}</th><th scope="col">${t('Kliknięcia','Clicks')}</th></tr></thead>
      <tbody>${Array.from(labels,([id,label])=>{
        const {impressions=0,clicks=0}=countsById.get(id)||{};
        return `<tr data-banner-stat="${e(id)}"><th scope="row">${e(label)}</th><td>${numbers.format(impressions)}</td><td>${numbers.format(clicks)}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><th scope="row">${t('Razem','Total')}</th><td>${total('impressions')}</td><td>${total('clicks')}</td></tr></tfoot>
    </table>
    <p class="muted traffic-note">${t('Wyświetlenie liczymy raz na odsłonę strony, gdy co najmniej połowa banera lub jego paska jest widoczna przez sekundę. Kliknięcia liczymy po otwarciu linku z banera.','Each banner counts as viewed once per page load when at least half of the banner or its collapsed strip is visible for one second. Clicks count when a banner link is followed.')}</p>
  </section>`;
}

export async function trafficPage(ctx) {
  const t=ctx.t;
  const title=t('Statystyki portalu','Site statistics');
  const stats=await readPageViews(ctx.db,ctx.url.searchParams.get('do')||'');
  const locale=formatLocale(ctx.lang);
  const numbers=new Intl.NumberFormat(locale);
  const banners=await bannerStatistics(ctx,stats,numbers);
  const dates=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'});
  const showDate=value=>dates.format(new Date(value+'T00:00:00Z'));
  const maxViews=Math.max(1,...stats.days.map(({views})=>views??0));
  const metrics=[
    [t('Dzisiaj','Today'),stats.today,'calendar','today'],
    [t('Ostatnie 7 dni','Last 7 days'),stats.week,'gauge','week'],
    [t('Od początku pomiaru','Since tracking began'),stats.total,'grid','total']
  ];
  const chartHeading=t('Wyświetlenia według dnia','Views by day');
  return {title,body:wrap(pageHead(title,t('Wyświetlenia publicznych stron {brand}','Views of public pages on {brand}',{brand:ctx.brand.name}))+
    `<dl class="traffic-metrics">${metrics.map(([label,value,symbol,key])=>`
      <div class="panel traffic-metric">
        <dt><span class="mini-icon" aria-hidden="true">${icon(symbol,21)}</span>${label}</dt>
        <dd data-traffic-metric="${key}">${numbers.format(value)}</dd>
      </div>`).join('')}</dl>
    <section class="panel traffic-history" aria-labelledby="traffic-history-title">
      <div class="traffic-history-head">
        <div><h2 id="traffic-history-title">${chartHeading}</h2>
          <p class="muted">${t('Czas polski','Polish time')} · ${e(showDate(stats.days.at(-1).day))} – ${e(showDate(stats.endDay))}</p></div>
        <form action="/statystyki" method="get" class="traffic-date-form">
          ${ctx.lang==='pl'?'':`<input type="hidden" name="lang" value="${ctx.lang}">`}
          ${['today','week'].includes(ctx.url.searchParams.get('banery'))?`<input type="hidden" name="banery" value="${ctx.url.searchParams.get('banery')}">`:''}
          ${field('do',t('Tydzień do dnia','Week ending on'),stats.endDay,{type:'date',attributes:'max="'+stats.todayDate+'"'})}
          ${submit(t('Pokaż','Show'),'','btn')}
        </form>
      </div>
      <table class="traffic-table">
        <thead><tr><th scope="col">${t('Dzień','Day')}</th><th scope="col">${t('Wyświetlenia','Views')}</th></tr></thead>
        <tbody>${stats.days.map(({day,views})=>`
          <tr><th scope="row"><time datetime="${e(day)}">${e(showDate(day))}</time>
            ${day===stats.todayDate?`<span class="traffic-today">${t('Dzisiaj','Today')}</span>`:''}</th>
            <td><div class="traffic-value">
              <span class="traffic-bar" aria-hidden="true"><span style="--share:${(views??0)*100/maxViews}%"></span></span>
              <span>${views===null?'—':numbers.format(views)}</span>
            </div></td></tr>`).join('')}</tbody>
      </table>
      <p class="muted traffic-note">${stats.firstDay?
        t('Pierwsze wyświetlenia zarejestrowano','First views recorded on')+' '+e(showDate(stats.firstDay))+'.':
        t('Licznik czeka na pierwsze wyświetlenie.','The counter is waiting for its first view.')}
        ${t('Kreska oznacza dzień przed rozpoczęciem pomiaru.','A dash marks a day before tracking began.')}</p>
    </section>
    ${banners}
    <section class="panel traffic-method"><h2>${t('Jak liczymy wyświetlenia','How views are counted')}</h2>
      <p>${t('Licznik obejmuje stronę główną, wyniki wyszukiwania, ogłoszenia, profile sprzedawców i strony informacyjne. Odświeżenie liczy się jako kolejne wyświetlenie.',
        'The counter covers the homepage, search results, listings, seller profiles and information pages. Refreshing counts as another view.')}</p>
      <p>${t('Pomiar pomija tryb demo i rozpoznane boty. Zapisujemy wyłącznie dzienne sumy.',
        'Tracking excludes demo mode and recognised bots. We store daily totals only.')}</p>
    </section>`)};
}
