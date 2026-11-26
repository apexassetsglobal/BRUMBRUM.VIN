import { youtubePromotionsSection } from './youtube-promotions.js';
import { spinViewer } from './spin-viewer.js';
import { demoSellerReels, publicReels } from './views-reels.js';
import { id, cleanReturn, isId, missing, now, row, rows } from './core.js';
import { brandCopy, catalogFor, demoGalleries, ensureDemo, features, options, regions } from './data.js';
import { activeBanners, managedBannerId } from './banners.js';
import { catalogBodyGroups, partsCatalogGroups, semiTrailerBodies, vehicleBodyChoices, vehicleCatalogOrder, vehicleFeatures } from './vehicle-types.js';
import { heavyVehicleFilters } from './vehicle-catalog.js';
import { byId, filterFields, listingsByKeys, photoDetailLabels, search, spinLimits } from './market.js';
import { listingVin } from './listing-review.js';
import { favorites } from './inbox.js';
import { apiForm, area, buttonEmbroideryLabel, check, choice, day, e, embed, empty, enquiryAccess, field, flash, hidden, href, icon, keyInput, km, lang, link, localized, loginPath, measure, pageHead, panel, price, sectionHead, submit, tag, titleOf, wrap } from './ui.js';
import { adCarousel } from './views-ads.js';
import { adMediaReady } from './ad-media.js';
import { banner as robotBanner, card as robotCard } from './views-robots.js';

const inOptions=values=>Object.fromEntries(values.map(value=>[value,value]));
function optionName(ctx,key,value,type) {
  if (key==='body'&&type) return lang(ctx,vehicleBodyChoices(type,value)[value])||localized(ctx,key,value);
  if (key!=='type') return localized(ctx,key,value);
  const types=ctx.catalog?.types??options.type;
  return lang(ctx,Object.hasOwn(types,value)?types[value]:Object.hasOwn(options.type,value)?options.type[value]:value);
}
const listingUrl=(ctx,offer,back='')=>href(ctx,'/oferta/'+offer.slug)+(back?'?powrot='+encodeURIComponent(back):'');
const sellerUrl=(ctx,offer)=>href(ctx,(offer.profile_type==='company'?'/dealer/':'/sprzedawca/')+offer.user_id);
const hasMeasurement=value=>value!=null&&value!=='';
const operatingHours=(ctx,offer)=>measure(ctx,offer.hours,ctx.t('mth','h'));
function offerDescription(ctx,offer) {
  if (ctx.lang==='pl'||!offer.description_en) return offer.description;
  if (offer.demo_photo) return ctx.t(offer.description,offer.description_en);
  return ctx.lang==='en'?offer.description_en:offer.description;
}

function favoriteButton(ctx,offer,marked=false,caption='') {
  return `<button type="button" class="${caption?'btn':'icon-button'} favorite ${marked?'selected':''}" data-favorite="${e(offer.id)}" aria-pressed="${marked}"${caption?'':` aria-label="${ctx.t('Dodaj do ulubionych','Save as favorite')}"`}>${icon('star',20)}${e(caption)}</button>`;
}
function compare(ctx,offer,caption='') {
  return `<button type="button" class="btn ${caption?'':'icon-button '}compare" data-compare="${e(offer.id)}" aria-pressed="false"${caption?'':` aria-label="${ctx.t('Dodaj do porównania','Add to comparison')}" title="${ctx.t('Porównaj','Compare')}"`}>${icon('scale',19)}${e(caption)}</button>`;
}
function thumb(ctx,offer,load='lazy') {
  if (!offer.cover) return `<div class="photo-empty">${icon('image',38)}<span>${ctx.t('Brak zdjęcia','No image')}</span></div>`;
  const sample=demoGalleries.get(offer.demo_photo)?.[0];
  const wide=sample?.thumb===offer.cover;
  const responsive=wide?` class="wide-photo" srcset="${e(offer.cover)} 640w, ${e(sample.url)} 1920w" sizes="auto, (max-width: 700px) calc(100vw - 24px), 440px"`:'';
  return `<img src="${e(offer.cover)}" alt="${e(titleOf(offer))}${offer.demo_photo?' · '+ctx.t('zdjęcie poglądowe','illustrative image'):''}"${responsive} loading="${load}" width="630" height="385">`;
}
function keyFacts(ctx,offer) {
  const t=ctx.t;
  const year=['calendar',t('Rok produkcji','Year'),offer.year||'—'];
  if (offer.type==='farm'&&!vehicleFeatures(offer.type,offer.body).motorized) return [year,
    ['car',t('Odmiana','Variant'),optionName(ctx,'body',offer.body,offer.type)],
    ['shield',t('Stan','Condition'),localized(ctx,'condition',offer.condition)]];
  if (offer.type==='trailer') return [year,
    ['scale',t('DMC','Gross vehicle weight'),measure(ctx,offer.grossWeight,'kg')],
    ['axle',t('Liczba osi','Axles'),offer.axles||'—'],['car',t('Odmiana','Variant'),optionName(ctx,'body',offer.body,offer.type)]];
  const hours=!hasMeasurement(offer.mileage)&&hasMeasurement(offer.hours);
  return [year,['gauge',hours?t('Motogodziny','Operating hours'):t('Przebieg','Mileage'),hours?operatingHours(ctx,offer):km(ctx,offer.mileage)],
    ['fuel',t('Paliwo','Fuel'),localized(ctx,'fuel',offer.fuel)],['gear',t('Skrzynia biegów','Transmission'),localized(ctx,'gearbox',offer.gearbox)]];
}
export function offerCard(ctx,offer,{back='',marked=false,interactive=true}={}) {
  if(offer.type==='robot')return robotCard(ctx,offer,marked);
  const t=ctx.t;
  const anchor='oferta-'+offer.slug;
  const path=listingUrl(ctx,offer,back?back+'#'+anchor:'');
  const description=(offerDescription(ctx,offer)||'').replace(/\s+/g,' ').trim();
  const excerpt=description.length>320?description.slice(0,320).replace(/\s+\S*$/,'')+'…':description;
  const marker=offer.status==='sold'?tag(ctx,'sold'):offer.featured?`<span class="badge accent">${t('Wyróżnione','Featured')}</span>`:offer.demo_photo?
    `<span class="badge">${t('Demo','Demo')}</span>`:offer.fresh?`<span class="badge">${t('Nowe ogłoszenie','New listing')}</span>`:'';
  return `<article class="offer-card"${back?` id="${e(anchor)}"`:''}>
    <div class="offer-image"><a href="${e(path)}" aria-label="${e(titleOf(offer))}">${thumb(ctx,offer)}</a><div class="offer-badges">${marker}</div>
      ${interactive?favoriteButton(ctx,offer,marked):''}${offer.city?`<span class="offer-location">${icon('pin',15)} <span>${e(offer.city)}</span></span>`:''}</div>
    <div class="offer-info"><div class="offer-summary"><div class="offer-top"><h3><a href="${e(path)}">${e(titleOf(offer)||t('Pojazd','Vehicle'))}</a></h3>
      <p class="trim"${offer.variant?` title="${e(offer.variant)}"`:''}>${e(offer.variant)}</p><div class="offer-price">${e(price(ctx,offer.price,offer.currency))}</div>
      ${excerpt?`<p class="reel-description">${e(excerpt)}</p>`:''}</div>
      <ul class="offer-specs">${keyFacts(ctx,offer).map(([symbol,label,value])=>`<li title="${e(label)} · ${e(value)}">${icon(symbol,15)}<span><span class="visually-hidden">${e(label)} </span>${e(value)}</span></li>`).join('')}</ul></div>
    <div class="offer-foot"><span class="offer-seller">${icon(offer.profile_type==='company'?'building':'user',15)} ${e(localized(ctx,'seller',offer.profile_type))}</span>${interactive?compare(ctx,offer):''}</div></div>
  </article>`;
}
async function offerCards(ctx,items,back,interactive) {
  const marked=new Set(interactive?await favorites(ctx):[]);
  return items.map(offer=>offerCard(ctx,offer,{back,marked:marked.has(offer.id),interactive})).join('');
}
function resultActionLabels(full,short) {
  return `<span class="result-label-full">${e(full)}</span><span class="result-label-short">${e(short)}</span>`;
}
export async function cards(ctx,items,back='',interactive=true,renderResultsHeader) {
  const t=ctx.t;
  const modeName=t('Tryb rolek','Reel view');
  const mode=`<button type="button" class="btn small reel-mode" data-reel-mode aria-pressed="false">
    ${icon('image',17)} ${renderResultsHeader?resultActionLabels(modeName,'Rolki'):e(modeName)}</button>`;
  const controls=`<div class="reel-controls" data-reel-controls hidden><span data-reel-position></span>
    <button type="button" class="icon-button" data-reel-prev aria-label="${t('Poprzednie ogłoszenia','Previous listings')}">${icon('back',19)}</button>
    <button type="button" class="icon-button" data-reel-next aria-label="${t('Następne ogłoszenia','Next listings')}">${icon('arrow',19)}</button></div>`;
  const toolbar=renderResultsHeader
    ? renderResultsHeader(`<span data-reel-toolbar hidden>${mode}</span>`)+controls
    : `<div class="reel-toolbar" data-reel-toolbar hidden>${mode}${controls}</div>`;
  return `<div class="offer-reel" data-reel data-reel-size="${items.length}" style="--reel-size:${items.length}">
    ${toolbar}
    <div class="offer-grid" data-reel-track role="region" aria-label="${t('Ogłoszenia','Listings')}">
      ${await offerCards(ctx,items,back,interactive)}
    </div></div>`;
}

const demoPreviewSize=10;
async function demoCarPreview(ctx) {
  const sample={...ctx,demo:true,prefix:'/demo',scope:'demo:seed',user:null};
  await ensureDemo(sample);
  const offers=await search(sample,new URLSearchParams({type:'car'}),{limit:demoPreviewSize});
  const t=ctx.t;
  return `<section class="market-section demo-preview">${sectionHead(t('Przykładowe samochody w demo','Example cars in demo'),
    `<a class="text-link" href="/demo/szukaj?type=car">${icon('arrow',18)} ${t('Zobacz wszystkie w demo','See all in demo')}</a>`)}
    ${await cards(sample,offers.offers,'',false)}</section>`;
}

function filter(ctx,key,values={}) {
  const t=ctx.t,catalog=ctx.catalog,caption=lang(ctx,filterFields[key]);
  const value=values[key]||'';
  const hint={
    type:t('Wszystkie pojazdy','All vehicle types'),make:t('Wszystkie marki','All brands'),model:t('Każdy model','All models')
  }[key]??t('Wszystkie','Any');
  const choiceProps={placeholder:hint};
  const type=values.type||'';
  const heavyBody=type==='trailer'&&semiTrailerBodies.includes(values.body)?'semi_trailer':values.body;
  const heavy=Object.hasOwn(catalog.heavyFilters,heavyBody)?catalog.heavyFilters[heavyBody]:null;
  const heavyType=heavy?.type===type?heavyBody:'';
  const makes=heavyType?heavy.makes:Object.hasOwn(catalog.makesByType,type)?catalog.makesByType[type]:{};
  if (key==='type') {
    const items={...catalog.types,...Object.fromEntries(Object.entries(catalog.heavyFilters)
      .map(([body,entry])=>[entry.type+':'+body,entry.label]))};
    const choices=value&&!Object.hasOwn(items,value)?{...items,[value]:value}:items;
    return choice(ctx,'category',caption,choices,heavyType?type+':'+heavyType:value,{...choiceProps,attributes:'data-filter-type'});
  }
  if (key==='make') {
    const names=Object.keys(makes);
    if (value&&!Object.hasOwn(makes,value)) names.push(value);
    const available=names.length>0;
    return choice(ctx,key,t('Marki','Brand'),inOptions(names),value,{placeholder:available?hint:t('Brak marek na liście','No brands listed'),
      attributes:'data-filter-make'+(available?'':' disabled')});
  }
  if (key==='model') {
    const make=values.make;
    const names=Object.hasOwn(makes,make)?makes[make]:[];
    const models=value&&!names.includes(value)?[...names,value]:names;
    const available=models.length>0;
    const placeholder=!make&&!value?t('Wybierz markę','Choose a brand'):
      available?hint:t('Brak modeli na liście','No models listed');
    return choice(ctx,key,caption,inOptions(models),value,{placeholder,attributes:'data-filter-model'+(available?'':' disabled')});
  }
  if (key==='region') {
    const list=inOptions(regions);
    if (value) list[value]=value;
    return choice(ctx,key,caption,list,value,choiceProps);
  }
  const select=key==='body'&&heavyType==='semi_trailer'?semiFilterChoices():key==='body'&&type?vehicleBodyChoices(type,value):options[key];
  if (select) return choice(ctx,key,caption,select,heavyType===value&&key==='body'?'':value,
    key==='body'?{...choiceProps,attributes:'data-filter-body'}:choiceProps);
  if (/^(min|max)/.test(key)) return field(key,caption,value,{type:'number',placeholder:key.includes('Price')?'PLN':undefined,attributes:'min="0" step="'+(/Price|Hours/.test(key)?'0.01':'1')+'" inputmode="decimal"'});
  return field(key,caption,value,{placeholder:key==='city'?t('np. Warszawa','e.g. Warsaw'):key==='q'?t('np. S line','e.g. S line'):''});
}
function semiFilterChoices() {
  const choices=vehicleBodyChoices('trailer');
  return Object.fromEntries(semiTrailerBodies.filter(key=>key!=='semi_trailer').map(key=>[key,choices[key]]));
}
function catalogData(ctx) {
  const {makesByType,heavyFilters}=ctx.catalog;
  const makes={...makesByType,...Object.fromEntries(Object.entries(heavyFilters).map(([body,entry])=>[entry.type+':'+body,entry.makes]))};
  const bodies=Object.fromEntries(['',...Object.keys(ctx.catalog.types)].map(type=>{
    const choices=type?vehicleBodyChoices(type):options.body;
    return [type,Object.entries(choices).map(([value,label])=>[value,lang(ctx,label)])];
  }));
  bodies['trailer:semi_trailer']=Object.entries(semiFilterChoices()).map(([value,label])=>[value,lang(ctx,label)]);
  return `<span hidden data-catalog="${embed(makes)}" data-body-options="${embed(bodies)}"></span>`;
}
const basicSearchFields=['type','make','model','minPrice','maxPrice','city'];
const advancedSearchFields=Object.keys(filterFields).filter(key=>!basicSearchFields.includes(key));
function vehicleSearchForm(ctx,{home=false,values={},sort='',open=false}={}) {
  const t=ctx.t;
  const filterTitle=home?t('Filtry pojazdów','Vehicle filters'):t('Filtry zaawansowane','Advanced filters');
  const fields=keys=>keys.map(key=>filter(ctx,key,values)).join('');
  const searchButton=submit(home?t('Szukaj pojazdów','Find vehicles'):t('Pokaż wyniki','Show results'),'search');
  const toggle=`<button class="${home?'text-link':'btn filter-open'}"${home?' id="filter-advanced-title" type="submit" name="filtry" value="1" formnovalidate':' type="button"'} data-filter-open-button aria-expanded="${open}" aria-controls="filter-advanced">${icon('sliders',18)}${filterTitle}${home?icon('down',16):''}</button>`;
  const basic=fields(basicSearchFields);
  const main=home?`<div class="quick-fields">${basic}${searchButton}</div>
    <div class="quick-foot"><a class="text-link" href="#kategorie">${icon('grid',18)}${t('Wszystkie kategorie','All categories')}</a>${toggle}</div>`:
    `<div class="filter-basic-fields">${basic}<div class="filter-quick-actions">${toggle}${searchButton}</div></div>`;
  const clear=home?`<button class="text-link" type="reset">${t('Wyczyść filtry','Clear filters')}</button>`:
    link(ctx,'/szukaj',t('Wyczyść filtry','Clear filters'),'text-link');
  const label=home?t('Wyszukiwarka pojazdów','Vehicle search'):t('Filtry ogłoszeń','Listing filters');
  return `<form class="${home?'quick-search':'filter-top panel'}"${home?' id="filtry-pojazdow"':''} data-search-form action="${href(ctx,'/szukaj')}" method="get" aria-label="${label}">
    ${catalogData(ctx)}${sort?hidden('sort',sort):''}${main}
    <section class="filter-advanced" id="filter-advanced" aria-labelledby="filter-advanced-title" data-filter-panel${home?' data-filter-inline':''}${open?' data-filter-open':''}>
      ${home?vehicleQuickFilters(ctx):`<div class="filter-head"><h2 id="filter-advanced-title">${filterTitle}</h2><button class="icon-button filter-close" data-filter-close type="button" aria-label="${t('Zamknij filtry','Close filters')}">${icon('close')}</button></div>`}
      <div class="filter-extra-fields">${fields(advancedSearchFields)}</div>
      <div class="filter-actions">${clear}${searchButton}</div>
    </section></form>`;
}

function partsSearchForm(ctx,{values={},sort=''}={}) {
  const t=ctx.t;
  const bodyChoices=vehicleBodyChoices('parts',values.body||'');
  const selectedBody=values.body||'';
  return `<form class="filter-top panel parts-search" data-parts-search action="${href(ctx,'/szukaj')}" method="get" aria-label="${e(t('Wyszukiwarka części','Parts search'))}">
    ${hidden('type','parts')}${sort?hidden('sort',sort):''}
    <div class="filter-basic-fields parts-search-fields">
      ${field('q',t('Szukaj części','Find a part'),values.q||'',{placeholder:t('np. zderzak, reflektor, 225/45 R17','e.g. bumper, headlight, 225/45 R17')})}
      ${choice(ctx,'body',t('Kategoria części','Parts category'),bodyChoices,selectedBody,{placeholder:t('Wszystkie części','All parts')})}
      ${filter(ctx,'minPrice',values)}${filter(ctx,'maxPrice',values)}${filter(ctx,'city',values)}
      <div class="filter-quick-actions">${submit(t('Szukaj części','Search parts'),'search')}</div>
    </div>
    <div class="filter-actions">${link(ctx,'/szukaj?type=parts',t('Wyczyść filtry','Clear filters'),'text-link')}</div>
  </form>`;
}

function managedBanners(ctx,banners) {
  const t=ctx.t;
  const slides=banners.map(item=>({
    id:managedBannerId(item.id),
    advertiser:brandCopy(item.advertiser),
    title:brandCopy((ctx.lang==='pl'?item.title_pl:item.title_en)||item.title_pl),
    label:brandCopy((ctx.lang==='pl'?item.label_pl:item.label_en)||item.label_pl)||t('Sprawdź','View'),
    url:item.link.startsWith('/')?href(ctx,item.link):item.link,
    photo:item.image_key?href(ctx,'/asset/banner/'+item.image_key):''
  }));
  return `<section class="ad-banner expanded" data-banner aria-label="${t('Reklama','Advertisement')}">
    ${slides.map((s,i)=>`<div class="ad-slide" data-slide data-banner-id="${e(s.id)}"${i?' hidden':''}><div class="ad-copy">
      <div class="ad-identity"><span class="ad-label">${t('REKLAMA','AD')}</span>${s.advertiser?`<span class="ad-company">${e(s.advertiser)}</span>`:''}</div><strong class="ad-title">${e(s.title)}</strong></div><div class="ad-actions">
      <a class="ad-cta" href="${e(s.url)}" data-banner-click${s.url.startsWith('https://')?' target="_blank" rel="noopener noreferrer"':''}><span>${e(s.label)}</span>${icon('arrow',15)}</a><a href="${href(ctx,'/reklama')}" class="ad-secondary" data-banner-click>${t('Zapytaj o reklamę','Ask about advertising')}</a></div>
      ${s.photo?`<img src="${e(s.photo)}" class="ad-photo" alt="" width="750" height="365">`:''}</div>`).join('')}
    ${slides.length>1?`<button class="ad-toggle ad-next" type="button" data-ad-next aria-label="${t('Następny baner','Next banner')}">${icon('chevron',17)}</button>`:''}
    <button class="ad-toggle" type="button" data-ad-toggle aria-expanded="true" aria-label="${t('Rozwiń lub zwiń reklamę','Expand or collapse advertisement')}">${icon('down',17)}</button>
  </section>`;
}

const categoryCopy = { car:['Samochody osobowe','Passenger cars'],van:['Samochody dostawcze','Vans'],truck:['Samochody ciężarowe','Trucks'],camper:['Kampery','Motorhomes'] };
const categoryBodyPhotos = {
  car:{convertible:'category-body-convertible-four-seat',roadster:'category-body-convertible',other:'category-body-other-passenger'},
  trailer:{other:'category-body-other-trailers'}
};
const categoryTypePhotos = {
  garden:'category-body-garden_mower.png',forestry:'category-body-harvester.png',
  marine_air:'category-body-motor_yacht.png',parts:'category-body-wheels_tires.png'
};
// A single catalogue convention: every vehicle's front points left. Only source
// photos that face right are mirrored; their original lighting and crop remain intact.
const mirroredCategoryPhotos = new Set([
  'category-body-motor_boat_rib.png','category-body-jet_ski.png','category-body-sailboat.png',
  'category-body-fishing_boat.png','category-body-beet_harvester.webp','category-body-grader.webp'
]);
const bodyPhotoAliases = {
  naked:'category-type-motorcycle',scooter:'category-type-scooter',atv_utility:'category-type-quad',
  utv:'category-type-utv',track_kart:'category-type-kart',snow_sport:'category-type-snowmobile',
  coach:'category-type-bus',garden_mower:'category-body-garden_mower.png',riding_mower:'category-body-riding_mower.png',
  zero_turn:'category-body-zero_turn.png',garden_tractor:'category-body-garden_tractor.png',snow_blower:'category-body-snow_blower.png',
  wood_chipper:'category-body-wood_chipper.png',stump_grinder:'category-body-stump_grinder.png',
  motorized_wheelbarrow:'category-body-motorized_wheelbarrow.png',mini_dumper:'category-body-mini_dumper.png',
  farm_tractor:'category-type-farm',excavator:'category-type-construction',
  forklift:'category-type-industrial',tow_truck:'category-type-special',cargo_trailer:'category-type-trailer',
  minibike:'category-body-moped',microcar:'category-body-other',tuk_tuk:'category-body-tuk_tuk.png',
  cargo_tricycle:'category-body-cargo_tricycle.png',mobility_scooter:'category-body-mobility_scooter.png',
  classic_car:'category-body-classic',supercar:'category-body-coupe',electric_ev:'category-body-sedan',
  van_insulated:'category-body-van_fridge',van_hds:'category-body-truck_loader_crane',
  semi_walking_floor:'category-body-semi_curtain',semi_silo:'category-body-semi_tanker',semi_car_transporter:'category-body-semi_lowbed',
  scooter_quad_trailer:'category-body-motorcycle_trailer',farm_loader:'category-body-loader',farm_trailer_spreader:'category-body-bale_trailer',
  sport_touring:'category-body-touring',cafe_bobber:'category-body-classic',electric_motorcycle:'category-body-sportbike',
  bicycle:'category-body-e_bike',mono_segway:'category-body-e_scooter',
  motor_yacht:'category-body-motor_yacht.png',motor_boat_rib:'category-body-motor_boat_rib.png',jet_ski:'category-body-jet_ski.png',
  sailboat:'category-body-sailboat.png',catamaran:'category-body-catamaran.png',fishing_boat:'category-body-fishing_boat.png',
  ultralight:'category-body-ultralight.png',water_air_other:'category-body-water_air_other.png',
  harvester:'category-body-harvester.png',forwarder:'category-body-forwarder.png',skidder:'category-body-skidder.png',
  industrial_wood_chipper:'category-body-industrial_wood_chipper.png',forestry_trailer_crane:'category-body-forestry_trailer_crane.png',
  engine:'category-body-engines_gearboxes.png',gearbox:'category-body-engines_gearboxes.png',drivetrain:'category-body-engines_gearboxes.png',
  clutch:'category-body-engines_gearboxes.png',differential_turbo:'category-body-engines_gearboxes.png',
  bumpers:'category-body-body_parts.png',mirrors:'category-body-body_parts.png',headlights:'category-body-body_parts.png',
  windows:'category-body-body_parts.png',hood_doors:'category-body-body_parts.png',fenders_grilles:'category-body-body_parts.png',
  navigation_multimedia:'category-body-electronics_navigation.png',ecu_modules:'category-body-electronics_navigation.png',
  sensors_cameras:'category-body-electronics_navigation.png',wiring_electrics:'category-body-electronics_navigation.png',
  brakes:'category-body-workshop_equipment.png',suspension:'category-body-workshop_equipment.png',steering:'category-body-workshop_equipment.png',
  exhaust_intake:'category-body-workshop_equipment.png',
  rims_13:'category-body-wheels_tires.png',rims_14:'category-body-wheels_tires.png',rims_15:'category-body-wheels_tires.png',
  rims_16:'category-body-wheels_tires.png',rims_17:'category-body-wheels_tires.png',rims_18:'category-body-wheels_tires.png',
  rims_19:'category-body-wheels_tires.png',rims_20:'category-body-wheels_tires.png',rims_21:'category-body-wheels_tires.png',
  rims_22:'category-body-wheels_tires.png',rims_23:'category-body-wheels_tires.png',rims_24:'category-body-wheels_tires.png',
  tires_by_size:'category-body-wheels_tires.png',workshop_equipment:'category-body-workshop_equipment.png',
  interior:'category-body-workshop_equipment.png',other_parts:'category-body-workshop_equipment.png'
};

function categoryCaption(ctx,title) {
  const conjunction=ctx.lang==='pl'?/(^|\s)([aiouwz])\s+(?=\S)/gi:/(^|\s)([aioksvuz])\s+(?=\S)/gi;
  return ['pl','cs','sk'].includes(ctx.lang)?title.replace(conjunction,'$1$2\u00a0'):title;
}

function categoryPhoto(photo) {
  const filename=/\.(?:avif|gif|jpe?g|png|webp)$/i.test(photo)?photo:photo+'.webp';
  const mirrored=filename==='category-body-semi_trailer.webp'||mirroredCategoryPhotos.has(filename)?' class="category-photo-mirrored"':'';
  return `<img src="/assets/${e(filename)}"${mirrored} data-facing="right" width="384" height="216" alt="" loading="lazy" decoding="async">`;
}

const partPhotoAliases={
  engine:'parts/engine.png',gearbox:'parts/gearbox.png',drivetrain:'parts/drivetrain.png',clutch:'parts/clutch.png',differential_turbo:'parts/differential-turbo.png',
  bumpers:'parts/bumpers.png',mirrors:'parts/mirrors.png',headlights:'parts/headlights.png',windows:'parts/windows.png',hood_doors:'parts/hood-doors.png',fenders_grilles:'parts/fenders-grilles.png',
  navigation_multimedia:'parts/navigation-multimedia.png',ecu_modules:'parts/ecu-modules.png',sensors_cameras:'parts/sensors-cameras.png',wiring_electrics:'parts/wiring-electrics.png',
  brakes:'parts/brakes.png',suspension:'parts/suspension.png',steering:'parts/steering.png',exhaust_intake:'parts/exhaust-intake.png',
  rims_13:'parts/wheels-tyres.png',rims_14:'parts/wheels-tyres.png',rims_15:'parts/wheels-tyres.png',rims_16:'parts/wheels-tyres.png',rims_17:'parts/wheels-tyres.png',rims_18:'parts/wheels-tyres.png',
  rims_19:'parts/wheels-tyres.png',rims_20:'parts/wheels-tyres.png',rims_21:'parts/wheels-tyres.png',rims_22:'parts/wheels-tyres.png',rims_23:'parts/wheels-tyres.png',rims_24:'parts/wheels-tyres.png',
  tires_by_size:'parts/wheels-tyres.png',workshop_equipment:'parts/workshop.png',interior:'parts/workshop.png',other_parts:'parts/workshop.png'
};

function categoryVariants(ctx,type,bodies) {
  return Object.entries(bodies).map(([body,label])=>{
    const heavy=heavyVehicleFilters[body];
    const title=lang(ctx,heavy?.[0]===type?heavy.slice(2,4):label);
    const photo=categoryBodyPhotos[type]?.[body]||bodyPhotoAliases[body]||'category-body-'+body;
    const destination=href(ctx,'/szukaj?'+new URLSearchParams({type,body}));
    return `<a class="category category-variant${type==='parts'?' category-part':''}" data-vehicle-filter href="${e(destination)}" title="${e(typeName(ctx,type)+' · '+title)}">
      ${type==='parts'?categoryPhoto(partPhotoAliases[body]||'parts/workshop.png'):categoryPhoto(photo)}<strong>${e(categoryCaption(ctx,title))}</strong></a>`;
  }).join('');
}

const partGroupPhotos={
  'silnik-naped':'category-body-engines_gearboxes.png','nadwozie-szyby':'category-body-body_parts.png',
  elektronika:'category-body-electronics_navigation.png','hamulce-zawieszenie':'category-body-workshop_equipment.png',
  'felgi-opony':'category-body-wheels_tires.png','warsztat-pozostale':'category-body-workshop_equipment.png'
};
function partGroupVariants(ctx) {
  return partsCatalogGroups.map(group=>`<a class="category category-part-group" href="${e(href(ctx,'/kategorie/parts')+'#'+group.id)}" title="${e(lang(ctx,group.title))}">
    ${categoryPhoto(partGroupPhotos[group.id])}<strong>${e(categoryCaption(ctx,lang(ctx,group.title)))}</strong></a>`).join('');
}

function typeName(ctx,type) {
  const labels=ctx.catalog.types[type];
  return lang(ctx,Object.hasOwn(categoryCopy,type)&&labels===options.type[type]?categoryCopy[type]:labels);
}

const formerGroupAnchors=new Map([
  ['car',['samochody-i-kampery']],['truck',['transport-i-maszyny','odmiany-transportu']],
  ['motorcycle',['motocykle-i-rekreacja','odmiany-rekreacyjne']]
]);

function vehicleCategory(ctx,type) {
  const photo=categoryTypePhotos[type]||(Object.hasOwn(categoryCopy,type)?'category-'+type:type==='other'?'category-body-other':Object.hasOwn(options.type,type)?'category-type-'+type:'category-car');
  const bodies=Object.assign({},...catalogBodyGroups(type).map(group=>group.bodies));
  const count=type==='parts'?partsCatalogGroups.length:Object.keys(bodies).length;
  const columns=limit=>Math.ceil(count/Math.ceil(count/limit));
  const destination=href(ctx,'/szukaj?'+new URLSearchParams({type}));
  const anchors=(formerGroupAnchors.get(type)||[]).map(id=>`<span id="${id}" class="catalog-anchor" aria-hidden="true"></span>`).join('');
  return `<section class="catalog-vehicle-section" data-catalog-type="${e(type)}" aria-labelledby="catalog-title-${e(type)}">${anchors}
    <h3><a class="catalog-type-tile" data-vehicle-type="${e(type)}" data-vehicle-filter${type==='car'?' id="samochody-osobowe"':''} href="${e(destination)}">
      ${categoryPhoto(photo)}<strong id="catalog-title-${e(type)}">${e(categoryCaption(ctx,typeName(ctx,type)))}</strong>
      <span class="catalog-type-action" aria-hidden="true">${ctx.t('Ogłoszenia w tej kategorii','Listings in this category')}</span></a></h3>
    ${count?`<div class="home-vehicle-variants" data-variant-count="${count}" style="--tablet-columns:${columns(3)};--medium-columns:${columns(4)};--wide-columns:${columns(6)}">${type==='parts'?partGroupVariants(ctx):categoryVariants(ctx,type,bodies)}</div>`:''}
  </section>`;
}

export async function vehicleCategoryPage(ctx,type) {
  ctx.catalog=await catalogFor(ctx);
  if(!Object.hasOwn(ctx.catalog.types,type)) missing();
  const title=typeName(ctx,type), all=ctx.t('Wszystkie ogłoszenia','All listings');
  const back=href(ctx,'/')+'#kategorie', destination=href(ctx,'/szukaj?'+new URLSearchParams({type}));
  const families=catalogBodyGroups(type);
  const sections=families.map(group=>{
    const count=Object.keys(group.bodies).length;
    if(!count) return '';
    return `<section class="catalog-subgroup"${group.id?` id="${e(group.id)}"`:''}>${group.title?`<h2>${e(lang(ctx,group.title))}</h2>`:''}
      <div class="catalog-body-grid" data-variant-count="${count}">${categoryVariants(ctx,type,group.bodies)}</div></section>`;
  }).join('');
  let content=sections;
  if(!content){
    const results=await search(ctx,new URLSearchParams({type}),{limit:6});
    content=results.total?await cards(ctx,results.offers):'';
  }
  return {title,index:!ctx.demo,body:wrap(
    `<nav aria-label="${e(ctx.t('Nawigacja','Navigation'))}"><a class="text-link catalog-back" href="${e(back)}">${icon('back',18)}${ctx.t('Wszystkie kategorie','All categories')}</a></nav>`+
    pageHead(title,'',`<a class="btn catalog-all" data-vehicle-filter href="${e(destination)}">${e(all)}</a>`)+
    `<div class="catalog-type-body" data-vehicle-type="${e(type)}"${type==='car'?' id="samochody-osobowe"':''}>${content}</div>`,'vehicle-category-page')};
}

function categories(ctx) {
  const t=ctx.t, title=t('Wszystkie kategorie','All categories');
  const types=[...new Set([...vehicleCatalogOrder,...Object.keys(ctx.catalog.types)])].filter(type=>Object.hasOwn(ctx.catalog.types,type));
  return `<section class="market-section category-directory" id="kategorie" aria-label="${e(title)}">
    ${sectionHead(title,link(ctx,'/szukaj',t('Wszystkie ogłoszenia','All listings'),'text-link'))}
    ${types.map(type=>vehicleCategory(ctx,type)).join('')}</section>`;
}

function vehicleQuickFilters(ctx) {
  const t=ctx.t;
  const conditions={new:t('Nowe','New'),used:t('Używane','Used')};
  const fuelLabels={electric:t('Elektryczne','Electric'),hybrid:t('Hybrydowe','Hybrid')};
  const buttons=(field,labels)=>Object.keys(options[field]).map(value=>
    `<button type="button" class="chip" data-filter-shortcut="${field}" value="${value}" aria-pressed="false">${e(labels[value]||localized(ctx,field,value))}</button>`).join('');
  return `<div class="category-shortcuts">
    <div><h3>${t('Stan pojazdu','Vehicle condition')}</h3><div class="category-chip-row">${buttons('condition',conditions)}</div></div>
    <div><h3>${t('Paliwo','Fuel')}</h3><div class="category-chip-row">${buttons('fuel',fuelLabels)}</div></div>
  </div>`;
}

export async function dealerProfiles(ctx,limit=9) {
  return rows(ctx.db,`SELECT u.id,u.name,u.city,c.name AS company,CASE WHEN u.show_profile_images=1 THEN c.logo_key END AS logo_key,count(l.id) AS total FROM users u LEFT JOIN companies c ON c.user_id=u.id
    JOIN listings l ON l.user_id=u.id AND l.scope=u.scope AND l.status='published' WHERE u.scope=? AND u.profile_type='company' AND u.deleted_at IS NULL
    GROUP BY u.id,c.name,c.logo_key,u.show_profile_images ORDER BY total DESC,u.name LIMIT ?`,ctx.scope,limit);
}

export async function home(ctx) {
  const t=ctx.t;
  ctx.catalog=await catalogFor(ctx);
  const [latest,featured,banners,dealers,adsReady]=await Promise.all([
    search(ctx,new URLSearchParams(),{limit:ctx.demo?demoPreviewSize:6}),
    search(ctx,new URLSearchParams(),{limit:3,featured:true}),activeBanners(ctx),dealerProfiles(ctx,3),adMediaReady(ctx)
  ]);
  const latestCards=latest.total?await cards(ctx,latest.offers):empty(ctx,t('Katalog czeka na pierwsze ogłoszenia','The catalog is ready for its first listings'),
    t('Oferty pojawią się tu po zatwierdzeniu.','Listings will appear here after approval.'));
  const steps=[
    ['edit',t('Dodaj dane pojazdu','Enter vehicle details'),t('Wpisz parametry, cenę i dodaj zdjęcia.','Enter the specifications and price, then add photos.')],
    ['shield',t('Prześlij ogłoszenie','Submit listing'),t('Ogłoszenie trafi do katalogu po sprawdzeniu.','The listing goes live after review.')],
    ['message',t('Ustal oględziny','Arrange a viewing'),t('Odpowiadaj kupującym i oznacz auto jako sprzedane.','Reply to buyers and mark the car sold.')]
  ];
  const heading=t('Znajdź samochód dla siebie','Find the right car for you');
  return {title:heading,index:true,body:`
  <section class="hero"><div class="wrap hero-inner"><div class="hero-copy">
    <span class="hero-kicker">${icon('car',17)} ${t('Kupno i sprzedaż pojazdów','Buy and sell vehicles')}</span>
    <h1>${t('Znajdź samochód <em>dla siebie</em>','Find the right car <em>for you</em>')}</h1>
    <p>${t('Samochody, motocykle, quady i inne pojazdy od sprzedawców z całej Polski.','Cars, motorcycles, ATVs and other vehicles from sellers across Poland.')}</p>
    ${!ctx.demo?`<a class="text-link hero-demo" href="/demo/szukaj">${icon('test',16)} ${t('Zobacz przykładowe ogłoszenia','See example listings')} ${icon('arrow',16)}</a>`:''}
  </div></div></section>
  <div class="wrap home-content">
    ${vehicleSearchForm(ctx,{home:true})}
    ${adCarousel(ctx,adsReady)}
    ${!adsReady?`<p class="muted">${t('Banery ALL4RENT są chwilowo niedostępne.','The ALL4RENT banners are temporarily unavailable.')}</p>`:''}
    ${banners.length?managedBanners(ctx,banners):''}
    ${categories(ctx)}
    ${featured.total?`<section class="market-section">${sectionHead(t('Wyróżnione ogłoszenia','Featured listings'))}${await cards(ctx,featured.offers)}</section>`:''}
    <section class="market-section${ctx.demo?' demo-latest':''}">${sectionHead(t('Najnowsze ogłoszenia','Latest listings'),link(ctx,'/szukaj',t('Zobacz wszystkie','See all'),'text-link','arrow'))}${latestCards}</section>
    ${!ctx.demo&&!latest.total?await demoCarPreview(ctx):''}
    <section class="market-section">${sectionHead(t('Dealerzy i komisy','Dealers and showrooms'),link(ctx,'/dealerzy',t('Dla dealerów','For dealers'),'text-link','arrow'))}
      ${dealers.length?`<div class="dealer-grid">${dealers.map(x=>dealerCard(ctx,x)).join('')}</div>`:`<div class="dealer-intro"><span class="mini-icon">${icon('building',24)}</span><div><strong>${t('Sprzedajesz jako firma?','Selling as a business?')}</strong><p>${t('Załóż wizytówkę i importuj własne oferty z CSV.','Create a business profile and import your own listings via CSV.')}</p></div>${link(ctx,'/dealerzy',t('Zobacz panel dealera','Explore dealer tools'),'btn','arrow')}</div>`}</section>
    <section class="market-section sell-guide" aria-labelledby="sell-guide-heading">
      <h2 id="sell-guide-heading">${t('Jak sprzedać pojazd?','How do I sell a vehicle?')}</h2>
      <ol class="steps-grid">${steps.map(([symbol,title,body])=>`<li class="step-card"><span class="mini-icon">${icon(symbol,22)}</span><div><h3>${e(title)}</h3><p>${e(body)}</p></div></li>`).join('')}</ol>
      <div class="sell-guide-action">${link(ctx,'/sprzedaj',t('Sprzedaj pojazd','Sell a vehicle'),'btn primary','listing')}</div>
    </section>
    <section class="install-panel" aria-labelledby="install-panel-heading">
      <div class="mini-icon">${icon('mobile',25)}</div>
      <div><h2 id="install-panel-heading">${t('Aplikacja BrumBrum.VIN','BrumBrum.VIN app')}</h2><p>${t('Dodaj aplikację z przeglądarki na telefonie, tablecie lub komputerze.','Install the app from your browser on your phone, tablet or computer.')}</p></div>
      ${link(ctx,'/aplikacja',t('Dodaj aplikację','Install app'),'btn','download')}
    </section>
    <section class="china-market market-section" id="rynek-aut-z-chin" data-china-market aria-labelledby="china-market-title"
      data-read-article="${t('Czytaj pełny artykuł','Read full article')}"
      data-illustrative="${t('Grafika poglądowa','Illustrative image')}">
      <div class="china-market-head">
        <div><h2 id="china-market-title">${t('Rynek aut z Chin','China car market')}</h2>
        <p>${t('Sprzedaż, eksport, premiery modeli i technologie. Nagłówki w języku źródeł.','Sales, exports, model launches and technology. Headlines in their original language.')}</p></div>
        <p class="china-market-status" data-market-status
          data-checked="${t('Ostatnie sprawdzenie źródeł','Sources last checked')}"
          data-unavailable="${t('Aktualności chwilowo niedostępne. Bezpośrednie linki do źródeł są poniżej.','News is temporarily unavailable. Direct source links are below.')}">${t('Pobieranie aktualności…','Loading news…')}</p>
      </div>
      <ul class="china-market-articles" id="china-market-articles" data-market-articles></ul>
      <div class="china-market-links">
        <a href="https://cnevpost.com/industry/">${t('Dane sprzedaży CPCA','CPCA sales data')} · CnEVPost</a>
        <a href="https://carnewschina.com/">CarNewsChina</a>
        <button class="btn" type="button" data-market-more aria-controls="china-market-articles" aria-expanded="false" hidden
          data-more="${t('Pokaż więcej','Show more')}" data-less="${t('Pokaż mniej','Show less')}">${t('Pokaż więcej','Show more')}</button>
      </div>
    </section>
    ${await youtubePromotionsSection(ctx)}
    ${robotBanner(ctx)}
  </div><script type="module" src="/assets/china-market.js?v=2"></script>`};
}
function dealerCard(ctx,x) {
  return `<a class="dealer-card" href="${href(ctx,'/dealer/'+e(x.id))}">
    <span class="mini-icon">${x.logo_key?`<img src="${href(ctx,'/asset/company/'+e(x.logo_key))}" alt="" loading="lazy">`:icon('building',23)}</span>
    <span><strong>${e(x.company||x.name)}</strong><small>${e(x.city||ctx.t('Polska','Poland'))} · ${e(x.total)} ${ctx.t('ofert','listings')}</small></span>${icon('arrow',18)}</a>`;
}

function queryLink(ctx,params,change={}) {
  const result=new URLSearchParams(params);
  for (const [key,value] of Object.entries(change)) {
    if (value==null||value==='') result.delete(key);
    else result.set(key,value);
  }
  return href(ctx,'/szukaj')+(result.size?'?'+result.toString():'');
}
const searchBatchSize=24;
const searchResultUrl=(ctx,result,page)=>queryLink(ctx,new URLSearchParams(result.values),{
  sort:result.sort==='latest'?null:result.sort,pokaz:page>1?page:null
});
async function searchBatch(ctx,previousPages=0) {
  const params=new URLSearchParams(ctx.url.searchParams);
  params.set('page',params.get('pokaz')||params.get('page')||'1');
  const result=await search(ctx,params,{limit:ctx.demo?demoGalleries.size:searchBatchSize,previousPages});
  const current=searchResultUrl(ctx,result,result.page);
  const next=result.page<result.pages?searchResultUrl(ctx,result,result.page+1):'';
  return {result,current,next};
}
export async function renderSearchBatch(ctx) {
  const {result,current,next}=await searchBatch(ctx);
  return `<div data-search-batch data-current="${e(current)}" data-next="${e(next)}" data-total="${result.total}">${await offerCards(ctx,result.offers,current,true)}</div>`;
}
export async function searchPage(ctx) {
  const t=ctx.t;
  ctx.catalog=await catalogFor(ctx);
  const params=ctx.url.searchParams;
  const {result,current,next}=await searchBatch(ctx,7);
  const partsMode=result.values.type==='parts';
  const title=partsMode?t('Części i akcesoria','Parts and accessories'):t('Pojazdy na sprzedaż','Vehicles for sale');
  const filtersAndSort=new URLSearchParams(result.values);
  if (result.sort!=='latest') filtersAndSort.set('sort',result.sort);
  const tags=Object.entries(result.values).map(([key,value])=>`<a class="chip active-chip" href="${e(queryLink(ctx,filtersAndSort,{[key]:null,...(key==='make'?{model:null}:{})}))}" aria-label="${e(t('Usuń filtr','Remove filter')+' '+lang(ctx,filterFields[key]))}">${e(lang(ctx,filterFields[key]))} <strong>${e(options[key]||key==='type'?optionName(ctx,key,value,result.values.type):value)}</strong>${icon('close',15)}</a>`).join('');
  const titleCount=(partsMode?t('Wyniki części','Part results'):t('Wyniki','Results'))+' · '+result.total;
  const unfiltered=!Object.keys(result.values).length;
  const sample=!ctx.demo&&!result.total&&unfiltered?await demoCarPreview(ctx):'';
  const filters=partsMode?partsSearchForm(ctx,{values:result.values,sort:result.sort}):vehicleSearchForm(ctx,{values:result.values,sort:result.sort,open:params.get('filtry')==='1'});
  const sort=`<form action="${href(ctx,'/szukaj')}" method="get" class="sort-form">${Object.entries(result.values).map(([key,value])=>hidden(key,value)).join('')}
    ${choice(ctx,'sort',t('Sortowanie','Sort by'),options.sort,result.sort,{placeholder:false,attributes:'data-sort'})}<noscript>${submit(t('Sortuj','Sort'))}</noscript></form>`;
  const compareName=t('Porównywarka','Compare');
  const compareLink=`<a class="btn results-compare" href="${e(href(ctx,'/porownanie'))}" title="${e(compareName)}">
    ${icon('scale',20)}${resultActionLabels(compareName,t('Porównaj','Compare'))}</a>`;
  const resultsHeader=(reelButton='')=>`<div class="results-head"><h2 data-search-count>${e(titleCount)}</h2>${sort}${compareLink}${reelButton}</div>
    ${tags?`<div class="active-filters">${tags}${link(ctx,'/szukaj',t('Wyczyść filtry','Clear filters'),'text-link')}</div>`:''}`;
  const loadMore=next?`<div class="search-more"><a class="btn" href="${e(next)}" data-search-more>${t('Pokaż więcej ogłoszeń','Show more listings')} ${icon('down',17)}</a>
    <p class="form-status" role="status" data-search-status></p></div>`:'';
  const listings=result.total?`<div data-search-results>${await cards(ctx,result.offers,current,true,resultsHeader)}${loadMore}</div>`:
    resultsHeader()+empty(ctx,t('Brak wyników','No results'),unfiltered?t('Oferty pojawią się tutaj po zatwierdzeniu.','Listings will appear here after approval.'):
      t('Zmień kryteria lub usuń część filtrów.','Change your criteria or remove some filters.'),unfiltered?'':link(ctx,'/szukaj',t('Wyczyść filtry','Clear filters'),'btn','close'),'search');
  return {title,index:!params.size,body:wrap(pageHead(title)+
    `<div class="search-layout">${filters}<section class="search-main">${listings}${sample}</section></div>`)};
}

function facts(ctx,offer) {
  const t=ctx.t;
  const profile=vehicleFeatures(offer.type,offer.body);
  const drivetrain=profile.motorized?[
    ['gauge',t('Przebieg','Mileage'),km(ctx,offer.mileage)],['fuel',t('Paliwo','Fuel'),localized(ctx,'fuel',offer.fuel)],
    ['gear',t('Skrzynia biegów','Transmission'),localized(ctx,'gearbox',offer.gearbox)],
    ['gauge',t('Moc','Power'),offer.power?offer.power+' '+(offer.powerUnit==='KM'?t('KM','hp'):offer.powerUnit):'—'],
    ['settings',t('Napęd','Drivetrain'),localized(ctx,'drive',offer.drive)],
    ...(profile.hours?[['gauge',t('Motogodziny','Operating hours'),operatingHours(ctx,offer)]]:[])
  ]:offer.type==='trailer'?[['scale',t('DMC','Gross vehicle weight'),measure(ctx,offer.grossWeight,'kg')],['settings',t('Liczba osi','Number of axles'),offer.axles||'—']]:[];
  return [
    ['calendar',t('Rok produkcji','Year'),offer.year||'—'],...drivetrain,
    ['car',t('Nadwozie lub odmiana','Body style or variant'),optionName(ctx,'body',offer.body,offer.type)],
    ['shield',t('Stan','Condition'),localized(ctx,'condition',offer.condition)]
  ];
}
function listingPhotos(offer) {
  const sample=offer.demo_photo;
  return offer.photos.length?offer.photos:demoGalleries.get(sample)||(sample?[{url:sample,thumb:sample}]:[]);
}
export function photoGallery(ctx,offer,{autoplay=false,photos=listingPhotos(offer),captions=[],mobileView=false}={}) {
  const t=ctx.t;
  if (!photos.length) return `<div class="gallery-placeholder">${thumb(ctx,offer)}</div>`;
  const photoAlt=titleOf(offer)+(offer.demo_photo&&!offer.photos.length?' · '+t('zdjęcie poglądowe','illustrative image'):'');
  const prev=`<button class="icon-button gallery-icon-control gallery-prev" type="button" data-gallery-prev aria-label="${t('Poprzednie zdjęcie','Previous photo')}">${icon('back',19)}</button>`;
  const next=`<button class="icon-button gallery-icon-control gallery-next" type="button" data-gallery-next aria-label="${t('Następne zdjęcie','Next photo')}">${icon('arrow',19)}</button>`;
  const count=`<span class="gallery-count" data-gallery-count>1 / ${photos.length}</span>`;
  const multiple=photos.length>1;
  const columns=Math.min(3,photos.length);
  const mobileColumns=Math.min(5,photos.length);
  const thumbnailSizes=`(max-width: 700px) calc((100vw - 44px) / ${mobileColumns}), (min-width: 1041px) calc((100vw - 112px) / ${columns}), calc((100vw - 36px) / ${columns})`;
  const thumbnails=multiple?photos.map((photo,i)=>{
    const src=e(photo.thumb+(photo.wide?'?v=wide-strip':''));
    return `<div class="gallery-thumb">
      <button type="button" data-thumb="${i}" aria-pressed="${i===0}" aria-label="${t('Zdjęcie','Photo')} ${i+1}">
        <img src="${src}"${photo.wide?` srcset="${src} 640w, ${e(photo.url)} 1920w" sizes="${thumbnailSizes}"`:''} alt="" loading="lazy" decoding="async" width="640" height="360">
      </button>${captions[i]||''}
    </div>`;
  }).join(''):'';
  const photoStack=mobileView?`<div class="gallery-photo-stack" id="listing-photo-stack" data-photo-stack role="group" aria-label="${t('Zdjęcia','Photos')}" hidden>
    ${photos.slice(0,3).map(({detail,wide},index)=>{
      const label=t('Powiększ zdjęcie','Enlarge photo')+' '+(index+1)+(detail?' · '+t(...photoDetailLabels[detail]):'');
      return `<button type="button" class="gallery-stack-photo" data-stack-photo="${index}" aria-label="${e(label)}" aria-haspopup="dialog">
        <img alt="" fetchpriority="low" decoding="async"${wide?' sizes="calc(100vw - 12px)"':''}></button>`;
    }).join('')}
    </div>`:'';
  return `<div class="gallery" data-gallery="${embed(photos)}" ${photos[0].wide?'data-gallery-wide':''} ${!offer.photos.length&&offer.demo_photo&&autoplay?'data-gallery-autoplay':''}>
    <div class="gallery-main" data-swipe><button type="button" class="gallery-enlarge" data-enlarge aria-label="${t('Powiększ zdjęcie','Enlarge photo')}"><img src="${e(photos[0].url)}" alt="${e(photoAlt)}" data-gallery-image fetchpriority="high" decoding="async" width="1920" height="1080"><span class="gallery-zoom" aria-hidden="true">${icon('zoom',20)}<span class="gallery-zoom-label"><span>+</span> ${t('Powiększ','Enlarge')}</span></span></button></div>
    <div class="gallery-controls" role="group" aria-label="${t('Sterowanie galerią','Gallery controls')}">
      ${multiple?`${prev}<div class="gallery-thumbs" style="--thumb-columns:${columns};--mobile-thumb-columns:${mobileColumns}"${photos.length===columns?' data-swipe':''} role="group" aria-label="${t('Miniatury zdjęć','Photo thumbnails')}">${thumbnails}</div>${next}
        <div class="gallery-playback">
          <button class="icon-button gallery-icon-control" type="button" data-gallery-play aria-pressed="false" aria-label="${t('Włącz pokaz slajdów','Play slideshow')}">
            <span data-play-icon>${icon('play',14)}</span><span data-pause-icon hidden>${icon('pause',14)}</span></button>${count}
        </div>`:count}
    </div>
    ${photoStack}
    <dialog class="lightbox" data-lightbox><button type="button" class="icon-button gallery-icon-control lightbox-close" data-close aria-label="${t('Zamknij','Close')}">${icon('close')}</button>
      <div class="lightbox-inner" data-swipe><img alt="${e(photoAlt)}" data-lightbox-image>${multiple?prev+next:''}</div></dialog>
    </div>`;
}
function galleryDetails(ctx,photos) {
  const t=ctx.t;
  const details=photos.flatMap(({url,detail,hotspots=[]},photoIndex)=>
    [...hotspots,...(detail?[{detail,photoIndex}]:[])].map(point=>({...point,url,label:t(...photoDetailLabels[point.detail])})));
  const captions=[];
  if (!details.length) return {captions,controls:''};
  const trigger=(index,{visual=false,style='gallery-detail-chip',inThumb=false}={})=>{
    const {label}=details[index];
    return `<button type="button" class="${visual?'gallery-hotspot':style}"${visual?` aria-label="${e(label)}" title="${e(label)}" hidden`:''}${inThumb?' data-in-thumb':''}
      data-open-photo-detail="${index}" aria-haspopup="dialog"><span aria-hidden="true">+</span>${visual?'':e(label)}</button>`;
  };
  const dock=details.map(({photoIndex},index)=>{
    const inThumb=photos.length>1&&photoIndex!==undefined;
    if (inThumb) captions[photoIndex]=trigger(index,{style:'gallery-thumb-caption'});
    return trigger(index,{inThumb});
  }).join('');
  const controls=`<div class="gallery-details" data-gallery-details="${embed(details.map(({photoIndex,...point})=>point))}" hidden>
    <div class="gallery-detail-dock" role="group" aria-label="${t('Detale i ujęcia pojazdu','Vehicle details and angles')}">${dock}</div>
    ${details.map((point,index)=>Number.isFinite(point.x)?trigger(index,{visual:true}):'').join('')}
    <dialog class="lightbox gallery-detail-preview" data-gallery-detail-preview aria-labelledby="gallery-detail-title">
      <header class="gallery-detail-heading"><h2 id="gallery-detail-title" data-gallery-detail-title></h2>
        <button type="button" class="icon-button gallery-icon-control" data-close autofocus aria-label="${t('Zamknij','Close')}">${icon('close')}</button></header>
      <div class="gallery-detail-photo" data-gallery-detail-photo><img data-gallery-detail-image alt="" decoding="async"></div>
      <p class="gallery-detail-status" data-gallery-detail-error role="status" hidden>${t('Nie udało się wczytać zdjęcia.','The photo could not be loaded.')}</p>
    </dialog></div>`;
  return {captions,controls};
}
function listingMedia(ctx,offer,{autoplay,mobileFacts,photos,mobileView}) {
  const t=ctx.t;
  const {captions,controls}=galleryDetails(ctx,photos);
  const gallery=photoGallery(ctx,offer,{autoplay,photos,captions,mobileView});
  const factsBar=`<div class="gallery-mobile-facts">${mobileFacts}</div>`;
  const spin=offer.spin.length>=spinLimits.min;
  if (!spin&&!offer.video) return `<div class="showcase-media">${gallery}${controls}${factsBar}</div>`;
  const modes=[['photos','image',t('Zdjęcia','Photos')],...(spin?[['spin','rotate',t('Widok 360°','360° view')]]:[]),
    ...(offer.video?[['video','video',t('Rolka','Reel')]]:[])];
  return `<div class="showcase-media" data-listing-media>
    <div data-media-pane="photos" id="listing-media-photos">${gallery}</div>
    ${spin?`<div data-media-pane="spin" id="listing-media-spin" hidden>${spinViewer(ctx,offer)}</div>`:''}
    ${offer.video?`<div data-media-pane="video" id="listing-media-video" hidden>
      <video class="listing-video" controls playsinline preload="metadata" data-listing-video="${e(offer.video)}" ${offer.cover?`poster="${e(offer.cover)}"`:''} aria-label="${t('Wideo pojazdu','Vehicle video')}"></video>
      <p class="flash warn" data-video-error hidden>${t('Nie udało się odtworzyć wideo w tej przeglądarce.','The video could not be played in this browser.')}</p></div>`:''}
    <div class="media-switch" role="group" aria-label="${t('Materiały ogłoszenia','Listing media')}">
      ${modes.map(([mode,symbol,label])=>`<button class="btn" data-media-tab="${mode}" type="button" aria-pressed="${mode==='photos'}" aria-controls="listing-media-${mode}">${icon(symbol,18)}${label}</button>`).join('')}
    </div>
    ${controls}${factsBar}
  </div>`;
}
function specs(ctx,offer) {
  const t=ctx.t;
  const profile=vehicleFeatures(offer.type,offer.body);
  const table=[
    [t('Rodzaj pojazdu','Vehicle type'),optionName(ctx,'type',offer.type)],
    [t('Marka','Make'),offer.make],[t('Model','Model'),offer.model],[t('Wersja','Trim'),offer.variant],
    ...facts(ctx,offer).map(([,label,value])=>[label,value]),
    ...(profile.motorized&&offer.fuel!=='electric'?[[t('Pojemność silnika','Engine capacity'),offer.engine?offer.engine+' cm³':'']]:[]),
    ...(['electric','plugin'].includes(offer.fuel)?[[t('Pojemność akumulatora','Battery capacity'),offer.battery?offer.battery+' kWh':''],[t('Deklarowany zasięg','Claimed range'),offer.range?offer.range+' km':'']]:[]),
    ...(profile.doors?[[t('Liczba drzwi','Doors'),offer.doors]]:[]),
    ...(profile.motorized?[[t('Liczba miejsc','Seats'),offer.seats]]:[]),[t('Kolor','Color'),offer.color],
    [t('Kraj pochodzenia','Country of origin'),offer.countryOrigin],[t('Pierwsza rejestracja','First registration'),offer.registered],
    ['VIN / '+t('Identyfikator','Identifier'),offer.vin],[t('Dokument sprzedaży','Sales document'),localized(ctx,'document',offer.document)]
  ];
  return `<dl class="spec-table">${table.map(([key,value])=>`<div><dt>${e(key)}</dt><dd>${e(value||'—')}</dd></div>`).join('')}</dl>`;
}
function equipment(ctx,offer) {
  const t=ctx.t;
  const groups=Object.values(features).map(([pl,en,choices])=>[t(pl,en),Object.entries(choices).filter(([key])=>offer.equipment?.includes(key))]).filter(([,list])=>list.length);
  if(Array.isArray(offer.importEquipment)&&offer.importEquipment.length)groups.push([t('Pozostałe wyposażenie','Additional equipment'),offer.importEquipment.map(key=>[key,[key,key]])]);
  return groups.length?`<div class="equipment-grid">${groups.map(([label,items])=>`<div><h3>${e(label)}</h3><ul>${items.map(([,pair])=>`<li>${icon('check',17)}${e(lang(ctx,pair))}</li>`).join('')}</ul></div>`).join('')}</div>`:
    `<p class="muted">${t('Sprzedawca nie podał wyposażenia.','The seller has not listed any equipment.')}</p>`;
}
function contactDialog(ctx,offer,isViewing,next) {
  const t=ctx.t;
  const dialog=isViewing?'viewing':'contact';
  const title=isViewing?t('Umów oględziny','Arrange a viewing'):t('Napisz do sprzedawcy','Message the seller');
  const body=ctx.user?apiForm('/offers/'+offer.id+'/message',keyInput()+(isViewing?field('proposed_at',t('Proponowany termin','Proposed date and time'),'',{type:'datetime-local',required:true}):'')+
      area('body',t('Wiadomość','Message'),isViewing?t('Dzień dobry, proponuję oględziny w podanym terminie.','Hello, I would like to view the vehicle at the proposed time.'):'',{required:true,attributes:'maxlength="3000" data-message-body'})+submit(t('Wyślij wiadomość','Send message'),'message'),
      {go:'thread'}):enquiryAccess(ctx,next);
  return `<dialog class="modal" data-dialog="${dialog}" aria-labelledby="listing-${dialog}-title"><div class="modal-head"><h2 id="listing-${dialog}-title">${title}</h2><button class="icon-button" data-close type="button" aria-label="${t('Zamknij','Close')}">${icon('close')}</button></div>
    ${ctx.user&&isViewing?`<p>${t('Sprzedawca otrzyma propozycję terminu i zdecyduje, czy ją potwierdzić.','The seller will receive your proposed time and decide whether to confirm it.')}</p>`:''}${body}</dialog>`;
}
export function reportDialog(ctx,kind,ref) {
  const t=ctx.t;
  return `<dialog class="modal" data-dialog="report"><div class="modal-head"><h2>${kind==='appeal'?t('Odwołanie','Appeal'):t('Zgłoś nieprawidłowość','Report an issue')}</h2><button type="button" class="icon-button" data-close aria-label="${t('Zamknij','Close')}">${icon('close')}</button></div>
  ${apiForm('/report',(kind==='listing'?choice(ctx,'kind',t('Rodzaj zgłoszenia','Report category'),{rules:[t('Naruszenie zasad','Rules violation'),t('Naruszenie zasad','Rules violation')],illegal:[t('Podejrzenie nielegalnej treści','Suspected illegal content'),t('Podejrzenie nielegalnej treści','Suspected illegal content')]},'rules',{placeholder:false}):hidden('kind',kind))+
    hidden(kind==='message'?'thread':'listing',ref)+(ctx.user?'':field('email',t('E-mail (wymagany przy zgłoszeniu nielegalnej treści)','Email (required when reporting illegal content)'),' ',{type:'email'}))+
    area('reason',t('Uzasadnienie','Reason'),'',{required:true,attributes:'minlength="10" maxlength="2500"'})+
    submit(t('Wyślij zgłoszenie','Submit report'),'flag'),{success:t('Zgłoszenie zapisano.','Report saved.'),go:'reported'})}</dialog>`;
}

function offerSection(title,symbol,body,id='') {
  return `<details class="panel offer-section"${id?` id="${e(id)}"`:''}><summary>${icon(symbol,19)}<span>${title}</span>${icon('down',17)}</summary><div>${body}</div></details>`;
}

function vinCheck(ctx,offer) {
  const t=ctx.t;
  const identifier=String(offer.vin??'').trim();
  const vin=listingVin(identifier);
  const hasVin=Boolean(vin);
  const provider=t('https://www.carvertical.com/pl/historia-pojazdu','https://www.carvertical.com/en');
  const identifierText=hasVin?t('VIN z ogłoszenia','VIN from the listing'):t('Identyfikator z ogłoszenia','Identifier from the listing');
  const hint=hasVin?t('Skopiuj VIN i wklej go w formularzu carVertical.','Copy the VIN and paste it into the carVertical form.'):
    identifier?t('Do sprawdzenia po VIN carVertical wymaga standardowego 17-znakowego numeru. O dokumenty pojazdu zapytaj sprzedawcę.',
      'A carVertical VIN check requires a standard 17-character VIN. Ask the seller for the vehicle documents.'):
    offer.demo_photo?t('To przykładowe ogłoszenie nie zawiera numeru VIN.','This example listing has no VIN.'):
    t('Sprzedawca nie podał numeru VIN. Poproś o niego przed sprawdzeniem historii.',
      'The seller did not provide a VIN. Ask for it before checking the vehicle history.');
  return offerSection(t('Sprawdź po numerze VIN','Check by VIN'),'search',`<div class="vin-check">
    <div class="vin-check-info">
      ${identifier?`<dl class="vin-check-number"><dt>${identifierText}</dt><dd><code>${e(hasVin?vin:identifier)}</code></dd></dl>`:''}
      <p class="muted">${hint}</p>
    </div>
    <div class="vin-check-provider">
      <div class="inline vin-check-actions">
        ${hasVin?`<button class="btn" type="button" data-copy-vin="${e(vin)}" hidden>${icon('copy',17)}${t('Kopiuj VIN','Copy VIN')}</button>`:''}
        <a class="btn primary" href="${provider}" target="_blank" rel="noopener noreferrer">${buttonEmbroideryLabel(t('Sprawdź w carVertical','Check on carVertical'))}${icon('arrow',17)}</a>
      </div>
      <p class="muted">${t('Serwis zewnętrzny. Pełny raport jest płatny.','External service. The full report is paid.')}</p>
    </div>
  </div>`,'sprawdz-vin');
}

const financeEligibleTypes=new Set(['car','van','truck','garden','farm','construction','forestry','industrial','special']);
function financeCalculator(ctx,offer) {
  if (!financeEligibleTypes.has(offer.type)||!Number.isFinite(Number(offer.price))||Number(offer.price)<=0) return '';
  const t=ctx.t, amount=Math.round(Number(offer.price));
  return `<div class="finance-calculator" data-finance-calculator data-finance-price="${amount}" data-finance-currency="${e(offer.currency||'PLN')}">
    <div class="finance-calculator-head"><div><h2>${t('Kalkulator finansowania / leasingu','Financing / leasing calculator')}</h2><p>${t('Orientacyjna rata miesięczna dla tej oferty.','Estimated monthly payment for this listing.')}</p></div><output data-finance-payment aria-live="polite"></output></div>
    <div class="finance-calculator-controls">
      <label><span>${t('Okres finansowania','Term')} <output data-finance-term-value></output></span><input type="range" data-finance-term min="24" max="72" step="12" value="60"></label>
      <label><span>${t('Wpłata własna','Own contribution')} <output data-finance-contribution-value></output></span><input type="range" data-finance-contribution min="0" max="45" step="5" value="10"></label>
    </div>
    <p class="finance-calculator-note">${t('Kalkulacja orientacyjna, bez oferty wiążącej.','Illustrative calculation, not a binding offer.')}</p>
    <button type="button" class="btn primary finance-calculator-cta" data-open="finance" data-button-finish-action>${buttonEmbroideryLabel(t('Zapytaj o finansowanie w 60 sekund','Ask about financing in 60 seconds'))}</button>
  </div>`;
}

function financeDialog(ctx,offer,next) {
  const t=ctx.t, title=t('Zapytaj o finansowanie','Ask about financing');
  const initial=t('Proszę o ofertę finansowania dla tego pojazdu.','Please send me a financing offer for this vehicle.');
  const body=ctx.user?apiForm('/offers/'+offer.id+'/message',keyInput()+area('body',t('Wiadomość','Message'),initial,{required:true,rows:4,attributes:'maxlength="3000" data-finance-lead-text'})+
    submit(t('Wyślij zapytanie','Send enquiry'),'message'),{go:'thread'}):enquiryAccess(ctx,next);
  return `<dialog class="modal finance-dialog" data-dialog="finance" aria-labelledby="finance-title"><div class="modal-head"><h2 id="finance-title">${title}</h2><button class="icon-button" data-close type="button" aria-label="${t('Zamknij','Close')}">${icon('close')}</button></div>
    <p>${t('Zostaw kontakt przez wiadomość przy ofercie. Wątek zachowuje parametry kalkulacji, aby sprawnie przygotować finansowanie.','Send an enquiry through this listing. The conversation retains the calculation parameters for a faster financing proposal.')}</p>${body}</dialog>`;
}

function listingTrail(ctx,offer,name,back,fromResults,isPublic) {
  const t=ctx.t;
  const filters=new URLSearchParams(offer.type?{type:offer.type}:{});
  const category=offer.type==='car'?t('Samochody osobowe','Passenger cars'):optionName(ctx,'type',offer.type)||t('Ogłoszenia','Listings');
  const crumbs=isPublic?[[fromResults?back:queryLink(ctx,filters),category]]:
    [[back,t('Wróć do panelu','Back to dashboard')]];
  if (isPublic&&offer.make&&(offer.model||offer.variant)) {
    filters.set('make',offer.make);
    crumbs.push([queryLink(ctx,filters),offer.make]);
  }
  if (isPublic&&offer.model&&offer.variant) {
    filters.set('model',offer.model);
    crumbs.push([queryLink(ctx,filters),offer.model]);
  }
  const current=offer.variant||offer.model||name;
  return `<nav class="wrap listing-trail" aria-label="${t('Ścieżka nawigacji','Breadcrumb')}">
    <a href="${e(href(ctx,'/'))}" aria-label="${t('Start','Home')}">${icon('home',16)}</a>
    ${crumbs.map(([url,label])=>`${icon('chevron',12)}<a href="${e(url)}" title="${e(label)}">${e(label)}</a>`).join('')}
    ${icon('chevron',12)}<span aria-current="page" title="${e(current)}">${e(current)}</span></nav>`;
}

export async function detail(ctx,offer,{mode='public',extras=''}={}) {
  const t=ctx.t;
  ctx.catalog??=await catalogFor(ctx);
  const name=titleOf(offer)||t('Podgląd ogłoszenia','Listing preview');
  const isPublic=mode==='public';
  const slidePanel=isPublic&&offer.status==='published';
  const contactable=isPublic&&offer.status==='published'&&ctx.user?.id!==offer.user_id;
  const searchBack=cleanReturn(ctx.url.searchParams.get('powrot'),'');
  const searchUrl=href(ctx,'/szukaj');
  const allowedBack=searchBack.split(/[?#]/,1)[0]===searchUrl;
  const back=isPublic?(allowedBack?searchBack:searchUrl):href(ctx,mode==='moderation'?'/moderacja':'/moje-ogloszenia');
  const desc=offerDescription(ctx,offer);
  const description=desc?`<p class="prose">${e(desc)}</p>`:`<p class="muted">${t('Brak opisu.','No description.')}</p>`;
  const declarations=[['accidentFree',t('Bezwypadkowy','Accident-free')],['firstOwner',t('Pierwszy właściciel','First owner')],['service',t('Serwisowany','Serviced')]].filter(([key])=>offer[key]);
  const favoriteMarked=isPublic&&(await favorites(ctx)).includes(offer.id);
  let similar=[];
  if (isPublic) {
    const params=new URLSearchParams({type:offer.type,...(offer.body?{body:offer.body}:{})});
    similar=(await search(ctx,params,{exclude:offer.id,limit:3})).offers;
    if (!similar.length && offer.type) similar=(await search(ctx,new URLSearchParams({type:offer.type}),{exclude:offer.id,limit:3})).offers;
  }
  const nextOffer=href(ctx,'/oferta/'+offer.slug);
  const offerReturn=kind=>listingUrl(ctx,offer,allowedBack?searchBack:'')+(allowedBack?'&':'?')+'kontakt='+kind;
  const messageReturn=offerReturn('wiadomosc');
  const viewingReturn=offerReturn('ogledziny');
  const contactAction=(dialog,next,label,symbol,style)=>ctx.user
    ? `<button class="${style}" type="button" data-open="${dialog}" aria-haspopup="dialog" data-button-finish-action>${icon(symbol)}${buttonEmbroideryLabel(label)}</button>`
    : `<a class="${style}" href="${e(loginPath(ctx,next))}" data-open-enquiry="${dialog}" aria-haspopup="dialog" data-button-finish-action>${icon(symbol)}${buttonEmbroideryLabel(label)}</a>`;
  const reelAction=isPublic&&(offer.demo_photo||offer.video)?link(ctx,'/rolki/'+offer.slug,t('Rolki','Reels'),'btn listing-reels-link','video',{buttonFinish:true}):'';
  const callLabel=offer.listingPhone?t('Zadzwoń','Call')+' · '+offer.listingPhone:'';
  const callAction=callLabel&&(mode==='preview'||(isPublic&&offer.status==='published'))
    ? isPublic
      ? `<a class="btn primary listing-call" href="tel:${e(offer.listingPhone.replace(/[^+0-9]/g,''))}" data-button-finish-action>${icon('phone',18)}${buttonEmbroideryLabel(callLabel)}</a>`
      : `<span class="btn primary listing-call" data-button-finish-action>${icon('phone',18)}${buttonEmbroideryLabel(callLabel)}</span>`
    : '';
  const contactActions=contactable||reelAction||callAction?`<div class="stack contact-actions">
    ${callAction}
    ${contactable?`${contactAction('contact',messageReturn,t('Napisz wiadomość','Send a message'),'message',callAction?'btn':'btn primary')}
    ${!callAction&&offer.phone_available?`<button class="btn" type="button" data-phone="${e(offer.id)}" data-button-finish-action>${icon('phone')}${buttonEmbroideryLabel(t('Pokaż numer','Show number'))}</button><div class="phone-links" data-phone-links hidden><strong data-phone-number></strong><a class="btn" data-call data-button-finish-action>${icon('phone',18)}${buttonEmbroideryLabel(t('Zadzwoń','Call'))}</a><button type="button" class="btn" data-copy-phone data-button-finish-action>${icon('copy',18)}${buttonEmbroideryLabel(t('Skopiuj','Copy'))}</button></div>`:''}
    ${contactAction('viewing',viewingReturn,t('Umów oględziny','Arrange a viewing'),'calendar','btn')}`:''}
    ${reelAction}</div>`:'';
  const financing=isPublic&&contactable?financeCalculator(ctx,offer):'';
  const tools=isPublic?`<div class="detail-tools">${favoriteButton(ctx,offer,favoriteMarked,t('Ulubione','Favorite'))}${compare(ctx,offer,t('Porównaj','Compare'))}
    <button type="button" class="btn" data-share="${e(nextOffer)}">${icon('share',20)}${t('Udostępnij','Share')}</button></div>`:'';
  const quickFacts=`<dl class="facts-grid" aria-label="${t('Najważniejsze parametry','Key specifications')}">
    ${keyFacts(ctx,offer).map(([symbol,label,value])=>`<div>${icon(symbol,17)}<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div></div>`).join('')}</dl>`;
  const photos=listingPhotos(offer);
  const mobileView=isPublic&&photos.length>1;
  const media=listingMedia(ctx,offer,{autoplay:isPublic,mobileFacts:quickFacts,photos,mobileView});
  const photoActions=isPublic?`<div class="showcase-photo-actions">
    <button type="button" class="icon-button" data-share="${e(nextOffer)}" aria-label="${t('Udostępnij ogłoszenie','Share listing')}">${icon('share',20)}</button>
    ${compare(ctx,offer)}
    ${favoriteButton(ctx,offer,favoriteMarked)}</div>`:'';
  const seller=panel('',`${sellerCover(ctx,offer.seller_panorama)}<div class="seller">${sellerThumbnail(ctx,offer.profile_type==='company',offer.company_logo,offer.seller_avatar)}<div><strong>${e(offer.seller_name||'—')}</strong><small>${e(localized(ctx,'seller',offer.profile_type))}</small></div></div>
      <p class="location">${icon('pin',18)} ${e([offer.city,offer.region,offer.country].filter(Boolean).join(', ')||'—')}</p>
      <div class="seller-links">${isPublic?`<a class="text-link" href="${e(sellerUrl(ctx,offer))}">${t('Oferty sprzedawcy','Seller’s listings')} ${icon('arrow',16)}</a>
      <button class="text-link" type="button" data-open="report">${icon('flag',17)}${t('Zgłoś','Report')}</button>`:tag(ctx,offer.status)}</div>`,'seller-panel');
  const backLabel=isPublic?t('Wróć do wyników','Back to results'):t('Wróć do panelu','Back to dashboard');
  return {title:name+(offer.variant?' '+offer.variant:''),index:isPublic&&offer.status==='published',listingPage:true,
    description:desc?.slice(0,155)||name,canonical:isPublic?nextOffer:undefined,image:offer.photos[0]?.url||offer.cover||undefined,
    body:`${listingTrail(ctx,offer,name,back,allowedBack,isPublic)}<section class="listing-showcase" ${ctx.demo?'data-demo-showcase':''} aria-labelledby="listing-title">
      ${media}
      <div class="wrap showcase-top"><a class="btn showcase-back" href="${e(back)}" aria-label="${backLabel}">${icon('back',19)}<span>${backLabel}</span></a>${photoActions}</div>
      <div class="wrap showcase-content"${slidePanel?' data-showcase-panel':''}>
      ${slidePanel?`<button class="btn showcase-toggle" type="button" data-showcase-toggle aria-expanded="true" aria-controls="listing-summary" aria-label="${t('Schowaj dane','Hide details')}" hidden>
        ${icon('chevron',19)}<span>${t('Schowaj dane','Hide details')}</span></button>`:''}
      <div class="showcase-summary" id="listing-summary"><div class="showcase-copy">
        <div class="showcase-heading">
        <div class="showcase-labels">
        ${offer.make?`<span class="showcase-make">${e(offer.make)}</span>`:''}
        ${!isPublic?`<p class="showcase-note">${mode==='moderation'?t('Widok moderatora','Moderator view'):t('Podgląd oferty przed publikacją','Listing preview before publication')}</p>`:''}
        ${offer.demo_photo?`<p class="showcase-note">${icon('image',15)}${t('Demo · zdjęcia poglądowe','Demo · illustrative images')}</p>`:''}
        </div>
        ${offer.status==='sold'?flash(offer.type==='car'?t('Samochód został sprzedany.','This car has been sold.'):
          t('Pojazd został sprzedany.','This vehicle has been sold.'),'warn'):''}
        <header class="detail-heading"><h1 id="listing-title"${mobileView?' tabindex="-1"':''}>${e(name)}</h1>${offer.variant?`<p>${e(offer.variant)}</p>`:''}
          <div class="showcase-price"><div class="detail-price">${e(price(ctx,offer.price,offer.currency))}</div>${offer.negotiable?`<small>${t('Do negocjacji','Negotiable')}</small>`:''}</div></header>
        ${offer.netPrice?`<p class="net-price">${t('Cena netto (informacja dodatkowa)','Net price (additional information)')} · ${e(price(ctx,offer.netPrice,offer.currency))}</p>`:''}
        </div>
        ${quickFacts}${contactActions}${tools}
      </div></div></div>
      <div class="wrap showcase-bottom">
        <a class="text-link showcase-details-link" href="#dane-pojazdu">${icon('down',18)}${t('Dane pojazdu','Vehicle details')}</a>
        <a class="btn showcase-vin-link" href="#sprawdz-vin">${icon('search',17)}${t('Sprawdź VIN','Check VIN')}${icon('down',15)}</a>
        ${mobileView?`<button type="button" class="mobile-photo-view" data-photo-view-toggle aria-controls="listing-photo-stack" aria-expanded="false" hidden>
          <span data-photo-view-open>${icon('image',20)}${t('Same zdjęcia','Photos only')}</span><span data-photo-view-close hidden>${icon('sliders',20)}${t('Pokaż dane i przyciski','Show details and buttons')}</span></button>`:''}
      </div>
    </section>${extras?wrap(`<div class="showcase-review">${extras}</div>`):''}
      <div class="detail-main" id="dane-pojazdu">
        ${offerSection(t('Opis sprzedawcy','Seller’s description'),'message',description)}
        ${financing?offerSection(t('Kalkulator finansowania / leasingu','Financing / leasing calculator'),'sliders',financing,'finansowanie'):''}
        ${offerSection(t('Pełna specyfikacja','Full specifications'),'sliders',specs(ctx,offer))}
        ${offerSection(t('Wyposażenie','Equipment'),'check',equipment(ctx,offer))}
        ${offerSection(t('Historia i stan pojazdu','History and condition'),'shield',`<p class="muted">${t('Informacje w tej sekcji to deklaracje sprzedawcy.','The information in this section is declared by the seller.')}</p>
          <div class="body-chips"><span class="chip">${e(localized(ctx,'damage',offer.damage))}</span>${declarations.map(([,label])=>`<span class="chip">${icon('check',16)}${e(label)}</span>`).join('')}</div>${offer.history?`<p class="prose">${e(offer.history)}</p>`:''}`)}
        ${offerSection(t('Dane ogłoszenia','Listing details'),'calendar',`<dl class="offer-meta"><div><dt>${t('Data publikacji','Published')}</dt><dd>${e(day(ctx,offer.published_at))}</dd></div><div><dt>ID</dt><dd>${e(offer.id)}</dd></div></dl>`)}
        ${vinCheck(ctx,offer)}
      </div>${wrap(`${seller}
      ${similar.length?`<section class="market-section">${sectionHead(t('Podobne pojazdy','Similar vehicles'))}${await cards(ctx,similar)}</section>`:''}
      ${contactable?contactDialog(ctx,offer,false,messageReturn)+contactDialog(ctx,offer,true,viewingReturn)+(financing?financeDialog(ctx,offer,messageReturn):''):''}${isPublic?reportDialog(ctx,'listing',offer.id):''}`)}`};
}

function sellerThumbnail(ctx,company,logo,avatar) {
  const kind=company&&logo?'company':'avatar';
  const key=kind==='company'?logo:avatar;
  return `<span class="mini-icon seller-thumbnail${kind==='company'?' company-avatar':''}">${key?'<img src="'+href(ctx,'/asset/'+kind+'/'+e(key))+'" alt="" loading="lazy">':icon(company?'building':'user',23)}</span>`;
}

function sellerCover(ctx,key) {
  return key?`<img class="seller-panorama" src="${href(ctx,'/asset/panorama/'+e(key))}" alt="" loading="lazy">`:'';
}

export async function sellerPage(ctx,key,companyOnly=false) {
  const t=ctx.t;
  const profile=isId(key)?await row(ctx.db,`SELECT u.id,u.name,u.city,u.bio,u.profile_type,c.name AS company,c.description,c.address,c.hours,c.logo_key,u.avatar_key,u.panorama_key,u.show_profile_images
    FROM users u LEFT JOIN companies c ON c.user_id=u.id WHERE u.id=? AND u.scope=? AND u.deleted_at IS NULL AND u.verified_at IS NOT NULL`,key,ctx.scope):null;
  if (!profile || (companyOnly && profile.profile_type!=='company')) return null;
  const company=profile.profile_type==='company';
  const name=(company&&profile.company)||profile.name;
  const listings=await search(ctx,new URLSearchParams(),{seller:profile.id,limit:60});
  const [reels,sampleReels]=await Promise.all([company?publicReels(ctx,profile.id):'',demoSellerReels(ctx,profile.id)]);
  return {title:name,index:listings.total>0||Boolean(reels),body:wrap(pageHead(name,company?t('Wizytówka firmy','Business profile'):t('Profil sprzedawcy','Seller profile'))+
    panel('',`${sellerCover(ctx,company&&profile.show_profile_images&&profile.panorama_key)}
      <div class="seller">${sellerThumbnail(ctx,company,profile.show_profile_images&&profile.logo_key,profile.show_profile_images&&profile.avatar_key)}<div><strong>${e(name)}</strong><small>${e(profile.city)}</small></div></div>
      <p class="prose">${e(company?profile.description:profile.bio)}</p>${company?`<p>${e(profile.address)}${profile.hours?' · '+e(profile.hours):''}</p>`:''}`)+
    `<section class="market-section">${sectionHead(t('Opublikowane samochody','Published vehicles')+' · '+listings.total)}
      ${listings.total?await cards(ctx,listings.offers):empty(ctx,t('Brak aktywnych ogłoszeń','No active listings'))}</section>`+reels+sampleReels)};
}

export async function favoritesPage(ctx) {
  const t=ctx.t;
  const keys=await favorites(ctx);
  const offers=await listingsByKeys(ctx,keys);
  return {title:t('Ulubione','Favorites'),body:wrap(pageHead(t('Ulubione pojazdy','Favorite vehicles'),ctx.user?t('Zapisane na Twoim koncie.','Saved to your account.'):t('Zapisane w tej przeglądarce. Po zalogowaniu połączą się z Twoim kontem.','Saved in this browser. They will merge with your account after sign-in.'),
    link(ctx,'/porownanie',t('Porównywarka','Compare'),'btn','scale'))+
    `<div data-saved-page>${offers.length?await cards(ctx,offers):empty(ctx,t('Brak zapisanych pojazdów','No saved vehicles'),t('Wybierz gwiazdkę przy ogłoszeniu, aby dodać je do ulubionych.','Select the star on a listing to save it.'),link(ctx,'/szukaj',t('Przeglądaj pojazdy','Browse vehicles'),'btn primary','search'),'star')}</div>`)};
}
export function comparePage(ctx) {
  const t=ctx.t;
  return {title:t('Porównywarka','Compare'),body:wrap(pageHead(t('Porównaj pojazdy','Compare vehicles'),t('Dodaj do czterech ogłoszeń, aby zestawić ich parametry.','Add up to four listings to compare their specifications.'),link(ctx,'/szukaj',t('Znajdź pojazdy','Find vehicles'),'btn','search'))+
    `<div data-compare-page>${empty(ctx,t('Brak pojazdów do porównania','No vehicles to compare'),t('Wybierz ikonę porównania na karcie pojazdu.','Choose the comparison icon on a vehicle card.'))}</div>`, 'compare-page')};
}
export async function renderSaved(ctx,keys) {
  const offers=await listingsByKeys(ctx,keys);
  return offers.length?cards(ctx,offers):'';
}
export async function renderCompare(ctx,keys) {
  const t=ctx.t;
  const offers=await listingsByKeys(ctx,keys);
  if (!offers.length) return '';
  const missingValue='—';
  const declared=value=>value?t('Tak','Yes'):missingValue;
  const power=o=>o.power?measure(ctx,o.power,o.powerUnit==='KM'?t('KM','hp'):o.powerUnit):missingValue;
  const hasMotor=offers.some(o=>vehicleFeatures(o.type,o.body).motorized);
  const hasTrailer=offers.some(o=>o.type==='trailer');
  const hasBattery=offers.some(o=>['electric','plugin'].includes(o.fuel));
  const groups=[
    [t('Cena i sprzedaż','Price and sale'),[
      [t('Cena końcowa','Final price'),o=>price(ctx,o.price,o.currency)],
      [t('Cena netto','Net price'),o=>price(ctx,o.netPrice,o.currency)],
      [t('Cena do negocjacji','Price negotiable'),o=>declared(o.negotiable)],
      [t('Dokument sprzedaży','Sales document'),o=>localized(ctx,'document',o.document)],
      [t('Typ sprzedawcy','Seller type'),o=>localized(ctx,'seller',o.profile_type)],
      [t('Miejscowość','City'),o=>o.city],[t('Region','Region'),o=>o.region],[t('Kraj','Country'),o=>o.country]
    ]],
    [t('Dane pojazdu','Vehicle details'),[
      [t('Rodzaj pojazdu','Vehicle type'),o=>optionName(ctx,'type',o.type)],
      [t('Marka','Make'),o=>o.make],[t('Model','Model'),o=>o.model],[t('Wersja','Trim'),o=>o.variant],
      [t('Rok produkcji','Year'),o=>o.year],
      [t('Nadwozie lub odmiana','Body style or variant'),o=>optionName(ctx,'body',o.body,o.type)],
      [t('Kolor','Color'),o=>o.color],
      ...(offers.some(o=>vehicleFeatures(o.type,o.body).doors)?[[t('Liczba drzwi','Doors'),o=>o.doors]]:[]),
      ...(hasMotor?[[t('Liczba miejsc','Seats'),o=>o.seats]]:[]),
      ...(hasTrailer?[[t('DMC','Gross vehicle weight'),o=>measure(ctx,o.grossWeight,'kg')],[t('Liczba osi','Number of axles'),o=>o.axles]]:[])
    ]],
    ...(hasMotor?[[t('Silnik i napęd','Engine and drivetrain'),[
      [t('Paliwo','Fuel'),o=>localized(ctx,'fuel',o.fuel)],
      [t('Moc','Power'),power],
      ...(offers.some(o=>vehicleFeatures(o.type,o.body).motorized&&o.fuel!=='electric')?[[t('Pojemność silnika','Engine capacity'),o=>measure(ctx,o.engine,'cm³')]]:[]),
      [t('Skrzynia biegów','Transmission'),o=>localized(ctx,'gearbox',o.gearbox)],
      [t('Napęd','Drivetrain'),o=>localized(ctx,'drive',o.drive)],
      ...(hasBattery?[
        [t('Pojemność akumulatora','Battery capacity'),o=>measure(ctx,o.battery,'kWh')],
        [t('Deklarowany zasięg','Claimed range'),o=>km(ctx,o.range)]
      ]:[])
    ]]]:[]),
    [t('Stan i historia','Condition and history'),[
      [t('Stan','Condition'),o=>localized(ctx,'condition',o.condition)],
      [t('Uszkodzenia','Damage'),o=>localized(ctx,'damage',o.damage)],
      ...(hasMotor?[[t('Przebieg','Mileage'),o=>km(ctx,o.mileage)]]:[]),
      ...(offers.some(o=>vehicleFeatures(o.type,o.body).hours||hasMeasurement(o.hours))?[[t('Motogodziny','Operating hours'),o=>operatingHours(ctx,o)]]:[]),
      [t('Pierwsza rejestracja','First registration'),o=>o.registered],
      [t('Kraj pochodzenia','Country of origin'),o=>o.countryOrigin],
      ['VIN / '+t('Identyfikator','Identifier'),o=>o.vin],
      [t('Pierwszy właściciel','First owner'),o=>declared(o.firstOwner)],
      [t('Bezwypadkowy','Accident-free'),o=>declared(o.accidentFree)],
      [t('Historia serwisowa','Service history'),o=>declared(o.service)],
      [t('Informacje o historii','Vehicle history notes'),o=>o.history]
    ]],
    ...Object.values(features).map(([pl,en,items])=>[
      t('Wyposażenie','Equipment')+' · '+t(pl,en),
      Object.entries(items).map(([key,pair])=>[lang(ctx,pair),o=>declared(o.equipment?.includes(key))])
    ])
  ];
  const scrollHint=offers.length>2
    ?`<p class="compare-scroll-hint">${t('Przesuń tabelę w bok, aby zobaczyć kolejne pojazdy.','Swipe the table sideways to see more vehicles.')}</p>`:'';
  return `<p class="compare-legend muted">${t('Kreska (—) oznacza brak deklaracji, brak danych lub parametr, który nie dotyczy pojazdu.','A dash (—) means the seller did not declare the item, data is missing, or the specification does not apply.')}</p>
    ${scrollHint}<div class="table-scroll compare-scroll" role="region" aria-label="${t('Porównanie parametrów pojazdów','Vehicle specification comparison')}" tabindex="0">
    <table class="compare-table" data-vehicle-count="${offers.length}"><thead>
    <tr class="compare-head"><th scope="col" rowspan="2">${t('Parametr','Specification')}</th>${offers.map(o=>`<th scope="col">
    <a class="compare-vehicle" href="${e(listingUrl(ctx,o))}"><span class="compare-photo">${thumb(ctx,o)}</span><strong>${e(titleOf(o))}</strong></a></th>`).join('')}</tr>
    <tr class="compare-actions">${offers.map(o=>`<td><button class="text-link" type="button" data-remove-compare="${e(o.id)}" aria-label="${e(t('Usuń z porównania','Remove from comparison')+' · '+titleOf(o))}">${icon('close',15)}${t('Usuń','Remove')}</button></td>`).join('')}</tr></thead>
    ${groups.map(([group,fields])=>`<tbody><tr class="compare-section"><th colspan="${offers.length+1}" scope="rowgroup">${e(group)}</th></tr>
      ${fields.map(([label,get])=>`<tr><th scope="row">${e(label)}</th>${offers.map(o=>{
        const value=get(o);
        return `<td>${e(value==null||value===''?missingValue:value)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>`).join('')}</table></div>`;
}
