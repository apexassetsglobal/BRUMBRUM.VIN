import {AppError,after,assertSameOrigin,changes,conflict,digest,fail,forbidden,id,input,invalid,isId,json,limitedBody,missing,now,parse,random,rate,requireAdmin,requireUser,row,rows,run,stmt,text,truth} from './core.js';
import {importFields,parseImport,suggestMapping} from './import-formats.js';
import {fetchImportResource,normalizeImportUrl,openIntegrationSecret,sealIntegrationSecret} from './import-transport.js';
import {importVehicle,mapRecord} from './automation-listings.js';
import {fromListing} from './market.js';
import {translator} from './i18n.js';

const size=4*1024*1024,formats=new Set(['auto','csv','xlsx','json','xml']),periods=new Set([0,1,6,12,24]);
const paused=()=>fail(409,'Import lub publikacja są wstrzymane.','Import or publishing is paused.');
export async function autoPolicy(ctx){return await row(ctx.db,'SELECT * FROM auto_policy WHERE scope=?',ctx.scope)||{imports:1,publish:1,sync:1,paused:0};}
export async function allowPublication(ctx){if((await autoPolicy(ctx)).paused)paused();}
export async function allowImport(ctx){const p=await autoPolicy(ctx);if(p.paused||!p.imports)paused();if(ctx.user&&(await row(ctx.db,'SELECT enabled FROM auto_clients WHERE scope=? AND owner_id=?',ctx.scope,ctx.user.id))?.enabled===0)paused();return p;}
const safeError=(ctx,err)=>err instanceof AppError?ctx.t(err.pl,err.en):ctx.t('Operacja nie powiodła się.','The operation failed.');
function transport(ctx,url,options){return (ctx.transport||fetchImportResource)(ctx,url,options);}
function validatedMapping(m,columns){
 if(m==null)return suggestMapping(columns);
 if(!m||Array.isArray(m)||typeof m!=='object')invalid();
 const result={};for(const [k,v] of Object.entries(m)){if(!v)continue;if(!importFields.includes(k)||typeof v!=='string'||!columns.includes(v))invalid();result[k]=v;}return result;
}
async function source(ctx,key){const u=requireUser(ctx),s=await row(ctx.db,'SELECT * FROM auto_sources WHERE id=? AND owner_id=? AND scope=?',key,u.id,ctx.scope);if(!s)missing();return s;}
async function register(ctx,b){
 const u=requireUser(ctx);await allowImport(ctx);if(!u.verified_at)forbidden();
 const name=text(b.name,90),kind=b.kind,format=b.format||'auto',hours=Number(b.interval||0);
 if(!name||!['file','feed','push','dealer','rest'].includes(kind)||!formats.has(format)||!periods.has(hours)||!truth(b.rights))invalid();
 const pull=['feed','dealer','rest'].includes(kind);if(!pull&&hours)invalid();
 const key=id(),url=pull?normalizeImportUrl(b.url):'',origin=url?new URL(url).origin:'',token=kind==='push'?random():null;
 const encodedURL=url?await sealIntegrationSecret(ctx.env,u.id,key+':url',url):'';
 const credential=await sealIntegrationSecret(ctx.env,u.id,key,b.token||''),at=now();
 if(await row(ctx.db,'SELECT 1 FROM auto_sources WHERE owner_id=? AND scope=? AND name=?',u.id,ctx.scope,name))fail(409,'Źródło o tej nazwie już istnieje.','A source with this name already exists.');
 await run(ctx.db,'INSERT INTO auto_sources(id,scope,owner_id,name,kind,format,url,credential,token_origin,push_hash,autopublish,interval_hours,consent_at,created_at,next_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,ctx.scope,u.id,name,kind,format,encodedURL,credential,origin,token?await digest(token):'',+truth(b.autopublish),hours,at,at,hours?at:null);
 return {id:key,...(token?{token}:{}),endpoint:kind==='push'?ctx.origin+ctx.prefix+'/api/automation/push/'+key:undefined};
}
async function loadRemote(ctx,s){
 const url=await openIntegrationSecret(ctx.env,s.owner_id,s.id+':url',s.url);
 const token=await openIntegrationSecret(ctx.env,s.owner_id,s.id,s.credential);
 const file=await transport(ctx,url,{purpose:'feed',maxBytes:size,token,tokenOrigin:s.token_origin});
 return parseImport(file.bytes,s.format,{allowEmpty:true});
}
async function putData(ctx,key,data){await ctx.env.BUCKET.put(key,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});}
async function getData(ctx,key){const o=await ctx.env.BUCKET.get(key);if(!o)fail(410,'Dane importu wygasły.','Import data expired.');return new Response(o.body).json();}
async function preview(ctx,s){
 await allowImport(ctx);if(!s.enabled)paused();await rate(ctx,'auto-preview',35,3600);
 const fmt=ctx.url.searchParams.get('format')||s.format;
 const data=s.url?await loadRemote(ctx,s):await parseImport(await limitedBody(ctx.req,size),fmt,{allowEmpty:true});
 const key=id(),object='automation/preview/'+key,expires=after(3600000);await putData(ctx,object,data);
 await run(ctx.db,'INSERT INTO auto_previews VALUES(?,?,?,?,?)',key,s.id,ctx.user.id,object,expires);
 const current=parse(s.mapping,{});
 return {previewId:key,columns:data.columns,total:data.rows.length,sample:data.rows.slice(0,4),mapping:{...suggestMapping(data.columns),...Object.fromEntries(Object.entries(current).filter(([,v])=>data.columns.includes(v)))}};
}
async function queue(ctx,s,{kind='manual',data,mapping,snapshot=false,requestKey=''}={}){
 const policy=await allowImport(ctx);if(!s.enabled||kind==='sync'&&!policy.sync)paused();
 if(requestKey){
  const prior=await row(ctx.db,'SELECT id FROM auto_jobs WHERE source_id=? AND request_key=?',s.id,requestKey);
  if(prior)return {jobId:prior.id};
 }
 const key=id(),object=data?'automation/jobs/'+key:'';
 if(data)await putData(ctx,object,data);
 let saved;
 try{
  saved=await run(ctx.db,"INSERT OR IGNORE INTO auto_jobs(id,scope,owner_id,source_id,kind,payload,mapping,snapshot,total,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)",key,s.scope,s.owner_id,s.id,kind,object,JSON.stringify(mapping||parse(s.mapping,{})),+snapshot,data?.rows.length||0,now(),requestKey||null);
  if(!changes(saved)){
    if(requestKey){const previous=await row(ctx.db,'SELECT id FROM auto_jobs WHERE source_id=? AND request_key=?',s.id,requestKey);if(previous){if(object)await ctx.env.BUCKET.delete(object);return {jobId:previous.id};}}
    fail(409,'Trwa już import z tego źródła.','An import from this source is already running.');
  }
 }catch(error){if(object)await ctx.env.BUCKET.delete(object);throw error;}
 return {jobId:key};
}
async function start(ctx,s,b){
 if(!s.enabled)paused();await allowImport(ctx);
 if(!b.previewId){if(!s.url)invalid();return queue(ctx,s,{snapshot:true});}
 const prev=await row(ctx.db,'SELECT * FROM auto_previews WHERE id=? AND owner_id=? AND source_id=? AND expires>?',b.previewId,ctx.user.id,s.id,now());
 if(!prev)missing();const data=await getData(ctx,prev.object_key),mapping=validatedMapping(b.mapping,data.columns);
 if(data.rows.length&&!mapping.external_id)fail(422,'Przypisz identyfikator zewnętrzny oferty.','Map the external listing ID.');
 const result=await queue(ctx,s,{data,mapping,snapshot:truth(b.snapshot),requestKey:'preview-'+prev.id});
 await run(ctx.db,'UPDATE auto_sources SET mapping=? WHERE id=?',JSON.stringify(mapping),s.id);return result;
}
async function push(ctx,parts){
 const [key,verb,job,extra]=parts,bearer=ctx.req.headers.get('Authorization')||'';
 if(!/^Bearer [a-f0-9]{64}$/.test(bearer)||!isId(key)||extra)forbidden();
 const s=await row(ctx.db,"SELECT s.* FROM auto_sources s JOIN users u ON u.id=s.owner_id AND u.deleted_at IS NULL WHERE s.scope=? AND s.id=? AND s.kind='push' AND s.push_hash=?",ctx.scope,key,await digest(bearer.slice(7)));
 if(!s)forbidden();
 if(verb==='jobs'&&isId(job)&&ctx.req.method==='GET'){
   const result=await row(ctx.db,'SELECT id,state,errors,total FROM auto_jobs WHERE id=? AND source_id=?',job,s.id);if(!result)missing();
   let status=result.state==='done'?(result.errors?'rejected':'accepted'):result.state==='failed'?'rejected':'pending';
   if(status==='accepted'){
     const decision=await row(ctx.db,"SELECT max(l.status='rejected') AS rejected, max(l.status='pending') AS pending FROM auto_events e JOIN listings l ON l.id=e.listing_id WHERE e.job_id=? AND l.user_id=? AND l.scope=?",result.id,s.owner_id,s.scope);
     if(decision?.rejected)status='rejected';else if(decision?.pending)status='pending';
   }
   return json({ok:true,jobId:result.id,status});
 }
 if(verb||ctx.req.method!=='POST')missing();ctx.user=await row(ctx.db,'SELECT * FROM users WHERE id=? AND deleted_at IS NULL',s.owner_id);if(!ctx.user)forbidden();
 await allowImport(ctx);if(!s.enabled)paused();await rate(ctx,'auto-push',100,3600,s.id);
 const data=await parseImport(await limitedBody(ctx.req,size),s.format,{allowEmpty:true});
 const token=text(ctx.req.headers.get('Idempotency-Key'),180);const requestKey=token?'push-'+await digest(token):'';
 const res=await queue(ctx,s,{kind:'push',data,mapping:Object.keys(parse(s.mapping,{})).length?parse(s.mapping,{}):suggestMapping(data.columns),snapshot:ctx.url.searchParams.get('snapshot')==='1',requestKey});
 return json({ok:true,...res,status:'pending'},202);
}
export function channelRegistry(env){
 const result=[],configured=parse(env.IMPORT_CHANNELS||'[]',[]);if(!Array.isArray(configured))return result;for(const c of configured){
  try{if(!isId(c.id)||!text(c.name,100)||!['receipt-v1','brumbrum-v1'].includes(c.protocol))continue;
   result.push({id:c.id,name:text(c.name,100),protocol:c.protocol,endpoint:normalizeImportUrl(c.endpoint)});
  }catch{}
 }return result;
}
async function changeChannel(ctx,b){
 const user=requireUser(ctx),config=channelRegistry(ctx.env).find(c=>c.id===b.channel);if(!config)missing();
 const prev=await row(ctx.db,'SELECT * FROM auto_channels WHERE scope=? AND owner_id=? AND channel=?',ctx.scope,user.id,config.id);
 if(!truth(b.enabled)){if(prev)await run(ctx.db,'UPDATE auto_channels SET enabled=0 WHERE id=?',prev.id);return {};}
 if(!truth(b.rights)||ctx.demo)forbidden();const key=prev?.id||id(),origin=new URL(config.endpoint).origin;
 if(prev?.credential&&prev.token_origin!==origin&&!b.token)invalid();
 const credential=b.token?await sealIntegrationSecret(ctx.env,user.id,key,b.token):prev?.credential||'';
 if(config.protocol==='brumbrum-v1'&&!credential)invalid();
 await run(ctx.db,'INSERT INTO auto_channels(id,scope,owner_id,channel,credential,token_origin,consent_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_id,channel) DO UPDATE SET credential=excluded.credential,token_origin=excluded.token_origin,consent_at=excluded.consent_at,enabled=1',key,ctx.scope,user.id,config.id,credential,origin,now());
 return {};
}
async function sendDelivery(ctx){
 if(ctx.scope!=='live')return;
 const db=ctx.db,at=now();
 const registry=channelRegistry(ctx.env);if(!registry.length)return;
 await run(db,"INSERT OR IGNORE INTO auto_deliveries(id,channel_id,listing_id,revision,created_at) SELECT lower(hex(randomblob(16))),c.id,l.id,l.revision,? FROM auto_channels c JOIN listings l ON l.user_id=c.owner_id AND l.scope=c.scope JOIN users u ON u.id=c.owner_id AND u.deleted_at IS NULL LEFT JOIN auto_clients ac ON ac.owner_id=c.owner_id AND ac.scope=c.scope WHERE c.scope=? AND c.enabled=1 AND coalesce(ac.enabled,1)=1 AND l.status='published' AND l.type<>'robot' AND NOT EXISTS(SELECT 1 FROM auto_deliveries d WHERE d.channel_id=c.id AND d.listing_id=l.id AND d.revision=l.revision) LIMIT 25",at,ctx.scope);
 const item=await row(db,"SELECT d.*,c.channel,c.owner_id,c.credential,c.token_origin FROM auto_deliveries d JOIN auto_channels c ON c.id=d.channel_id JOIN listings l ON l.id=d.listing_id AND l.user_id=c.owner_id AND l.revision=d.revision AND l.status='published' AND l.type<>'robot' JOIN users u ON u.id=c.owner_id AND u.deleted_at IS NULL LEFT JOIN auto_clients a ON a.owner_id=c.owner_id AND a.scope=c.scope WHERE c.scope=? AND c.enabled=1 AND coalesce(a.enabled,1)=1 AND d.state IN ('queued','inflight','waiting') AND (d.lease_until IS NULL OR d.lease_until<?) ORDER BY d.created_at LIMIT 1",ctx.scope,at);
 if(!item)return;const cfg=registry.find(c=>c.id===item.channel);if(!cfg)return;
 const claim=await run(db,"UPDATE auto_deliveries SET state='inflight',lease_until=?,attempts=attempts+1 WHERE id=? AND (lease_until IS NULL OR lease_until<?)",after(120000),item.id,at);if(!changes(claim))return;
 let state='accepted',detail='',retry=null,remoteJob=item.remote_job;
 try{
  const source=await row(db,"SELECT l.* FROM listings l JOIN auto_channels c ON c.id=? AND c.enabled=1 AND c.owner_id=l.user_id WHERE l.id=? AND l.status='published' AND l.type<>'robot' AND l.revision=?",item.channel_id,item.listing_id,item.revision);if(!source)forbidden();
  const policy=await autoPolicy(ctx);if(policy.paused||!policy.publish)paused();
  const token=await openIntegrationSecret(ctx.env,item.owner_id,item.channel_id,item.credential);
  let response;
  if(cfg.protocol==='brumbrum-v1'&&remoteJob){
   if(!isId(remoteJob))invalid();
   const statusUrl=new URL(cfg.endpoint);statusUrl.pathname+='/jobs/'+remoteJob;
   response=await transport(ctx,statusUrl.href,{purpose:'feed',token,tokenOrigin:item.token_origin,maxBytes:65536});
  }else{
   const data=fromListing(source),photos=parse(source.photo_ids,[]).map(p=>new URL('/media/'+p,ctx.origin).href);
   delete data.importSeller;delete data.listingPhone;delete data.photoDetails;
   delete data.smartCamera;delete data.cameraReceipts;
   const listing={...data,external_id:source.id,photo_urls:photos,availability:'available',url:new URL('/oferta/'+source.slug,ctx.origin).href};
   response=await transport(ctx,cfg.endpoint,{purpose:'distribution',token,tokenOrigin:item.token_origin,officialEndpoint:cfg.endpoint,idempotencyKey:item.id,json:{offers:[listing]}});
  }
  const ack=parse(new TextDecoder().decode(response.bytes),{});
  if(ack.status==='rejected'){state='rejected';detail='Odbiorca odrzucił ofertę / Listing rejected';}
  else if(ack.status==='pending'&&cfg.protocol==='brumbrum-v1'&&isId(ack.jobId)){remoteJob=ack.jobId;state='waiting';retry=after(60000);}
  else if(ack.status!=='accepted')fail(502,'Brak potwierdzenia przyjęcia oferty.','The publisher did not acknowledge the listing.');
 }catch(err){const remote=err.details?.remoteStatus;state=(!remote||remote>=500||remote===429)&&item.attempts<3?'queued':'rejected';detail=safeError(ctx,err);if(state==='queued')retry=after(60000*2**item.attempts);}
 const statements=[stmt(db,'UPDATE auto_deliveries SET state=?,detail=?,lease_until=?,remote_job=? WHERE id=?',state,detail,retry,remoteJob||null,item.id)];
 if(state==='rejected')statements.push(stmt(db,"INSERT INTO notifications(id,user_id,kind,data,created_at) VALUES(?,?,'import_distribution',?,?)",id(),item.owner_id,JSON.stringify({listingId:item.listing_id,reason:detail}),at));
 await db.batch(statements);
}
async function complete(ctx,j,s,status,message=''){
 const at=now();await ctx.db.batch([stmt(ctx.db,'UPDATE auto_jobs SET state=?,report=?,lease=NULL,lease_until=NULL,finished_at=? WHERE id=? AND lease=?',status,message,at,j.id,j.lease),
 stmt(ctx.db,'UPDATE auto_sources SET last_at=?,next_at=CASE WHEN interval_hours>0 THEN strftime(\'%Y-%m-%dT%H:%M:%fZ\',?,\'+\'||interval_hours||\' hours\') END WHERE id=? AND EXISTS(SELECT 1 FROM auto_jobs WHERE id=? AND finished_at=?)',at,at,s.id,j.id,at)]);
 await run(ctx.db,"DELETE FROM auto_photo_steps WHERE job_id=? AND EXISTS(SELECT 1 FROM auto_jobs WHERE id=? AND state IN ('done','failed'))",j.id,j.id);
 if(j.payload&&await row(ctx.db,'SELECT 1 FROM auto_jobs WHERE id=? AND finished_at=?',j.id,at))await ctx.env.BUCKET.delete(j.payload);
}
async function processJob(ctx,j,s,policy,budget){
 const at=now(),lease=id();if(!changes(await run(ctx.db,"UPDATE auto_jobs SET state='running',lease=?,lease_until=?,last_slice=? WHERE id=? AND state IN ('queued','running') AND (lease IS NULL OR lease_until<?)",lease,after(240000),at,j.id,at)))return 0;
 j.lease=lease;ctx={...ctx,user:await row(ctx.db,'SELECT * FROM users WHERE id=? AND scope=? AND deleted_at IS NULL',s.owner_id,s.scope)};
 if(!ctx.user){await complete(ctx,j,s,'failed','Konto niedostępne / Account unavailable');return 0;}
 ctx.lang=ctx.user.lang||'pl';ctx.t=translator(ctx.lang);
 let processed=0;
 try{
  let data;
  if(!j.payload){data=await loadRemote(ctx,s);const object='automation/jobs/'+j.id;await putData(ctx,object,data);await run(ctx.db,'UPDATE auto_jobs SET payload=?,total=? WHERE id=? AND lease=?',object,data.rows.length,j.id,lease);j.payload=object;}
  else data=await getData(ctx,j.payload);
  const m=parse(j.mapping,{}),mapping=Object.keys(m).length?validatedMapping(m,data.columns):suggestMapping(data.columns);
  if(data.rows.length&&!mapping.external_id)fail(422,'Przypisz identyfikator zewnętrzny oferty.','Map the external listing ID.');
  const counts=new Map();for(const record of data.rows){const key=String(record[mapping.external_id]??'').trim();counts.set(key,(counts.get(key)||0)+1);}
  let cursor=j.cursor;
  for(;cursor<data.rows.length && processed<budget;cursor++,processed++){
   const switchState=await autoPolicy(ctx),sourceState=await row(ctx.db,'SELECT enabled,autopublish FROM auto_sources WHERE id=?',s.id);
   if(switchState.paused||!switchState.imports||j.kind==='sync'&&!switchState.sync||!sourceState?.enabled)break;
   const mapped=mapRecord(data.rows[cursor],mapping),key=String(mapped.external_id??'').trim();let outcome;
   const previous=key?await row(ctx.db,'SELECT * FROM auto_items WHERE source_id=? AND external_id=?',s.id,key):null;
   try{if(!key||key.length>140||counts.get(key)>1)fail(422,'Brak lub powtórzony identyfikator źródłowy.','Missing or repeated external ID.');
    outcome=await importVehicle(ctx,{...s,...sourceState},j,mapped,previous,switchState);
   }catch(err){
    if(err instanceof AppError&&err.status===409){const live=await autoPolicy(ctx),enabled=await row(ctx.db,'SELECT enabled FROM auto_sources WHERE id=?',s.id);if(live.paused||!live.imports||j.kind==='sync'&&!live.sync||!enabled?.enabled)break;}
    outcome={result:'error',detail:safeError(ctx,err),listingId:previous?.listing_id};
   }
   if(outcome.result==='preparing'){processed++;break;}
   const gate='EXISTS(SELECT 1 FROM auto_jobs WHERE id=? AND lease=? AND cursor=?)',db=ctx.db;
   const bad=+['error','incomplete','review'].includes(outcome.result);
   const op=[stmt(db,'INSERT OR IGNORE INTO auto_events(job_id,line,external_id,result,detail,listing_id) SELECT ?,?,?,?,?,? WHERE '+gate,j.id,cursor+1,key.slice(0,140),outcome.result,outcome.detail||'',outcome.listingId||null,j.id,lease,cursor)];
   if(key&&key.length<=140&&counts.get(key)===1)op.push(stmt(db,'INSERT INTO auto_items(source_id,external_id,listing_id,fingerprint,result,detail,last_job,ever_published) SELECT ?,?,?,?,?,?,?,? WHERE '+gate+' ON CONFLICT(source_id,external_id) DO UPDATE SET listing_id=coalesce(excluded.listing_id,auto_items.listing_id),fingerprint=excluded.fingerprint,result=excluded.result,detail=excluded.detail,last_job=excluded.last_job,missing=0,ever_published=max(auto_items.ever_published,excluded.ever_published)',s.id,key,outcome.listingId||null,outcome.fingerprint||'',outcome.state||outcome.result,outcome.detail||'',j.id,+(outcome.result==='published'),j.id,lease,cursor));
   op.push(stmt(db,'UPDATE auto_jobs SET cursor=cursor+1,errors=errors+?,lease_until=? WHERE id=? AND lease=? AND cursor=?',bad,after(240000),j.id,lease,cursor));
   const r=await db.batch(op);if(!changes(r.at(-1)))return processed;
  }
  if(cursor===data.rows.length){
   if(j.snapshot&&!(await row(ctx.db,'SELECT errors FROM auto_jobs WHERE id=?',j.id)).errors)
    await run(ctx.db,'UPDATE auto_items SET missing=1 WHERE source_id=? AND last_job!=? AND EXISTS(SELECT 1 FROM auto_jobs WHERE id=? AND lease=?)',s.id,j.id,j.id,lease);
   await complete(ctx,j,s,'done');
  }else await run(ctx.db,'UPDATE auto_jobs SET lease=NULL,lease_until=NULL WHERE id=? AND lease=?',j.id,lease);
 }catch(err){await complete(ctx,j,s,'failed',safeError(ctx,err));}
 return processed;
}
export async function automationTick(ctx,{force=false,sourceId=null,budget=6}={}){
 const db=ctx.db,at=now(),clock='tick:'+ctx.scope;const gate=await run(db,"INSERT INTO auto_clock VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET last_at=excluded.last_at,next_at=excluded.next_at WHERE auto_clock.next_at<=? OR ?=1",clock,at,after(ctx.env.runtime==='node'?500:4000),at,+force);
 if(!changes(gate))return {checkedAt:at,processed:0};
 const policy=await autoPolicy(ctx);if(policy.paused)return {checkedAt:at,processed:0};if(!policy.imports){if(policy.publish)await sendDelivery(ctx);return {checkedAt:at,processed:0};}
 if(policy.sync){
  const due=await rows(db,"SELECT s.* FROM auto_sources s JOIN users u ON u.id=s.owner_id AND u.deleted_at IS NULL WHERE s.scope=? AND s.enabled=1 AND s.interval_hours>0 AND s.next_at<=? AND NOT EXISTS(SELECT 1 FROM auto_jobs j WHERE j.source_id=s.id AND j.state IN ('queued','running')) ORDER BY s.next_at LIMIT 12",ctx.scope,at);
  for(const s of due){try{await queue({...ctx,user:{id:s.owner_id}},s,{kind:'sync',snapshot:true});}catch(err){if(!(err instanceof AppError))throw err;}}
 }
 const jobs=await rows(db,"SELECT j.* FROM auto_jobs j JOIN auto_sources s ON s.id=j.source_id AND s.enabled=1 WHERE j.scope=? AND j.state IN ('queued','running') AND (j.lease IS NULL OR j.lease_until<?) AND (j.kind!='sync' OR ?=1) AND (? IS NULL OR s.id=?) ORDER BY coalesce(j.last_slice,j.created_at),j.id LIMIT 4",ctx.scope,at,policy.sync,sourceId,sourceId);
 let processed=0;
 for(const j of jobs){const s=await row(db,'SELECT * FROM auto_sources WHERE id=?',j.source_id);processed+=await processJob(ctx,j,s,policy,Math.min(6,budget-processed));if(processed>=budget)break;}
 if(policy.publish)await sendDelivery(ctx);
 for(const prev of await rows(db,'SELECT id,object_key FROM auto_previews WHERE expires<? LIMIT 3',at)){await ctx.env.BUCKET.delete(prev.object_key);await run(db,'DELETE FROM auto_previews WHERE id=?',prev.id);}
 return {checkedAt:at,processed};
}
export async function automationApi(ctx,parts){
 const [area,key,action]=parts,method=ctx.req.method,ok=data=>json({ok:true,...data});
 if(area==='push')return push(ctx,parts.slice(1));
 if(area==='health'&&method==='GET')return ok({lastTick:(await row(ctx.db,'SELECT last_at FROM auto_clock WHERE name=?','tick:'+ctx.scope))?.last_at||null});
 if(area==='tick'&&method==='POST'&&!key&&!ctx.demo){
  assertSameOrigin(ctx);
  const privateSite=ctx.env.IMPORT_PRIVATE_SITE_DISPATCH==='1' && ctx.env.SITES_CHATGPT_SIGNIN==='1' && ctx.url.origin===ctx.env.IMPORT_PUBLIC_ORIGIN;
  if(ctx.user?.role!=='admin' && !privateSite){
   const secret=ctx.env.IMPORT_TICK_SECRET, bearer=ctx.req.headers.get('authorization')||'';
   if(!secret || !bearer.startsWith('Bearer ') || await digest(bearer.slice(7))!==await digest(secret)) forbidden();
  }
  return ok(await (ctx.wakeAutomation ? ctx.wakeAutomation() : automationTick(ctx)));
 }
 const user=requireUser(ctx);
 if(area==='job'&&key&&method==='GET'){
  const job=await row(ctx.db,'SELECT id,state,cursor,total,errors,report FROM auto_jobs WHERE id=? AND scope=? AND owner_id=?',key,ctx.scope,user.id);if(!job)missing();
  return ok({job,events:await rows(ctx.db,'SELECT line,external_id,result,detail,listing_id FROM auto_events WHERE job_id=? ORDER BY line LIMIT 1000',key)});
 }
 if(method!=='POST')missing();assertSameOrigin(ctx);await rate(ctx,'automation-write',150,600);
 if(area==='admin'){requireAdmin(ctx);const b=await input(ctx);
  if(key==='policy'){await run(ctx.db,'INSERT INTO auto_policy(scope,imports,publish,sync,paused) VALUES(?,?,?,?,?) ON CONFLICT(scope) DO UPDATE SET imports=excluded.imports,publish=excluded.publish,sync=excluded.sync,paused=excluded.paused',ctx.scope,+truth(b.imports),+truth(b.publish),+truth(b.sync),+truth(b.paused));return ok({});}
  if(key==='suspend'){if(!await row(ctx.db,'SELECT 1 FROM users WHERE id=? AND scope=?',b.owner_id,ctx.scope))missing();const flag=+truth(b.enabled);await ctx.db.batch([stmt(ctx.db,'INSERT INTO auto_clients VALUES(?,?,?) ON CONFLICT(scope,owner_id) DO UPDATE SET enabled=excluded.enabled',ctx.scope,b.owner_id,flag),stmt(ctx.db,'UPDATE auto_sources SET enabled=? WHERE owner_id=? AND scope=?',flag,b.owner_id,ctx.scope)]);return ok({});}
  missing();
 }
 if(area==='sources'&&!key)return ok(await register(ctx,await input(ctx)));
 if(area==='channels'&&!key)return ok(await changeChannel(ctx,await input(ctx)));
 if(area!=='source')missing();const s=await source(ctx,key);
 if(action==='preview')return ok(await preview(ctx,s));
 const b=await input(ctx);
 if(action==='run')return ok(await start(ctx,s,b));
 if(action==='rotate'&&s.kind==='push'){const token=random();await run(ctx.db,'UPDATE auto_sources SET push_hash=? WHERE id=?',await digest(token),s.id);return ok({token});}
 if(action==='connection'){
   if(!s.url||!truth(b.rights))invalid();const url=normalizeImportUrl(b.url),origin=new URL(url).origin;
   const secret=await sealIntegrationSecret(ctx.env,user.id,s.id,b.token||''),encoded=await sealIntegrationSecret(ctx.env,user.id,s.id+':url',url);
   await run(ctx.db,'UPDATE auto_sources SET url=?,credential=?,token_origin=?,consent_at=? WHERE id=?',encoded,secret,origin,now(),s.id);return ok({});
 }
 if(action==='enabled'){
   const enabled=+truth(b.enabled);
   if(enabled)await allowImport(ctx);
   await run(ctx.db,'UPDATE auto_sources SET enabled=? WHERE id=? AND owner_id=?',enabled,s.id,user.id);return ok({});
 }
 if(action==='settings'){
  const hours=Number(b.interval||0);if(!periods.has(hours)||hours&&!s.url)invalid();
  await run(ctx.db,'UPDATE auto_sources SET interval_hours=?,autopublish=?,next_at=CASE WHEN ?>0 THEN coalesce(next_at,?) END WHERE id=?',hours,+truth(b.autopublish),hours,now(),s.id);return ok({});
 }
 missing();
}
