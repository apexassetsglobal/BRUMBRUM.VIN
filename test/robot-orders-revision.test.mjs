import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { createOrder, orderDetail, changeOrderStatus } from '../src/robot-orders.js';
import { editState, owned, saveEdit, submitListing, moderate, listingValues, detailValues, listColumns } from '../src/market.js';
import { importCSV, robotCsvFields } from '../src/dealer.js';
import { robotDefaultData, validateRobotListing } from '../src/robot-catalog.js';
import { importVehicle } from '../src/automation-listings.js';
import { automationTick } from '../src/automation.js';

let sqlite,db,seller,buyer,buyer2,moderator,beforeBatch;
const currentDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day=offset=>new Date(Date.parse(currentDay()+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const expectStock=error=>{assert.equal(error.status,409,error.stack);assert.deepEqual(error.details.fields,['stock']);return true;};
const expectConflict=error=>{assert.equal(error.status,409,error.stack);return true;};

function statement(sql,values=[]) {
  const execute=()=>({success:true,meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}});
  return {sql,bind:(...params)=>statement(sql,params),first:async()=>sqlite.prepare(sql).get(...values)??null,
    all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>execute(),execute};
}
function user(name,role='user') {
  const key=crypto.randomUUID(),at=new Date().toISOString();
  sqlite.prepare('INSERT INTO users(id,scope,email,name,profile_type,role,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(key,'live',name+'@example.test',name,'company',role,at,at);
  return {db,scope:'live',prefix:'',env:{},ip:name,user:{id:key,scope:'live',name,profile_type:'company',role},t:pl=>pl};
}
const baseData={...robotDefaultData,make:'Maker A',model:'Humanoid A',year:2025,robotCategory:'humanoidalne',tradeMode:'both',
  condition:'new',damage:'no',price:100,currency:'PLN',rentalPrice:10,rentalUnit:'day',deposit:0,stock:5,leadTime:0,minimumRental:1,
  specs:'Udźwig 12 kg. Oprogramowanie ROS 2.',description:'Robot testowy ze szczegółową dokumentacją techniczną.',city:'Warszawa',country:'Polska'};
function listing(patch={}) {
  const key=crypto.randomUUID(),at=new Date().toISOString();
  const data=validateRobotListing(seller,{...baseData,...patch},true);
  sqlite.prepare(`INSERT INTO listings(id,scope,user_id,client_key,slug,status,${listColumns.join(',')},data,photo_ids,created_at,updated_at,published_at,revision)
    VALUES(?,?,?,?,?,'published',${listColumns.map(()=>'?').join(',')},?,?,?,?,?,1)`).run(
    key,'live',seller.user.id,key,'robot-'+key,...listingValues(data),detailValues(data),JSON.stringify(['photo-'+key]),at,at,at);
  return key;
}
const request=(kind='purchase',values={})=>({key:crypto.randomUUID(),kind,quantity:1,...(kind==='rental'?{startsOn:day(10),endsOn:day(13)}:{}),...values});
const accept=key=>changeOrderStatus(seller,key,{status:'accepted'});
const record=key=>sqlite.prepare('SELECT * FROM listings WHERE id=?').get(key);
const pool=key=>JSON.parse(record(key).data).stock;
async function prepareEdit(key,patch) {
  const state=await editState(seller,await owned(seller,key));
  return saveEdit(seller,key,{version:state.version,data:{...state.data,...patch},step:4});
}
async function publishEdit(key,patch) {
  const state=await prepareEdit(key,patch);
  await submitListing(seller,key,{version:state.version,confirm:true});
  await moderate(moderator,key,{revision:record(key).revision,action:'published'});
}

beforeEach(async()=>{
  sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort()) sqlite.exec(await readFile('drizzle/'+file,'utf8'));
  beforeBatch=null;
  db={prepare:sql=>statement(sql),batch:async statements=>{
    if(beforeBatch) await beforeBatch(statements);
    sqlite.exec('BEGIN IMMEDIATE');
    try{const result=statements.map(item=>item.execute());sqlite.exec('COMMIT');return result;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  seller=user('seller');buyer=user('buyer');buyer2=user('buyer2');moderator=user('moderator','admin');
});
afterEach(()=>sqlite.close());

test('requested orders cannot be accepted after a material identity or description edit at the same price',async()=>{
  const patches=[{make:'Maker B'},{model:'Drone B'},{variant:'Different configuration'},{robotCategory:'drony'},
    {condition:'used'},{damage:'yes'},{year:2024},{specs:'Nowe parametry: udźwig 1 kg.'},
    {description:'Inny opis sprzętu wystawionego na sprzedaż.'},{city:'Gdańsk'},{country:'Niemcy'}];
  for(const patch of patches) {
    const robot=listing({stock:2});
    const original=await createOrder(buyer,robot,request());
    await publishEdit(robot,patch);
    await assert.rejects(accept(original.id),expectConflict,JSON.stringify(patch));
    const unchanged=await orderDetail(buyer,original.id);
    assert.equal(unchanged.status,'requested');
    assert.equal(unchanged.unit_amount,10000);
    assert.equal(unchanged.snapshot.identity.make,'Maker A');
    const fresh=await createOrder(buyer,robot,request());
    assert.equal((await accept(fresh.id)).status,'accepted');
  }
});

test('accepted orders keep their own equipment snapshot, currency and amounts after an offer edit',async()=>{
  const robot=listing({stock:2});
  const original=await createOrder(buyer,robot,request());
  await accept(original.id);
  await publishEdit(robot,{price:900,currency:'EUR',description:'Zaktualizowany opis kolejnych egzemplarzy robota.'});
  const completed=await changeOrderStatus(seller,original.id,{status:'completed'});
  assert.equal(completed.status,'completed');
  assert.equal(completed.order.currency,'PLN');
  assert.equal(completed.order.unit_amount,10000);
  assert.equal(completed.order.snapshot.identity.description,baseData.description);
  assert.equal(record(robot).price,90000);
});

test('publication cannot reduce a pool below completed sales and preserves the live listing on rejection',async()=>{
  const robot=listing({stock:3});
  const order=await createOrder(buyer,robot,request('purchase',{quantity:2}));
  await accept(order.id);
  await changeOrderStatus(seller,order.id,{status:'completed'});
  const state=await prepareEdit(robot,{stock:1});
  await assert.rejects(submitListing(seller,robot,{version:state.version,confirm:true}),expectStock);
  assert.equal(pool(robot),3);
  assert.equal(record(robot).status,'published');
  assert.ok(sqlite.prepare('SELECT 1 FROM listing_edits WHERE listing_id=?').get(robot));
  await publishEdit(robot,{stock:2});
  assert.equal(pool(robot),2);
});

test('pool edits use peak concurrent future rentals plus sales, not the sum of disjoint rentals',async()=>{
  const robot=listing({stock:5});
  const sold=await createOrder(buyer,robot,request());await accept(sold.id);
  const first=await createOrder(buyer,robot,request('rental',{quantity:2,startsOn:day(10),endsOn:day(12)}));await accept(first.id);
  const second=await createOrder(buyer2,robot,request('rental',{quantity:2,startsOn:day(12),endsOn:day(14)}));await accept(second.id);
  const spanning=await createOrder(buyer2,robot,request('rental',{quantity:1,startsOn:day(10),endsOn:day(14)}));await accept(spanning.id);
  const blocked=await prepareEdit(robot,{stock:3});
  await assert.rejects(submitListing(seller,robot,{version:blocked.version,confirm:true}),expectStock);
  assert.equal(pool(robot),5);
  await changeOrderStatus(seller,spanning.id,{status:'cancelled'});
  await publishEdit(robot,{stock:3});
  assert.equal(pool(robot),3);
});

test('pool guards include rentals already in progress and release capacity on the exclusive return date',async()=>{
  const robot=listing({stock:2});
  const rental=await createOrder(buyer,robot,request('rental',{quantity:2}));await accept(rental.id);
  sqlite.prepare('UPDATE robot_orders SET starts_on=?,ends_on=? WHERE id=?').run(day(-1),day(1),rental.id);
  const blocked=await prepareEdit(robot,{stock:1});
  await assert.rejects(submitListing(seller,robot,{version:blocked.version,confirm:true}),expectStock);
  sqlite.prepare('UPDATE robot_orders SET ends_on=? WHERE id=?').run(day(0),rental.id);
  await publishEdit(robot,{stock:0});
  assert.equal(pool(robot),0);
});

test('acceptance after the editor read but before its commit is caught by the atomic publication guard',async()=>{
  const robot=listing({stock:2});
  const requested=await createOrder(buyer,robot,request('purchase',{quantity:2}));
  const state=await prepareEdit(robot,{stock:1});
  beforeBatch=async statements=>{
    if(statements[0].sql.startsWith('UPDATE listings SET')) {
      beforeBatch=null;
      await accept(requested.id);
    }
  };
  await assert.rejects(submitListing(seller,robot,{version:state.version,confirm:true}),expectStock);
  assert.equal((await orderDetail(buyer,requested.id)).status,'accepted');
  assert.equal(pool(robot),2);
  assert.equal(record(robot).status,'published');
});

test('CSV upsert also rejects a pool decrease when an order is accepted after import analysis',async()=>{
  const robot=listing({stock:2});
  sqlite.prepare('INSERT INTO external_ids(user_id,source,external_id,listing_id) VALUES(?,?,?,?)')
    .run(seller.user.id,'robot-import','robot-1',robot);
  const requested=await createOrder(buyer,robot,request('purchase',{quantity:2}));
  const csv=stock=>robotCsvFields.join(';')+'\n'+robotCsvFields.map(key=>{
    const value=key==='external_id'?'robot-1':key==='stock'?stock:key==='equipment'?'':baseData[key]??'';
    return '"'+String(value).replaceAll('"','""')+'"';
  }).join(';');
  beforeBatch=async statements=>{
    if(statements[0].sql.startsWith('INSERT INTO listings')) {
      beforeBatch=null;
      await accept(requested.id);
    }
  };
  const body={key:crypto.randomUUID(),source:'robot-import',market:'robotics',confirm:true,rights:true,csv:csv(1)};
  const failed=await importCSV(seller,body);
  assert.equal(failed.valid,0);
  assert.match(failed.rows[0].error,/Pula sztuk/);
  assert.equal(pool(robot),2);
  assert.equal(record(robot).status,'published');
  assert.equal((await orderDetail(buyer,requested.id)).status,'accepted');
  const allowed=await importCSV(seller,{...body,key:crypto.randomUUID(),csv:csv(2)});
  assert.equal(allowed.valid,1);
  assert.equal(pool(robot),2);
  assert.equal(record(robot).status,'pending');
});

test('vehicle automation rejects incoming robots before creating incomplete cross-market drafts',async()=>{
  for(const type of ['robot',' ROBOT ']) {
    await assert.rejects(importVehicle(seller,{id:crypto.randomUUID(),autopublish:true},{id:crypto.randomUUID(),kind:'sync'},
      {external_id:'external-robot',type,make:'Maker',model:'Robot'},null,{publish:true}),
      error=>error.status===422&&error.details.fields.includes('type'));
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM listings').get().n,0);
});

test('an existing automation external key cannot overwrite a robot with accepted commitments as a vehicle',async()=>{
  const robot=listing({stock:2});
  const order=await createOrder(buyer,robot,request('purchase',{quantity:2}));await accept(order.id);
  const sourceId=crypto.randomUUID(),jobId=crypto.randomUUID(),at=new Date().toISOString();
  sqlite.prepare('INSERT INTO auto_sources(id,scope,owner_id,name,kind,autopublish,consent_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(sourceId,'live',seller.user.id,'Legacy vehicle feed','push',1,at,at);
  sqlite.prepare('INSERT INTO auto_items(source_id,external_id,listing_id,result,last_job) VALUES(?,?,?,?,?)')
    .run(sourceId,'legacy-robot',robot,'published',jobId);
  const previous=sqlite.prepare('SELECT * FROM auto_items WHERE source_id=? AND external_id=?').get(sourceId,'legacy-robot');
  const revision=record(robot).revision;
  const incoming={external_id:'legacy-robot',type:'car',make:'Toyota',model:'Corolla',year:2021,condition:'used',damage:'no',
    body:'wagon',fuel:'hybrid',gearbox:'auto',drive:'fwd',mileage:20000,power:120,price:100,city:'Warszawa',region:'Mazowieckie',
    description:'Pojazd testowy z dokumentacją techniczną.',contact:'message',availability:'available'};
  await assert.rejects(importVehicle(seller,{id:sourceId,autopublish:true},{id:jobId,kind:'sync'},incoming,previous,{publish:true}),
    error=>error.status===422&&error.details.fields.includes('type'));
  assert.equal(record(robot).type,'robot');
  assert.equal(record(robot).revision,revision);
  assert.equal(record(robot).status,'published');
  assert.equal(pool(robot),2);
  assert.equal((await orderDetail(buyer,order.id)).status,'accepted');
});

test('vehicle publication channels exclude new robots and skip legacy queued robots while sending a vehicle',async()=>{
  const freshRobot=listing(),legacyRobot=listing(),car=listing();
  sqlite.prepare("UPDATE listings SET type='car',make='Toyota',model='Corolla',data='{}' WHERE id=?").run(car);
  const channel=crypto.randomUUID(),legacyDelivery=crypto.randomUUID(),at=new Date().toISOString();
  sqlite.prepare('INSERT INTO auto_channels(id,scope,owner_id,channel,consent_at) VALUES(?,?,?,?,?)')
    .run(channel,'live',seller.user.id,'vehicle-feed',at);
  sqlite.prepare('INSERT INTO auto_policy(scope,imports,publish,sync,paused) VALUES(?,0,1,0,0)').run('live');
  sqlite.prepare('INSERT INTO auto_deliveries(id,channel_id,listing_id,revision,created_at) VALUES(?,?,?,?,?)')
    .run(legacyDelivery,channel,legacyRobot,1,'2020-01-01T00:00:00.000Z');
  const delivered=[];
  const ctx={...seller,origin:'https://market.example.com',env:{...seller.env,IMPORT_CHANNELS:JSON.stringify([
    {id:'vehicle-feed',name:'Kanał pojazdów',endpoint:'https://publisher.example.com/receive',protocol:'receipt-v1'}
  ])},transport:async(_ctx,_url,options)=>{
    delivered.push(options.json);
    return {bytes:new TextEncoder().encode(JSON.stringify({status:'accepted'}))};
  }};
  await automationTick(ctx,{force:true});
  assert.equal(delivered.length,1);
  assert.equal(delivered[0].offers[0].external_id,car);
  assert.equal(delivered[0].offers[0].type,'car');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM auto_deliveries WHERE listing_id=?').get(freshRobot).n,0);
  const legacy=sqlite.prepare('SELECT state,attempts FROM auto_deliveries WHERE id=?').get(legacyDelivery);
  assert.equal(legacy.state,'queued');
  assert.equal(legacy.attempts,0);
  assert.equal(sqlite.prepare('SELECT state FROM auto_deliveries WHERE listing_id=?').get(car).state,'accepted');
});
