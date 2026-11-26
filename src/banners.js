import { firstAdFile } from './ad-media.js';
import { now, row, rows, safeLink } from './core.js';

export const houseBannerId='brumbrum';
const externalBanners=[
  {id:'all4rent-rental',name:'ALL4RENT',file:firstAdFile,width:1536,url:'https://all4rent.app/',
    title:['ALL4RENT – wynajem','ALL4RENT – rentals']},
  {id:'jcb-rental',name:'JCB',file:'jcb-rental-banner.png',
    title:['JCB – wynajem koparek','JCB – excavator rental']},
  {id:'fazicars',name:'FAZICARS',file:'fazicars-banner.png',url:'https://fazicars.pl/',
    title:['FAZICARS – wynajem samochodów','FAZICARS – car rental']},
  {id:'cars-collection',name:'Cars Collection',file:'cars-collection-banner.png',url:'https://carscollection.pl/',
    title:['Cars Collection – wynajem samochodów','Cars Collection – car rental']},
  {id:'cars-rent',name:'CARS-RENT',file:'cars-rent-banner.png',url:'https://cars-rent.pl/',
    title:['CARS-RENT – wynajem samochodów','CARS-RENT – car rental']},
  {id:'rankomat',name:'Rankomat',file:'rankomat-banner.png',url:'https://rankomat.pl/brand',
    title:['Rankomat – porównywarka ubezpieczeń','Rankomat – insurance comparison']},
  {id:'jet-partner',name:'Jet Partner',file:'jet-partner-banner.png',url:'https://jetpartner.pl/wynajem-odrzutowcow/',
    title:['Jet Partner – wynajem odrzutowców','Jet Partner – private jet charter']},
  {id:'all4rent-advertise',name:'ALL4RENT',file:'all4rent-advertise-banner.png',url:'https://all4rent.app/?contact=1&topic=Reklama%20banerowa',
    title:['ALL4RENT – Tutaj może być Twoja reklama','ALL4RENT – Your ad could be here'],
    action:['Zapytaj o reklamę','Ask about advertising']}
];

export const managedBannerId=id=>'managed-'+id;
export function carouselBanners(ctx) {
  const jcb=safeLink(ctx.env.JCB_AD_URL?.trim());
  return externalBanners.map(banner=>banner.id==='jcb-rental'?{...banner,url:jcb.startsWith('https:')?jcb:''}:banner);
}

const activeBannerQuery=`SELECT * FROM banners WHERE scope=? AND active=1 AND (starts_at IS NULL OR starts_at<=?)
  AND (ends_at IS NULL OR ends_at>?) ORDER BY position,id LIMIT 8`;
export function activeBanners(ctx) {
  const current=now();
  return rows(ctx.db,activeBannerQuery,ctx.scope,current,current);
}

export async function canRecordBanner(ctx,id,event) {
  if (id===houseBannerId) return true;
  const banner=carouselBanners(ctx).find(b=>b.id===id);
  if (banner) return event==='impression'||Boolean(banner.url);
  if (!/^managed-[a-f0-9-]{36}$/.test(id)) return false;
  const current=now();
  return Boolean(await row(ctx.db,`SELECT 1 FROM (${activeBannerQuery}) WHERE id=?`,
    ctx.scope,current,current,id.slice('managed-'.length)));
}
