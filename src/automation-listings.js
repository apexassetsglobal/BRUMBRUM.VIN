import {AppError,changes,conflict,digest,fail,id,limitedBody,now,parse,row,rows,run,slugify,stmt,text} from './core.js';
import {catalogFor,demoPhotos,features,options} from './data.js';
import {readDemoMedia} from './demo-media.js';
import {cleanImage,maxUpload} from './images.js';
import {detailValues,listColumns,listingValues,moveStatus,validateListing} from './market.js';
import {moderationStatement,saveSubmission} from './listing-review.js';
import {importFieldLabel} from './service-catalog.js';
import {vehicleProfile} from './vehicle-types.js';
import {fetchImportResource} from './import-transport.js';

const fold=v=>String(v??'').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replaceAll('ł','l').replace(/[^\p{L}\p{N}]/gu,'');
const parts=v=>Array.isArray(v)?v:String(v??'').split(/[|\n;]/);
function choice(v,dict){if(v==null||v==='')return '';const n=fold(v);return Object.entries(dict||{}).find(([k,vs])=>[k,...(Array.isArray(vs)?vs:[vs])].some(x=>fold(x)===n))?.[0]??String(v);}
const currencies=new Set(Intl.supportedValuesOf('currency'));
const robotImport=()=>fail(422,'Import automatyczny obsługuje pojazdy. Roboty dodawaj lub importuj w Strefie Robotów; źródło pojazdów nie może zmienić takiego ogłoszenia.',
  'Automatic imports support vehicles. Add or import robots in the Robot Zone; a vehicle source cannot modify a robot listing.',{fields:['type']});
const availabilityGroups={available:['','1','true','available','dostepny','active','published','instock','forsale'],sold:['sold','sprzedany','sprzedane'],held:['0','false','inactive','unavailable','withdrawn','reserved','niedostepny','wycofany','outofstock']};
function avail(v){const k=fold(v);for(const [state,values] of Object.entries(availabilityGroups))if(values.includes(k))return state;return '';}
export function mapRecord(record,mapping){return Object.fromEntries(Object.entries(mapping).filter(([,col])=>col&&Object.hasOwn(record,col)).map(([name,col])=>[name,record[col]]));}
async function normalize(ctx,source){
  const raw={...source},catalog=ctx.catalog??=await catalogFor(ctx);
  for(const [k,v] of Object.entries(raw))if(typeof v==='number')raw[k]=String(v);
  const aliases={fuel:{gasoline:'petrol',benzin:'petrol',benzina:'petrol',bev:'electric',ev:'electric',phev:'plugin',hev:'hybrid'},gearbox:{at:'auto',mt:'manual',automatik:'auto',automat:'auto',manualny:'manual'},drive:{'4wd':'awd','4x4':'awd'},condition:{gebraucht:'used',neu:'new'},damage:{false:'no',true:'yes'}};
  for(const [key,terms] of Object.entries(aliases)){if(Object.hasOwn(terms,fold(raw[key])))raw[key]=terms[fold(raw[key])];}
  raw.type=choice(raw.type,{...options.type,...catalog.types});
  for(const k of ['fuel','gearbox','condition','damage','drive','document','contact'])raw[k]=choice(raw[k],options[k]);
  raw.body=choice(raw.body,vehicleProfile(raw.type).bodies);
  for(const k of ['price','netPrice','mileage','engine','power','battery','grossWeight','range'])if(typeof raw[k]==='string')raw[k]=raw[k].replace(/[\s\u00a0]/g,'').replace(',','.');
  const feat=Object.assign({},...Object.values(features).map(group=>group[2]));raw.equipment=parts(raw.equipment).map(v=>choice(v,feat)).filter(Boolean);
  const data=await validateListing(ctx,raw,false);
  data.currency=String(raw.currency||'PLN').toUpperCase();
  data.importEquipment=raw.equipment.filter(k=>!Object.hasOwn(feat,k)).map(k=>text(k,70)).slice(0,80);
  data.importSeller={name:text(raw.sellerName,100),email:text(raw.sellerEmail,254)};
  return {data,raw};
}
async function photos(ctx,key,urls,job){
  if(urls.length>30)fail(422,'Maksymalnie 30 zdjęć w ogłoszeniu.','A listing supports up to 30 photos.');
  const result=[], cached=await rows(ctx.db,'SELECT position,photo_id FROM auto_photo_steps WHERE job_id=? AND listing_id=? ORDER BY position',job,key);
  const byPosition=new Map(cached.map(i=>[i.position,i.photo_id]));let fetched=0;
  for(const [position,path] of urls.entries()){
    if(byPosition.has(position)){const previous=byPosition.get(position);if(!result.includes(previous))result.push(previous);continue;}
    if(ctx.env.runtime!=='node'&&fetched>=3)return null;
    fetched++;

    let bytes;
    if(/^\/media\/[a-z0-9_-]+$/i.test(path)){
      const source=await row(ctx.db,'SELECT p.id FROM photos p JOIN listings l ON l.id=p.listing_id WHERE p.id=? AND l.user_id=? AND l.scope=?',path.slice(7),ctx.user.id,ctx.scope);
      if(!source)fail(422,'Wybierz własne zdjęcie.','Choose a photo you own.');
      const file=await ctx.env.BUCKET.get('photos/'+source.id+'/main');if(!file)fail(422,'Brak zdjęcia.','Missing image.');bytes=await limitedBody(new Response(file.body),maxUpload);
    }else if(ctx.demo&&demoPhotos.has(path)){
      const r=await ctx.asset?.(path)??await readDemoMedia(ctx,path,{fallback:false});if(!r?.ok)fail(422,'Brak zdjęcia.','Missing image.');bytes=await limitedBody(r,maxUpload);
    }else bytes=(await (ctx.transport||fetchImportResource)(ctx,path,{purpose:'photo',maxBytes:maxUpload})).bytes;
    const photo=cleanImage(bytes),hash=await digest(photo.bytes),pid='ph-'+(await digest(key+hash)).slice(0,32);
    const saved=await row(ctx.db,'SELECT id FROM photos WHERE listing_id=? AND digest=?',key,hash);
    const actual=saved?.id||pid;
    if(!saved){
      for(const suffix of ['main','thumb'])await ctx.env.BUCKET.put('photos/'+pid+'/'+suffix,photo.bytes,{httpMetadata:{contentType:photo.mime}});
      await run(ctx.db,'INSERT OR IGNORE INTO photos(id,listing_id,mime,thumb_mime,width,height,digest,created_at) VALUES(?,?,?,?,?,?,?,?)',pid,key,photo.mime,photo.mime,photo.width,photo.height,hash,now());
    }
    await run(ctx.db,'INSERT OR REPLACE INTO auto_photo_steps(job_id,listing_id,position,photo_id) VALUES(?,?,?,?)',job,key,position,actual);
    if(!result.includes(actual))result.push(actual);
  }
  return result;
}
export async function importVehicle(ctx,s,j,mapped,previous,policy){
  const externalId=String(mapped.external_id??'').trim();if(!externalId||externalId.length>140)fail(422,'Brak prawidłowego identyfikatora zewnętrznego.','A valid external ID is required.');
  let fingerprint=await digest(JSON.stringify(mapped));const mayPublish=Boolean(s.autopublish&&policy.publish),availability=avail(mapped.availability);
  let listing=previous?.listing_id?await row(ctx.db,'SELECT * FROM listings WHERE id=? AND user_id=? AND scope=?',previous.listing_id,ctx.user.id,ctx.scope):null;
  if(listing?.type==='robot'||fold(mapped.type)==='robot')robotImport();

  const {raw,data}=await normalize(ctx,mapped);
  if(data.type==='robot')robotImport();
  const stable=await digest(JSON.stringify([s.id,externalId])),key=listing?.id||'imp-'+stable.slice(0,32),at=now();
  if(!listing){
    await run(ctx.db,'INSERT OR IGNORE INTO listings(id,scope,user_id,client_key,created_at,updated_at) VALUES(?,?,?,?,?,?)',key,ctx.scope,ctx.user.id,'automation-'+stable,at,at);
    listing=await row(ctx.db,'SELECT * FROM listings WHERE id=? AND scope=? AND user_id=?',key,ctx.scope,ctx.user.id);
  }
  if(!listing)conflict();
  if(listing.type==='robot')robotImport();
  if(['rejected','archived'].includes(listing.status) || (['held','sold'].includes(listing.status)&&availability==='available' && !(previous?.result===listing.status && !listing.rejection && (await row(ctx.db,'SELECT action FROM moderation WHERE listing_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',listing.id))?.action==='import_availability'))){
    return {result:'review',detail:ctx.t('Status ustawiony ręcznie wymaga decyzji właściciela lub moderatora.','A manual status requires owner or moderator review.'),listingId:key,fingerprint:''};
  }
  if(await row(ctx.db,'SELECT 1 FROM listing_edits WHERE listing_id=?',key))return {result:'review',detail:ctx.t('Trwa ręczna edycja ogłoszenia.','A manual edit is in progress.'),listingId:key,fingerprint:''};
  const photoUrls=[...new Set(parts(raw.photo_urls).map(s=>String(s??'').trim()).filter(Boolean))];
  let photoIds=parse(listing.photo_ids,[]),detail='',incomplete=false;
  try{
    if(photoUrls.length){
      photoIds=await photos(ctx,key,photoUrls,j.id);
      if(photoIds===null)return {result:'preparing'};
    }
    else if(Object.hasOwn(raw,'photo_urls'))photoIds=[];
    fingerprint=await digest(JSON.stringify([mapped,photoIds]));
  if(previous?.fingerprint===fingerprint&&listing&&!previous.missing&&(previous.result==='published'&&listing.status==='published'||previous.result===listing.status&&!(mayPublish&&listing.status==='draft')))return {result:'unchanged',state:previous.result,fingerprint,listingId:listing.id};
    await validateListing(ctx,raw,true);
    if(!currencies.has(data.currency))fail(422,'Nieznana waluta.','Unknown currency.');
    if(!availability)fail(422,'Nieznany status dostępności.','Unknown availability.');
    if(!photoIds.length)fail(422,'Brak zdjęć.','No photos.');
  }catch(error){if(!(error instanceof AppError))throw error;incomplete=true;detail=ctx.t(error.pl,error.en)+(error.details?.fields?.length?' · '+error.details.fields.map(k=>importFieldLabel(k,ctx.lang)).join(', '):'');}
  const fresh=await row(ctx.db,'SELECT s.enabled,s.autopublish,p.paused,p.imports,p.publish,p.sync FROM auto_sources s LEFT JOIN auto_policy p ON p.scope=s.scope WHERE s.id=?',s.id);
  if(!fresh?.enabled||fresh.paused||fresh.imports===0||j.kind==='sync'&&fresh.sync===0)fail(409,'Import wstrzymany.','Import paused.');
  const auto=mayPublish&&fresh.autopublish&&fresh.publish!==0;
  if((availability==='sold'||availability==='held')&&listing.status!=='draft'){
    if(listing.status!==availability)await moveStatus(ctx,listing,availability,'','import_availability');
    return {result:availability,listingId:key,fingerprint};
  }
  if((incomplete||!auto)&&listing.status!=='draft'){
    return {result:'review',detail:detail||ctx.t('Zmiany czekają na zgodę na automatyczną publikację.','Changes await permission for automatic publication.'),listingId:key,fingerprint:''};
  }
  if(!currencies.has(data.currency)){data.importCurrency=data.currency;data.currency='PLN';data.price=null;}
  data.sourceAvailability=availability;
  const values=listColumns.map(k=>k==='price'&&data.price==null?null:listingValues(data)[listColumns.indexOf(k)]);
  const slug=listing.slug||(slugify(data.make+'-'+data.model)||'pojazd')+'-'+stable.slice(0,12),state=incomplete||!auto||availability!=='available'?'draft':'pending';
  const gate=" AND NOT EXISTS(SELECT 1 FROM auto_policy WHERE scope=? AND (paused=1 OR imports=0 OR (?='sync' AND sync=0) OR (?='pending' AND publish=0))) AND EXISTS(SELECT 1 FROM auto_sources WHERE id=? AND enabled=1 AND (?!='pending' OR autopublish=1)) AND NOT EXISTS(SELECT 1 FROM listing_edits WHERE listing_id=listings.id)";
  const write=stmt(ctx.db,'UPDATE listings SET '+listColumns.map(k=>k+'=?').join(',')+',data=?,photo_ids=?,slug=?,status=?,updated_at=?,submitted_at=?,published_at=NULL,rejection=?,revision=revision+1 WHERE id=? AND scope=? AND user_id=? AND revision=? AND type<>\'robot\''+gate,...values,detailValues(data),JSON.stringify(photoIds),slug,state,at,state==='pending'?at:null,detail,key,ctx.scope,ctx.user.id,listing.revision,ctx.scope,j.kind,state,s.id,state);
  if(state==='draft'){
    const r=await write.run();if(!changes(r))conflict();
    return {result:incomplete?'incomplete':'draft',detail,listingId:key,fingerprint:incomplete?'':fingerprint};
  }
  const result=await saveSubmission(ctx,{listingId:key,slug,data,at,write,allTypes:true,decision:moderationStatement(ctx,ctx.user.id,key,'import_submit','',at),afterWrite:[]});
  if(!result.changed)conflict();return {result:result.status,listingId:key,fingerprint};
}
