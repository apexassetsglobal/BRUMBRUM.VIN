import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { createOrder, listOrders, orderDetail, changeOrderStatus, robotOrderLimits } from '../src/robot-orders.js';
import { publicOffer } from '../src/market.js';
import { detail as robotDetail } from '../src/views-robots.js';

let sqlite,db,seller,buyer,buyer2,stranger;
const day=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const expectStatus=status=>error=>{assert.equal(error.status,status,error.stack);return true;};

function statement(sql,values=[]) {
  const execute=()=>({success:true,meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}});
  return {bind:(...params)=>statement(sql,params),first:async()=>sqlite.prepare(sql).get(...values)??null,
    all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>execute(),execute};
}

function user(name,scope='live') {
  const key=crypto.randomUUID();
  sqlite.prepare('INSERT INTO users(id,scope,email,name,profile_type,verified_at,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(key,scope,name+'@example.test',name,'company',new Date().toISOString(),new Date().toISOString());
  return {db,scope,prefix:'',ip:name,user:{id:key,scope,name},t:(pl)=>pl};
}

function listing({owner=seller,stock=5,type='robot',status='published',price=12345,currency='EUR',data={}}={}) {
  const key=crypto.randomUUID();
  const details={market:'robotics',robotCategory:'humanoid',tradeMode:'both',rentalPrice:10.01,rentalUnit:'day',
    deposit:55.55,stock,leadTime:0,minimumRental:1,country:'Polska',...data};
  sqlite.prepare(`INSERT INTO listings(id,scope,user_id,client_key,slug,status,make,model,type,condition,price,currency,city,data,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(key,owner.scope,owner.user.id,key,'robot-'+key,status,'Robot','Test',type,'new',price,currency,'Warszawa',JSON.stringify(details),new Date().toISOString(),new Date().toISOString());
  return key;
}

function updateListing(key,patch={}) {
  const current=sqlite.prepare('SELECT data FROM listings WHERE id=?').get(key);
  const data={...JSON.parse(current.data),...patch};
  sqlite.prepare('UPDATE listings SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify(data),key);
}

const request=(kind='purchase',values={})=>({key:crypto.randomUUID(),kind,quantity:1,...(kind==='rental'?{startsOn:day(10),endsOn:day(13)}:{}),...values});
const accept=(key)=>changeOrderStatus(seller,key,{status:'accepted'});
async function offerPage(client,key) {
  const ctx={...client,robotics:true,lang:'pl',url:new URL('https://robots.example.test/roboty/oferta/'+key)};
  return (await robotDetail(ctx,await publicOffer(ctx,key))).body;
}

beforeEach(async()=>{
  sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort()) sqlite.exec(await readFile('drizzle/'+file,'utf8'));
  db={prepare:sql=>statement(sql),batch:async statements=>{
    sqlite.exec('BEGIN IMMEDIATE');
    try {const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  seller=user('seller');buyer=user('buyer');buyer2=user('buyer2');stranger=user('stranger');
});
afterEach(()=>sqlite.close());

test('offer actions and quantity bounds reflect accepted sales and recover after cancellation',async()=>{
  const robot=listing({stock:3});
  const first=await createOrder(buyer,robot,request('purchase',{quantity:2}));
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:3,rental:3},'an unconfirmed request does not consume inventory');
  await accept(first.id);
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:1,rental:1});
  const limited=await offerPage(buyer2,robot);
  const quantities=[...limited.matchAll(/<input\b[^>]*name="quantity"[^>]*>/g)].map(match=>match[0]);
  assert.equal(quantities.length,2);
  assert.ok(quantities.every(tag=>/max="1"/.test(tag)),'purchase and rental forms use the remaining pool');
  const last=await createOrder(buyer2,robot,request());await accept(last.id);
  await changeOrderStatus(seller,first.id,{status:'completed'});
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:0,rental:0});
  for(const client of [buyer,{...buyer,user:null}]) {
    const soldOut=await offerPage(client,robot);
    assert.match(soldOut,/Brak wolnych sztuk do zamówienia/);
    assert.doesNotMatch(soldOut,/data-open="robot-(?:purchase|rental)"/);
    assert.doesNotMatch(soldOut,/data-dialog="robot-(?:purchase|rental)"/);
  }
  await changeOrderStatus(seller,last.id,{status:'cancelled'});
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:1,rental:1});
  assert.match(await offerPage(buyer,robot),/data-open="robot-purchase"/);
  assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM listings WHERE id=?').get(robot).data).stock,3,'the original unit pool is not overwritten');
});

test('purchase limits protect peak future rentals while rental forms avoid promising any particular date',async()=>{
  const robot=listing({stock:4});
  const sold=await createOrder(buyer,robot,request());await accept(sold.id);
  const first=await createOrder(buyer,robot,request('rental',{quantity:2,startsOn:day(10),endsOn:day(12)}));await accept(first.id);
  const next=await createOrder(buyer2,robot,request('rental',{quantity:2,startsOn:day(12),endsOn:day(14)}));await accept(next.id);
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:1,rental:3},'disjoint rentals share the same two units');
  await assert.rejects(createOrder(buyer,robot,request('purchase',{quantity:2})),expectStatus(409));
  const spanning=await createOrder(buyer,robot,request('rental',{quantity:1,startsOn:day(10),endsOn:day(14)}));await accept(spanning.id);
  assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:0,rental:3});
  const html=await offerPage(buyer2,robot);
  assert.doesNotMatch(html,/data-open="robot-purchase"/);
  assert.match(html,/data-open="robot-rental"/);
  assert.match(html,/Dostępność sztuk sprawdzimy dla wybranego terminu/);
  assert.match(html,/Zakup jest obecnie niedostępny/);
});

test('public order limits remain scoped and do not expose unpublished or vehicle stock',async()=>{
  const demoSeller=user('demo-seller','demo:isolated');
  const demoRobot=listing({owner:demoSeller,stock:7});
  assert.deepEqual(await robotOrderLimits(buyer,demoRobot),{purchase:0,rental:0});
  assert.deepEqual(await robotOrderLimits(demoSeller,demoRobot),{purchase:7,rental:7});
  for(const robot of [listing({status:'draft'}),listing({type:'car'}),'missing']) {
    assert.deepEqual(await robotOrderLimits(buyer,robot),{purchase:0,rental:0});
  }
});

test('purchase snapshots server amounts, persists orders, supports strict idempotency and notifies once',async()=>{
  const robot=listing();
  const body=request('purchase',{quantity:2,unitAmount:1,currency:'USD',subtotal:1,note:'Odbiór osobisty'});
  const created=await createOrder(buyer,robot,body);
  assert.equal(created.status,'requested');
  assert.equal(created.order.unit_amount,12345);
  assert.equal(created.order.subtotal_amount,24690);
  assert.equal(created.order.deposit_amount,0);
  assert.equal(created.order.currency,'EUR');
  assert.equal(created.order.isBuyer,true);
  assert.equal(created.order.isSeller,false);
  assert.equal(created.order.canAccept,false);
  assert.equal(created.order.title,'Robot Test');
  assert.equal(created.next,'/roboty/zamowienia/'+created.id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
  sqlite.prepare('UPDATE listings SET price=99999 WHERE id=?').run(robot);
  const retry=await createOrder(buyer,robot,body);
  assert.equal(retry.id,created.id);
  assert.equal(retry.order.unit_amount,12345);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM robot_orders').get().n,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
  await assert.rejects(createOrder(buyer,robot,{...body,quantity:3}),expectStatus(409));
  const other=listing();
  await assert.rejects(createOrder(buyer,other,body),expectStatus(409));
  assert.equal((await listOrders(buyer)).length,1);
  assert.equal((await listOrders(seller))[0].isSeller,true);
  assert.deepEqual(await listOrders(stranger),[]);
  await assert.rejects(orderDetail(stranger,created.id),expectStatus(404));
});

test('rental quote uses exact cents, exclusive return dates, complete billing units and a separate deposit',async()=>{
  const daily=listing();
  const result=await createOrder(buyer,daily,request('rental',{quantity:2,rentalPrice:0.01,deposit:0}));
  assert.equal(result.order.billing_unit,'day');
  assert.equal(result.order.billing_periods,3);
  assert.equal(result.order.unit_amount,1001);
  assert.equal(result.order.subtotal_amount,6006);
  assert.equal(result.order.unit_deposit_amount,5555);
  assert.equal(result.order.deposit_amount,11110);
  assert.equal(result.order.total_amount,17116);
  const weekly=listing({data:{rentalUnit:'week',rentalPrice:25.29,deposit:0}});
  const week=await createOrder(buyer,weekly,request('rental',{startsOn:day(10),endsOn:day(20)}));
  assert.equal(week.order.billing_periods,2);
  assert.equal(week.order.subtotal_amount,5058);
  const monthly=listing({data:{rentalUnit:'month',rentalPrice:100,deposit:0}});
  const month=await createOrder(buyer,monthly,request('rental',{startsOn:day(10),endsOn:day(41)}));
  assert.equal(month.order.billing_periods,2);
  assert.equal(month.order.subtotal_amount,20000);
});

test('concurrent retries create only one request and one notification and remain readable in demo scope',async()=>{
  const robot=listing();
  const body=request();
  const copies=await Promise.all([createOrder(buyer,robot,body),createOrder(buyer,robot,body)]);
  assert.equal(copies[0].id,copies[1].id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM robot_orders').get().n,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
  const demoSeller=user('demo-seller','demo:shared');
  const demoBuyer={...user('demo-buyer','demo:shared'),prefix:'/demo'};
  const demo=await createOrder(demoBuyer,listing({owner:demoSeller}),request());
  assert.equal(demo.next,'/demo/roboty/zamowienia/'+demo.id);
  assert.ok(demo.order.listingUrl.startsWith('/demo/roboty/oferta/'));
  await assert.rejects(orderDetail(buyer,demo.id),expectStatus(404));
});

test('rental dates and minimum durations are validated with current published terms',async()=>{
  const robot=listing();
  for (const values of [
    {startsOn:day(-1),endsOn:day(3)},
    {startsOn:day(4),endsOn:day(4)},
    {startsOn:day(4),endsOn:day(3)},
    {startsOn:'2028-02-30',endsOn:'2028-03-04'},
    {startsOn:day(4)+'x',endsOn:day(8)},
    {startsOn:day(1),endsOn:day(4000)},
    {quantity:0},{quantity:1.5}
  ]) await assert.rejects(createOrder(buyer,robot,request('rental',values)),expectStatus(422));
  updateListing(robot,{minimumRental:2,rentalUnit:'week'});
  await assert.rejects(createOrder(buyer,robot,request('rental',{startsOn:day(10),endsOn:day(23)})),expectStatus(422));
  await createOrder(buyer,robot,request('rental',{startsOn:day(10),endsOn:day(24)}));
  updateListing(robot,{minimumRental:1,rentalUnit:'day',leadTime:20});
  await assert.rejects(createOrder(buyer,robot,request('rental')),expectStatus(422));
});

test('orders require an active same-scope buyer, a published robot, supported mode, other seller and unblocked contact',async()=>{
  const robot=listing();
  await assert.rejects(createOrder({...buyer,user:null},robot,request()),expectStatus(401));
  await assert.rejects(createOrder({...buyer,scope:'demo:someone'},robot,request()),expectStatus(403));
  await assert.rejects(createOrder(seller,robot,request()),expectStatus(422));
  await assert.rejects(createOrder(buyer,listing({type:'car'}),request()),expectStatus(404));
  await assert.rejects(createOrder(buyer,listing({status:'draft'}),request()),expectStatus(404));
  await assert.rejects(createOrder(buyer,listing({status:'sold'}),request()),expectStatus(404));
  const demoSeller=user('demo-seller','demo:other');
  await assert.rejects(createOrder(buyer,listing({owner:demoSeller}),request()),expectStatus(404));
  const rentOnly=listing({price:null,data:{tradeMode:'rent'}});
  await assert.rejects(createOrder(buyer,rentOnly,request()),expectStatus(422));
  const saleOnly=listing({data:{tradeMode:'sale'}});
  await assert.rejects(createOrder(buyer,saleOnly,request('rental')),expectStatus(422));
  await assert.rejects(createOrder(buyer,listing({stock:0}),request()),expectStatus(409));
  sqlite.prepare('INSERT INTO blocks(user_id,blocked_id,created_at) VALUES(?,?,?)').run(seller.user.id,buyer.user.id,new Date().toISOString());
  await assert.rejects(createOrder(buyer,robot,request()),expectStatus(409));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM robot_orders').get().n,0);
});

test('only one concurrent purchase can be accepted for one unit, and completed sales keep consuming stock',async()=>{
  const robot=listing({stock:1});
  const a=await createOrder(buyer,robot,request());
  const b=await createOrder(buyer2,robot,request());
  const outcomes=await Promise.allSettled([accept(a.id),accept(b.id)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  const failed=outcomes.find(x=>x.status==='rejected');
  assert.equal(failed.reason.status,409);
  const winner=outcomes.find(x=>x.status==='fulfilled').value;
  const firstNotifications=sqlite.prepare('SELECT COUNT(*) AS n FROM notifications').get().n;
  await accept(winner.id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,firstNotifications);
  await changeOrderStatus(seller,winner.id,{status:'completed'});
  await assert.rejects(createOrder(stranger,robot,request()),expectStatus(409));
  await assert.rejects(changeOrderStatus(seller,winner.id,{status:'cancelled'}),expectStatus(409));
});

test('rentals share a pool by peak concurrency, permit touching endpoints, and reject overlapping overbooking',async()=>{
  const robot=listing({stock:3});
  const a=await createOrder(buyer,robot,request('rental',{quantity:2,startsOn:day(10),endsOn:day(12)}));
  const b=await createOrder(buyer2,robot,request('rental',{quantity:2,startsOn:day(12),endsOn:day(14)}));
  const spanning=await createOrder(stranger,robot,request('rental',{quantity:1,startsOn:day(10),endsOn:day(14)}));
  const excess=await createOrder(stranger,robot,request('rental',{quantity:2,startsOn:day(11),endsOn:day(13)}));
  await accept(a.id);await accept(b.id);await accept(spanning.id);
  await assert.rejects(accept(excess.id),expectStatus(409));
  await assert.rejects(createOrder(stranger,robot,request('rental',{startsOn:day(11),endsOn:day(12)})),expectStatus(409));
  const after=await createOrder(buyer,robot,request('rental',{quantity:3,startsOn:day(14),endsOn:day(15)}));
  await accept(after.id);
  const one=listing({stock:1});
  const c=await createOrder(buyer,one,request('rental',{startsOn:day(20),endsOn:day(22)}));
  const d=await createOrder(buyer2,one,request('rental',{startsOn:day(20),endsOn:day(22)}));
  const concurrent=await Promise.allSettled([accept(c.id),accept(d.id)]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(concurrent.find(x=>x.status==='rejected').reason.status,409);
});

test('sales respect future accepted rentals and an accepted sale reduces rental capacity',async()=>{
  const robot=listing({stock:2});
  const rented=await createOrder(buyer,robot,request('rental'));
  const purchase=await createOrder(buyer2,robot,request('purchase',{quantity:2}));
  await accept(rented.id);
  await assert.rejects(accept(purchase.id),expectStatus(409));
  const single=await createOrder(buyer2,robot,request());
  await accept(single.id);
  await assert.rejects(createOrder(stranger,robot,request('rental')),expectStatus(409));
  const later=await createOrder(stranger,robot,request('rental',{startsOn:day(14),endsOn:day(16)}));
  await accept(later.id);
  await changeOrderStatus(seller,single.id,{status:'cancelled'});
  const released=await createOrder(buyer2,robot,request('rental'));
  await accept(released.id);
});

test('seller decisions enforce actors, state transitions, current price, listing publication and rental terms',async()=>{
  const robot=listing();
  const purchase=await createOrder(buyer,robot,request());
  await assert.rejects(changeOrderStatus(buyer,purchase.id,{status:'accepted'}),expectStatus(403));
  await assert.rejects(changeOrderStatus(stranger,purchase.id,{status:'accepted'}),expectStatus(404));
  sqlite.prepare('UPDATE listings SET price=20000 WHERE id=?').run(robot);
  await assert.rejects(accept(purchase.id),expectStatus(409));
  sqlite.prepare('UPDATE listings SET price=12345,status=\'archived\' WHERE id=?').run(robot);
  await assert.rejects(accept(purchase.id),expectStatus(409));
  sqlite.prepare("UPDATE listings SET status='published' WHERE id=?").run(robot);
  await accept(purchase.id);
  await assert.rejects(changeOrderStatus(buyer,purchase.id,{status:'cancelled'}),expectStatus(403));
  await assert.rejects(changeOrderStatus(seller,purchase.id,{status:'rejected'}),expectStatus(409));
  const rental=await createOrder(buyer2,robot,request('rental'));
  updateListing(robot,{rentalPrice:11});
  await assert.rejects(accept(rental.id),expectStatus(409));
  updateListing(robot,{rentalPrice:10.01,deposit:66});
  await assert.rejects(accept(rental.id),expectStatus(409));
  updateListing(robot,{deposit:55.55,rentalUnit:'week'});
  await assert.rejects(accept(rental.id),expectStatus(409));
  updateListing(robot,{rentalUnit:'day',leadTime:20});
  await assert.rejects(accept(rental.id),expectStatus(409));
  updateListing(robot,{leadTime:0});await accept(rental.id);
  await assert.rejects(changeOrderStatus(seller,rental.id,{status:'completed'}),expectStatus(422));
  const cancel=await createOrder(stranger,robot,request());
  await changeOrderStatus(stranger,cancel.id,{status:'cancelled'});
  await assert.rejects(accept(cancel.id),expectStatus(409));
});
