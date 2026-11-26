import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '../src/core.js';
import { translator } from '../src/i18n.js';
import { auditSupport, drainStripeInbox, startSupport, stripeWebhook, supportConfiguration, supportPackages, supportReturn } from '../src/support.js';
import { supportAdminPanel, supportChoices, supportPage, supportReturnPage } from '../src/views-support.js';

const secret='whsec_DevelopmentFixtureOnly';
const returnPath='/wsparcie/powrot?session_id={CHECKOUT_SESSION_ID}';
const eventTypes=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
const fails=status=>error=>error instanceof AppError&&error.status===status;

function fixture(t) {
  const sqlite=new DatabaseSync(':memory:');
  const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
  for (const {tag} of journal.entries) sqlite.exec(readFileSync(new URL('../drizzle/'+tag+'.sql',import.meta.url),'utf8'));
  sqlite.exec("INSERT INTO users(id,scope,email,name,profile_type,created_at) VALUES('qa-user','live','qa@example.test','QA','private',datetime('now')),('qa-other','live','other@example.test','Other','private',datetime('now'))");
  sqlite.exec("INSERT INTO listings(id,scope,user_id,client_key,created_at,updated_at) VALUES('qa-car','live','qa-user','qa-client',datetime('now'),datetime('now'))");
  t.after(()=>sqlite.close());
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
  const ctx={db,origin:'http://127.0.0.1:3000',prefix:'',scope:'live',demo:false,lang:'pl',t:translator('pl'),
    user:{id:'qa-user',role:'user'},url:new URL('http://127.0.0.1:3000/wsparcie'),
    env:{runtime:'node',APP_MODE:'development',STRIPE_SUPPORT_MODE:'test',STRIPE_SUPPORT_ENABLED:'1',
      STRIPE_RESTRICTED_KEY:'rk_test_DevelopmentFixtureOnly',STRIPE_ACCOUNT_ID:'acct_QAFixture',STRIPE_WEBHOOK_SECRET:secret,
      STRIPE_TAX_REVIEWED_AT:'2026-01-01T00:00:00.000Z',
      STRIPE_TEST_PAYMENT_LINKS:JSON.stringify(Object.fromEntries(supportPackages.map((item,index)=>[item.id,'https://buy.stripe.com/test_QA'+index])))}};
  const links=supportPackages.map((item,index)=>({id:'plink_QA'+index,url:'https://buy.stripe.com/test_QA'+index,active:true,livemode:false,currency:'pln',
    subscription_data:{description:null,trial_period_days:null},allow_promotion_codes:false,automatic_tax:{enabled:false},
    after_completion:{type:'redirect',redirect:{url:ctx.origin+returnPath}}}));
  const lines=supportPackages.map((item,index)=>({data:[{quantity:1,adjustable_quantity:{enabled:false},price:{
    id:'price_QA'+index,type:'one_time',active:true,currency:'pln',unit_amount:item.amount,recurring:null,
    tax_behavior:'inclusive',product:{name:item.name,tax_code:'txcd_fixture'}}}],has_more:false}));
  const account={id:'acct_QAFixture',charges_enabled:true,country:'PL',details_submitted:true,business_type:'individual'};
  const tax={status:'active'},registrations={data:[{id:'taxreg_fixture',status:'active'}]};
  const webhooks={data:[{url:ctx.origin+'/api/stripe/webhook',status:'enabled',livemode:false,enabled_events:eventTypes}]};
  const sessions=new Map(),calls=[];
  const inbox={ready:true,events:[],calls:[]};
  function useReceiver() {
    ctx.env.STRIPE_WEBHOOK_ORIGIN='https://webhook.example.test';
    ctx.env.STRIPE_INBOX_TOKEN='a'.repeat(64);
    delete ctx.env.STRIPE_WEBHOOK_SECRET;
    const liveMode=ctx.env.STRIPE_SUPPORT_MODE==='live';
    webhooks.data[0].url=ctx.env.STRIPE_WEBHOOK_ORIGIN+(liveMode?'':'/sandbox')+'/api/stripe/webhook';
  }
  function live() {
    ctx.env.STRIPE_SUPPORT_MODE='live';ctx.env.STRIPE_RESTRICTED_KEY='rk_live_DevelopmentFixtureOnly';
    ctx.origin='https://brumbrum.example.test';
    links.forEach((link,index)=>{link.url='https://buy.stripe.com/verifiedQAFixture'+index;link.livemode=true;link.after_completion.redirect.url=ctx.origin+returnPath;});
    ctx.env.STRIPE_LIVE_PAYMENT_LINKS=JSON.stringify(Object.fromEntries(supportPackages.map((item,index)=>[item.id,links[index].url])));
    webhooks.data[0].url=ctx.origin+'/api/stripe/webhook';webhooks.data[0].livemode=true;
  }
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const parsed=new URL(url);
    if(parsed.origin==='https://webhook.example.test'){
      assert.equal(parsed.pathname,'/internal/stripe/inbox');
      assert.equal(options.headers.Authorization,'Bearer '+ctx.env.STRIPE_INBOX_TOKEN);
      assert.equal(options.redirect,'error');
      const cmd=JSON.parse(options.body);inbox.calls.push(cmd);
      if(cmd.operation==='status')return Response.json({ready:inbox.ready,live:cmd.live,account:account.id});
      if(cmd.operation==='pending')return Response.json({events:inbox.events.filter(e=>!cmd.session||cmd.session===e.session_id)});
      if(cmd.operation==='ack')inbox.events=inbox.events.filter(e=>!cmd.ids.includes(e.event_id));
      else assert.equal(cmd.operation,'retry');
      return Response.json({ok:true});
    }
    assert.equal(parsed.origin,'https://api.stripe.com');
    assert.equal(options.headers.Authorization,'Bearer '+ctx.env.STRIPE_RESTRICTED_KEY);
    assert.equal(options.redirect,'error');
    calls.push(parsed.pathname);
    const path=parsed.pathname.replace('/v1','');
    let data;
    if(path==='/account') data=account;
    else if(path==='/tax/settings') data=tax;
    else if(path==='/tax/registrations') data=registrations;
    else if(path==='/webhook_endpoints') data=webhooks;
    else if(path==='/payment_links') data={data:links,has_more:false};
    else if(/^\/payment_links\/plink_QA\d\/line_items$/.test(path)) data=lines[Number(path.match(/QA(\d)/)[1])];
    else if(path.startsWith('/checkout/sessions/')) data=sessions.get(path.split('/').at(-1));
    else throw new Error('Unexpected Stripe call '+path);
    return Response.json(data??{error:{message:'Fixture not found'}},{status:data?200:404});
  });
  function eventRequest(sessionId,{type=eventTypes[0],id='evt_QA'+crypto.randomUUID().replaceAll('-',''),livemode=false,timestamp=Math.floor(Date.now()/1000),tamper=false,header=true}={}) {
    const event={id,type,livemode,data:{object:{id:sessionId}}};
    const raw=JSON.stringify(event);
    const signature=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
    ctx.req=new Request(ctx.origin+'/api/stripe/webhook',{method:'POST',body:raw+(tamper?' ':''),
      headers:header?{'Stripe-Signature':`t=${timestamp},v1=${signature}`}:{}});
    return event;
  }
  async function attempt(index=0,key=crypto.randomUUID()) {
    const result=await startSupport(ctx,{package:supportPackages[index].id,key,listing:'qa-car'});
    const reference=new URL(result.next).searchParams.get('client_reference_id');
    return {result,reference,key};
  }
  const session=(reference,index=0,extra={})=>({id:'cs_test_QA'+crypto.randomUUID().replaceAll('-',''),client_reference_id:reference,
    payment_link:'plink_QA'+index,livemode:false,mode:'payment',subscription:null,currency:'pln',amount_total:supportPackages[index].amount,
    status:'complete',payment_status:'paid',...extra});
  return {ctx,sqlite,links,lines,account,tax,registrations,webhooks,sessions,calls,eventRequest,attempt,session,live,inbox,useReceiver};
}

test('support stays disabled without reviewed server configuration, and hosted test mode requires an explicitly selected sandbox origin',async t=>{
  const f=fixture(t);
  delete f.ctx.env.STRIPE_TAX_REVIEWED_AT;
  assert.equal(supportConfiguration(f.ctx).ready,false);
  await assert.rejects(startSupport(f.ctx,{package:'pit-stop',key:'qa-idempotency'}),fails(503));
  assert.equal(f.calls.length,0);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_attempts').get().n,0);
  f.ctx.env.STRIPE_TAX_REVIEWED_AT='2026-01-01';
  f.ctx.origin='https://public.example.test';
  assert.equal(supportConfiguration(f.ctx).ready,false);
  f.ctx.env.STRIPE_SANDBOX_ORIGIN=f.ctx.origin;
  assert.equal(supportConfiguration(f.ctx).ready,true);
  f.ctx.origin='http://127.0.0.1:3000';f.ctx.demo=true;
  await assert.rejects(startSupport(f.ctx,{package:'pit-stop',key:'qa-idempotency'}),fails(403));
  f.ctx.demo=false;f.ctx.user=null;
  await assert.rejects(startSupport(f.ctx,{}),fails(401));
});

test('four one-time PLN Payment Links are verified and mapped before redirect, with retry idempotency',async t=>{
  const f=fixture(t);
  for(let index=0;index<4;index++) {
    const {result,reference,key}=await f.attempt(index);
    assert.equal(result.next,`https://buy.stripe.com/test_QA${index}?client_reference_id=${reference}`);
    assert.deepEqual(await startSupport(f.ctx,{package:supportPackages[index].id,key,listing:'qa-car'}),result);
    const attempt=f.sqlite.prepare('SELECT * FROM support_attempts WHERE id=?').get(reference);
    assert.equal(attempt.amount,[1000,10000,100000,1000000][index]);assert.equal(attempt.currency,'pln');
  }
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_attempts').get().n,4);
  assert.equal(f.sqlite.prepare("SELECT status FROM listings WHERE id='qa-car'").get().status,'draft');
  f.ctx.user={id:'qa-other',role:'user'};
  await assert.rejects(f.attempt(),fails(403));
});

test('production redirects use the four account-verified links, and live audit requires the complete webhook endpoint',async t=>{
  const f=fixture(t);f.live();
  for(const [index,item] of supportPackages.entries()) {
    const result=await startSupport(f.ctx,{key:crypto.randomUUID(),package:item.id});
    assert.equal(result.next.split('?')[0],f.links[index].url);
  }
  f.ctx.env.STRIPE_SUPPORT_ENABLED='0';
  const reviewed=await auditSupport(f.ctx);
  assert.equal(reviewed.verified,true);assert.equal(reviewed.ready,false);
  f.ctx.env.STRIPE_SUPPORT_ENABLED='1';
  f.webhooks.data=[];
  await assert.rejects(auditSupport(f.ctx),fails(409));
  f.ctx.env.STRIPE_SUPPORT_MODE='test';
  f.ctx.origin='http://127.0.0.1:3000';f.ctx.env.STRIPE_RESTRICTED_KEY='rk_test_DevelopmentFixtureOnly';
  f.links.forEach((link,index)=>{link.url='https://buy.stripe.com/test_QA'+index;link.livemode=false;link.after_completion.redirect.url=f.ctx.origin+returnPath;});
  assert.equal((await auditSupport(f.ctx)).ready,true);
});

test('catalog titles may include the displayed PLN amount for the same package',async t=>{
  const f=fixture(t);
  const names=['PIT STOP BRUMBRUM.VIN 10 zł','V8 CLUB BRUMBRUM 100 zł',
    'SUPERCAR ELITE BRUMBRUM.VIN 1\u00a0000 zł','HYPERCAR SOVEREIGN BRUMBRUM.VIN 10\u202f000 zł'];
  names.forEach((name,index)=>{f.lines[index].data[0].price.product.name=name;});
  assert.equal((await auditSupport(f.ctx)).verified,true);
  f.lines[1].data[0].price.product.name='V8 CLUB BRUMBRUM 10 zł';
  await assert.rejects(auditSupport(f.ctx),fails(409));
});

test('standalone Payment Links expose only configured live packages and keep the listing and receipts untouched',async t=>{
  const f=fixture(t);f.live();
  const ctx=f.ctx;
  ctx.env.STRIPE_SUPPORT_CHECKOUT='hosted_links';
  delete ctx.env.STRIPE_RESTRICTED_KEY;
  const mapping=JSON.parse(ctx.env.STRIPE_LIVE_PAYMENT_LINKS);
  delete mapping['hypercar-sovereign'];
  ctx.env.STRIPE_LIVE_PAYMENT_LINKS=JSON.stringify(mapping);
  const page=await supportPage(ctx);
  assert.equal((page.body.match(/href="https:\/\/buy\.stripe\.com\//g)||[]).length,3);
  for(const [id,url] of Object.entries(mapping)) {
    assert.ok(page.body.split('data-package="'+id+'"')[1].split('</article>')[0].includes('href="'+url+'"'));
    assert.deepEqual(await startSupport(ctx,{package:id,key:crypto.randomUUID(),listing:'qa-car'}),{next:url});
  }
  assert.equal((supportChoices(ctx).match(/ disabled/g)||[]).length,1);
  await assert.rejects(f.attempt(3),fails(503));
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM support_attempts').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM support_payments').get().n,0);
  assert.equal(f.sqlite.prepare("SELECT status FROM listings WHERE id='qa-car'").get().status,'draft');
  ctx.env.STRIPE_LIVE_PAYMENT_LINKS=JSON.stringify({...mapping,'pit-stop':mapping['v8-club']});
  await assert.rejects(f.attempt(0),fails(503));
  await assert.rejects(f.attempt(1),fails(503));
  ctx.env.STRIPE_SUPPORT_ENABLED='0';
  await assert.rejects(f.attempt(2),fails(503));
  assert.doesNotMatch((await supportPage(ctx)).body,/buy\.stripe\.com/);
  ctx.env.STRIPE_SUPPORT_ENABLED='1';ctx.demo=true;
  assert.doesNotMatch((await supportPage(ctx)).body,/buy\.stripe\.com/);
  await assert.rejects(f.attempt(2),fails(403));
  ctx.demo=false;ctx.env.STRIPE_SUPPORT_MODE='test';
  await assert.rejects(f.attempt(2),fails(503));
  assert.equal(f.calls.length,0);
});

test('configuration rejects wrong amount, currency, recurring prices, mutable totals, return URL and wrong account',async t=>{
  const changes=[
    f=>f.lines[0].data[0].price.unit_amount=999,
    f=>f.lines[1].data[0].price.currency='eur',
    f=>f.links[0].currency='eur',
    f=>f.lines[2].data[0].price.type='recurring',
    f=>f.lines[2].data[0].price.recurring={interval:'month'},
    f=>f.lines[0].data[0].price.product.name='Other product',
    f=>f.links[3].active=false,
    f=>{f.live();const map=JSON.parse(f.ctx.env.STRIPE_LIVE_PAYMENT_LINKS);map['pit-stop']='https://buy.stripe.com/fZu14mbfW0veh4eN69oc01';f.ctx.env.STRIPE_LIVE_PAYMENT_LINKS=JSON.stringify(map);},
    f=>f.links[0].livemode=true,
    f=>f.links[0].allow_promotion_codes=true,
    f=>f.lines[0].data[0].adjustable_quantity.enabled=true,
    f=>f.links[1].shipping_options=[{shipping_rate:'shr_fixture'}],
    f=>f.links[0].optional_items=[{price:'price_extra'}],
    f=>f.links[0].after_completion={type:'hosted_confirmation'},
    f=>f.links[0].after_completion.redirect.url='https://elsewhere.example.test',
    f=>f.account.id='acct_OtherAccount',
    f=>{f.live();f.account.country='DE';},
    f=>{f.live();f.account.details_submitted=false;},
    f=>f.lines[0].data[0].price.product.name='PIT STOP BRUMBRUM unrelated',
    f=>{f.useReceiver();f.webhooks.data[0].url=f.ctx.origin+'/api/stripe/webhook';},
    f=>{f.useReceiver();f.inbox.ready=false;},
    f=>{f.live();f.webhooks.data[0].enabled_events=['checkout.session.completed'];},
    f=>{f.links[0].automatic_tax.enabled=true;f.lines[0].data[0].price.tax_behavior='exclusive';},
    f=>{f.links[0].automatic_tax.enabled=true;f.tax.status='pending';}
  ];
  for(let index=0;index<changes.length;index++) await t.test('rejection '+(index+1),async child=>{
    const f=fixture(child);changes[index](f);
    await assert.rejects(auditSupport(f.ctx),fails(409));
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_attempts').get().n,0);
  });
});

test('raw-body webhook signatures reject missing, altered, old, future and wrong-mode events',async t=>{
  // The future sample must stay outside the 300-second window while async
  // signature checks run; wall-clock progress could otherwise make it valid.
  const currentTime=Math.floor(Date.now()/1000)*1000;
  t.mock.method(Date,'now',()=>currentTime);
  const f=fixture(t);
  for(const options of [{header:false},{tamper:true},{timestamp:Math.floor(Date.now()/1000)-301},
    {timestamp:Math.floor(Date.now()/1000)+301},{livemode:true}]) {
    f.eventRequest('cs_test_QAFixture',options);
    await assert.rejects(stripeWebhook(f.ctx),fails(403));
  }
  assert.equal(f.calls.length,0);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_events').get().n,0);
});

test('webhooks persist pending and confirmed states, handle retries, late events and multiple sessions',async t=>{
  const f=fixture(t),{reference}=await f.attempt();
  const session=f.session(reference,0,{payment_status:'unpaid'});f.sessions.set(session.id,session);
  const event=f.eventRequest(session.id);
  assert.equal((await stripeWebhook(f.ctx)).status,200);
  assert.equal(f.sqlite.prepare('SELECT status FROM support_payments').get().status,'pending');
  session.payment_status='paid';
  f.eventRequest(session.id,{type:'checkout.session.async_payment_succeeded'});
  await stripeWebhook(f.ctx);
  assert.equal(f.sqlite.prepare('SELECT status FROM support_payments').get().status,'paid');
  const paidAt=f.sqlite.prepare('SELECT paid_at FROM support_payments').get().paid_at;
  const callCount=f.calls.length;
  f.eventRequest(session.id,{id:event.id});await stripeWebhook(f.ctx);
  assert.equal(f.calls.length,callCount);
  session.payment_status='unpaid';session.status='expired';
  f.eventRequest(session.id,{type:'checkout.session.expired'});await stripeWebhook(f.ctx);
  assert.equal(f.sqlite.prepare('SELECT status FROM support_payments').get().status,'paid');
  assert.equal(f.sqlite.prepare('SELECT paid_at FROM support_payments').get().paid_at,paidAt);
  const second=f.session(reference);f.sessions.set(second.id,second);
  f.eventRequest(second.id);await stripeWebhook(f.ctx);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_payments').get().n,2);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_attempts').get().n,1);
  assert.equal(f.sqlite.prepare("SELECT status FROM listings WHERE id='qa-car'").get().status,'draft');
});

test('forged totals, other currencies, other links and subscriptions never record a payment',async t=>{
  const f=fixture(t),{reference}=await f.attempt();
  for(const extra of [{amount_total:1},{currency:'eur'},{payment_link:'plink_Elsewhere'},{mode:'subscription'},
    {subscription:'sub_fixture'},{livemode:true}]) {
    const session=f.session(reference,0,extra);f.sessions.set(session.id,session);f.eventRequest(session.id);
    await assert.rejects(stripeWebhook(f.ctx),fails(403));
  }
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_payments').get().n,0);
});

test('return pages trust stored webhook records and limit visibility to the contributor',async t=>{
  const f=fixture(t),{reference}=await f.attempt();
  const session=f.session(reference);f.sessions.set(session.id,session);
  f.ctx.url=new URL(f.ctx.origin+'/wsparcie/powrot?session_id='+session.id+'&success=true');
  assert.equal(await supportReturn(f.ctx),null);
  assert.doesNotMatch((await supportReturnPage(f.ctx)).body,/Stripe potwierdził jednorazową wpłatę/);
  f.eventRequest(session.id);await stripeWebhook(f.ctx);
  assert.equal((await supportReturn(f.ctx)).status,'paid');
  assert.match((await supportReturnPage(f.ctx)).body,/Stripe potwierdził jednorazową wpłatę/);
  f.ctx.user={id:'qa-other',role:'user'};
  assert.equal(await supportReturn(f.ctx),null);
  f.ctx.url=new URL(f.ctx.origin+'/wsparcie?anulowano=1');
  assert.match((await supportPage(f.ctx)).body,/Przerwano płatność/);
  await assert.rejects(supportAdminPanel(f.ctx),fails(403));
});

test('asynchronous failure and expiry show no confirmation and never affect listing status',async t=>{
  const f=fixture(t),{reference}=await f.attempt();
  for(const type of ['checkout.session.async_payment_failed','checkout.session.expired']) {
    const session=f.session(reference,0,{status:type.endsWith('expired')?'expired':'complete',payment_status:'unpaid'});
    f.sessions.set(session.id,session);f.eventRequest(session.id,{type});await stripeWebhook(f.ctx);
    f.ctx.url=new URL(f.ctx.origin+'/wsparcie/powrot?session_id='+session.id);
    assert.match((await supportReturnPage(f.ctx)).body,/Płatność nie została potwierdzona/);
  }
  assert.equal(f.sqlite.prepare("SELECT status FROM listings WHERE id='qa-car'").get().status,'draft');
});

test('support choices contain all four prices and no retired or recurring payment links',async t=>{
  const f=fixture(t),html=supportChoices(f.ctx);
  assert.equal((html.match(/name="support"/g)||[]).length,4);
  assert.match(html,/nie wpływa na widoczność ani pozycjonowanie/);
  assert.doesNotMatch(html,/buy\.stripe\.com|subskrypc|odnawian/);
  delete f.ctx.env.STRIPE_RESTRICTED_KEY;
  const page=await supportPage(f.ctx);
  assert.equal((page.body.match(/ disabled/g)||[]).length,4);
  assert.match(page.body,/Przejdź do moich ogłoszeń/);
});


test('new contributions require four distinct available links in the correct Stripe mode',t=>{
  const f=fixture(t);f.live();
  const original=JSON.parse(f.ctx.env.STRIPE_LIVE_PAYMENT_LINKS);
  const bad=['https://buy.stripe.com/6oUcN45VC9l1a0O6gA9oc00',
    original['v8-club'],'https://buy.stripe.com/test_QA0','https://not-stripe.example.test/QAFixture',null];
  for(const url of bad){
    f.ctx.env.STRIPE_LIVE_PAYMENT_LINKS=JSON.stringify({...original,'pit-stop':url});
    assert.equal(supportConfiguration(f.ctx).configured,false);
  }
  delete f.ctx.env.STRIPE_LIVE_PAYMENT_LINKS;
  assert.equal(supportConfiguration(f.ctx).configured,false);
  assert.equal(f.calls.length,0);
});

test('relay acknowledgment follows durable settlement and retries Stripe failures after checkout is disabled',async t=>{
  const f=fixture(t);f.useReceiver();
  const {reference}=await f.attempt();
  const session=f.session(reference,0,{payment_status:'unpaid'});
  const notice={event_id:'evt_QARelay',event_type:'checkout.session.completed',session_id:session.id,account_id:f.account.id};
  f.inbox.events=[notice];
  f.ctx.env.STRIPE_SUPPORT_ENABLED='0';
  delete f.ctx.env.STRIPE_TAX_REVIEWED_AT;
  delete f.ctx.env.STRIPE_TEST_PAYMENT_LINKS;
  await drainStripeInbox(f.ctx);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_events').get().n,0);
  assert.deepEqual(f.inbox.calls.at(-1).ids,[notice.event_id]);
  assert.equal(f.inbox.calls.at(-1).operation,'retry');
  f.sessions.set(session.id,session);
  await drainStripeInbox(f.ctx);
  assert.equal(f.inbox.calls.at(-1).operation,'ack');
  assert.equal(f.sqlite.prepare('SELECT status FROM support_payments').get().status,'pending');
  session.payment_status='paid';
  const success={...notice,event_id:'evt_QARelaySucceeded',event_type:'checkout.session.async_payment_succeeded'};
  f.inbox.events=[success];f.ctx.url=new URL(f.ctx.origin+'/wsparcie/powrot?session_id='+session.id);
  assert.equal((await supportReturn(f.ctx)).status,'paid');
  const before=f.calls.length;
  f.inbox.events=[success];await drainStripeInbox(f.ctx);
  assert.equal(f.calls.length,before);
  assert.equal(f.inbox.calls.at(-1).operation,'ack');
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_payments').get().n,1);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_events').get().n,2);
  f.ctx.user={id:'qa-other',role:'user'};
  assert.equal(await supportReturn(f.ctx),null);
});

test('relay rejects mismatched account and price without acknowledging or marking a session paid',async t=>{
  const f=fixture(t);f.useReceiver();const {reference}=await f.attempt();
  const session=f.session(reference,0,{amount_total:10});f.sessions.set(session.id,session);
  f.inbox.events=[{event_id:'evt_WrongTotal',event_type:eventTypes[0],session_id:session.id,account_id:f.account.id},
    {event_id:'evt_WrongAccount',event_type:eventTypes[0],session_id:session.id,account_id:'acct_Other'}];
  await drainStripeInbox(f.ctx);
  assert.equal(f.inbox.calls.at(-1).operation,'retry');
  assert.deepEqual(f.inbox.calls.at(-1).ids,['evt_WrongTotal','evt_WrongAccount']);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM support_payments').get().n,0);
});
