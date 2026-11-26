import { encoder, fail, forbidden, id, isId, json, limitedBody, missing, now, requireUser, row, run, stmt } from './core.js';
import { owned } from './market.js';

export const supportPackages=Object.freeze([
  {id:'pit-stop',name:'PIT STOP BRUMBRUM',amount:1000,
    description:['Dobrowolne wsparcie reklamy, pozycjonowania SEO i rozwoju platformy.','Voluntary support for platform advertising, SEO and development.']},
  {id:'v8-club',name:'V8 CLUB BRUMBRUM',amount:10000,
    description:['Dobrowolne wsparcie kampanii reklamowych, promocji i zwiększania rozpoznawalności platformy.','Voluntary support for advertising campaigns, promotion and platform awareness.']},
  {id:'supercar-elite',name:'SUPERCAR ELITE BRUMBRUM',amount:100000,
    description:['Dobrowolne wsparcie rozwoju aplikacji, działań marketingowych i pozycjonowania BRUMBRUM.VIN.','Voluntary support for app development, marketing and BRUMBRUM.VIN SEO.']},
  {id:'hypercar-sovereign',name:'HYPERCAR SOVEREIGN BRUMBRUM',amount:1000000,
    description:['Najwyższy poziom dobrowolnego wsparcia reklamy, pozycjonowania i rozwoju BRUMBRUM.VIN.','The highest level of voluntary support for BRUMBRUM.VIN advertising, SEO and development.']}
]);
export const supportPackage=value=>supportPackages.find(item=>item.id===value);
const expectedLive=ctx=>ctx.env.STRIPE_SUPPORT_MODE!=='test';
const localSandbox=ctx=>ctx.env.runtime==='node'&&ctx.env.APP_MODE==='development'&&['localhost','127.0.0.1'].includes(new URL(ctx.origin).hostname);
const validTest=ctx=>localSandbox(ctx)||(ctx.origin.startsWith('https://')&&ctx.env.STRIPE_SANDBOX_ORIGIN===ctx.origin);
const returnUrl=ctx=>ctx.origin+'/wsparcie/powrot?session_id={CHECKOUT_SESSION_ID}';
function receiverOrigin(ctx) {
  const value=ctx.env.STRIPE_WEBHOOK_ORIGIN;
  if(!value)return '';
  try {const u=new URL(value);return u.protocol==='https:'&&u.origin===value?u.origin:'';}catch{return '';}
}
export function supportWebhookUrl(ctx) {
  const origin=receiverOrigin(ctx);
  return origin?origin+(expectedLive(ctx)?'/api/stripe/webhook':'/sandbox/api/stripe/webhook'):ctx.origin+'/api/stripe/webhook';
}
export function paymentUrl(ctx,item) {
  const live=expectedLive(ctx), value=live?ctx.env.STRIPE_LIVE_PAYMENT_LINKS:ctx.env.STRIPE_TEST_PAYMENT_LINKS;
  let mapping;try{mapping=JSON.parse(value||'{}');}catch{return '';}
  const url=mapping?.[item.id];
  if(typeof url!=='string')return '';
  const pattern=live?/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/:/^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+$/;
  if(!pattern.test(url))return '';
  return new URL(url).pathname==='/6oUcN45VC9l1a0O6gA9oc00'?'':url;
}

// Hosted links are enabled explicitly for voluntary contributions settled entirely in Stripe.
// A missing link disables just that package. A URL shared by two packages is ambiguous.
export function hostedCheckout(ctx) {
  if (ctx.env.STRIPE_SUPPORT_CHECKOUT !== 'hosted_links') return null;
  const targets = supportPackages.map(item => paymentUrl(ctx,item));
  const links = new Map();
  if (ctx.env.STRIPE_SUPPORT_MODE === 'live' && ctx.origin.startsWith('https://') && !ctx.demo) {
    supportPackages.forEach((item,index) => {
      const url = targets[index];
      if (url && targets.indexOf(url) === targets.lastIndexOf(url)) links.set(item.id,url);
    });
  }
  return {enabled:ctx.env.STRIPE_SUPPORT_ENABLED === '1', links};
}

function productNameMatches(item, value) {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleUpperCase('pl-PL');
  // A merchant may include the PLN display price in the title. The actual Stripe Price is checked separately.
  const amount = item.amount / 100;
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  const names = [item.name,item.name+'.VIN'];
  return names.some(name => normalized === name ||
    [String(amount),grouped].some(display =>
      [' ZŁ',' PLN'].some(unit => normalized === name+' '+display+unit)));
}
function stripeKeyMatches(ctx) {
  return new RegExp('^[rs]k_'+(expectedLive(ctx)?'live':'test')+'_[A-Za-z0-9]+$').test(ctx.env.STRIPE_RESTRICTED_KEY||'');
}
const unavailable=()=>fail(503,'Wsparcie jest chwilowo niedostępne. Publikacja ogłoszenia pozostaje bezpłatna.',
  'Support is currently unavailable. Listing publication remains free.');

export function supportConfiguration(ctx) {
  const live=expectedLive(ctx);
  const external=Boolean(ctx.env.STRIPE_WEBHOOK_ORIGIN);
  const checks={
    STRIPE_SUPPORT_ENABLED:ctx.env.STRIPE_SUPPORT_ENABLED==='1',
    STRIPE_SUPPORT_MODE:['live','test'].includes(ctx.env.STRIPE_SUPPORT_MODE),
    STRIPE_RESTRICTED_KEY:stripeKeyMatches(ctx),
    STRIPE_ACCOUNT_ID:/^acct_[A-Za-z0-9]+$/.test(ctx.env.STRIPE_ACCOUNT_ID||''),
    ...(external?{STRIPE_WEBHOOK_ORIGIN:Boolean(receiverOrigin(ctx)),STRIPE_INBOX_TOKEN:/^[a-f0-9]{64}$/.test(ctx.env.STRIPE_INBOX_TOKEN||'')}:{STRIPE_WEBHOOK_SECRET:/^whsec_[A-Za-z0-9]+$/.test(ctx.env.STRIPE_WEBHOOK_SECRET||'')}),
    STRIPE_TAX_REVIEWED_AT:Number.isFinite(Date.parse(ctx.env.STRIPE_TAX_REVIEWED_AT||''))&&Date.parse(ctx.env.STRIPE_TAX_REVIEWED_AT)<=Date.now(),
    origin:live?ctx.origin.startsWith('https://'):validTest(ctx)
  };
  const urls=supportPackages.map(item=>paymentUrl(ctx,item));
  checks[live?'STRIPE_LIVE_PAYMENT_LINKS':'STRIPE_TEST_PAYMENT_LINKS']=urls.every(Boolean)&&new Set(urls).size===supportPackages.length;
  const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  const configured=!ctx.demo&&missing.every(name=>name==='STRIPE_SUPPORT_ENABLED');
  return {ready:configured&&checks.STRIPE_SUPPORT_ENABLED,configured,missing,live,returnUrl:returnUrl(ctx)};
}

async function stripeRead(ctx,path) {
  if(!stripeKeyMatches(ctx)||!/^acct_[A-Za-z0-9]+$/.test(ctx.env.STRIPE_ACCOUNT_ID||'')) unavailable();
  let response;
  try {
    response=await fetch('https://api.stripe.com/v1'+path,{
      headers:{Authorization:'Bearer '+ctx.env.STRIPE_RESTRICTED_KEY,'Stripe-Version':'2026-11-18.endive'},
      redirect:'error',signal:AbortSignal.timeout(10000)
    });
  } catch {unavailable();}
  if (!response.ok) {await response.body?.cancel();unavailable();}
  try {return await response.json();} catch {unavailable();}
}

function configurationError() {
  fail(409,'Ustawienia płatności wymagają sprawdzenia przez administratora. Ogłoszenie możesz opublikować za darmo.',
    'The payment configuration needs an administrator review. You can publish your listing for free.');
}

export async function auditSupport(ctx) {
  const config=supportConfiguration(ctx);
  if (!config.configured) return {...config,packages:[]};
  if(receiverOrigin(ctx)){
    const remote=await inboxCommand(ctx,'status');
    if(remote.ready!==true||remote.account!==ctx.env.STRIPE_ACCOUNT_ID||remote.live!==config.live)configurationError();
  }
  const [account,tax,registrations,webhooks]=await Promise.all([
    stripeRead(ctx,'/account'),stripeRead(ctx,'/tax/settings'),stripeRead(ctx,'/tax/registrations?status=active&limit=100'),
    stripeRead(ctx,'/webhook_endpoints?limit=100')
  ]);
  if (account.id!==ctx.env.STRIPE_ACCOUNT_ID||!account.charges_enabled) configurationError();
  if(config.live&&(account.country!=='PL'||account.details_submitted!==true))configurationError();
  const endpoint=webhooks.data?.find(endpoint=>endpoint.url===supportWebhookUrl(ctx)&&endpoint.status==='enabled'&&
    endpoint.livemode===config.live&&[...eventTypes].every(type=>endpoint.enabled_events?.some(event=>event==='*'||event===type)));
  // Stripe CLI signs forwarded local test events without a registered localhost endpoint.
  if ((config.live||!localSandbox(ctx)||receiverOrigin(ctx))&&!endpoint) configurationError();
  const links=[];
  let cursor='';
  for (let page=0;page<10;page++) {
    const result=await stripeRead(ctx,'/payment_links?limit=100'+(cursor?'&starting_after='+encodeURIComponent(cursor):''));
    if (!Array.isArray(result.data)) configurationError();
    links.push(...result.data);
    if (!result.has_more||supportPackages.every(item=>links.some(link=>link.url===paymentUrl(ctx,item)))) break;
    cursor=result.data.at(-1)?.id;
    if (!cursor) configurationError();
  }
  const packages=await Promise.all(supportPackages.map(async item=>{
    const link=links.find(link=>link.url===paymentUrl(ctx,item));
    if (!link?.active||link.livemode!==config.live||link.currency!=='pln'||!/^plink_[A-Za-z0-9]+$/.test(link.id)) configurationError();
    const lines=await stripeRead(ctx,'/payment_links/'+link.id+'/line_items?limit=100&expand%5B%5D=data.price.product');
    const line=lines.data?.[0],price=line?.price;
    const taxIncluded=!link.automatic_tax?.enabled||price?.tax_behavior==='inclusive';
    const redirect=link.after_completion?.redirect?.url;
    if (lines.has_more||lines.data?.length!==1||line.quantity!==1||line.adjustable_quantity?.enabled||
        price?.type!=='one_time'||price.recurring||price.custom_unit_amount||!price.active||
        price.currency!=='pln'||price.unit_amount!==item.amount||!productNameMatches(item,price.product?.name)||price.product?.active===false||
        link.allow_promotion_codes||link.optional_items?.length||link.shipping_options?.length||
        link.after_completion?.type!=='redirect'||redirect!==config.returnUrl||!taxIncluded||
        line.tax_rates?.length||link.application_fee_amount||link.application_fee_percent||link.transfer_data||link.on_behalf_of||
        (link.automatic_tax?.enabled&&(tax.status!=='active'||!registrations.data?.length||!price.product?.tax_code))) configurationError();
    return {id:item.id,paymentLink:link.id,price:price.id,amount:item.amount,currency:'pln',automaticTax:Boolean(link.automatic_tax?.enabled)};
  }));
  return {...config,verified:true,packages,account:account.id,taxStatus:tax.status,activeRegistrations:registrations.data?.length||0,
    taxReviewedAt:ctx.env.STRIPE_TAX_REVIEWED_AT,country:account.country||'',businessType:account.business_type||'',legalStructure:account.company?.structure||'',taxCountry:tax.head_office?.address?.country||''};
}

export async function startSupport(ctx,body) {
  const user=requireUser(ctx);
  if (ctx.demo) forbidden();
  const item=supportPackage(body.package);
  if (!item||!isId(body.key)) missing();
  const listingId=body.listing||null;
  if (listingId) await owned(ctx,listingId);
  const hosted=hostedCheckout(ctx);
  if (hosted) {
    const target=hosted.enabled && hosted.links.get(item.id);
    if (!target) unavailable();
    return {next:target};
  }
  const audit=await auditSupport(ctx);
  if (!audit.ready) unavailable();
  const verified=audit.packages.find(record=>record.id===item.id);
  const attemptId=id();
  await run(ctx.db,`INSERT OR IGNORE INTO support_attempts(id,user_id,listing_id,package_id,amount,currency,payment_link,livemode,client_key,created_at)
    VALUES(?,?,?,?,?,'pln',?,?,?,?)`,attemptId,user.id,listingId,item.id,item.amount,verified.paymentLink,+audit.live,body.key,now());
  const attempt=await row(ctx.db,'SELECT * FROM support_attempts WHERE user_id=? AND client_key=?',user.id,body.key);
  if (attempt.package_id!==item.id||attempt.listing_id!==listingId||attempt.payment_link!==verified.paymentLink) configurationError();
  const target=new URL(paymentUrl(ctx,item));
  target.searchParams.set('client_reference_id',attempt.id);
  return {next:target.href};
}

async function verifySignature(ctx,raw) {
  const header=ctx.req.headers.get('Stripe-Signature')||'';
  if (header.length>2048) forbidden();
  const parts=header.split(',').map(part=>part.trim().split('='));
  const timestamp=parts.find(([key])=>key==='t')?.[1];
  const signatures=parts.filter(([key,value])=>key==='v1'&&/^[a-f0-9]{64}$/.test(value)).map(([,value])=>value);
  if (!/^\d+$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300||!signatures.length) forbidden();
  const secret=ctx.env.STRIPE_WEBHOOK_SECRET;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const prefix=encoder.encode(timestamp+'.');
  const payload=new Uint8Array(prefix.length+raw.length);
  payload.set(prefix);payload.set(raw,prefix.length);
  for (const signature of signatures) {
    const bytes=Uint8Array.from(signature.match(/../g),part=>parseInt(part,16));
    if (await crypto.subtle.verify('HMAC',key,bytes,payload)) return;
  }
  forbidden();
}

const eventTypes=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
export async function stripeWebhook(ctx) {
  if (ctx.demo||ctx.req.method!=='POST') missing();
  if (!/^whsec_[A-Za-z0-9]+$/.test(ctx.env.STRIPE_WEBHOOK_SECRET||'')) unavailable();
  const raw=await limitedBody(ctx.req,262144);
  await verifySignature(ctx,raw);
  let event;
  try {event=JSON.parse(new TextDecoder().decode(raw));} catch {forbidden();}
  await processNotice(ctx,{event_id:event?.id,event_type:event?.type,session_id:event?.data?.object?.id,
    account_id:event?.account||ctx.env.STRIPE_ACCOUNT_ID,live:event?.livemode});
  return json({received:true});
}

async function processNotice(ctx,notice) {
  if (!/^evt_[A-Za-z0-9]+$/.test(notice?.event_id||'')||notice.live!==expectedLive(ctx)||
      !/^acct_[A-Za-z0-9]+$/.test(notice.account_id||'')||notice.account_id!==ctx.env.STRIPE_ACCOUNT_ID) forbidden();
  if (!eventTypes.has(notice.event_type)) return;
  if (await row(ctx.db,'SELECT id FROM support_events WHERE id=?',notice.event_id)) return;
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(notice.session_id||'')) forbidden();
  // The API supplies the current state even when Stripe retries an older event.
  const session=await stripeRead(ctx,'/checkout/sessions/'+notice.session_id);
  const attempt=await row(ctx.db,'SELECT * FROM support_attempts WHERE id=?',session.client_reference_id||'');
  if (!attempt) return;
  const item=supportPackage(attempt.package_id);
  if (!item||session.id!==notice.session_id||session.mode!=='payment'||session.subscription||session.payment_link!==attempt.payment_link||
      session.livemode!==notice.live||session.livemode!==Boolean(attempt.livemode)||session.amount_total!==item.amount||
      session.amount_total!==attempt.amount||session.currency!=='pln'||session.currency!==attempt.currency) forbidden();
  const paid=session.payment_status==='paid'&&session.status==='complete';
  const state=paid?'paid':session.status==='expired'?'expired':notice.event_type==='checkout.session.async_payment_failed'?'failed':'pending';
  const at=now();
  await ctx.db.batch([
    stmt(ctx.db,`INSERT INTO support_payments(session_id,attempt_id,status,amount,currency,updated_at,paid_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET
      status=CASE WHEN support_payments.status='paid' OR (support_payments.status IN ('failed','expired') AND excluded.status='pending') THEN support_payments.status ELSE excluded.status END,
      paid_at=coalesce(support_payments.paid_at,excluded.paid_at),updated_at=excluded.updated_at
      WHERE support_payments.attempt_id=excluded.attempt_id`,
      session.id,attempt.id,state,attempt.amount,attempt.currency,at,paid?at:null),
    stmt(ctx.db,'INSERT OR IGNORE INTO support_events(id,session_id,type,created_at) VALUES(?,?,?,?)',notice.event_id,session.id,notice.event_type,at)
  ]);
}

async function inboxCommand(ctx,operation,fields={}) {
  const origin=receiverOrigin(ctx), token=ctx.env.STRIPE_INBOX_TOKEN;
  if(!origin||!/^[a-f0-9]{64}$/.test(token||'')) unavailable();
  try {
    const response=await fetch(origin+'/internal/stripe/inbox',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation,live:expectedLive(ctx),...fields})});
    if(!response.ok){await response.body?.cancel();unavailable();}
    return await response.json();
  }catch{unavailable();}
}

export async function drainStripeInbox(ctx,session='') {
  if(ctx.demo||!receiverOrigin(ctx)||!stripeKeyMatches(ctx)||!ctx.env.STRIPE_ACCOUNT_ID)return;
  const result=await inboxCommand(ctx,'pending',session?{session}:{});
  if(!Array.isArray(result.events)||result.events.length>12)unavailable();
  const done=[],retry=[];
  for(const event of result.events){
    if(!/^evt_[A-Za-z0-9]+$/.test(event?.event_id||''))unavailable();
    try {await processNotice(ctx,{...event,live:expectedLive(ctx)});done.push(event.event_id);}
    catch {retry.push(event.event_id);}
  }
  if(done.length)await inboxCommand(ctx,'ack',{ids:done});
  if(retry.length)await inboxCommand(ctx,'retry',{ids:retry});
  return !session&&result.events.length===12;
}
export async function supportReturn(ctx) {
  const user=requireUser(ctx),session=ctx.url.searchParams.get('session_id');
  if (ctx.demo||!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(session||'')) return null;
  if(receiverOrigin(ctx)&&await row(ctx.db,'SELECT 1 FROM support_attempts WHERE user_id=? AND livemode=? LIMIT 1',user.id,+expectedLive(ctx))){
    try{await drainStripeInbox(ctx,session);}catch{ /* background processing retries later. */ }
  }
  return row(ctx.db,`SELECT p.status,p.amount,p.currency,a.listing_id,a.package_id
    FROM support_payments p JOIN support_attempts a ON a.id=p.attempt_id
    WHERE p.session_id=? AND a.user_id=?`,session,user.id);
}
