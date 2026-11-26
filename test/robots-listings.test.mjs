import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { robotCategories, robotDefaultData, validateRobotListing } from '../src/robot-catalog.js';

const password='robot-marketplace-tests-only';
const ownerEmail='robots-owner@example.test';
const ownerToken='robot-tests-'+crypto.randomUUID();
const robot={
  ...robotDefaultData,type:'robot',market:'robotics',robotCategory:'humanoidalne',tradeMode:'both',
  make:'Robot Test',model:'QA-1',year:2025,condition:'new',price:15000.99,currency:'EUR',
  rentalPrice:450.75,rentalUnit:'day',deposit:1500,stock:2,leadTime:7,minimumRental:2,
  city:'Warszawa',country:'Polska',region:'Mazowieckie',
  specs:'Udźwig 12 kg, platforma edukacyjna ROS 2.',description:'Testowe urządzenie robotyczne z pełną dokumentacją.',contact:'message'
};
const vehicle={
  type:'car',make:'Toyota',model:'Corolla',year:2021,condition:'used',mileage:54000,
  body:'wagon',fuel:'hybrid',gearbox:'auto',drive:'fwd',power:122,damage:'no',city:'Warszawa',region:'Mazowieckie',
  price:68400,description:'Testowy pojazd z dokumentacją i wyposażeniem.',contact:'message'
};
let service,base,directory,seller,buyer,moderator,robotId,robotSlug,rentalId,vehicleId;
const serverErrors=[];

function browser() {
  const jar=new Map();
  return {
    async go(path,{method='GET',data,bytes,headers={},code=200}={}) {
      const opts={method,headers:{...headers},redirect:'manual'};
      const cookie=[...jar.entries()].map(([key,value])=>key+'='+value).join('; ');
      if(cookie) opts.headers.Cookie=cookie;
      if(method!=='GET') opts.headers.Origin??=base;
      if(data!==undefined) { opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data); }
      if(bytes!==undefined) { opts.headers['Content-Type']='application/octet-stream';opts.body=bytes; }
      const response=await fetch(base+path,opts);
      for(const entry of response.headers.getSetCookie()) {
        const [key,value]=entry.split(';',1)[0].split('=');
        if(value) jar.set(key,value);else jar.delete(key);
      }
      const buffer=Buffer.from(await response.arrayBuffer());
      const type=response.headers.get('content-type')||'';
      const result=type.includes('application/json')?JSON.parse(buffer.toString()):/^(image|video)\//.test(type)?buffer:buffer.toString();
      assert.equal(response.status,code,path+' · '+(typeof result==='string'?result.slice(-400):JSON.stringify(result).slice(0,400)));
      return {result,headers:response.headers};
    },
    async api(path,data,code=200,method='POST') {return (await this.go('/api'+path,{method,data,code})).result;}
  };
}
async function signup(email) {
  const client=browser();
  await client.api('/auth/register',{email,password,name:email.split('@')[0],profile_type:'private',terms:true});
  const mail=(await readFile(join(directory,'mailbox.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)).findLast(entry=>entry.to===email);
  assert.ok(mail,'verification mail is captured locally');
  await client.api('/auth/verify',{token:new URL(mail.url).searchParams.get('token'),password});
  await client.api('/auth/login',{email,password});
  return client;
}
function inspect(sql,...args) {
  const db=new DatabaseSync(join(directory,'all4auto.sqlite'),{readOnly:true});
  try{return db.prepare(sql).get(...args);}finally{db.close();}
}
const editRead=async(client,key)=>(await client.go('/api/listings/'+key+'/edit')).result;
const edit=(client,key,version,data,code=200)=>client.api('/listings/'+key+'/edit',{version,data,step:4},code,'PUT');
const submit=(client,key,version,extra={})=>client.api('/listings/'+key+'/submit',{version,...extra});
async function upload(client,key,version,kind='photo',code=200) {
  return (await client.go('/api/listings/'+key+'/'+kind,{method:'POST',headers:{'X-Edit-Version':String(version)},
    bytes:await readFile(kind==='video'?'test/fixtures/vehicle.mp4':'public/assets/vehicle-1.webp'),code})).result;
}
async function approve(key) {
  const record=inspect('SELECT revision FROM listings WHERE id=?',key);
  return moderator.api('/moderation/'+key,{action:'published',revision:record.revision});
}

before(async()=>{
  directory=await mkdtemp(resolve('var-robot-listing-test-'));
  service=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,APP_MODE:'development',APP_ORIGIN:'',MAIL_API_KEY:'',MAIL_FROM:'',PORT:'0',HOST:'127.0.0.1',DATA_DIR:directory,
      OWNER_EMAIL:ownerEmail,OWNER_SETUP_TOKEN:ownerToken},stdio:['ignore','pipe','pipe']
  });
  service.stderr.on('data',chunk=>serverErrors.push(String(chunk)));
  const [line]=await Promise.race([
    once(service.stdout,'data'),once(service,'exit').then(([code])=>{throw new Error('Server exited: '+code+' '+serverErrors.join(''));})
  ]);
  base=String(line).trim().split(' · ')[1];
  seller=await signup('robots-seller@example.test');
  buyer=await signup('robots-buyer@example.test');
  moderator=await signup(ownerEmail);
  await moderator.api('/auth/owner',{token:ownerToken});
});
after(async()=>{
  if(service?.exitCode==null) {service.kill();await once(service,'exit');}
  if(directory) await rm(directory,{recursive:true,force:true});
});

test('robot validation requires commerce fields without automotive fields',()=>{
  assert.equal(Object.keys(robotCategories).length,11);
  const valid=validateRobotListing({user:null},robot,true);
  assert.equal(valid.type,'robot');
  assert.equal(valid.price,15000.99);
  assert.equal(valid.rentalPrice,450.75);
  assert.equal(valid.mileage,null);
  assert.equal(valid.fuel,'');
  assert.ok(!Object.hasOwn(valid,'vin'));
  for(const [key,value] of [['robotCategory','not-a-category'],['tradeMode','lease'],['currency','XYZ'],['price',0],['rentalPrice',12.345],['stock',1.5],['minimumRental',0],['leadTime',-1]]) {
    assert.throws(()=>validateRobotListing({user:null},{...robot,[key]:value},true),error=>error.status===422&&error.details.fields.includes(key),key);
  }
  const rent=validateRobotListing({user:null},{...robot,tradeMode:'rent',price:'',year:''},true);
  assert.equal(rent.price,null);
  assert.equal(rent.year,null);
  assert.throws(()=>validateRobotListing({user:null},{...robot,contact:'phone',listingPhone:''},true),error=>error.details.fields.includes('listingPhone'));
});

test('drafts retain their marketplace and remain idempotent',async()=>{
  const key=crypto.randomUUID();
  await browser().api('/listings',{key,market:'robotics'},401);
  const draft=await seller.api('/listings',{key,market:'robotics'});
  const again=await seller.api('/listings',{key,market:'robotics'});
  robotId=draft.id;
  assert.equal(again.id,robotId);
  assert.equal(draft.next,'/roboty/sprzedaj/'+robotId);
  const state=await editRead(seller,robotId);
  assert.equal(state.data.type,'robot');
  assert.equal(state.data.stock,1);
  assert.equal(state.data.tradeMode,'sale');
  await seller.api('/listings',{key},409);
  await edit(seller,robotId,state.version,vehicle,422);
  assert.equal((await editRead(seller,robotId)).version,state.version);
  await buyer.go('/api/listings/'+robotId+'/edit',{code:403});
  await edit(buyer,robotId,state.version,robot,403);
  const car=await seller.api('/listings',{key:crypto.randomUUID()});
  vehicleId=car.id;
  await edit(seller,vehicleId,0,robot,422);
  const catalog=(await browser().go('/api/catalog?market=robotics')).result;
  assert.equal(Object.keys(catalog.categories).length,11);
  assert.ok(catalog.brands.includes('DOBOT'));
});

test('robot media and publication use existing permissions and moderation',async()=>{
  let state=await edit(seller,robotId,0,robot);
  await seller.api('/listings/'+robotId+'/submit',{version:state.version},422);
  await upload(buyer,robotId,state.version,'photo',403);
  await upload(browser(),robotId,state.version,'photo',401);
  state=await upload(seller,robotId,state.version);
  const image='/media/'+state.photos[0];
  await browser().go(image,{code:404});
  const result=await submit(seller,robotId,state.version);
  assert.equal(result.status,'pending');
  robotSlug=result.slug;
  assert.equal((await submit(seller,robotId,state.version)).slug,robotSlug);
  assert.equal((await browser().go('/api/search?market=robotics')).result.total,0);
  await browser().go(image,{code:404});
  await seller.api('/moderation/'+robotId,{action:'published',revision:1},403);
  await approve(robotId);
  await browser().go(image);
  const data=(await browser().go('/api/search?market=robotics')).result;
  assert.equal(data.total,1);
  const offer=data.offers[0];
  assert.equal(offer.id,robotId);
  assert.equal(offer.price,robot.price);
  assert.equal(offer.rentalPrice,robot.rentalPrice);
  assert.equal(offer.currency,'EUR');
  assert.equal(offer.specs,robot.specs);
  assert.equal(offer.stock,2);
  assert.equal(offer.market,'robotics');
  assert.equal(offer.is_demo,false);
  assert.equal(inspect('SELECT price FROM listings WHERE id=?',robotId).price,1500099);
});

test('rental-only offers keep purchase price null and expose only matching robot searches',async()=>{
  const draft=await seller.api('/listings',{key:crypto.randomUUID(),type:'robot'});
  rentalId=draft.id;
  const rental={...robot,model:'QA-Rent',robotCategory:'kroczace',tradeMode:'rent',price:'',currency:'PLN',rentalPrice:125.50,rentalUnit:'week'};
  let state=await edit(seller,rentalId,0,rental);
  state=await upload(seller,rentalId,state.version);
  await submit(seller,rentalId,state.version);
  await approve(rentalId);
  assert.equal(inspect('SELECT price FROM listings WHERE id=?',rentalId).price,null);
  let car=await edit(seller,vehicleId,0,vehicle);
  car=await upload(seller,vehicleId,car.version);
  assert.equal((await submit(seller,vehicleId,car.version)).status,'published');
  const get=async(query)=>(await browser().go('/api/search?'+query)).result;
  assert.deepEqual((await get('')).offers.map(offer=>offer.id),[vehicleId]);
  assert.equal((await get('type=robot')).total,0);
  assert.equal((await get('market=robotics')).total,2);
  assert.equal((await get('market=robotics&type=car')).total,2);
  assert.equal((await get('market=robotics&category=humanoidalne')).offers[0].id,robotId);
  assert.equal((await get('market=robotics&robotCategory=kroczace')).offers[0].id,rentalId);
  assert.equal((await get('market=robotics&category=unknown')).total,0);
  assert.deepEqual((await get('market=robotics&tradeMode=sale')).offers.map(offer=>offer.id),[robotId]);
  assert.equal((await get('market=robotics&mode=rent')).total,2);
  const rentalResults=await get('market=robotics&tradeMode=rent&currency=PLN&minPrice=125.5&maxPrice=125.5');
  assert.equal(rentalResults.total,1);
  assert.equal(rentalResults.offers[0].price,null);
  assert.equal(rentalResults.offers[0].rentalPrice,125.5);
  assert.equal((await get('market=robotics&minRentalPrice=126&maxRentalPrice=450.75')).offers[0].id,robotId);
  assert.equal((await get('market=robotics&q=ROS%202')).total,2);
});

test('robots share favorites and conversations without exposing owner editing',async()=>{
  const saved=await buyer.api('/favorites',{key:robotId,add:true});
  assert.ok(saved.keys.includes(robotId));
  assert.ok((await buyer.go('/api/favorites')).result.keys.includes(robotId));
  const compare=(await browser().go('/api/compare?keys='+robotId)).result;
  assert.equal(compare.offers[0].type,'robot');
  await seller.api('/offers/'+robotId+'/message',{key:crypto.randomUUID(),body:'Self message'},422);
  const sent=await buyer.api('/offers/'+robotId+'/message',{key:crypto.randomUUID(),body:'Zapytanie testowe o dostępność robota.'});
  const messages=(await seller.go('/api/messages/'+sent.thread)).result;
  assert.equal(messages.items[0].body,'Zapytanie testowe o dostępność robota.');
  await browser().go('/api/messages/'+sent.thread,{code:401});
  await moderator.go('/api/messages/'+sent.thread,{code:404});
  const current=await editRead(seller,robotId);
  await edit(seller,robotId,current.version,{...current.data,type:'car'},422);
  assert.equal(inspect('SELECT type FROM listings WHERE id=?',robotId).type,'robot');
  const edited=await edit(seller,robotId,current.version,{...current.data,description:robot.description+' Zmieniony opis.'});
  await edit(seller,robotId,current.version,current.data,409);
  assert.equal(edited.data.tradeMode,'both');
});

test('robot video stays private until publication of its current revision',async()=>{
  let state=await editRead(seller,robotId);
  state=await upload(seller,robotId,state.version,'video');
  const path='/wideo/'+state.video;
  await browser().go(path,{code:404});
  await buyer.go(path,{code:404});
  await seller.go(path);
  const submitted=await submit(seller,robotId,state.version,{confirm:true});
  assert.equal(submitted.status,'pending');
  await browser().go(path,{code:404});
  await moderator.go(path);
  await approve(robotId);
  const published=await browser().go(path,{headers:{Range:'bytes=0-15'},code:206});
  assert.equal(published.result.length,16);
  assert.equal(published.headers.get('content-type'),'video/mp4');
  const offer=(await browser().go('/api/search?market=robotics&category=humanoidalne')).result.offers[0];
  assert.equal(offer.video,path);
  assert.equal(offer.photos.length,1);
  assert.ok(!serverErrors.some(message=>/TypeError|ReferenceError|SQLITE_ERROR/.test(message)),serverErrors.join(''));
});

test('category, trade mode and cover changes become public only after the edited robot is approved',async()=>{
  const draft=await seller.api('/listings',{key:crypto.randomUUID(),market:'robotics'});
  const original={...robot,make:'Category audit',model:'QA-Revision',robotCategory:'magazynowe',tradeMode:'sale',currency:'PLN',price:12345.67};
  let state=await edit(seller,draft.id,0,original);
  state=await upload(seller,draft.id,state.version);
  const first=state.photos[0];
  state=(await seller.go('/api/listings/'+draft.id+'/photo',{method:'POST',headers:{'X-Edit-Version':String(state.version)},
    bytes:await readFile('public/assets/vehicle-2.webp')})).result;
  const second=state.photos[1];
  assert.ok(second&&second!==first);
  const submitted=await submit(seller,draft.id,state.version);
  await approve(draft.id);
  const find=async extra=>(await browser().go('/api/search?market=robotics&q=QA-Revision'+extra)).result;
  assert.equal((await find('&category=magazynowe')).offers[0].cover,'/media/'+first+'/thumb');

  state=await editRead(seller,draft.id);
  const revised={...state.data,robotCategory:'medyczne',tradeMode:'rent',price:'',rentalPrice:89.50,rentalUnit:'week',minimumRental:2};
  state=await seller.api('/listings/'+draft.id+'/edit',{version:state.version,data:revised,photos:[second,first],step:4},200,'PUT');
  const saved=await editRead(seller,draft.id);
  assert.equal(saved.data.robotCategory,'medyczne');
  assert.equal(saved.data.tradeMode,'rent');
  assert.equal(saved.data.price,null);
  assert.deepEqual(saved.photos,[second,first]);
  assert.equal((await find('&category=magazynowe&tradeMode=sale')).total,1);
  assert.equal((await find('&category=medyczne&tradeMode=rent')).total,0);
  const preview=(await seller.go('/roboty/podglad/'+draft.id)).result;
  assert.match(preview,/Medyczne/);
  assert.ok(preview.includes('/media/'+second));
  await seller.api('/listings/'+draft.id+'/submit',{version:state.version},409);
  await submit(seller,draft.id,state.version,{confirm:true});
  assert.equal((await find('')).total,0);
  await approve(draft.id);
  const current=(await find('&category=medyczne&tradeMode=rent')).offers[0];
  assert.equal(current.id,draft.id);
  assert.equal(current.slug,submitted.slug);
  assert.equal(current.price,null);
  assert.equal(current.rentalPrice,89.5);
  assert.equal(current.rentalUnit,'week');
  assert.equal(current.minimumRental,2);
  assert.equal(current.cover,'/media/'+second+'/thumb');
  assert.deepEqual(current.photos.map(photo=>photo.key),[second,first]);
  assert.equal((await find('&category=magazynowe')).total,0);
  assert.equal((await find('&tradeMode=sale')).total,0);
});
