import { after, changes, conflict, digest, fail, forbidden, id, integer, isId, isStaff, limitedBody, missing, now, numeric, parse, placeholders, requireStaff, requireUser, row, rows, run, slugify, stmt, text, truth } from './core.js';
import { catalogFor, demoGalleries, featureKeys, options } from './data.js';
import { cleanImage, maxUpload, objectImage, thumbLimit } from './images.js';
import { semiTrailerBodies, vehicleProfile } from './vehicle-types.js';
import { videoLimit, videoMime, videoObject } from './videos.js';
import { moderationStatement, saveSubmission, statusNotice } from './listing-review.js';
import { robotDefaultData, validateRobotListing } from './robot-catalog.js';
import { assertRobotStock, robotStockGuardSQL } from './robot-orders.js';
import { cameraCapture, cameraState, cameraTarget, checkCameraSlot, currentSlot, exteriorAngles, keepCameraState, orderedFrames, setSkipped, setSpinCount } from './camera-session.js';

export const spinLimits = {min:8,max:36};
export const photoDetailLabels = {
  wheels:['Felgi','Wheels'],interior:['Wnętrze','Interior'],headlights:['Reflektory','Headlights'],
  dashboard:['Deska rozdzielcza','Dashboard'],engine:['Komora silnika','Engine bay'],
  front:['Przód pojazdu','Front view'],rear:['Tył pojazdu','Rear view'],side:['Bok pojazdu','Side view']
};

const listColumns = ['make','model','variant','type','body','fuel','gearbox','drive','condition','damage','year','mileage','power','price','currency','city','region'];
const required = ['make','model','type','condition','damage','year','price','city','region'];
const roadRequired = ['body','gearbox','drive','mileage','power'];
export const listingFieldLabels={
  make:['marka','make'],model:['model','model'],type:['rodzaj pojazdu','vehicle type'],body:['nadwozie lub odmiana','body style or variant'],
  fuel:['paliwo','fuel'],gearbox:['skrzynia biegów','transmission'],drive:['napęd','drivetrain'],condition:['stan','condition'],damage:['uszkodzenia','damage'],
  year:['rok','year'],mileage:['przebieg','mileage'],power:['moc','power'],price:['cena końcowa','final price'],city:['miejscowość','city'],region:['region','region'],
  description:['opis','description'],vin:['identyfikator pojazdu','vehicle identifier'],registered:['pierwsza rejestracja','first registration'],netPrice:['cena netto','net price'],
  contact:['kontakt','contact'],listingPhone:['numer telefonu','phone number'],hours:['motogodziny','operating hours'],grossWeight:['DMC','gross vehicle weight'],axles:['liczba osi','number of axles'],
  robotCategory:['kategoria robota','robot category'],tradeMode:['sprzedaż lub wynajem','sale or rental'],rentalPrice:['cena wynajmu','rental price'],
  rentalUnit:['jednostka wynajmu','rental unit'],deposit:['kaucja','deposit'],stock:['liczba sztuk','stock'],leadTime:['czas realizacji','lead time'],
  minimumRental:['minimalny okres wynajmu','minimum rental period'],currency:['waluta','currency'],country:['kraj','country']
};
const units = ['KM','kW'];
const countryDefault = 'Polska';
export const ownerSelection = `l.*,u.name AS seller_name,u.profile_type,c.name AS company_name,
  CASE WHEN u.show_profile_images=1 AND u.profile_type='company' THEN c.logo_key END AS logo_key,
  CASE WHEN u.show_profile_images=1 THEN u.avatar_key END AS avatar_key,
  CASE WHEN u.show_profile_images=1 AND u.profile_type='company' THEN u.panorama_key END AS panorama_key,
  CASE WHEN u.show_phone=1 AND u.phone<>'' THEN 1 ELSE 0 END AS phone_available`;
const ownerJoin = ' FROM listings l JOIN users u ON u.id=l.user_id LEFT JOIN companies c ON c.user_id=u.id ';
const normalizeChoice = (value, group) => Object.hasOwn(group,value) ? value : '';
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const rawVin = value => text(value,35).toUpperCase().replace(/\s+/g,' ');
const validListingPhone = value => /^\+?\d{7,15}$/.test(value?.replace(/[ ()-]/g,'') || '');
const defaultData = {type:'car',condition:'used',damage:'unknown',country:countryDefault,powerUnit:'KM',currency:'PLN',contact:'message',equipment:[]};
export function fromListing(record) {
  if (!record) return {...defaultData};
  const data = {...(record.type==='robot'?robotDefaultData:{}),...parse(record.data)};
  for (const key of listColumns) data[key] = record[key] ?? '';
  data.price = record.price == null ? (record.type==='robot'?null:'') : record.price/100;
  return data;
}

export async function validateListing(ctx, raw, strict = false) {
  if(raw.type==='robot') return validateRobotListing(ctx,raw,strict);
  const yearMax = new Date().getFullYear()+1;
  const catalog=ctx.catalog??=await catalogFor(ctx);
  const types = {...options.type,...catalog.types};
  const type = normalizeChoice(raw.type,types);
  const profile = vehicleProfile(type,raw.body);
  const fuel = profile.motorized?normalizeChoice(raw.fuel,options.fuel):'';
  const data = {
    make:text(raw.make,50),model:text(raw.model,60),variant:text(raw.variant,95),
    type,body:normalizeChoice(raw.body,profile.bodies),fuel,
    gearbox:profile.motorized?normalizeChoice(raw.gearbox,options.gearbox):'',
    drive:profile.motorized?normalizeChoice(raw.drive,options.drive):'',
    condition:normalizeChoice(raw.condition,options.condition),damage:normalizeChoice(raw.damage,options.damage),
    year:integer(raw.year,1886,yearMax),mileage:profile.motorized?integer(raw.mileage,0,20000000):null,
    hours:profile.hours?numeric(raw.hours,0,1000000):null,
    power:profile.motorized?integer(raw.power,1,5000):null,powerUnit:units.includes(raw.powerUnit)?raw.powerUnit:'KM',
    price:numeric(raw.price,1,100000000),currency:Intl.supportedValuesOf('currency').includes(String(raw.currency||'').toUpperCase())?String(raw.currency).toUpperCase():'PLN',netPrice:numeric(raw.netPrice,1,100000000),
    city:text(raw.city,90),region:text(raw.region,90),country:text(raw.country,80)||countryDefault,
    engine:profile.motorized&&fuel!=='electric'?integer(raw.engine,1,30000):null,
    doors:profile.doors?integer(raw.doors,1,12):null,seats:profile.motorized?integer(raw.seats,1,100):null,
    grossWeight:type==='trailer'?integer(raw.grossWeight,1,150000):null,axles:type==='trailer'?integer(raw.axles,1,24):null,
    color:text(raw.color,70),countryOrigin:text(raw.countryOrigin,80),
    registered:validDate(raw.registered)?raw.registered:'',vin:rawVin(raw.vin),
    service:truth(raw.service),firstOwner:truth(raw.firstOwner),accidentFree:truth(raw.accidentFree),negotiable:truth(raw.negotiable),
    equipment:Array.isArray(raw.equipment)?featureKeys.filter(key=>raw.equipment.includes(key)):[],
    description:text(raw.description,7000),description_en:text(raw.description_en,7000),
    history:text(raw.history,1500),document:normalizeChoice(raw.document,options.document),
    contact:normalizeChoice(raw.contact,options.contact)||'message',
    listingPhone:text(raw.listingPhone,30),
    battery:fuel==='electric'||fuel==='plugin'?numeric(raw.battery,1,300):null,
    range:fuel==='electric'||fuel==='plugin'?integer(raw.range,1,2000):null
  };
  if (strict) {
    const mandatory=[...required,...(profile.road?roadRequired:[]),...(profile.fuelRequired?['fuel']:[])];
    const fields=mandatory.filter(key=>data[key]===null||data[key]==='');
    if (raw.body && !data.body && !fields.includes('body')) fields.push('body');
    for (const key of profile.hours?['hours']:type==='trailer'?['grossWeight','axles']:[]) {
      if (raw[key]!=='' && raw[key]!=null && data[key]===null) fields.push(key);
    }
    if (data.description.length<12) fields.push('description');
    if (data.vin && !/^[A-Z0-9 .\/-]{3,35}$/.test(data.vin)) fields.push('vin');
    if (raw.registered && !data.registered) fields.push('registered');
    if (data.netPrice && data.price && data.netPrice>data.price) fields.push('netPrice');
    if (data.listingPhone ? !validListingPhone(data.listingPhone) : data.contact==='phone' && !(ctx.user?.phone && ctx.user.show_phone)) fields.push('listingPhone');
    if (fields.length) fail(422,'Uzupełnij wymagane pola lub popraw ich wartości.',
      'Complete the required fields or correct their values.',{fields});
  }
  return data;
}

function setPhotoDetails(data, value, photos) {
  const details = Object.fromEntries(photos.flatMap(key=>{
    const detail=value?.[key];
    return typeof detail==='string'&&Object.hasOwn(photoDetailLabels,detail)?[[key,detail]]:[];
  }));
  if (Object.keys(details).length) data.photoDetails=details;
  else delete data.photoDetails;
  return data;
}

export function hydrate(ctx, record, edits = null, includePhone = false) {
  const data = edits ? parse(edits.data) : fromListing(record);
  const {listingPhone,importSeller,smartCamera,cameraReceipts,...details}=data;
  const source=edits||record;
  const photos=parse(source.photo_ids,[]);
  const spin=parse(source.spin_ids,[]);
  const camera=cameraState(smartCamera,photos,spin);
  const shotById=new Map(Object.entries(camera.shots).map(([shot,id])=>[id,shot]));
  const angleById=new Map(Object.entries(camera.frames).map(([angle,id])=>[id,Number(angle)]));
  const image=key=>({key,url:ctx.prefix+'/media/'+key,thumb:ctx.prefix+'/media/'+key+'/thumb'});
  return {
    ...details,...(includePhone&&validListingPhone(listingPhone)?{listingPhone}:{}),id:record.id,slug:record.slug || record.id,user_id:record.user_id,status:record.status,
    photos:photos.map(key=>{
      const detail=data.photoDetails?.[key];
      const shot=shotById.get(key);
      return {...image(key),...(Object.hasOwn(photoDetailLabels,detail)?{detail}:{}),...(shot?{shot}:{}),
        ...(Object.hasOwn(exteriorAngles,shot)?{angle:exteriorAngles[shot]}:{})};
    }),spin:spin.map(key=>({...image(key),...(angleById.has(key)?{angle:angleById.get(key)}:{})})),video:source.video_id?ctx.prefix+'/wideo/'+source.video_id:null,
    cover:photos.length?image(photos[0]).thumb:demoGalleries.get(record.demo_photo)?.[0].thumb||record.demo_photo,
    demo_photo:record.demo_photo, is_demo:record.scope.startsWith('demo:'), seller_name:record.company_name && record.profile_type==='company'?record.company_name:record.seller_name,
    profile_type:record.profile_type, company_logo:record.logo_key, seller_avatar:record.avatar_key, seller_panorama:record.panorama_key, phone_available:Boolean(record.phone_available && data.contact==='phone'),
    published_at:record.published_at,created_at:record.created_at,updated_at:record.updated_at,revision:record.revision,rejection:record.rejection,
    featured:Boolean(record.status==='published' && record.featured_until && record.featured_until>now()), featured_until:record.featured_until,
    fresh:Boolean(record.status==='published' && record.published_at && record.published_at>after(-3*86400000))
  };
}

export async function byId(ctx,key) {
  if (!isId(key)) return null;
  return row(ctx.db,'SELECT '+ownerSelection+ownerJoin+' WHERE l.scope=? AND (l.id=? OR l.slug=?) AND u.deleted_at IS NULL',ctx.scope,key,key);
}
const publicStatus = record => record && ['published','sold'].includes(record.status);
export async function publicOffer(ctx,key,{includePhone=false}={}) {
  const record=await byId(ctx,key);
  if (!publicStatus(record)) missing();
  return hydrate(ctx,record,null,includePhone&&record.status==='published');
}
export async function owned(ctx,key) {
  const user=requireUser(ctx);
  const record=await byId(ctx,key);
  if (!record) missing();
  if (record.user_id!==user.id) forbidden();
  return record;
}

export const filterFields = {
  type:['Rodzaj pojazdu','Vehicle type'],make:['Marka','Brand'],model:['Model','Model'],q:['Wersja lub słowo kluczowe','Trim or keyword'],
  minPrice:['Cena od','Price from'],maxPrice:['Cena do','Price to'],minYear:['Rok od','Year from'],maxYear:['Rok do','Year to'],
  minMileage:['Przebieg od','Mileage from'],maxMileage:['Przebieg do','Mileage to'],
  minHours:['Motogodziny od','Operating hours from'],maxHours:['Motogodziny do','Operating hours to'],
  minGrossWeight:['DMC od (kg)','Gross weight from (kg)'],maxGrossWeight:['DMC do (kg)','Gross weight to (kg)'],fuel:['Paliwo','Fuel'],
  gearbox:['Skrzynia biegów','Transmission'],body:['Nadwozie lub odmiana','Body style or variant'],drive:['Napęd','Drivetrain'],
  minPower:['Moc od (KM)','Power from (hp)'],maxPower:['Moc do (KM)','Power to (hp)'],condition:['Stan','Condition'],
  damage:['Uszkodzenia','Damage'],city:['Miejscowość','City'],region:['Województwo','Region'],seller:['Sprzedawca','Seller']
};
const exactFields=['type','make','model','fuel','gearbox','body','drive','condition','damage','region'];
const betweenFields={
  minPrice:['l.price','>=',100],maxPrice:['l.price','<=',100],minYear:['l.year','>=',1],maxYear:['l.year','<=',1],
  minHours:["json_extract(l.data,'$.hours')",'>=',1],maxHours:["json_extract(l.data,'$.hours')",'<=',1],
  minGrossWeight:["json_extract(l.data,'$.grossWeight')",'>=',1],maxGrossWeight:["json_extract(l.data,'$.grossWeight')",'<=',1],
  minMileage:['l.mileage','>=',1],maxMileage:['l.mileage','<=',1],minPower:["CASE WHEN json_extract(l.data,'$.powerUnit')='kW' THEN l.power*1.35962 ELSE l.power END",'>=',1],
  maxPower:["CASE WHEN json_extract(l.data,'$.powerUnit')='kW' THEN l.power*1.35962 ELSE l.power END",'<=',1]
};
const plLower = field => "lower(" + [...'ĄĆĘŁŃÓŚŹŻŠŽ'].reduce((sql,letter)=>"replace("+sql+",'"+letter+"','"+letter.toLowerCase()+"')",field)+")";
const order={
  latest:'l.published_at DESC',price_asc:'l.price ASC',price_desc:'l.price DESC',mileage:'l.mileage IS NULL,l.mileage ASC',mileage_desc:'l.mileage IS NULL,l.mileage DESC',year:'l.year DESC',year_asc:'l.year ASC'
};
export const pageSize = 9;
export async function search(ctx, params, settings = {}) {
  const robotics=Boolean(ctx.robotics||settings.robotics||params.get('market')==='robotics');
  const values=Object.fromEntries(Object.keys(filterFields).map(key=>[key,text(params.get(key),100)]).filter(([,value])=>value!==''));
  const category=text(params.get('category'),100);
  if (category && !robotics) {
    const [type,body]=category.split(':');
    if (type&&body&&category===type+':'+body) {
      values.type=type;
      if (body!=='semi_trailer'||!semiTrailerBodies.includes(values.body)) values.body=body;
    } else {
      values.type=category;
    }
  }
  const conditions=["l.scope=?","l.status='published'","u.deleted_at IS NULL"];
  const args=[ctx.scope];
  conditions.push(robotics?"l.type='robot'":"l.type<>'robot'");
  if(robotics) {
    delete values.type;
    const robotCategory=text(params.get('robotCategory'),100)||category;
    const tradeMode=text(params.get('tradeMode')||params.get('mode'),20);
    const currency=text(params.get('currency'),6).toUpperCase();
    if(robotCategory) {
      values.robotCategory=robotCategory;
      conditions.push("json_extract(l.data,'$.robotCategory')=?");args.push(robotCategory);
    }
    if(tradeMode) {
      values.tradeMode=tradeMode;
      conditions.push(tradeMode==='sale'||tradeMode==='rent'?"json_extract(l.data,'$.tradeMode') IN (?,'both')":"json_extract(l.data,'$.tradeMode')=?");
      args.push(tradeMode);
    }
    if(currency) { values.currency=currency;conditions.push('l.currency=?');args.push(currency); }
    for(const [key,operator] of [['minRentalPrice','>='],['maxRentalPrice','<=']]) {
      const value=numeric(params.get(key),0,100000000);
      if(value!==null) { values[key]=String(value);conditions.push(`json_extract(l.data,'$.rentalPrice')${operator}?`);args.push(value); }
    }
  }
  if((values.minPrice||values.maxPrice)&&!values.currency) {
    const currency=String(params.get('currency')||'PLN').toUpperCase();
    conditions.push('l.currency=?');args.push(currency);
    if(robotics) values.currency=currency;
  }
  for (const key of exactFields) {
    if (!values[key]) continue;
    if (key==='body'&&values.body==='semi_trailer') {
      conditions.push(`l.body IN (${placeholders(semiTrailerBodies)})`);
      args.push(...semiTrailerBodies);
    } else {
      conditions.push(`l.${key}=? COLLATE NOCASE`);args.push(values[key]);
    }
  }
  for (const [key,[field,operator,factor]] of Object.entries(betweenFields)) {
    const value=numeric(values[key],0,100000000);
    const filteredField=robotics&&values.tradeMode==='rent'&&field==='l.price'?"json_extract(l.data,'$.rentalPrice')*100":field;
    if (value!=null) { conditions.push(`${filteredField}${operator}?`); args.push(value*factor); }
    else delete values[key];
  }
  if (values.city) { conditions.push('instr('+plLower('l.city')+',?)>0'); args.push(values.city.toLocaleLowerCase('pl')); }
  if (values.q) {
    const searchable = "l.make||' '||l.model||' '||l.variant||' '||coalesce(json_extract(l.data,'$.description'),'')||' '||coalesce(json_extract(l.data,'$.description_en'),'')"+
      (robotics?"||' '||coalesce(json_extract(l.data,'$.specs'),'')":'');
    conditions.push('instr('+plLower(searchable)+',?)>0');
    args.push(values.q.toLocaleLowerCase('pl'));
  }
  if (values.seller) { conditions.push('u.profile_type=?'); args.push(values.seller); }
  if (settings.sampleOnly) conditions.push("l.demo_photo IS NOT NULL AND l.demo_photo<>''");
  if (settings.seller) { conditions.push('l.user_id=?'); args.push(settings.seller); }
  if (settings.featured) { conditions.push('l.featured_until>?'); args.push(now()); }
  if (settings.exclude) { conditions.push('l.id<>?'); args.push(settings.exclude); }
  const where=' WHERE '+conditions.join(' AND ');
  const sorting=Object.hasOwn(order,params.get('sort'))?params.get('sort'):'latest';
  const limit=settings.limit ?? pageSize;
  const {n:total}=await row(ctx.db,'SELECT count(*) AS n'+ownerJoin+where,...args);
  const pages=Math.max(1,Math.ceil(total/limit));
  const page=Math.min(pages,integer(params.get('page'),1,1e6) || 1);
  const firstPage=Math.max(1,page-(settings.previousPages??0));
  const orderBy=robotics&&values.tradeMode==='rent'?order[sorting].replaceAll('l.price',"json_extract(l.data,'$.rentalPrice')"):order[sorting];
  const hits=await rows(ctx.db,'SELECT '+ownerSelection+ownerJoin+where+' ORDER BY '+orderBy+',l.id LIMIT ? OFFSET ?',...args,(page-firstPage+1)*limit,(firstPage-1)*limit);
  return {offers:hits.map(x=>hydrate(ctx,x,null,settings.includePhone)),total,page,pages,sort:sorting,values,market:robotics?'robotics':'vehicles'};
}

export async function listingsByKeys(ctx, keys) {
  if (!keys.length) return [];
  const result=await rows(ctx.db,'SELECT '+ownerSelection+ownerJoin+` WHERE l.scope=? AND l.status IN ('published','sold') AND u.deleted_at IS NULL AND l.id IN (${placeholders(keys)})`,ctx.scope,...keys);
  const offers=new Map(result.map(item=>[item.id,hydrate(ctx,item)]));
  return keys.map(key=>offers.get(key)).filter(Boolean);
}

export async function createDraft(ctx, body) {
  const user=requireUser(ctx);
  const key=text(body.key,90);
  if (!isId(key)) fail(422,'Brak identyfikatora szkicu. Odśwież formularz.','Draft key is missing. Reload the form.');
  const draftId=id();
  const at=now();
  const robotics=Boolean(ctx.robotics||body.market==='robotics'||body.type==='robot');
  const defaults=robotics?robotDefaultData:defaultData;
  await ctx.db.batch([
    stmt(ctx.db,`INSERT INTO listings(id,scope,user_id,client_key,type,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,client_key) DO NOTHING`,draftId,ctx.scope,user.id,key,robotics?'robot':'',robotics?JSON.stringify(defaults):'{}',at,at),
    stmt(ctx.db,`INSERT OR IGNORE INTO listing_edits(listing_id,data,photo_ids,step,updated_at)
      SELECT id,?,'[]',1,? FROM listings WHERE id=?`,JSON.stringify(defaults),at,draftId)
  ]);
  const result=await row(ctx.db,'SELECT id,type FROM listings WHERE user_id=? AND client_key=? AND scope=?',user.id,key,ctx.scope);
  if(!result || (result.type==='robot')!==robotics) fail(409,'Ten szkic należy do innego działu. Utwórz nowe ogłoszenie.',
    'This draft belongs to a different marketplace. Create a new listing.');
  return result.id;
}

export async function editState(ctx,record) {
  const raw=await row(ctx.db,'SELECT * FROM listing_edits WHERE listing_id=?',record.id);
  const media=raw||record;
  const data=raw?parse(raw.data):fromListing(record);
  const photos=parse(media.photo_ids,[]);
  const spin=parse(media.spin_ids,[]);
  return {
    raw,data:setPhotoDetails(data,data.photoDetails,photos),photos,spin,smartCamera:cameraState(data.smartCamera,photos,spin),video:media.video_id??null,
    version:raw?.version ?? record.revision*1000000, step:raw?.step ?? 1
  };
}

async function storeEdit(ctx,record,state,patch,version) {
  if (record.status==='pending') fail(409,'Poczekaj na decyzję moderacji albo wstrzymaj ogłoszenie.','Wait for moderation or pause this listing.');
  if (state.version!==version) conflict();
  const {data,photos,spin,video,step}={...state,...patch};
  const at=now();
  const result=await run(ctx.db,`INSERT INTO listing_edits(listing_id,data,photo_ids,spin_ids,video_id,step,version,updated_at)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM listings WHERE id=? AND revision=? AND status<>'pending')
    ON CONFLICT(listing_id) DO UPDATE SET data=excluded.data,photo_ids=excluded.photo_ids,spin_ids=excluded.spin_ids,video_id=excluded.video_id,
      step=excluded.step,version=excluded.version,updated_at=excluded.updated_at WHERE listing_edits.version=?`,
    record.id,JSON.stringify(data),JSON.stringify(photos),JSON.stringify(spin),video,step,version+1,at,record.id,record.revision,version);
  if (!changes(result)) conflict();
  return {version:version+1,data,photos,spin,video,step,smartCamera:cameraState(data.smartCamera,photos,spin)};
}

function imageSelection(value,current,max) {
  if (value===undefined) return current;
  if (!Array.isArray(value)||value.length>max||new Set(value).size!==value.length||!value.every(key=>current.includes(key)))
    fail(422,'Sprawdź listę zdjęć i klatek 360°.','Check the list of photos and 360° frames.');
  return value;
}

async function forgetVideo(ctx,listing,video) {
  if (!video) return;
  try {
    const result=await run(ctx.db,`DELETE FROM listing_videos WHERE id=? AND listing_id=?
      AND NOT EXISTS(SELECT 1 FROM listings WHERE id=? AND video_id=?)
      AND NOT EXISTS(SELECT 1 FROM listing_edits WHERE listing_id=? AND video_id=?)`,video,listing,listing,video,listing,video);
    if (changes(result)) await ctx.env.BUCKET.delete('videos/'+video);
  } catch (error) {console.error('listing_video_cleanup_failed',error.name);}
}

export async function saveEdit(ctx,key,body) {
  const record=await owned(ctx,key);
  const state=await editState(ctx,record);
  const step=integer(body.step,1,5)||state.step;
  const raw=body.data??state.data;
  const robotics=record.type==='robot'||state.data.type==='robot';
  if((robotics && ((raw.type!==undefined&&raw.type!=='robot')||(raw.market!==undefined&&raw.market!=='robotics')))
    ||(!robotics&&(raw.type==='robot'||raw.market==='robotics'))) {
    fail(422,'Nie można zmienić działu istniejącego ogłoszenia. Utwórz nowe ogłoszenie.',
      'An existing listing cannot change marketplace. Create a new listing.',{fields:['type']});
  }
  const studioOnly=body.data===undefined&&(body.studioCount!==undefined||body.studioSkip!==undefined);
  const data=studioOnly?{...state.data}:await validateListing(ctx,robotics?{...raw,type:'robot'}:raw);
  const photos=imageSelection(body.photos,state.photos,30);
  setPhotoDetails(data,body.data?.photoDetails??state.data.photoDetails,photos);
  let spin=imageSelection(body.spin,state.spin,spinLimits.max);
  const camera=cameraState(state.data.smartCamera,photos,spin);
  if(!spin.length&&state.spin.length) camera.spinCount=null;
  if(body.studioCount!==undefined) setSpinCount(camera,body.studioCount,spin);
  if(body.studioSkip!==undefined) setSkipped(camera,body.studioSkip);
  if(Object.keys(camera.frames).length) spin=orderedFrames(camera);
  keepCameraState(data,camera);
  if(state.data.cameraReceipts) data.cameraReceipts=state.data.cameraReceipts;
  const video=body.video===undefined?state.video:body.video;
  if (video!==null&&video!==state.video) fail(422,'Wybierz wideo w formularzu ogłoszenia.','Upload a video through the listing form.');
  const saved=await storeEdit(ctx,record,state,{data,photos,spin,video,step},integer(body.version,0,Number.MAX_SAFE_INTEGER));
  if (video!==state.video) await forgetVideo(ctx,record.id,state.video);
  return saved;
}

async function imagePayload(ctx) {
  const bytes=await limitedBody(ctx.req,maxUpload+thumbLimit);
  const length=ctx.req.headers.get('X-Image-Length');
  const mainLength=length===null?bytes.length:integer(length,1,bytes.length);
  if(mainLength===null) fail(422,'Niepoprawna długość zdjęcia.','Invalid image length.');
  const main=cleanImage(bytes.subarray(0,mainLength));
  const thumb=mainLength<bytes.length?cleanImage(bytes.subarray(mainLength),900,thumbLimit):main;
  const hash=await digest(main.bytes);
  return {main,thumb,hash};
}

async function writeImage(ctx,listing,{main,thumb,hash}) {
  const photoId=id(),bucket=ctx.env.BUCKET;
  await bucket.put('photos/'+photoId+'/main',main.bytes,{httpMetadata:{contentType:main.mime}});
  try {
    await bucket.put('photos/'+photoId+'/thumb',thumb.bytes,{httpMetadata:{contentType:thumb.mime}});
    const result=await run(ctx.db,`INSERT OR IGNORE INTO photos(id,listing_id,mime,thumb_mime,width,height,digest,created_at)
      VALUES(?,?,?,?,?,?,?,?)`,photoId,listing,main.mime,thumb.mime,main.width,main.height,hash,now());
    if(changes(result)) return photoId;
  } catch(error) {
    await Promise.allSettled([bucket.delete('photos/'+photoId+'/main'),bucket.delete('photos/'+photoId+'/thumb')]);
    throw error;
  }
  await Promise.all([bucket.delete('photos/'+photoId+'/main'),bucket.delete('photos/'+photoId+'/thumb')]);
  const existing=await row(ctx.db,'SELECT id FROM photos WHERE listing_id=? AND digest=?',listing,hash);
  return existing.id;
}

function replayUpload(state,{captureId,signature,target,group,imageId}) {
  const receipts=state.data.cameraReceipts||{};
  const receipt=captureId&&Object.hasOwn(receipts,captureId)&&receipts[captureId];
  if(receipt) {
    if(receipt.slot!==signature||receipt.image!==imageId) conflict();
    return true;
  }
  if(!imageId) return false;
  return target?currentSlot(state.smartCamera,target)===imageId:state[group].includes(imageId);
}

function duplicateUpload(state,{captureId,version}) {
  const receipt=captureId&&state.data.cameraReceipts?.[captureId];
  const ownCommit=receipt?.version===version+1&&state.version===receipt.version;
  return {...state,duplicate:true,needsRefresh:state.version!==version&&!ownCommit};
}

export async function upload(ctx,key,group='photos') {
  const record=await owned(ctx,key);
  if (record.status==='pending') fail(409,'Ogłoszenie jest w moderacji.','The listing is under review.');
  const state=await editState(ctx,record);
  const headers=ctx.req.headers,version=integer(headers.get('X-Edit-Version'),0,Number.MAX_SAFE_INTEGER);
  const target=cameraTarget(headers,group), captureId=headers.get('X-Studio-Capture-Id');
  if(captureId!==null&&!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(captureId)) fail(422,'Niepoprawny identyfikator ujęcia.','Invalid capture ID.');
  if(version===null||(!target&&!captureId&&state.version!==version)) conflict();
  const payload=target?.reuse?null:await imagePayload(ctx);
  const existing=payload?await row(ctx.db,'SELECT id FROM photos WHERE listing_id=? AND digest=?',record.id,payload.hash):null;
  let imageId=target?.reuse??existing?.id;
  const signature=[group,target?.shot,target?.spinCount,target?.angle,target?.replace,target?.reuse].join('/');
  const request={target,group,captureId,signature,imageId,version};
  if(replayUpload(state,request)) return duplicateUpload(state,request);
  if(state.version!==version) conflict();
  if(target) checkCameraSlot(state,target);
  if(!target&&group==='spin'&&state.spin.length&&state.smartCamera.spinCount)
    fail(409,'Kontynuuj tę serię w Studio 360°.','Continue this guided sequence in Studio 360°.');
  if(!target?.replace&&!state[group].includes(imageId)&&state[group].length>=(group==='spin'?spinLimits.max:30)) {
    if(group==='spin') fail(422,'Maksymalnie 36 klatek widoku 360°.','Up to 36 frames for the 360° view.');
    fail(422,'Maksymalnie 30 zdjęć.','A maximum of 30 photos is allowed.');
  }
  imageId??=await writeImage(ctx,record.id,payload);
  const patch=target?cameraCapture(state,group,target,imageId):{[group]:[...state[group],imageId]};
  if(!target&&group==='spin'&&state.smartCamera.spinCount) {
    patch.data={...state.data};
    keepCameraState(patch.data,{...state.smartCamera,spinCount:null});
  }
  if(captureId) {
    const receipts=Object.entries(state.data.cameraReceipts||{}).slice(-127);
    const data={...(patch.data||state.data),cameraReceipts:{...Object.fromEntries(receipts),[captureId]:{slot:signature,image:imageId,version:version+1}}};
    patch.data=data;
  }
  try {
    return await storeEdit(ctx,record,state,patch,version);
  } catch(error) {
    if(error.status!==409||(!target&&!captureId)) throw error;
    const latest=await editState(ctx,await owned(ctx,key));
    if(replayUpload(latest,{...request,imageId})) return duplicateUpload(latest,request);
    throw error;
  }
}

export async function uploadVideo(ctx,key) {
  const record=await owned(ctx,key);
  const state=await editState(ctx,record);
  const version=integer(ctx.req.headers.get('X-Edit-Version'),0,Number.MAX_SAFE_INTEGER);
  if (state.version!==version) conflict();
  if (record.status==='pending') fail(409,'Ogłoszenie jest w moderacji.','The listing is under review.');
  const bytes=await limitedBody(ctx.req,videoLimit);
  const mime=videoMime(bytes);
  const video=id();
  const objectKey='videos/'+video;
  await ctx.env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
  try {
    await run(ctx.db,'INSERT INTO listing_videos(id,listing_id,mime,size,created_at) VALUES(?,?,?,?,?)',video,record.id,mime,bytes.length,now());
  } catch (error) {
    await Promise.allSettled([ctx.env.BUCKET.delete(objectKey)]);
    throw error;
  }
  try {
    const saved=await storeEdit(ctx,record,state,{video},version);
    await forgetVideo(ctx,record.id,state.video);
    return saved;
  } catch (error) {
    await forgetVideo(ctx,record.id,video);
    throw error;
  }
}

export async function photoResponse(ctx,key,thumb) {
  if (!isId(key)) missing();
  const photo=await row(ctx.db,`SELECT p.*,l.status,l.user_id,l.photo_ids,l.spin_ids FROM photos p JOIN listings l ON l.id=p.listing_id WHERE p.id=? AND l.scope=?`,key,ctx.scope);
  if (!photo) missing();
  const current=parse(photo.photo_ids,[]).includes(key)||parse(photo.spin_ids,[]).includes(key);
  const visible=current && publicStatus(photo);
  if (!visible && ctx.user?.id!==photo.user_id && !(isStaff(ctx.user) && current && !['draft','archived'].includes(photo.status))) missing();
  return objectImage(ctx,'photos/'+key+(thumb?'/thumb':'/main'),thumb?photo.thumb_mime:photo.mime,!visible);
}

export async function videoResponse(ctx,key) {
  if (!isId(key)) missing();
  const video=await row(ctx.db,`SELECT v.id,v.mime,v.size,l.user_id,l.status,l.video_id,e.video_id AS edit_video
    FROM listing_videos v JOIN listings l ON l.id=v.listing_id JOIN users u ON u.id=l.user_id
    LEFT JOIN listing_edits e ON e.listing_id=l.id WHERE v.id=? AND l.scope=? AND u.deleted_at IS NULL`,key,ctx.scope);
  if (!video) missing();
  const current=video.video_id===key;
  const visible=current&&publicStatus(video);
  const owner=ctx.user?.id===video.user_id&&(current||video.edit_video===key);
  const moderator=isStaff(ctx.user)&&current&&!['draft','archived'].includes(video.status);
  if (!visible&&!owner&&!moderator) missing();
  return videoObject(ctx,video,visible);
}

function listingValues(data) {
  return listColumns.map(key=>key==='price'?(data.price==null?null:Math.round(data.price*100)):data[key]);
}
function detailValues(data) {
  return JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key])=>!listColumns.includes(key))));
}
async function confirmedSubmission(ctx,listingId,version) {
  const recorded=version!==null&&await row(ctx.db,`SELECT slug,status FROM listings
    WHERE id=? AND user_id=? AND scope=? AND submitted_edit_version=? AND status IN ('pending','published')`,
  listingId,ctx.user.id,ctx.scope,version);
  if (!recorded) conflict();
  return recorded;
}
export async function submitListing(ctx,key,body) {
  const record=await owned(ctx,key);
  const version=integer(body.version,0,Number.MAX_SAFE_INTEGER);
  if (record.status==='pending' || (record.status==='published' && version!==null && record.submitted_edit_version===version)) {
    return {slug:record.slug,status:record.status};
  }
  const state=await editState(ctx,record);
  if (state.version!==version) return confirmedSubmission(ctx,record.id,version);
  if (record.status==='published' && !truth(body.confirm)) fail(409,'Potwierdź ukrycie oferty na czas ponownej moderacji.','Confirm that the listing will be hidden during re-review.');
  const data=await validateListing(ctx,state.data,true);
  if(Array.isArray(state.data.importEquipment))data.importEquipment=state.data.importEquipment.filter(v=>typeof v==='string').map(v=>text(v,70)).slice(0,80);
  if(state.data.importSeller)data.importSeller={name:text(state.data.importSeller.name,100),email:text(state.data.importSeller.email,254)};
  setPhotoDetails(data,state.data.photoDetails,state.photos);
  keepCameraState(data,state.smartCamera);
  if(state.smartCamera.spinCount&&state.spin.length&&Object.keys(state.smartCamera.frames).length!==state.smartCamera.spinCount)
    fail(422,'Uzupełnij brakujące kąty w Studio 360° lub usuń rozpoczętą serię.',
      'Complete the missing angles in Studio 360° or remove the incomplete sequence.',{fields:['spin']});
  if (!state.photos.length && !record.demo_photo) fail(422,'Dodaj przynajmniej jedno zdjęcie.','Add at least one photo.',{fields:['photos']});
  if (state.spin.length&&state.spin.length<spinLimits.min) fail(422,'Dodaj co najmniej 8 różnych klatek widoku 360° lub usuń rozpoczętą serię.',
    'Add at least 8 distinct frames for the 360° view or remove the incomplete sequence.',{fields:['spin']});
  const slug=record.slug || (slugify(data.make+'-'+data.model)||'samochod')+'-'+record.id.slice(0,8);
  const at=now();
  const db=ctx.db;
  const decision=moderationStatement(ctx,ctx.user.id,record.id,'submit','',at);
  const gate=state.raw?' AND EXISTS(SELECT 1 FROM listing_edits WHERE listing_id=? AND version=?)':' AND NOT EXISTS(SELECT 1 FROM listing_edits WHERE listing_id=?)';
  const stockGate=data.type==='robot'?' AND ('+robotStockGuardSQL('listings',data.stock)+')':'';
  const params=state.raw?[record.id,version]:[record.id];
  const result=await saveSubmission(ctx,{
    listingId:record.id,slug,data,at,decision,
    write:stmt(db,`UPDATE listings SET ${listColumns.map(x=>x+'=?').join(',')},data=?,photo_ids=?,spin_ids=?,video_id=?,slug=?,status='pending',
      updated_at=?,submitted_at=?,submitted_edit_version=?,published_at=NULL,rejection='',revision=revision+1 WHERE id=? AND revision=?${gate}${stockGate}`,...listingValues(data),detailValues(data),JSON.stringify(state.photos),JSON.stringify(state.spin),state.video,
      slug,at,at,version,record.id,record.revision,...params),
    afterWrite:[stmt(db,'DELETE FROM listing_edits WHERE listing_id=? AND EXISTS(SELECT 1 FROM moderation WHERE id=?)',record.id,decision.decision)]
  });
  if (!result.changed) {
    if(data.type==='robot') await assertRobotStock(ctx,record.id,data.stock);
    return confirmedSubmission(ctx,record.id,version);
  }
  if (record.video_id!==state.video) await forgetVideo(ctx,record.id,record.video_id);
  return {slug,status:result.status};
}

export async function moveStatus(ctx,record,next,reason = '', kind = next) {
  const at=now();
  const decision=moderationStatement(ctx,ctx.user.id,record.id,kind,reason,at);
  const result=await ctx.db.batch([
    stmt(ctx.db,`UPDATE listings SET status=?,updated_at=?,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,
      rejection=CASE WHEN ? IN ('rejected','held') THEN ? ELSE '' END,revision=revision+1 WHERE id=? AND revision=?`,
      next,at,next,at,next,reason,record.id,record.revision),
    decision.sql,statusNotice(ctx,record.id,record.slug,decision.decision,at,reason)
  ]);
  if (!changes(result[0])) conflict();
}

function canMarkSold(record) {
  return record.status==='published' || (record.status==='held' && !record.rejection && Boolean(record.published_at)
    && (!record.submitted_at || record.published_at>=record.submitted_at));
}

export async function ownerAction(ctx,key,body) {
  const record=await owned(ctx,key);
  const allowed={held:['published','pending'],archived:['draft','rejected','held','sold']};
  const next=text(body.status,20);
  const permitted=next==='sold'?canMarkSold(record):Object.hasOwn(allowed,next)&&allowed[next].includes(record.status);
  if (!permitted) fail(409,'Ta zmiana statusu jest niedostępna.','This status change is unavailable.');
  await moveStatus(ctx,record,next);
}

export async function moderate(ctx,key,body) {
  const actor=requireStaff(ctx);
  const record=await byId(ctx,key);
  if (!record || ['draft','archived'].includes(record.status)) missing();
  if (record.user_id===actor.id) forbidden();
  if (Number(body.revision)!==record.revision) conflict();
  const action=text(body.action,20);
  const reason=text(body.reason,1600);
  const allowed=(record.status==='pending' && ['published','rejected'].includes(action)) || (record.status==='published' && action==='held');
  if (!allowed) fail(409,'Status ogłoszenia nie pozwala na tę decyzję.','The listing status does not allow this decision.');
  if (action!=='published' && reason.length<5) fail(422,'Podaj uzasadnienie decyzji.','Enter a reason for the decision.');
  await moveStatus(ctx,record,action,reason,'moderator_'+action);
}

export async function mine(ctx) {
  const user=requireUser(ctx);
  const listings=await rows(ctx.db,'SELECT '+ownerSelection+',e.data AS edit_data,e.photo_ids AS edit_photos'+ownerJoin+
    ' LEFT JOIN listing_edits e ON e.listing_id=l.id WHERE l.user_id=? ORDER BY l.updated_at DESC LIMIT 250',user.id);
  return listings.map(x=>({...hydrate(ctx,x,x.status==='draft' && x.edit_data ? {data:x.edit_data,photo_ids:x.edit_photos}:null),
    has_edit:Boolean(x.edit_data),can_mark_sold:canMarkSold(x)}));
}

export async function phoneFor(ctx,key) {
  const record=await byId(ctx,key);
  if (record?.status!=='published') missing();
  const data=parse(record.data);
  if (validListingPhone(data.listingPhone)) return data.listingPhone;
  if (!record.phone_available || data.contact!=='phone') missing();
  const user=await row(ctx.db,'SELECT phone FROM users WHERE id=? AND show_phone=1 AND deleted_at IS NULL',record.user_id);
  if (!user?.phone) missing();
  return user.phone;
}

export { listingValues, detailValues, listColumns };
