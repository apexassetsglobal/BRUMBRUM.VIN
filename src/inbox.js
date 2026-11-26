import { changes, emailOf, fail, forbidden, id, isEmail, isId, missing, now, parse, rate, requireUser, row, rows, run, stmt, text, truth } from './core.js';
import { byId } from './market.js';

const inboxJoin=` FROM conversations c JOIN listings l ON l.id=c.listing_id
  JOIN users b ON b.id=c.buyer_id JOIN users s ON s.id=c.seller_id`;

export async function inbox(ctx) {
  const u=requireUser(ctx);
  return rows(ctx.db,`SELECT c.*,l.slug,l.status,l.make,l.model,b.name AS buyer_name,s.name AS seller_name,
    (SELECT count(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.seen_at IS NULL) AS unread,
    (SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_body
    ${inboxJoin} WHERE (c.buyer_id=? OR c.seller_id=?) AND l.scope=?
    AND EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id) ORDER BY c.updated_at DESC LIMIT 120`,u.id,u.id,u.id,ctx.scope);
}

export async function thread(ctx,key) {
  const u=requireUser(ctx);
  if (!isId(key)) missing();
  const result=await row(ctx.db,`SELECT c.*,l.slug,l.status,l.make,l.model,b.name AS buyer_name,s.name AS seller_name,b.deleted_at AS buyer_deleted,s.deleted_at AS seller_deleted
    ${inboxJoin} WHERE c.id=? AND (c.buyer_id=? OR c.seller_id=?) AND l.scope=?`,key,u.id,u.id,ctx.scope);
  if (!result) missing();
  return result;
}
const partner = (u,c) => u.id===c.buyer_id?c.seller_id:c.buyer_id;

export async function messages(ctx,key) {
  const c=await thread(ctx,key);
  const other=partner(ctx.user,c);
  const blocked=await row(ctx.db,'SELECT count(*) AS total,max(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS by_me FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)',ctx.user.id,ctx.user.id,other,other,ctx.user.id);
  const items=await rows(ctx.db,`SELECT * FROM (SELECT id,sender_id,body,proposed_at,proposal_status,created_at,seen_at FROM messages
    WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 250) ORDER BY created_at,id`,c.id);
  return { c, items:items.map(m=>({...m,mine:m.sender_id===ctx.user.id})), blocked:Boolean(blocked?.total || c.buyer_deleted || c.seller_deleted), blockedByMe:Boolean(blocked?.by_me) };
}

async function insertMessage(ctx,c,body) {
  const u=ctx.user;
  const other=partner(u,c);
  const message=text(body.body,3000);
  const key=text(body.key,90);
  if (!isId(key)) fail(422,'Odśwież formularz wiadomości.','Reload the message form.');
  const duplicate=await row(ctx.db,'SELECT id FROM messages WHERE conversation_id=? AND sender_id=? AND client_key=?',c.id,u.id,key);
  if (duplicate) return duplicate.id;
  let visit=null;
  if (body.proposed_at) {
    const time=Date.parse(body.proposed_at);
    if (!Number.isFinite(time) || time < Date.now() || time > Date.now()+365*86400000 || c.buyer_id!==u.id) {
      fail(422,'Wybierz przyszły termin oględzin.','Choose a future date and time for the viewing.');
    }
    visit=new Date(time).toISOString();
  }
  if (!message) fail(422,'Wpisz wiadomość.','Enter a message.');
  const mid=id(), at=now(), db=ctx.db;
  const results=await db.batch([
    stmt(db,`INSERT OR IGNORE INTO messages(id,conversation_id,sender_id,client_key,body,proposed_at,proposal_status,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?))
      AND EXISTS (SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL)`,
      mid,c.id,u.id,key,message,visit,visit?'proposed':null,at,u.id,other,other,u.id,other),
    stmt(db,'UPDATE conversations SET updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM messages WHERE id=?)',at,c.id,mid),
    stmt(db,`INSERT INTO notifications(id,user_id,kind,data,created_at) SELECT ?,?,'message',?,?
      WHERE EXISTS(SELECT 1 FROM messages WHERE id=?) AND EXISTS(SELECT 1 FROM users WHERE id=? AND notify_messages=1)`,
      id(),other,JSON.stringify({thread:c.id}),at,mid,other)
  ]);
  if (changes(results[0])) return mid;
  const retry=await row(db,'SELECT id FROM messages WHERE conversation_id=? AND sender_id=? AND client_key=?',c.id,u.id,key);
  if (retry) return retry.id;
  fail(409,'Kontakt jest zablokowany lub niedostępny.','This contact is blocked or unavailable.');
}

export async function startMessage(ctx,key,body) {
  const u=requireUser(ctx);
  await rate(ctx,'send',45,3600);
  const listing=await byId(ctx,key);
  if (!listing || listing.status!=='published') missing();
  if (listing.user_id===u.id) fail(422,'To Twoje ogłoszenie.','This is your own listing.');
  const candidate=id(), at=now();
  await run(ctx.db,`INSERT OR IGNORE INTO conversations(id,listing_id,buyer_id,seller_id,created_at,updated_at)
    SELECT ?,l.id,?,l.user_id,?,? FROM listings l WHERE l.id=? AND l.status='published'
    AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=l.user_id) OR (user_id=l.user_id AND blocked_id=?))`,
    candidate,u.id,at,at,listing.id,u.id,u.id);
  const c=await row(ctx.db,'SELECT * FROM conversations WHERE listing_id=? AND buyer_id=?',listing.id,u.id);
  if (!c) fail(409,'Kontakt jest niedostępny.','This contact is unavailable.');
  return {thread:c.id,message:await insertMessage(ctx,c,body)};
}

export async function reply(ctx,key,body) {
  await rate(ctx,'send',45,3600);
  const c=await thread(ctx,key);
  return {thread:c.id,message:await insertMessage(ctx,c,body)};
}

export async function readThread(ctx,key) {
  const c=await thread(ctx,key);
  await ctx.db.batch([
    stmt(ctx.db,'UPDATE messages SET seen_at=? WHERE conversation_id=? AND sender_id<>? AND seen_at IS NULL',now(),c.id,ctx.user.id),
    stmt(ctx.db,`UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL AND json_extract(data,'$.thread')=?`,now(),ctx.user.id,c.id)
  ]);
}

export async function proposal(ctx,key,body) {
  const c=await thread(ctx,key);
  if (ctx.user.id!==c.seller_id) forbidden();
  if (!['accepted','declined'].includes(body.status)) fail(422,'Wybierz decyzję.','Choose a response.');
  const at=now(), db=ctx.db;
  const result=await db.batch([
    stmt(db,`UPDATE messages SET proposal_status=? WHERE id=? AND conversation_id=? AND proposal_status='proposed' AND proposed_at>?
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?))`,
      body.status,text(body.message,90),c.id,at,c.seller_id,c.buyer_id,c.buyer_id,c.seller_id),
    stmt(db,`INSERT INTO notifications(id,user_id,kind,data,created_at) SELECT ?,?,'viewing',?,? WHERE changes()=1`,
      id(),c.buyer_id,JSON.stringify({thread:c.id,status:body.status}),at)
  ]);
  if (!changes(result[0])) fail(409,'Propozycja jest już rozstrzygnięta lub wygasła.','This proposal has expired or has already been answered.');
}

export async function blockThread(ctx,key,body) {
  const c=await thread(ctx,key);
  const other=partner(ctx.user,c);
  if (truth(body.blocked)) await run(ctx.db,'INSERT OR IGNORE INTO blocks(user_id,blocked_id,created_at) VALUES(?,?,?)',ctx.user.id,other,now());
  else await run(ctx.db,'DELETE FROM blocks WHERE user_id=? AND blocked_id=?',ctx.user.id,other);
}

export async function report(ctx,body) {
  await rate(ctx,'reports',12,3600);
  let listing=null, conversation=null;
  const kind=['rules','illegal','message','appeal'].includes(body.kind)?body.kind:'rules';
  const reason=text(body.reason,2500);
  const email=ctx.user?.email || emailOf(body.email);
  if (reason.length<10 || ((kind==='illegal'||kind==='appeal') && !isEmail(email))) fail(422,'Podaj powód (co najmniej 10 znaków) i e-mail, jeśli wymagany.','Enter a reason (at least 10 characters) and an email if required.');
  if (kind==='message') {
    conversation=await thread(ctx,body.thread);
    listing=await byId(ctx,conversation.listing_id);
  } else {
    listing=await byId(ctx,body.listing);
    if (!listing || (kind==='appeal' ? listing.user_id!==ctx.user?.id : !['published','sold'].includes(listing.status))) missing();
  }
  const reportId=id();
  await run(ctx.db,'INSERT INTO reports(id,scope,reporter_id,listing_id,conversation_id,kind,email,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    reportId,ctx.scope,ctx.user?.id||null,listing?.id||null,conversation?.id||null,kind,email,reason,now());
  return reportId;
}

export async function contacts(ctx,body) {
  const user=requireUser(ctx);
  await rate(ctx,'contact',10,3600);
  const name=text(body.name,90), email=emailOf(body.email), message=text(body.body,5000);
  if (text(body.website) || name.length<2 || !isEmail(email) || message.length<10) fail(422,'Podaj imię, e-mail i treść zapytania.','Enter your name, email and enquiry.');
  const key=id();
  await run(ctx.db,'INSERT INTO contacts(id,scope,user_id,kind,name,email,body,created_at) VALUES(?,?,?,?,?,?,?,?)',
    key,ctx.scope,user.id,body.kind==='ad'?'ad':'support',name,email,message,now());
  return key;
}

export async function favorites(ctx) {
  if (!ctx.user) return [];
  const found=await rows(ctx.db,`SELECT f.listing_id FROM favorites f JOIN listings l ON l.id=f.listing_id
    WHERE f.user_id=? AND l.scope=? AND l.status IN ('published','sold') ORDER BY f.created_at DESC LIMIT 250`,ctx.user.id,ctx.scope);
  return found.map(x=>x.listing_id);
}

export async function favorite(ctx,keys,adding=true) {
  const u=requireUser(ctx);
  const checked=[...new Set(keys.filter(isId))].slice(0,80);
  if (!checked.length) return;
  const sql=adding?`INSERT OR IGNORE INTO favorites(user_id,listing_id,created_at) SELECT ?,id,? FROM listings
    WHERE id=? AND scope=? AND status IN ('published','sold')`:'DELETE FROM favorites WHERE user_id=? AND listing_id=?';
  await ctx.db.batch(checked.map(key=>adding?stmt(ctx.db,sql,u.id,now(),key,ctx.scope):stmt(ctx.db,sql,u.id,key)));
}

export async function badges(ctx) {
  if (!ctx.user) return {messages:0,notifications:0};
  return row(ctx.db,`SELECT (SELECT count(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id
    WHERE (c.buyer_id=? OR c.seller_id=?) AND m.sender_id<>? AND m.seen_at IS NULL) AS messages,
    (SELECT count(*) FROM notifications WHERE user_id=? AND read_at IS NULL) AS notifications`,ctx.user.id,ctx.user.id,ctx.user.id,ctx.user.id);
}

export async function notices(ctx) {
  const u=requireUser(ctx);
  return (await rows(ctx.db,'SELECT id,kind,data,created_at,read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 150',u.id))
    .map(n=>({...n,data:parse(n.data)}));
}
export async function readNotices(ctx) {
  const u=requireUser(ctx);
  await run(ctx.db,'UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',now(),u.id);
}
