import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const password='robot-pages-integration-tests-only';
const ownerEmail='robot-pages-owner@example.test';
const ownerToken='robot-pages-owner-'+crypto.randomUUID();
const robotData={type:'robot',market:'robotics',robotCategory:'humanoidalne',tradeMode:'both',
  make:'Próba Robotów',model:'Integrator-1',year:2025,condition:'new',damage:'no',price:15000.99,currency:'EUR',
  rentalPrice:450.75,rentalUnit:'day',deposit:1500,stock:3,leadTime:0,minimumRental:1,
  city:'Warszawa',country:'Polska',region:'Mazowieckie',specs:'Udźwig 12 kg. ROS 2.',
  description:'Robot do testu integracji ogłoszeń, zakupu oraz najmu.',contact:'message'};
const carData={type:'car',make:'Toyota',model:'Corolla',year:2021,condition:'used',mileage:54000,
  body:'wagon',fuel:'hybrid',gearbox:'auto',drive:'fwd',power:122,damage:'no',city:'Warszawa',region:'Mazowieckie',
  price:68400,description:'Testowy pojazd pozostaje w dziale motoryzacji.',contact:'message'};
const futureDay=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
let service,base,directory,seller,buyer,stranger,moderator,robotId,robotSlug,carId,carSlug,purchaseId,rentalId;
const serverErrors=[];

function browser() {
  const jar=new Map();
  return {
    async go(path,{method='GET',data,bytes,headers={},code=200}={}) {
      const opts={method,headers:{...headers},redirect:'manual'};
      const cookie=[...jar.entries()].map(([key,value])=>key+'='+value).join('; ');
      if(cookie)opts.headers.Cookie=cookie;
      if(method!=='GET')opts.headers.Origin??=base;
      if(data!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data);}
      if(bytes!==undefined){opts.headers['Content-Type']='application/octet-stream';opts.body=bytes;}
      const response=await fetch(base+path,opts);
      for(const entry of response.headers.getSetCookie()) {
        const [key,value]=entry.split(';',1)[0].split('=');
        if(value)jar.set(key,value);else jar.delete(key);
      }
      const buffer=Buffer.from(await response.arrayBuffer());
      const type=response.headers.get('content-type')||'';
      const result=/application\/(?:manifest\+)?json/.test(type)?JSON.parse(buffer.toString()):/^(image|video)\//.test(type)?buffer:buffer.toString();
      assert.equal(response.status,code,path+' · '+(typeof result==='string'?result.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(-500):JSON.stringify(result).slice(0,500)));
      return {result,headers:response.headers};
    },
    async api(path,data,code=200,method='POST',prefix='') {return (await this.go(prefix+'/api'+path,{method,data,code})).result;}
  };
}
async function start() {
  service=spawn(process.execPath,['server.mjs'],{env:{...process.env,APP_MODE:'development',APP_ORIGIN:'',MAIL_API_KEY:'',MAIL_FROM:'',
    PORT:'0',HOST:'127.0.0.1',DATA_DIR:directory,OWNER_EMAIL:ownerEmail,OWNER_SETUP_TOKEN:ownerToken,PUBLIC_INDEXING:'1'},
    stdio:['ignore','pipe','pipe']});
  service.stderr.on('data',chunk=>serverErrors.push(String(chunk)));
  const [line]=await Promise.race([once(service.stdout,'data'),once(service,'exit').then(([code])=>{throw new Error('Server exited: '+code+' '+serverErrors.join(''));})]);
  base=String(line).trim().split(' · ')[1];
}
async function stop() {if(service?.exitCode==null){service.kill();await once(service,'exit');}}
async function signup(email) {
  const client=browser();
  await client.api('/auth/register',{email,password,name:email.split('@')[0],profile_type:'private',terms:true});
  const mail=(await readFile(join(directory,'mailbox.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)).findLast(entry=>entry.to===email);
  assert.ok(mail,'mail is captured only in the isolated local fixture');
  await client.api('/auth/verify',{token:new URL(mail.url).searchParams.get('token'),password});
  await client.api('/auth/login',{email,password});
  return client;
}
function inspect(sql,...args) {
  const db=new DatabaseSync(join(directory,'all4auto.sqlite'),{readOnly:true});
  try{return db.prepare(sql).get(...args);}finally{db.close();}
}
async function save(client,key,data,version=0,prefix='') {
  return client.api('/listings/'+key+'/edit',{version,data,step:4},200,'PUT',prefix);
}
async function upload(client,key,version,prefix='') {
  return (await client.go(prefix+'/api/listings/'+key+'/photo',{method:'POST',headers:{'X-Edit-Version':String(version)},
    bytes:await readFile('public/assets/vehicle-1.webp')})).result;
}
async function approve(key,client=moderator,prefix='') {
  const record=inspect('SELECT revision FROM listings WHERE id=?',key);
  await client.api('/moderation/'+key,{action:'published',revision:record.revision},200,'POST',prefix);
}

before(async()=>{
  directory=await mkdtemp(resolve('var-robot-pages-test-'));
  await start();
  seller=await signup('robot-pages-seller@example.test');
  buyer=await signup('robot-pages-buyer@example.test');
  stranger=await signup('robot-pages-stranger@example.test');
  moderator=await signup(ownerEmail);
  await moderator.api('/auth/owner',{token:ownerToken});
});
after(async()=>{await stop();if(directory)await rm(directory,{recursive:true,force:true});});

test('main site advertises Robot Zone and both sites expose real project destinations',async()=>{
  const client=browser();
  const main=(await client.go('/')).result;
  assert.match(main,/<a[^>]+class="robot-entry-banner"[^>]+href="\/roboty"/);
  assert.match(main,/Przejdź do Strefy Robotów/);
  for(const path of ['/','/roboty']) {
    const html=(await client.go(path)).result;
    const family=html.match(/<div class="project-family">([\s\S]+?)<\/div><\/div>/)?.[1];
    assert.ok(family,'project navigation exists on '+path);
    assert.match(family,/Nasze projekty/);
    assert.match(family,/href="https:\/\/all4rent\.app"[^>]*>ALL4RENT/);
    assert.match(family,/href="\/"[^>]*>BRUMBRUM\.VIN/);
    assert.match(family,/href="\/roboty"[^>]*>Roboty i automatyka/);
  }
});

test('robot homepage renders all categories, navigation and labeled examples without real listings',async()=>{
  const html=(await browser().go('/roboty')).result;
  assert.match(html,/data-market="robotics"/);
  assert.match(html,/<body[^>]+class="robot-app /);
  const categories=[...html.matchAll(/<a class="robot-category-card(?: [^"]*)?" href="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(categories.length,12);
  assert.equal(new Set(categories).size,12);
  assert.ok(categories.slice(0,-1).every(path=>path.startsWith('/roboty/szukaj?category=')));
  assert.equal(categories.at(-1),'/roboty/szukaj','the final tile opens every robot category');
  const demoHome=(await browser().go('/demo/roboty')).result;
  assert.match(demoHome,/<a class="robot-category-card robot-category-all" href="\/demo\/roboty\/szukaj"/);
  for(const path of ['/roboty/szukaj','/roboty/ulubione','/roboty/zamowienia','/roboty/asystent','/roboty/konto','/roboty/sprzedaj']) {
    assert.ok(html.includes('href="'+path+'"'),path);
  }
  assert.match(html,/0 prawdziwych ogłoszeń/);
  assert.equal([...html.matchAll(/data-robot-demo="/g)].length,8);
  assert.doesNotMatch(html,/<article class="robot-offer-card"/);
  assert.doesNotMatch(html,/przyklad-\d+/);
  assert.match(html,/<meta name="theme-color" content="#ffffff"/);
  const search=(await browser().go('/roboty/szukaj?category=humanoidalne')).result;
  assert.match(search,/data-market="robotics"/);
  assert.equal([...search.matchAll(/data-robot-demo="/g)].length,2);
  assert.doesNotMatch(search,/<article class="robot-offer-card"/);
});

test('protected robot pages retain their destination through the shared sign-in flow',async()=>{
  const client=browser();
  for(const path of ['/roboty/sprzedaj','/roboty/zamowienia?widok=rentals','/roboty/konto']) {
    const response=await client.go(path,{code:303});
    const target=new URL(response.headers.get('location'),base);
    assert.equal(target.pathname,'/roboty/zaloguj');
    assert.equal(target.searchParams.get('dalej'),path);
    const login=(await client.go(target.pathname+target.search)).result;
    assert.match(login,/data-api="\/auth\/login"/);
    assert.match(login,/data-market="robotics"/);
  }
  await client.go('/api/robot-orders',{code:401});
  await client.api('/robot-orders',{listingId:'unavailable',key:crypto.randomUUID(),kind:'purchase'},401);
});

test('seller can create, edit, preview and publish a robot using the existing account and moderation',async()=>{
  const entry=(await seller.go('/roboty/sprzedaj')).result;
  assert.match(entry,/name="market" value="robotics"/);
  const draft=await seller.api('/listings',{key:crypto.randomUUID(),market:'robotics'});
  robotId=draft.id;
  assert.equal(draft.next,'/roboty/sprzedaj/'+robotId);
  const wizard=(await seller.go(draft.next)).result;
  for(const name of ['robotCategory','tradeMode','rentalPrice','rentalUnit','stock','specs']) assert.ok(wizard.includes('name="'+name+'"'),name);
  for(const name of ['vin','mileage','engine']) assert.ok(!wizard.includes('name="'+name+'"'),name);
  await buyer.go('/roboty/sprzedaj/'+robotId,{code:403});
  let state=await save(seller,robotId,robotData);
  state=await upload(seller,robotId,state.version);
  const preview=(await seller.go('/roboty/podglad/'+robotId)).result;
  assert.match(preview,/Próba Robotów Integrator-1/);
  assert.match(preview,/Podgląd przed publikacją/);
  assert.match(preview,new RegExp('data-api="/listings/'+robotId+'/submit"'));
  assert.ok(!preview.includes('data-api="/robot-orders"'));
  const submitted=await seller.api('/listings/'+robotId+'/submit',{version:state.version});
  assert.equal(submitted.status,'pending');robotSlug=submitted.slug;
  await browser().go('/roboty/oferta/'+robotSlug,{code:404});
  const review=(await moderator.go('/moderacja/'+robotId)).result;
  assert.match(review,/Widok moderatora/);
  assert.match(review,/data-market="robotics"/);
  await approve(robotId);
  const published=(await buyer.go('/roboty/oferta/'+robotSlug)).result;
  assert.match(published,/data-dialog="robot-purchase"/);
  assert.match(published,/data-dialog="robot-rental"/);
  assert.match(published,/name="listingId" value="/);
  assert.match(published,/Na tym etapie nie pobieramy płatności/);
  const old=await browser().go('/oferta/'+robotId,{code:303});
  assert.equal(old.headers.get('location'),'/roboty/oferta/'+robotSlug);
  const owner=(await seller.go('/roboty/oferta/'+robotSlug)).result;
  assert.doesNotMatch(owner,/data-dialog="robot-purchase"/);
});

test('vehicle and robot search, saved pages and direct offer links remain scoped to their market',async()=>{
  const draft=await seller.api('/listings',{key:crypto.randomUUID()});carId=draft.id;
  let state=await save(seller,carId,carData);state=await upload(seller,carId,state.version);
  const submitted=await seller.api('/listings/'+carId+'/submit',{version:state.version});
  if(submitted.status==='pending')await approve(carId);
  carSlug=submitted.slug;
  const robotSearch=(await buyer.go('/roboty/szukaj')).result;
  assert.match(robotSearch,/Próba Robotów Integrator-1/);
  assert.doesNotMatch(robotSearch,/Toyota Corolla/);
  const vehicleSearch=(await buyer.go('/szukaj')).result;
  assert.match(vehicleSearch,/Toyota Corolla/);
  assert.doesNotMatch(vehicleSearch,/Próba Robotów Integrator-1/);
  const api=(await buyer.go('/roboty/api/search')).result;
  assert.deepEqual(api.offers.map(offer=>offer.id),[robotId]);
  const cross=await buyer.go('/roboty/oferta/'+carSlug,{code:303});
  assert.equal(cross.headers.get('location'),'/oferta/'+carSlug);
  await buyer.api('/favorites',{keys:[robotId,carId],add:true});
  const saved=(await buyer.go('/roboty/ulubione')).result;
  assert.match(saved,/Próba Robotów Integrator-1/);
  assert.doesNotMatch(saved,/Toyota Corolla/);
  const compare=(await buyer.go('/roboty/fragment/compare?keys='+robotId+','+carId)).result;
  assert.match(compare,/Próba Robotów Integrator-1/);
  assert.doesNotMatch(compare,/Toyota Corolla/);
});

test('purchase and rental endpoints create durable requests visible only to their participants',async()=>{
  const purchase=await buyer.api('/robot-orders',{listingId:robotId,key:crypto.randomUUID(),kind:'purchase',quantity:1,price:0.01});
  purchaseId=purchase.id;
  assert.equal(purchase.status,'requested');assert.equal(purchase.order.unit_amount,1500099);
  assert.equal(inspect('SELECT buyer_id,status FROM robot_orders WHERE id=?',purchaseId).status,'requested');
  const rental=await buyer.api('/robot-orders',{listingId:robotId,key:crypto.randomUUID(),kind:'rental',quantity:1,
    startsOn:futureDay(10),endsOn:futureDay(12),note:'Prośba o termin testowy'});
  rentalId=rental.id;
  assert.equal(rental.order.billing_periods,2);
  assert.equal(rental.order.subtotal_amount,90150);
  assert.equal(rental.order.deposit_amount,150000);
  for(const client of [buyer,seller]) {
    const list=(await client.go('/roboty/zamowienia')).result;
    assert.ok(list.includes('/roboty/zamowienia/'+purchaseId));
    assert.ok(list.includes('/roboty/zamowienia/'+rentalId));
    const detail=(await client.go('/roboty/zamowienia/'+rentalId)).result;
    assert.match(detail,/Prośba o termin testowy/);
    assert.match(detail,/Ten status nie oznacza opłacenia zamówienia/);
    assert.ok(detail.includes('href="/roboty/oferta/'+robotSlug+'"'));
  }
  await stranger.go('/roboty/zamowienia/'+purchaseId,{code:404});
  await stranger.go('/api/robot-orders/'+rentalId,{code:404});
  assert.deepEqual((await stranger.go('/api/robot-orders')).result.orders,[]);
  await buyer.api('/robot-orders/'+purchaseId+'/status',{status:'accepted'},403);
  await buyer.go('/api/robot-orders',{method:'POST',headers:{Origin:'https://outside.example'},
    data:{listingId:robotId,key:crypto.randomUUID(),kind:'purchase'},code:403});
  await seller.api('/robot-orders/'+purchaseId+'/status',{status:'accepted'});
  await seller.api('/robot-orders/'+rentalId+'/status',{status:'accepted'});
  assert.equal((await buyer.go('/api/robot-orders/'+purchaseId)).result.order.status,'accepted');
  const sellerRental=(await seller.go('/roboty/zamowienia/'+rentalId)).result;
  assert.ok(!sellerRental.includes('name="status" value="completed"'),'future rental cannot be completed from the UI');
});

test('order notifications link to their real requests in both shared and robot account views',async()=>{
  for(const client of [seller,buyer]) {
    for(const path of ['/powiadomienia','/roboty/powiadomienia']) {
      const html=(await client.go(path)).result;
      assert.ok(html.includes('href="/roboty/zamowienia/'+purchaseId+'"'),path+' links the purchase');
      assert.ok(html.includes('href="/roboty/zamowienia/'+rentalId+'"'),path+' links the rental');
    }
  }
});

test('demo robot pages and orders keep the demo marketplace prefix and never expose live records',async()=>{
  const demo=browser();
  const home=(await demo.go('/demo/roboty')).result;
  assert.match(home,/data-market="robotics"/);
  assert.match(home,/Tryb demonstracyjny/);
  assert.doesNotMatch(home,/Próba Robotów Integrator-1/);
  assert.doesNotMatch(home,/przyklad-\d+/);
  const chosen=await demo.api('/access',{actor:'seller',next:'/demo/roboty/sprzedaj'},200,'POST','/demo');
  assert.equal(chosen.next,'/demo/roboty/sprzedaj');
  const draft=await demo.api('/listings',{key:crypto.randomUUID(),market:'robotics'},200,'POST','/demo');
  assert.equal(draft.next,'/demo/roboty/sprzedaj/'+draft.id);
  let state=await save(demo,draft.id,{...robotData,model:'Demo-Only'},0,'/demo');
  state=await upload(demo,draft.id,state.version,'/demo');
  const submitted=await demo.api('/listings/'+draft.id+'/submit',{version:state.version},200,'POST','/demo');
  await demo.api('/access',{actor:'moderator'},200,'POST','/demo');
  await approve(draft.id,demo,'/demo');
  await demo.api('/access',{actor:'buyer'},200,'POST','/demo');
  const order=await demo.api('/robot-orders',{listingId:draft.id,key:crypto.randomUUID(),kind:'purchase'},200,'POST','/demo');
  assert.equal(order.next,'/demo/roboty/zamowienia/'+order.id);
  const details=(await demo.go(order.next)).result;
  assert.ok(details.includes('href="/demo/roboty/oferta/'+submitted.slug+'"'));
  assert.doesNotMatch(details,/\/demo\/roboty\/demo\/roboty/);
  await buyer.go('/roboty/oferta/'+submitted.slug,{code:404});
  await buyer.go('/api/robot-orders/'+order.id,{code:404});
  const demoSearch=(await demo.go('/demo/roboty/szukaj')).result;
  assert.match(demoSearch,/Demo-Only/);assert.doesNotMatch(demoSearch,/Integrator-1/);
});

test('robot manifest and sitemap use robot URLs and orders survive a server restart',async()=>{
  const client=browser();
  const manifest=(await client.go('/roboty/manifest.webmanifest')).result;
  assert.equal(manifest.name,'Roboty i automatyka');
  assert.equal(manifest.start_url,'/roboty?launch=1');
  assert.equal(manifest.scope,'/roboty');
  assert.equal(manifest.theme_color,'#ffffff');
  assert.ok(manifest.shortcuts.every(item=>item.url.startsWith('/roboty/')));
  const demoManifest=(await client.go('/demo/roboty/manifest.webmanifest')).result;
  assert.equal(demoManifest.start_url,'/demo/roboty?launch=1');
  const sitemap=(await client.go('/sitemap.xml')).result;
  assert.ok(sitemap.includes('<loc>'+base+'/roboty</loc>'));
  assert.ok(sitemap.includes('<loc>'+base+'/roboty/oferta/'+robotSlug+'</loc>'));
  assert.ok(sitemap.includes('<loc>'+base+'/oferta/'+carSlug+'</loc>'));
  assert.ok(!sitemap.includes('<loc>'+base+'/oferta/'+robotSlug+'</loc>'));
  assert.doesNotMatch(sitemap,/Demo-Only|\/demo\//);
  await stop();await start();
  const persisted=(await buyer.go('/api/robot-orders/'+purchaseId)).result.order;
  assert.equal(persisted.status,'accepted');assert.equal(persisted.unit_amount,1500099);
  assert.equal((await seller.go('/api/robot-orders/'+rentalId)).result.order.status,'accepted');
  assert.ok(!serverErrors.some(message=>/request_failed|TypeError|ReferenceError|SQLITE_ERROR/.test(message)),serverErrors.join(''));
});
