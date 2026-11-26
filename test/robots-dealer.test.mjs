import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '../src/core.js';
import { csvTemplate, importCSV, parseCSV, previewCSV, robotCsvFields } from '../src/dealer.js';
import { companyReels, feedReels, listingReel, publishReel } from '../src/reels.js';
import { manageReels, reelsPage } from '../src/views-reels.js';
import { translator } from '../src/i18n.js';

const robot={type:'robot',make:'Robot testowy',model:'R-1',robotCategory:'kroczace',tradeMode:'both',condition:'used',damage:'no',
  price:'10000',currency:'EUR',rentalPrice:'100',rentalUnit:'day',deposit:'200',stock:'2',minimumRental:'2',country:'Polska',
  city:'Warszawa',region:'Mazowieckie',contact:'message',description:'Robot testowy z dokumentacją i wyposażeniem.'};
const csv=(entries)=>robotCsvFields.join(';')+'\n'+entries.map(entry=>robotCsvFields.map(key=>'"'+String(entry[key]??'').replaceAll('"','""')+'"').join(';')).join('\n');

function fixture(t) {
  const sqlite=new DatabaseSync(':memory:');
  const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
  for (const {tag} of journal.entries) sqlite.exec(readFileSync(new URL('../drizzle/'+tag+'.sql',import.meta.url),'utf8'));
  sqlite.exec("INSERT INTO users(id,scope,email,name,profile_type,verified_at,created_at) VALUES('qa-firm','live','robots@example.test','Robot seller','company',datetime('now'),datetime('now'))");
  const prepare=(sql,params=[])=>({
    bind(...values) {return prepare(sql,values);},
    async first() {return sqlite.prepare(sql).get(...params)||null;},
    async all() {return {results:sqlite.prepare(sql).all(...params)};},
    execute() {return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}};},
    async run() {return this.execute();}
  });
  const db={prepare,async batch(statements) {
    sqlite.exec('BEGIN');
    try {const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results;}
    catch(error) {sqlite.exec('ROLLBACK');throw error;}
  }};
  const bucket=new Map();
  const ctx={db,scope:'live',robotics:true,demo:false,prefix:'',lang:'pl',t:translator('pl'),
    user:{id:'qa-firm',profile_type:'company',verified_at:'2026-01-01',name:'Robot seller'},
    url:new URL('https://example.test/roboty/rolki'),req:new Request('https://example.test/roboty/rolki'),
    env:{BUCKET:{async get(key) {const body=bucket.get(key);return body?{body}:null;},async put(key,bytes) {bucket.set(key,bytes);},async delete(key) {bucket.delete(key);}}}};
  const add=(key,type='robot',status='published',video=null)=>{
    sqlite.prepare(`INSERT INTO listings(id,scope,user_id,client_key,slug,status,type,make,model,price,currency,data,photo_ids,video_id,created_at,updated_at,published_at)
      VALUES(?,'live','qa-firm',?,?,?,?,?,?,1000000,'EUR',?,'[]',?,datetime('now'),datetime('now'),datetime('now'))`)
      .run(key,key,key,status,type,type==='robot'?'Robot testowy':'Toyota',type==='robot'?'R-1':'Corolla',JSON.stringify(type==='robot'?robot:{}),video);
  };
  add('qa-source');
  sqlite.prepare("INSERT INTO photos(id,listing_id,mime,thumb_mime,width,height,digest,created_at) VALUES('ph-source','qa-source','image/webp','image/webp',800,600,'fixture',datetime('now'))").run();
  sqlite.exec("UPDATE listings SET photo_ids='[\"ph-source\"]' WHERE id='qa-source'");
  bucket.set('photos/ph-source/main',readFileSync(new URL('../public/assets/vehicle-1.webp',import.meta.url)));
  t.after(()=>sqlite.close());
  return {sqlite,ctx,add,bucket};
}

test('robot CSV template contains rental and stock fields without required vehicle fields',()=>{
  const {header,records}=parseCSV(csvTemplate({robotics:true}));
  assert.deepEqual(header,robotCsvFields);
  assert.equal(records[0].cells.length,header.length);
  for(const key of ['robotCategory','tradeMode','currency','rentalPrice','rentalUnit','stock','minimumRental']) assert.ok(header.includes(key));
  for(const key of ['vin','mileage','fuel','gearbox']) assert.ok(!header.includes(key));
  assert.equal(records[0].cells[header.indexOf('type')],'robot');
  assert.ok(parseCSV(csvTemplate()).header.includes('vin'));
});

test('robot CSV imports keep robot data, use moderation, and update idempotently',async t=>{
  const {sqlite,ctx}=fixture(t);
  const body={market:'robotics',csv:csv([{...robot,external_id:'supplier-1',photo_urls:'/media/ph-source'}]),source:'robot-supplier',rights:true,confirm:true,key:'qa-import-1'};
  const preview=await previewCSV(ctx,body);
  assert.equal(preview.rows[0].state,'create');
  assert.equal(preview.rows[0].error,undefined);
  const first=await importCSV(ctx,body);
  assert.equal(first.valid,1);
  const record=sqlite.prepare('SELECT * FROM listings WHERE id=?').get(first.rows[0].listingId);
  assert.equal(record.type,'robot');
  assert.equal(record.currency,'EUR');
  assert.equal(record.price,1000000);
  assert.equal(record.mileage,null);
  assert.equal(record.status,'pending');
  assert.equal(JSON.parse(record.data).rentalPrice,100);
  assert.equal(JSON.parse(record.data).stock,2);
  assert.equal((await importCSV(ctx,body)).id,first.id);
  const update=await importCSV(ctx,{...body,key:'qa-import-2',csv:csv([{...robot,price:'12000',external_id:'supplier-1'}])});
  assert.equal(update.valid,1);
  assert.equal(update.rows[0].listingId,record.id);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM external_ids').get().n,1);
  assert.equal(sqlite.prepare('SELECT price FROM listings WHERE id=?').get(record.id).price,1200000);
});

test('robot CSV rejects invalid robot data and refuses a vehicle-to-robot overwrite',async t=>{
  const {sqlite,ctx,add}=fixture(t);
  add('qa-car','car');
  sqlite.exec("INSERT INTO external_ids(user_id,source,external_id,listing_id) VALUES('qa-firm','supplier','shared-id','qa-car')");
  const result=await previewCSV(ctx,{market:'robotics',source:'supplier',rights:true,csv:csv([
    {...robot,external_id:'shared-id',photo_urls:'/media/ph-source'},
    {...robot,external_id:'wrong-type',type:'car',photo_urls:'/media/ph-source'},
    {...robot,external_id:'invalid-robot',robotCategory:'',stock:'',photo_urls:'/media/ph-source'}
  ])});
  assert.match(result.rows[0].error,/innego działu/);
  assert.match(result.rows[1].error,/wyłącznie roboty/);
  assert.match(result.rows[2].error,/kategoria robota/);
  assert.equal(sqlite.prepare("SELECT type FROM listings WHERE id='qa-car'").get().type,'car');
});

test('robot reels exclude vehicle and unlinked company films, while vehicle feed excludes robots',async t=>{
  const {sqlite,ctx,add}=fixture(t);
  add('qa-robot-video','robot','published','robot-video');
  add('qa-car-video','car','published','car-video');
  add('qa-pending-robot','robot','pending','pending-video');
  const insert=sqlite.prepare("INSERT INTO company_reels(id,user_id,listing_id,caption,mime,size,created_at) VALUES(?,'qa-firm',?,?,'video/mp4',100,datetime('now'))");
  insert.run('robot-company-reel','qa-robot-video','Robot reel');
  insert.run('car-company-reel','qa-car-video','Car reel');
  insert.run('company-generic',null,'Company news');
  insert.run('pending-company-reel','qa-pending-robot','Pending robot');
  const robotFeed=await feedReels(ctx,24,0);
  assert.deepEqual(robotFeed.map(item=>item.id).sort(),['robot-company-reel','robot-video']);
  assert.equal(robotFeed.find(item=>item.id==='robot-video').price,10000);
  assert.equal(await listingReel(ctx,'qa-car-video'),null);
  const vehicleFeed=await feedReels({...ctx,robotics:false},24,0);
  assert.ok(vehicleFeed.some(item=>item.id==='car-video'));
  assert.ok(vehicleFeed.every(item=>!['robot-video','robot-company-reel','pending-company-reel'].includes(item.id)));
  assert.deepEqual((await companyReels(ctx,'qa-firm')).map(item=>item.id),['robot-company-reel']);
  assert.equal((await companyReels({...ctx,robotics:false},'qa-firm')).length,4);
});

test('robot reel page shows real robot photos and never seeds vehicle demos',async t=>{
  const {sqlite,ctx}=fixture(t);
  const page=await reelsPage(ctx);
  assert.match(page.body,/Robot testowy R-1/);
  assert.match(page.body,/\/roboty\/oferta\/qa-source/);
  assert.doesNotMatch(page.body,/zdjęcia poglądowe|przyklad-|Porsche|\?typ=demo/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM listings WHERE scope LIKE 'demo:%'").get().n,0);
  sqlite.exec("UPDATE listings SET status='archived'");
  const empty=await reelsPage(ctx);
  assert.match(empty.body,/Brak rolek robotów/);
  assert.doesNotMatch(empty.body,/\/demo\//);
  const manage=await manageReels(ctx);
  assert.match(manage,/Najpierw opublikuj ogłoszenie robota/);
  assert.doesNotMatch(manage,/data-reel-upload/);
});

test('robot company reel requires a published robot belonging to the company',async t=>{
  const {ctx,add,bucket}=fixture(t);
  add('qa-car','car');
  const rejected=status=>error=>error instanceof AppError&&error.status===status;
  ctx.req=new Request('https://example.test/api/reels',{method:'POST',body:'invalid',headers:{'X-Reel-Market':'robotics'}});
  await assert.rejects(publishReel({...ctx,robotics:false}),rejected(422));
  ctx.req=new Request('https://example.test/api/reels',{method:'POST',body:'invalid',headers:{'X-Reel-Market':'robotics','X-Reel-Listing':'qa-car'}});
  await assert.rejects(publishReel({...ctx,robotics:false}),rejected(404));
  assert.equal([...bucket.keys()].filter(key=>key.startsWith('videos/')).length,0);
});
