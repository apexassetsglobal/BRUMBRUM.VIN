import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { handler } from '../src/app.js';
import { digest } from '../src/core.js';
import { robotCategories } from '../src/robot-catalog.js';
import { featuredRobotDemos, getRobotDemo, listRobotDemos, robotDemoExamples } from '../src/robot-demo.js';

let sqlite,db,env,userId,session;
const origin='https://robot-demo.example.test';
const slugs=html=>[...html.matchAll(/data-robot-demo="([^"]+)"/g)].map(match=>match[1]);
const count=table=>sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
const query=values=>new URLSearchParams(values);
const futureDay=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

function statement(sql,values=[]) {
  const execute=()=>({success:true,meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}});
  return {bind:(...params)=>statement(sql,params),first:async()=>sqlite.prepare(sql).get(...values)??null,
    all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>execute(),execute};
}
async function request(path,{body,method=body?'POST':'GET',authenticated=false,status=200}={}) {
  const headers={};
  if(authenticated)headers.Cookie='a4_session='+session;
  if(method!=='GET'&&method!=='HEAD')headers.Origin=origin;
  if(body)headers['Content-Type']='application/json';
  const response=await handler(new Request(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env,async()=>null);
  const text=await response.text();
  assert.equal(response.status,status,path+' '+text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(-300));
  return {text,headers:response.headers,json:()=>JSON.parse(text)};
}

before(async()=>{
  sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  for(const name of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+name,'utf8'));
  db={prepare:sql=>statement(sql),batch:async statements=>{
    sqlite.exec('BEGIN IMMEDIATE');
    try{const results=statements.map(item=>item.execute());sqlite.exec('COMMIT');return results;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  env={DB:db,runtime:'node',APP_MODE:'development',APP_ORIGIN:origin,PUBLIC_INDEXING:'1'};
  userId=crypto.randomUUID();session='e'.repeat(64);
  const at=new Date().toISOString();
  sqlite.prepare('INSERT INTO users(id,scope,email,name,profile_type,verified_at,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(userId,'live','demo-tests@example.test','Fixture user','company',at,at);
  sqlite.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)')
    .run(await digest(session),userId,new Date(Date.now()+86400000).toISOString());
});
after(()=>sqlite.close());

test('all eleven categories contain two fictional read-only examples with unique stable links',()=>{
  assert.equal(robotDemoExamples.length,22);
  assert.equal(new Set(robotDemoExamples.map(item=>item.id)).size,22);
  assert.equal(new Set(robotDemoExamples.map(item=>item.slug)).size,22);
  for(const category of Object.keys(robotCategories))assert.equal(robotDemoExamples.filter(item=>item.robotCategory===category).length,2,category);
  assert.deepEqual([...new Set(robotDemoExamples.map(item=>item.tradeMode))].sort(),['both','rent','sale']);
  for(const example of robotDemoExamples) {
    assert.equal(example.demo,true);assert.equal(example.readOnly,true);
    assert.equal(example.make,'Producent DEMO');assert.equal(example.user_id,undefined);
    assert.equal(getRobotDemo(example.slug),example);
    assert.ok(example.parameters.length>=2);
    assert.equal(example.price!==null,example.tradeMode!=='rent');
    assert.equal(example.rentalPrice!==null,example.tradeMode!=='sale');
  }
  assert.equal(featuredRobotDemos.length,8);
  assert.equal(new Set(featuredRobotDemos.map(item=>item.robotCategory)).size,8);
  assert.equal(getRobotDemo('unknown'),null);
});

test('demo filters respect categories, mode, text, currency, price, condition and year',()=>{
  assert.deepEqual(listRobotDemos(query({category:'humanoidalne',tradeMode:'rent'})).map(item=>item.slug),['humanoid-h01']);
  assert.equal(listRobotDemos(query({robotCategory:'drony',mode:'sale'})).length,2);
  assert.equal(listRobotDemos(query({category:'unknown'})).length,0);
  assert.equal(listRobotDemos(query({make:'Unitree'})).length,0);
  assert.deepEqual(listRobotDemos(query({q:'h-01'})).map(item=>item.slug),['humanoid-h01']);
  assert.ok(listRobotDemos(query({q:'Zasięg'})).length>0);
  assert.deepEqual(listRobotDemos(query({tradeMode:'rent',minPrice:'190',maxPrice:'190'})).map(item=>item.slug),['dron-a01']);
  assert.deepEqual(listRobotDemos(query({category:'humanoidalne',maxPrice:'25000',currency:'eur'})).map(item=>item.slug),['humanoid-h02']);
  assert.equal(listRobotDemos(query({category:'humanoidalne',maxPrice:'25000'})).length,0,'price bounds default to PLN, like real search');
  assert.ok(listRobotDemos(query({condition:'used',minYear:'2024',maxYear:'2024'})).every(item=>item.condition==='used'&&item.year===2024));
  assert.equal(listRobotDemos(query({condition:'used',minYear:'2026'})).length,0);
  assert.deepEqual(listRobotDemos(query({model:'A-01',city:'wroc',minRentalPrice:'180',maxRentalPrice:'200'})).map(item=>item.slug),['dron-a01']);
  const ordered=listRobotDemos(query({tradeMode:'rent',currency:'PLN',sort:'price_asc'}));
  assert.deepEqual(ordered.map(item=>item.rentalPrice),ordered.map(item=>item.rentalPrice).toSorted((a,b)=>a-b));
});

test('live home and demo gallery show examples immediately without seeding real or sandbox listings',async()=>{
  assert.equal(count('listings'),0);
  const home=await request('/roboty');
  assert.equal(slugs(home.text).length,8);
  assert.match(home.text,/0 prawdziwych ogłoszeń/);
  assert.doesNotMatch(home.text,/Miejsce na Twojego pierwszego robota|Tryb demonstracyjny/);
  assert.match(home.text,/href="\/roboty\/demo"/);
  const all=await request('/roboty/demo');
  assert.equal(slugs(all.text).length,22);
  assert.match(all.text,/data-robot-demo-count="22"/);
  assert.match(all.text,/method="get" action="\/roboty\/demo"/);
  assert.match(all.text,/Ilustracja/);
  assert.doesNotMatch(all.text,/Tryb demonstracyjny|data-favorite=|data-compare=/);
  assert.equal(all.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(count('listings'),0,'public demo catalogue must not call the legacy demo seed');
  assert.equal(count('demo_workspaces'),0);
  const english=await request('/roboty/demo?lang=en&category=drony');
  assert.match(english.text,/Example listings/);
  assert.equal(slugs(english.text).length,2);
});

test('every category shows only its two examples with a separate zero real listing count',async()=>{
  for(const category of Object.keys(robotCategories)) {
    const result=await request('/roboty/szukaj?category='+category);
    const examples=slugs(result.text).map(getRobotDemo);
    assert.equal(examples.length,2,category);
    assert.ok(examples.every(item=>item.robotCategory===category));
    assert.match(result.text,/0 prawdziwych ogłoszeń/);
    assert.match(result.text,/data-robot-demo-count="2"/);
    assert.doesNotMatch(result.text,/Brak ogłoszeń dla tych filtrów/);
  }
  const rental=await request('/roboty/szukaj?category=medyczne&tradeMode=rent');
  assert.deepEqual(slugs(rental.text),['robot-med01']);
  const none=await request('/roboty/szukaj?category=medyczne&q=nonexistent');
  assert.deepEqual(slugs(none.text),[]);
  assert.match(none.text,/Brak przykładów DEMO dla tych filtrów/);
  const real=(await request('/api/search?market=robotics&category=medyczne')).json();
  assert.equal(real.total,0);assert.deepEqual(real.offers,[]);
});

test('demo details have visible labels and real-listing CTAs but no transaction or account action bindings',async()=>{
  for(const example of [getRobotDemo('humanoid-h01'),getRobotDemo('robot-med01'),getRobotDemo('dron-a02')]) {
    const path='/roboty/demo/'+example.slug;
    const detail=await request(path,{authenticated:true});
    assert.match(detail.text,new RegExp('data-robot-demo-detail="'+example.slug+'"'));
    assert.match(detail.text,/class="robot-demo-badge">DEMO/);
    assert.match(detail.text,/nie są dostępne do zakupu ani wynajmu/);
    assert.match(detail.text,/Ilustracja poglądowa/);
    assert.match(detail.text,/Wystaw własny sprzęt/);
    assert.ok(detail.text.includes('href="/roboty/szukaj?category='+example.robotCategory+'"'));
    assert.doesNotMatch(detail.text,/data-api="\/robot-orders|data-dialog="robot-(?:purchase|rental)|data-open="robot-(?:purchase|rental)|data-favorite=|data-compare=|name="(?:listingId|quantity|startsOn|endsOn)"/);
    assert.doesNotMatch(detail.text,/data-api="\/offers\//);
    await request(path,{method:'POST',body:{quantity:1},authenticated:true,status:404});
    await request('/roboty/oferta/'+example.id,{status:404});
  }
  await request('/roboty/demo/not-a-demo',{status:404});
  assert.equal(count('listings'),0);assert.equal(count('robot_orders'),0);
});

test('production orders, favorites and seller messages cannot use static demo IDs',async()=>{
  for(const example of robotDemoExamples) {
    await request('/api/robot-orders',{authenticated:true,status:404,
      body:{listingId:example.id,key:crypto.randomUUID(),kind:'purchase',quantity:1}});
  }
  await request('/api/robot-orders',{authenticated:true,status:404,body:{listingId:robotDemoExamples[0].id,key:crypto.randomUUID(),kind:'rental',quantity:1,
    startsOn:futureDay(5),endsOn:futureDay(7)}});
  const saved=(await request('/api/favorites',{authenticated:true,body:{keys:robotDemoExamples.map(item=>item.id),add:true}})).json();
  assert.deepEqual(saved.keys,[]);
  await request('/api/offers/'+robotDemoExamples[0].id+'/message',{authenticated:true,status:404,body:{key:crypto.randomUUID(),body:'Test message'}});
  for(const table of ['listings','robot_orders','favorites','conversations','messages'])assert.equal(count(table),0,table);
});

test('real listings keep their own count and actions above the separate DEMO cards',async()=>{
  const key=crypto.randomUUID(),at=new Date().toISOString();
  sqlite.prepare(`INSERT INTO listings(id,scope,user_id,client_key,slug,status,type,make,model,price,currency,condition,data,created_at,updated_at,published_at)
    VALUES(?,?,?,?,?,'published','robot','Real fixture','Production listing',500000,'PLN','new',?,?,?,?)`).run(
    key,'live',userId,key,'real-fixture',JSON.stringify({robotCategory:'medyczne',tradeMode:'sale',description:'Fixture of a real listing',stock:1}),at,at,at);
  const result=await request('/roboty/szukaj?category=medyczne');
  assert.match(result.text,/1 prawdziwych ogłoszeń/);
  assert.match(result.text,/href="\/roboty\/oferta\/real-fixture"/);
  assert.match(result.text,new RegExp('data-favorite="'+key+'"'));
  assert.deepEqual(slugs(result.text),['robot-med01','robot-med02']);
  assert.ok(result.text.indexOf('href="/roboty/oferta/real-fixture"')<result.text.indexOf('data-robot-demo-count="2"'));
  const real=(await request('/api/search?market=robotics&category=medyczne')).json();
  assert.equal(real.total,1);assert.deepEqual(real.offers.map(item=>item.id),[key]);
  sqlite.prepare('DELETE FROM listings WHERE id=?').run(key);
});

test('legacy sandbox prefixes are preserved without inserting illustrative examples into any listings scope',async()=>{
  const gallery=await request('/demo/roboty/demo?category=drony');
  assert.deepEqual(slugs(gallery.text),['dron-a01','dron-a02']);
  assert.match(gallery.text,/href="\/demo\/roboty\/demo\/dron-a01"/);
  const detail=await request('/demo/roboty/demo/dron-a01');
  assert.match(detail.text,/href="\/demo\/roboty\/sprzedaj"/);
  assert.match(detail.text,/href="\/demo\/roboty\/szukaj\?category=drony"/);
  assert.doesNotMatch(detail.text,/\/demo\/roboty\/demo\/roboty/);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM listings WHERE id LIKE 'robot-demo-%' OR type='robot'").get().n,0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM listings WHERE scope='live'").get().n,0);
});
