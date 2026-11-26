import { AppError, changes, digest, fail, forbidden, id, isId, limitedBody, now, parse, rate, requireUser, row, rows, run, slugify, stmt, text, truth } from './core.js';
import { cleanImage, maxUpload } from './images.js';
import { demoPhotos } from './data.js';
import { readDemoMedia } from './demo-media.js';
import { detailValues, listColumns, listingFieldLabels, listingValues, validateListing } from './market.js';
import { moderationStatement, saveSubmission } from './listing-review.js';
import { assertRobotStock, robotStockGuardSQL } from './robot-orders.js';

export const csvFields=['external_id','make','model','variant','type','body','fuel','gearbox','drive','condition','damage','year','mileage','power','powerUnit','price',
  'netPrice','city','region','country','engine','doors','seats','color','countryOrigin','registered','vin','service','firstOwner','accidentFree','negotiable','equipment',
  'description','description_en','history','document','contact','battery','range','photo_urls','hours','grossWeight','axles'];
export const robotCsvFields=['external_id','make','model','variant','type','robotCategory','tradeMode','condition','damage','year','price','currency',
  'rentalPrice','rentalUnit','deposit','stock','leadTime','minimumRental','city','region','country','specs','equipment','description','description_en',
  'contact','listingPhone','negotiable','photo_urls'];
const importFields=[...new Set([...csvFields,...robotCsvFields])];
const sample=['sam-001','Toyota','Corolla','1.8 Hybrid','car','wagon','hybrid','auto','fwd','used','no','2021','63000','122','KM','74900','',
  'Warszawa','Mazowieckie','Polska','','5','5','','Polska','','','','','','','abs|ac','Wpisz rzeczywisty opis pojazdu.','','','vat','message','','','','','',''];
const cell = value => '"'+String(value??'').replaceAll('"','""')+'"';
export function csvTemplate(context={}) {
  const robotics=context==='robotics'||context?.robotics===true;
  const example={external_id:'robot-001',make:'Wpisz producenta',model:'Wpisz model',type:'robot',robotCategory:'przemyslowe',tradeMode:'both',
    condition:'used',damage:'unknown',price:'10000',currency:'PLN',rentalPrice:'250',rentalUnit:'day',deposit:'1000',stock:'1',minimumRental:'1',
    city:'Warszawa',region:'Mazowieckie',country:'Polska',contact:'message',description:'Wpisz rzeczywisty opis i stan oferowanego robota.'};
  const fields=robotics?robotCsvFields:csvFields;
  const values=robotics?fields.map(key=>example[key]??''):sample;
  return '\ufeff'+fields.join(';')+'\r\n'+values.map(cell).join(';')+'\r\n';
}
const dealer = ctx => { const u=requireUser(ctx); if (u.profile_type!=='company') forbidden(); return u; };
const badCsv = () => fail(422,'Plik CSV musi mieć poprawne nagłówki i zgodną liczbę kolumn. Maksymalnie 25 wierszy w pliku.',
  'The CSV needs valid headers and a consistent column count. Up to 25 rows per file.');

export function parseCSV(value) {
  if (typeof value !== 'string' || value.length>220000) badCsv();
  const source=value.replace(/^\ufeff/,'');
  const first=source.split(/\r?\n/,1)[0];
  const sep=first.replace(/"(?:""|[^"])*"/g,'').includes(';')?';':',';
  const result=[];
  let row=[], valuePart='', quote=false, closed=false, line=1, rowLine=1;
  const pushField=()=>{row.push(valuePart.trim());valuePart='';closed=false;};
  const pushRow=()=>{pushField();if(row.some(Boolean))result.push({line:rowLine,cells:row});row=[];rowLine=line+1;};
  for (let i=0;i<source.length;i++) {
    const c=source[i];
    if (quote) {
      if (c==='"' && source[i+1]==='"') {valuePart+='"';i++;continue;}
      if (c==='"') quote=false, closed=true;
      else {valuePart+=c;if(c==='\n')line++;}
      continue;
    }
    if (c===sep) {pushField();continue;}
    if (c==='\n' || c==='\r') {pushRow();if(c==='\r' && source[i+1]==='\n')i++;line++;continue;}
    if (closed) {if(c!==' '&&c!=='\t')badCsv();continue;}
    if (c==='"' && valuePart.trim()==='') {quote=true;continue;}
    if (c==='"') badCsv();
    valuePart+=c;
  }
  if (quote) badCsv();
  if (row.length||valuePart) pushRow();
  const header=result.shift()?.cells || [];
  if (header.length<2 || header.length>60 || new Set(header).size!==header.length || header.some(key=>!key) || result.length>25 || !result.length) badCsv();
  return {header, records:result};
}

function origins(ctx) {
  return (ctx.env.IMPORT_IMAGE_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
}
function allowed(ctx,value) {
  const local=/^\/media\/([a-z0-9-]+)$/.exec(value);
  if (local) return {local:local[1]};
  if (ctx.demo && demoPhotos.has(value)) return {sample:value};
  try {
    const parsed=new URL(value);
    if (parsed.protocol==='https:' && !parsed.username && !parsed.password && origins(ctx).includes(parsed.origin)) return {remote:parsed.href};
  } catch { /* invalid URL */ }
  fail(422,'Źródło zdjęcia jest niedozwolone.','The photo source is not allowed.');
}

async function analyze(ctx,body) {
  const user=dealer(ctx);
  const {header,records}=parseCSV(body.csv);
  const mapping=body.mapping && typeof body.mapping==='object' ? body.mapping : {};
  const robotics=Boolean(ctx.robotics||body.market==='robotics');
  const indexes=Object.fromEntries(importFields.map(key=>[key,header.indexOf(mapping[key] ?? key)]));
  const source=text(body.source,80);
  if (!source || !truth(body.rights)) fail(422,'Podaj nazwę źródła i potwierdź prawo do danych oraz zdjęć.','Name the source and confirm you have rights to the data and photos.');
  const seen=new Set();
  const preview=[];
  for (const item of records) {
    const raw=Object.fromEntries(importFields.map(key=>[key,item.cells[indexes[key]] ?? '']));
    const result={line:item.line,externalId:text(raw.external_id,140),make:text(raw.make,50),model:text(raw.model,60)};
    try {
      if (item.cells.length!==header.length) fail(422,'Niezgodna liczba kolumn.','Column count does not match.');
      if (!result.externalId || seen.has(result.externalId)) fail(422,'Brak lub powtórzony identyfikator zewnętrzny.','Missing or repeated external ID.');
      seen.add(result.externalId);
      if (robotics && raw.type && raw.type!=='robot') fail(422,'W Strefie Robotów można importować wyłącznie roboty. Użyj type=robot.',
        'Only robots can be imported into the Robot Zone. Use type=robot.');
      if (robotics || raw.type==='robot') {raw.type='robot';raw.market='robotics';}
      const paths=raw.photo_urls.split('|').map(s=>s.trim()).filter(Boolean);
      if (paths.length>4) fail(422,'Import obsługuje do 4 zdjęć na wiersz.','An import row supports up to four photos.');
      result.paths=paths.map(path=>allowed(ctx,path));
      const previous=await row(ctx.db,`SELECT e.listing_id,l.photo_ids,l.revision,l.type,l.scope FROM external_ids e JOIN listings l ON l.id=e.listing_id
        WHERE e.user_id=? AND e.source=? AND e.external_id=?`,user.id,source,result.externalId);
      if (previous && (previous.scope!==ctx.scope || (previous.type==='robot')!==(raw.type==='robot'))) fail(409,
        'Ten identyfikator źródłowy należy do innego działu. Podaj osobną nazwę źródła dla robotów i pojazdów.',
        'This source ID belongs to a different market. Use separate source names for robots and vehicles.');
      if (!paths.length && (!previous || !parse(previous.photo_ids,[]).length)) fail(422,'Podaj co najmniej jedno zdjęcie.','Provide at least one photo.');
      raw.equipment=raw.equipment.split('|').map(s=>s.trim());
      result.data=await validateListing(ctx,raw,true);
      result.previous=previous;
      result.state=previous?'update':'create';
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      result.error=ctx.t(error.pl,error.en)+(error.details.fields?.length?' ('+error.details.fields.map(key=>listingFieldLabels[key]?ctx.t(...listingFieldLabels[key]):key).join(', ')+')':'');
    }
    preview.push(result);
  }
  return {source,header,preview};
}

function reportRows(items) {
  return items.map(({line,externalId,make,model,error,state,listingId,status})=>({line,externalId,make,model,error,state,listingId,status}));
}

export async function previewCSV(ctx,body) {
  await rate(ctx,'csv-preview',20,3600);
  const info=await analyze(ctx,body);
  return {header:info.header,rows:reportRows(info.preview)};
}

async function loadImportPhoto(ctx,path) {
  let response;
  if (path.sample) response=await ctx.asset(path.sample) ?? await readDemoMedia(ctx,path.sample,{fallback:false});
  if (path.local) {
    const source=await row(ctx.db,`SELECT p.id,p.mime FROM photos p JOIN listings l ON l.id=p.listing_id
      WHERE p.id=? AND l.user_id=? AND l.scope=?`,path.local,ctx.user.id,ctx.scope);
    if (!source) fail(422,'Zdjęcie źródłowe nie należy do tego konta.','The source image does not belong to this account.');
    const object=await ctx.env.BUCKET.get('photos/'+source.id+'/main');
    if (!object) fail(422,'Nie znaleziono zdjęcia.','The photo could not be found.');
    response=new Response(object.body);
  }
  if (path.remote) {
    try {response=await fetch(path.remote,{redirect:'error',signal:AbortSignal.timeout(7000),headers:{Accept:'image/jpeg,image/webp,image/png'}});}
    catch { /* failure becomes a row error */ }
  }
  if (!response?.ok) fail(422,'Pobranie zdjęcia nie powiodło się.','The photo download failed.');
  return cleanImage(await limitedBody(response,maxUpload));
}

async function persistRow(ctx,source,item) {
  const db=ctx.db,u=ctx.user,at=now(),data=item.data;
  const stable=await digest(JSON.stringify([u.id,source,item.externalId]));
  const listingId=item.previous?.listing_id || 'imp-'+stable.slice(0,32);
  const slug=(slugify(data.make+'-'+data.model)||'samochod')+'-'+stable.slice(0,12);
  const images=[];
  const known=item.previous?await rows(db,'SELECT id,digest FROM photos WHERE listing_id=?',listingId):[];
  for (const path of item.paths) {
    const photo=await loadImportPhoto(ctx,path);
    const hash=await digest(photo.bytes);
    if (!images.some(x=>x.hash===hash)) {
      const existing=known.find(image=>image.digest===hash);
      images.push({...photo,hash,existing:Boolean(existing),key:existing?.id || 'ph-'+(await digest(listingId+hash)).slice(0,30)});
    }
  }
  const photoIds=images.length?images.map(x=>x.key):parse(item.previous?.photo_ids,[]);
  const decision=moderationStatement(ctx,u.id,listingId,'csv_submit','source: '+source,at);
  for (const img of images.filter(image=>!image.existing)) {
    const bucket=ctx.env.BUCKET;
    await bucket.put('photos/'+img.key+'/main',img.bytes,{httpMetadata:{contentType:img.mime}});
    await bucket.put('photos/'+img.key+'/thumb',img.bytes,{httpMetadata:{contentType:img.mime}});
  }
  const columns=listColumns.join(',');
  const stockGate=data.type==='robot'?' AND ('+robotStockGuardSQL('listings',data.stock)+')':'';
  const result=await saveSubmission(ctx,{
    listingId,slug,data,at,decision,
    write:stmt(db,`INSERT INTO listings(id,scope,user_id,client_key,slug,status,${columns},data,photo_ids,created_at,updated_at,submitted_at)
      VALUES(?,?,?,?,?,'pending',${listColumns.map(()=>'?').join(',')},?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET ${listColumns.map(k=>k+'=excluded.'+k).join(',')},data=excluded.data,photo_ids=excluded.photo_ids,
        status='pending',updated_at=excluded.updated_at,submitted_at=excluded.submitted_at,submitted_edit_version=NULL,published_at=NULL,rejection='',revision=listings.revision+1
      WHERE listings.user_id=excluded.user_id AND listings.revision=?${stockGate}`,
      listingId,ctx.scope,u.id,'csv-'+stable,slug,...listingValues(data),detailValues(data),JSON.stringify(photoIds),at,at,at,item.previous?.revision??-1),
    afterWrite:[
      stmt(db,`INSERT OR IGNORE INTO external_ids(user_id,source,external_id,listing_id) SELECT ?,?,?,?
        WHERE EXISTS(SELECT 1 FROM moderation WHERE id=?)`,u.id,source,item.externalId,listingId,decision.decision),
      ...images.filter(image=>!image.existing).map(img=>stmt(db,`INSERT OR IGNORE INTO photos(id,listing_id,mime,thumb_mime,width,height,digest,created_at)
        SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM moderation WHERE id=?)`,img.key,listingId,img.mime,img.mime,img.width,img.height,img.hash,at,decision.decision)),
      stmt(db,`DELETE FROM listing_edits WHERE listing_id=? AND EXISTS(SELECT 1 FROM moderation WHERE id=?)`,listingId,decision.decision)
    ]
  });
  if (!result.changed) {
    if(data.type==='robot') await assertRobotStock(ctx,listingId,data.stock);
    fail(409,'Oferta zmieniła się podczas importu. Ponów podgląd.','The listing changed during import. Preview it again.');
  }
  return {listingId,status:result.status};
}

export async function importCSV(ctx,body) {
  const user=dealer(ctx);
  await rate(ctx,'csv-commit',10,3600);
  if (!truth(body.confirm) || !isId(body.key)) fail(422,'Potwierdź import i moderację ofert.','Confirm the import and submission for review.');
  const previous=await row(ctx.db,'SELECT * FROM import_runs WHERE user_id=? AND client_key=?',user.id,body.key);
  if (previous?.state==='done') return {id:previous.id,rows:parse(previous.report,[]),valid:previous.valid};
  if (previous) fail(409,'Ten import trwa. Sprawdź historię importów.','This import is running. Check import history.');
  const {source,preview}=await analyze(ctx,body);
  const runId=id();
  const created=await run(ctx.db,`INSERT OR IGNORE INTO import_runs(id,user_id,source,filename,created_at,total,client_key) VALUES(?,?,?,?,?,?,?)`,
    runId,user.id,source,text(body.filename,120)||'import.csv',now(),preview.length,body.key);
  if (!changes(created)) fail(409,'Ten import trwa. Sprawdź historię importów.','This import is running. Check import history.');
  let valid=0;
  const completed=[];
  for (const item of preview) {
    if (!item.error) {
      try {Object.assign(item,await persistRow(ctx,source,item));valid++;}
      catch (error) {
        if (!(error instanceof AppError)) console.error('csv_row_failed',runId,item.line);
        item.error=error instanceof AppError?ctx.t(error.pl,error.en):ctx.t('Błąd zapisu wiersza.','The row could not be saved.');
      }
    }
    completed.push(item);
    await run(ctx.db,'UPDATE import_runs SET report=?,valid=? WHERE id=?',JSON.stringify(reportRows(completed)),valid,runId);
  }
  const result=reportRows(completed);
  await run(ctx.db,"UPDATE import_runs SET state='done' WHERE id=?",runId);
  return {id:runId,rows:result,valid};
}

export async function importHistory(ctx) {
  const u=dealer(ctx);
  return (await rows(ctx.db,'SELECT * FROM import_runs WHERE user_id=? ORDER BY created_at DESC LIMIT 30',u.id)).map(x=>({...x,report:parse(x.report,[])}));
}
