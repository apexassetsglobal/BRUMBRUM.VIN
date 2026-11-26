import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {AppError, digest} from '../src/core.js';
import {translator} from '../src/i18n.js';
import {discover, getFirm, serviceApi, serviceMedia, serviceSitemap} from '../src/services.js';
import {servicePage} from '../src/views-services.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const stamp=()=>new Date().toISOString();
const actors={};
let directory,server,base,sqlite;
let serverLog='';

before(async()=>{
  directory=await mkdtemp(join(root,'var-test-services-'));
  server=spawn(process.execPath,['server.mjs'],{
    cwd:root,env:{...process.env,DATA_DIR:directory,PORT:'0',HOST:'127.0.0.1',
      APP_MODE:'development',APP_ORIGIN:'',PUBLIC_INDEXING:'1',MAIL_API_KEY:'',MAIL_FROM:'',SERVICES_AI_TOKEN:''},
    stdio:['ignore','pipe','pipe']
  });
  server.stderr.on('data',chunk=>{serverLog+=chunk;});
  const line=await Promise.race([
    once(server.stdout,'data').then(([buffer])=>String(buffer)),
    once(server,'exit').then(([code])=>{throw new Error('Server exited '+code+' '+serverLog);})
  ]);
  base=new URL(line.match(/http:\/\/[^\s]+/)[0]).origin;
  sqlite=new DatabaseSync(join(directory,'all4auto.sqlite'));
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  for(const [key,role,verified] of [['owner','user',true],['other','user',true],['customer','user',true],['staff','moderator',true],['unverified','user',false]]){
    const user={id:randomUUID(),name:'QA '+key,role,verified_at:verified?stamp():null};
    sqlite.prepare('INSERT INTO users(id,scope,email,name,role,profile_type,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(user.id,'live',key+'@example.test',user.name,role,'private',user.verified_at,stamp());
    const token=randomBytes(32).toString('hex');
    sqlite.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)')
      .run(await digest(token),user.id,new Date(Date.now()+3600000).toISOString());
    actors[key]={user,cookie:'a4_session='+token};
  }
});
after(async()=>{
  sqlite?.close();
  if(server&&server.exitCode===null&&server.signalCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  if(directory)await rm(directory,{recursive:true,force:true});
});

function firmInfo(name,overrides={}){
  return {name,description:'Opis stanowiska testowego do weryfikacji lokalnego katalogu.',language:'pl',
    categories:['detailing','diagnostyka'],country:'PL',city:'Warszawa',region:'Mazowieckie',
    address:'Ulica Testowa QA 18',lat:'52.2305',lon:'21.0110',mobile:true,
    prices:'Przegląd QA · 100 PLN',hours:'Pn–Pt 09:00–17:00',brands:['BMW','Toyota'],phone:'+1 202 555 0142',
    whatsapp:'+12025550142',email:'kontakt@example.test',website:'https://garage.example.test/services',
    contactConsent:true,translation_en:'A QA-only service description for the temporary database.',...overrides};
}
function firmRow(key){
  return sqlite.prepare('SELECT * FROM service_firms WHERE id=?').get(key);
}

// This exercises core invariants even when a platform adapter fails to route the HTTP request.
function directContext(actor,path,data){
  const url=new URL(path,base);
  const req=new Request(url,data?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
  const prepare=(sql,values=[])=>({
    bind:(...params)=>prepare(sql,params),
    first:async()=>sqlite.prepare(sql).get(...values)??null,
    all:async()=>({results:sqlite.prepare(sql).all(...values)}),
    run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}})
  });
  const db={prepare,async batch(statements){
    sqlite.exec('BEGIN IMMEDIATE');
    try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  return {url,req,db,path:url.pathname,origin:base,prefix:'',scope:'live',lang:'pl',t:translator('pl'),
    env:{},demo:false,ip:'127.0.0.1',user:actors[actor]?.user||null};
}
test('service functions apply moderation, ownership, geographic filters and preserve indexable public URLs',async()=>{
  const post=async(actor,path,data)=>(await serviceApi(directContext(actor,'/api/services/'+path,data),path.split('/'))).json();
  const find=async(query)=>discover(directContext(null,'/uslugi'),new URLSearchParams(query));
  const expectFailure=(code)=>error=>error instanceof AppError&&error.status===code;
  const name='QA Direct isolated';const {id}=await post('owner','create',{key:randomUUID(),name});
  const info=firmInfo(name);
  await post('owner',id+'/save',{...info,revision:0,intent:'submit'});
  assert.equal((await find({})).total,0);
  await assert.rejects(()=>post('other',id+'/save',{...info,revision:1}),expectFailure(403));
  await assert.rejects(()=>post('owner','moderate',{type:'firm',id,action:'approve'}),expectFailure(403));
  await post('staff','moderate',{type:'firm',id,action:'approve'});
  const record=await getFirm(directContext(null,'/uslugi'),id);
  assert.equal(record.status,'published');
  const otherScope={...directContext(null,'/uslugi'),scope:'demo:test-scope'};
  await assert.rejects(()=>getFirm(otherScope,id),expectFailure(404));
  const nearby=await find({country:'PL',lat:'52.23',lon:'21.01',radius:'5',brand:'BMW'});
  assert.equal(nearby.total,1);
  assert.ok(nearby.items[0].km<1);
  assert.equal((await find({country:'DE'})).total,0);
  const page=await servicePage(directContext(null,'/uslugi/firma/'+record.slug));
  assert.equal(page.structured.name,name);
  assert.equal(page.structured.address.addressCountry,'PL');
  assert.match(page.body,/tel:\+12025550142/);
  assert.ok((await serviceSitemap(directContext(null,'/uslugi'))).includes('/uslugi/detailing/warszawa'));
  await post('owner',id+'/delete',{revision:firmRow(id).revision});
  await assert.rejects(()=>getFirm(directContext(null,'/uslugi'),id),expectFailure(404));
  assert.equal((await find({})).total,0);
});

test('service moderation records duplicate and spam reports and verifies reviews before publishing a rating',async()=>{
  const post=async(actor,path,data)=>(await serviceApi(directContext(actor,'/api/services/'+path,data),path.split('/'))).json();
  const denied=status=>error=>error instanceof AppError&&error.status===status;
  const info=firmInfo('QA Direct review sample');
  const first=(await post('owner','create',{key:randomUUID(),name:info.name})).id;
  const duplicate=(await post('other','create',{key:randomUUID(),name:info.name})).id;
  const spam=(await post('other','create',{key:randomUUID(),name:'QA Direct suspicious'})).id;
  for(const [actor,key,fields] of [['owner',first,info],['other',duplicate,info],['other',spam,{...info,name:'QA Direct suspicious',description:'S'.repeat(40)}]]){
    await post(actor,key+'/save',{...fields,revision:0,intent:'submit'});
  }
  assert.equal(firmRow(duplicate).reason,'duplicate');
  assert.equal(firmRow(spam).reason,'spam');
  assert.equal((await discover(directContext(null,'/uslugi'),new URLSearchParams())).total,0);
  const decide=(type,id,action,reason='')=>post('staff','moderate',{type,id,action,reason});
  await decide('firm',duplicate,'reject','Powtórzony rekord testowy.');
  await decide('firm',spam,'reject','Materiał testowy oznaczony jako spam.');
  await decide('firm',first,'approve');
  const text='Opinia testowa przekazana do moderacji.';
  await assert.rejects(()=>post('owner',first+'/review',{stars:5,content:text}),denied(403));
  await assert.rejects(()=>post('unverified',first+'/review',{stars:5,content:text}),denied(403));
  await post('customer',first+'/review',{stars:5,content:text});
  await assert.rejects(()=>post('customer',first+'/review',{stars:1,content:text}),denied(409));
  const review=sqlite.prepare('SELECT id FROM service_reviews WHERE firm_id=?').get(first).id;
  const path='/uslugi/firma/'+firmRow(first).slug;
  assert.ok(!(await servicePage(directContext(null,path))).body.includes(text));
  await decide('review',review,'approve');
  const reply='Testowa odpowiedź właściciela.';
  await assert.rejects(()=>post('other',first+'/reply',{review,reply}),denied(403));
  await post('owner',first+'/reply',{review,reply});
  assert.ok(!(await servicePage(directContext(null,path))).body.includes(reply));
  await decide('reply',review,'approve');
  const page=await servicePage(directContext(null,path));
  assert.ok(page.body.includes(reply));
  assert.equal(page.structured.aggregateRating.ratingValue,5);
  const customerId=actors.customer.user.id;
  sqlite.prepare('UPDATE users SET deleted_at=? WHERE id=?').run(stamp(),customerId);
  try{
    assert.equal((await servicePage(directContext(null,path))).structured.aggregateRating,undefined);
    assert.equal((await discover(directContext(null,'/uslugi'),new URLSearchParams({rating:5}))).total,0);
  }finally{sqlite.prepare('UPDATE users SET deleted_at=NULL WHERE id=?').run(customerId);}
  await post('customer',first+'/report',{review,reason:'Do sprawdzenia podczas testów QA.'});
  const report=sqlite.prepare('SELECT id FROM service_reports WHERE review_id=?').get(review).id;
  await decide('report',report,'approve');
  assert.equal(sqlite.prepare('SELECT state FROM service_reports WHERE id=?').get(report).state,'closed');
  for(const [key,owner] of [[first,'owner'],[duplicate,'other'],[spam,'other']])await post(owner,key+'/delete',{revision:firmRow(key).revision});
});

test('service gallery sanitizes uploads, protects draft assets and renders only complete before/after pairs',async()=>{
  const objects=new Map();
  const bucket={
    async put(key,bytes,{httpMetadata}){objects.set(key,{body:bytes,httpMetadata});},
    async get(key){return objects.get(key)||null;},
    async delete(key){objects.delete(key);}
  };
  function context(actor,path,data){const ctx=directContext(actor,path,data);ctx.env.BUCKET=bucket;return ctx;}
  const post=async(actor,path,data)=>(await serviceApi(context(actor,'/api/services/'+path,data),path.split('/'))).json();
  const info=firmInfo('QA Direct paired photos');
  const {id}=await post('owner','create',{key:randomUUID(),name:info.name});
  const photo=await readFile(join(root,'public/assets/vehicle-1.webp'));
  const upload=async(kind,pair,bytes=photo)=>{
    const ctx=context('owner','/api/services/'+id+'/media?'+new URLSearchParams({kind,pair}));
    ctx.req=new Request(ctx.url,{method:'POST',headers:{Origin:base,'Content-Type':'image/webp'},body:bytes});
    return (await serviceApi(ctx,[id,'media'])).json();
  };
  const noAccess=error=>error instanceof AppError&&error.status===404;
  const read=(actor,asset)=>serviceMedia(context(actor,'/uslugi-media/'+asset),asset);
  await assert.rejects(()=>upload('before','QA Pair',Buffer.from('not an image')),error=>error instanceof AppError&&error.status===422);
  const left=await upload('before','QA Pair'),lonely=await upload('after','Separate QA pair'),right=await upload('after','QA Pair');
  assert.equal(objects.size,3);
  await assert.rejects(()=>read(null,left.id),noAccess);
  await assert.rejects(()=>read('other',right.id),noAccess);
  assert.equal((await read('owner',left.id)).headers.get('Content-Type'),'image/webp');
  const moderatorPreview=await read('staff',right.id);
  assert.match(moderatorPreview.headers.get('Cache-Control'),/no-store/);
  await post('owner',id+'/save',{...info,revision:firmRow(id).revision,intent:'submit'});
  await post('staff','moderate',{id,type:'firm',action:'approve'});
  const page=await servicePage(context(null,'/uslugi/firma/'+firmRow(id).slug));
  assert.ok(page.body.includes('QA Pair')&&page.body.includes(left.id)&&page.body.includes(right.id));
  assert.ok(!page.body.includes(lonely.id));
  assert.ok((await (await read(null,right.id)).arrayBuffer()).byteLength>100);
  await post('owner',id+'/delete-media',{revision:firmRow(id).revision,media:right.id});
  assert.equal(firmRow(id).status,'draft');
  assert.equal(objects.size,2);
  await assert.rejects(()=>read(null,left.id),noAccess);
  await post('owner',id+'/delete',{revision:firmRow(id).revision});
  assert.equal(objects.size,0);
});

async function http(actor,path,{method='GET',data,bytes,code=200,origin=base}={}){
  const headers={};
  if(actor)headers.Cookie=actors[actor].cookie;
  const options={method,headers,redirect:'manual'};
  if(method!=='GET')headers.Origin=origin;
  if(data!==undefined){headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
  if(bytes!==undefined){headers['Content-Type']='image/webp';options.body=bytes;}
  const response=await fetch(new URL(path,base),options);
  const type=response.headers.get('content-type')||'';
  const body=type.startsWith('application/json')?await response.json():type.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.text();
  assert.equal(response.status,code,method+' '+path+' '+(typeof body==='string'?body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(-270):JSON.stringify(body).slice(0,250)));
  return {body,headers:response.headers};
}
const post=async(actor,path,data,code=200)=>(await http(actor,'/api/services/'+path,{method:'POST',data,code})).body;
const view=async(path,actor=null,code=200)=>(await http(actor,path,{code})).body;
const newFirm=async(actor,name)=>{
  const key=randomUUID(),first=await post(actor,'create',{key,name}),retry=await post(actor,'create',{key,name});
  assert.equal(retry.id,first.id);
  return first.id;
};
const save=(actor,id,info,intent='submit',revision=firmRow(id).revision,code=200)=>
  post(actor,id+'/save',{...info,revision,intent},code);
const decide=(type,id,action,reason='')=>post('staff','moderate',{type,id,action,reason});
const profile=id=>'/uslugi/firma/'+firmRow(id).slug;
const mediaURL=id=>'/uslugi-media/'+id;
const parseSchema=html=>{
  const match=html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match,'Public profile must publish JSON-LD in the rendered HTML.');
  return JSON.parse(match[1]);
};
function contains(html,phrase,should=true){assert.equal(html.includes(phrase),should,phrase);}

test('real HTTP service lifecycle, international search, contacts, galleries, moderation, ratings and removal',async t=>{
  const a=firmInfo('QA Atlas detailing');
  const b=firmInfo('QA Baltic mobile',{city:'Marki',lat:'52.3210',lon:'21.1080',address:'Drugi adres QA 2',
    categories:['warsztaty'],mobile:false,brands:['Volvo']});
  const c=firmInfo('QA Deutsches Atelier',{country:'DE',region:'Berlin',city:'Berlin',address:'Nur Testallee 3',
    lat:'52.521',lon:'13.404',categories:['wulkanizacja'],brands:['BMW'],mobile:true});
  const photo=await readFile(join(root,'public/assets/vehicle-1.webp'));
  let atlas,baltic,foreign,before,after,cover,review;
  const upload=async(id,kind,actor='owner',pair='',code=200)=>
    (await http(actor,'/api/services/'+id+'/media?'+new URLSearchParams({kind,pair}),{method:'POST',bytes:photo,code})).body;

  await t.test('sessions and two independent businesses for one owner',async()=>{
    await post(null,'create',{key:randomUUID(),name:'QA Anonymous'},401);
    await post('unverified','create',{key:randomUUID(),name:'QA Unverified'},401);
    atlas=await newFirm('owner',a.name);
    baltic=await newFirm('owner',b.name);
    foreign=await newFirm('other',c.name);
    assert.notEqual(atlas,baltic);
    const mine=await view('/moje-uslugi','owner');
    contains(mine,a.name);contains(mine,b.name);contains(mine,c.name,false);
    await view('/moje-uslugi/'+atlas,'other',403);
    await post('other',atlas+'/delete',{revision:0},403);
    await view(profile(atlas),null,404);
    const guest=await http(null,'/moje-uslugi',{code:303});assert.ok(guest.headers.get('location').includes('/zaloguj'));
  });
  if(!atlas||!baltic||!foreign)return;
  await t.test('owner uploads matched before/after and cover, metadata remains private in draft',async()=>{
    await upload(atlas,'before','other','QA para',403);
    await upload(atlas,'before','owner','',422);
    before=(await upload(atlas,'before','owner','QA para')).id;
    after=(await upload(atlas,'after','owner','QA para')).id;
    cover=(await upload(atlas,'cover')).id;
    assert.ok(before&&after&&cover);
    await view(mediaURL(before),null,404);
    await view(mediaURL(before),'other',404);
    const image=await http('owner',mediaURL(before));
    assert.equal(image.headers.get('content-type'),'image/webp');
    assert.ok(image.body.length>0);
    await save('owner',atlas,{...a,contactConsent:false},'submit',firmRow(atlas).revision,422);
    await save('owner',atlas,a,'draft');
    const version=firmRow(atlas).revision;
    await save('owner',atlas,{...a,description:'Zmieniono tylko roboczy opis QA.'},'draft',version);
    await save('owner',atlas,a,'submit',version,409);
    await save('other',atlas,a,'submit',firmRow(atlas).revision,403);
  });
  if(!before||!after||!cover)return;
  await t.test('submitted profiles are privately reviewed, rejected with reason, corrected and approved',async()=>{
    await save('owner',atlas,a);await save('owner',baltic,b);await save('other',foreign,c);
    contains(await view('/uslugi'),a.name,false);
    contains(await view('/sitemap.xml'),profile(atlas),false);
    await view('/moderacja-uslug','owner',403);
    await post('owner','moderate',{type:'firm',id:atlas,action:'approve'},403);
    contains(await view('/moderacja-uslug','staff'),a.name);
    const draft=await view('/moderacja-uslug/'+atlas,'staff');
    contains(draft,a.description);contains(draft,mediaURL(before));contains(draft,mediaURL(after));
    await post('staff','moderate',{type:'firm',id:atlas,action:'reject'},422);
    await decide('firm',atlas,'reject','Testowe uzasadnienie korekty.');
    contains(await view('/moje-uslugi','owner'),'Testowe uzasadnienie korekty.');
    await view(profile(atlas),null,404);
    await save('owner',atlas,a);
    for(const id of [atlas,baltic,foreign])await decide('firm',id,'approve');
    assert.equal(firmRow(atlas).status,'published');
  });
  if([atlas,baltic,foreign].some(id=>firmRow(id).status!=='published'))return;
  await t.test('published contacts, paired images, canonical, local structured data and real city sitemap',async()=>{
    const page=await view(profile(atlas));
    for(const content of ['href="tel:+12025550142"','href="mailto:kontakt@example.test"','href="https://wa.me/12025550142"',
      'maps/dir/?api=1&amp;destination=52.2305,21.011','href="https://garage.example.test/services"','href="#oferta"',
      'QA para',mediaURL(before),mediaURL(after),mediaURL(cover),a.prices,a.hours])contains(page,content);
    const schema=parseSchema(page);
    assert.ok(['LocalBusiness','AutomotiveBusiness','AutoRepair'].includes(schema['@type']));
    assert.equal(schema.name,a.name);assert.equal(schema.address.addressCountry,'PL');assert.equal(schema.geo.latitude,52.2305);
    assert.equal(schema.url,base+profile(atlas));assert.ok(schema.image.endsWith(mediaURL(cover)));
    contains(page,'rel="canonical" href="'+base+profile(atlas)+'"');
    const alias=await fetch(new URL('/uslugi/firma/'+atlas,base),{redirect:'manual'});
    if(alias.status===301||alias.status===308)assert.equal(new URL(alias.headers.get('location'),base).pathname,profile(atlas));
    else{assert.equal(alias.status,200);contains(await alias.text(),'rel="canonical" href="'+base+profile(atlas)+'"');}
    contains(page,'content="index, follow"');
    contains(await view(profile(atlas)+'?lang=en'),a.translation_en);
    const city=await view('/uslugi/detailing/warszawa');contains(city,a.name);contains(city,'Warszawa');
    contains(city,'<meta name="description"');contains(city,'content="index, follow"');
    await view('/uslugi/detailing/nieistniejace-miasto-qa',null,404);
    await view('/uslugi/nieistniejaca-kategoria',null,404);
    const map=await view('/sitemap.xml');
    for(const segment of [profile(atlas),'/uslugi/detailing/warszawa','/uslugi/warsztaty/marki','/uslugi/wulkanizacja/berlin'])contains(map,segment);
    contains(map,'nieistniejace-miasto-qa',false);
    contains(await view('/'),'href="/uslugi"');
    contains(await view('/demo/uslugi'),a.name,false);
    assert.equal((await http(null,mediaURL(after))).headers.get('content-type'),'image/webp');
  });
  await t.test('international filters, distance from coordinates and map marker link respect the same scope',async()=>{
    const de=await view('/uslugi?country=DE&brand=BMW');
    contains(de,c.name);contains(de,a.name,false);contains(de,b.name,false);
    const narrowed=await view('/uslugi?country=PL&region=Mazowieckie&city=Warszawa&category=detailing&brand=Toyota&mobile=on');
    contains(narrowed,a.name);contains(narrowed,b.name,false);contains(narrowed,c.name,false);
    assert.match(narrowed,/<input[^>]*name="mobile"[^>]* checked/,'Submitted checkbox remains checked.');
    const near=await view('/uslugi?lat=52.23&lon=21.01&radius=5');
    contains(near,a.name);contains(near,b.name,false);contains(near,c.name,false);
    const far=await view('/uslugi?lat=52.23&lon=21.01&radius=25');
    contains(far,a.name);contains(far,b.name);contains(far,c.name,false);
    await view('/uslugi?radius=5',null,422);
    await view('/uslugi?lat=52.23&lon=21.01&radius=7',null,422);
    const map=await view('/uslugi?view=map&country=DE');
    contains(map,'data-service-markers=');contains(map,c.name);contains(map,profile(foreign));contains(map,a.name,false);
  });
  await t.test('verified customer review, owner response, reports, publication of ratings and anti-duplicate checks',async()=>{
    const reviewText='Przykładowa opinia klienta tylko na potrzebę tego testu.';
    const reply='Odpowiedź właściciela na testową opinię.';
    await post('owner',atlas+'/review',{stars:5,content:reviewText},403);
    await post('unverified',atlas+'/review',{stars:5,content:reviewText},401);
    await post('customer',atlas+'/review',{stars:6,content:reviewText},422);
    await post('customer',atlas+'/review',{stars:4,content:reviewText});
    await post('customer',atlas+'/review',{stars:5,content:reviewText},409);
    review=sqlite.prepare('SELECT id FROM service_reviews WHERE firm_id=?').get(atlas).id;
    contains(await view(profile(atlas)),reviewText,false);
    contains(await view('/uslugi?rating=4'),a.name,false);
    await decide('review',review,'approve');
    contains(await view(profile(atlas)),reviewText);
    contains(await view('/uslugi?rating=4'),a.name);contains(await view('/uslugi?rating=5'),a.name,false);
    const aggregate=parseSchema(await view(profile(atlas))).aggregateRating;
    assert.equal(aggregate.ratingValue,4);assert.equal(aggregate.reviewCount,1);
    await post('other',atlas+'/reply',{review,reply},403);
    await post('owner',atlas+'/reply',{review,reply});
    contains(await view(profile(atlas)),reply,false);
    await decide('reply',review,'approve');contains(await view(profile(atlas)),reply);
    await post('customer',atlas+'/report',{review,reason:'Zgłoszenie do weryfikacji w teście QA.'});
    const report=sqlite.prepare('SELECT id FROM service_reports WHERE review_id=?').get(review).id;
    contains(await view('/moderacja-uslug','staff'),'Zgłoszenie do weryfikacji w teście QA.');
    await decide('report',report,'approve');
    assert.equal(sqlite.prepare('SELECT state FROM service_reports WHERE id=?').get(report).state,'closed');
  });
  await t.test('public edit requires another review and stale or other-owner deletion cannot erase the record',async()=>{
    const newer={...a,name:'QA Atlas po aktualizacji'};
    const oldVersion=firmRow(atlas).revision;
    await save('owner',atlas,newer);
    await view(profile(atlas),null,404);await view(mediaURL(before),null,404);
    contains(await view('/sitemap.xml'),profile(atlas),false);
    await decide('firm',atlas,'approve');contains(await view(profile(atlas)),newer.name);
    await post('owner',atlas+'/delete',{revision:oldVersion},409);
    await post('other',atlas+'/delete',{revision:firmRow(atlas).revision},403);
    await post('owner',atlas+'/delete',{revision:firmRow(atlas).revision});
    await view(profile(atlas),null,404);await view(mediaURL(before),null,404);
    contains(await view('/uslugi'),newer.name,false);contains(await view('/sitemap.xml'),'/uslugi/detailing/warszawa',false);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM service_media WHERE firm_id=?').get(atlas).n,0);
    contains(await view(profile(baltic)),b.name);contains(await view(profile(foreign)),c.name);
  });
});

