import { isBrandLogo } from './brand-logos.js';
import { changes, cleanReturn, emailOf, fail, forbidden, id, integer, isEmail, isId, limitedBody, missing, now, requireAdmin, requireStaff, requireUser, row, rows, run, safeLink, slugify, stmt, text, truth } from './core.js';
import { options } from './data.js';
import { cleanImage, maxUpload } from './images.js';
import { byId, hydrate, ownerSelection } from './market.js';

export async function reviewQueue(ctx) {
  requireStaff(ctx);
  const listings=await rows(ctx.db,`SELECT ${ownerSelection},(SELECT reason FROM moderation
    WHERE listing_id=l.id AND action='auto_review' AND created_at=l.submitted_at LIMIT 1) AS review_reason
    FROM listings l JOIN users u ON u.id=l.user_id
    LEFT JOIN companies c ON c.user_id=u.id WHERE l.scope=? AND l.status='pending' AND u.deleted_at IS NULL
    ORDER BY l.submitted_at,l.id LIMIT 100`,ctx.scope);
  const reports=await rows(ctx.db,`SELECT r.*,l.make,l.model FROM reports r LEFT JOIN listings l ON l.id=r.listing_id
    WHERE r.scope=? ORDER BY (r.state='open') DESC,r.created_at DESC LIMIT 100`,ctx.scope);
  const history=await rows(ctx.db,`SELECT m.*,u.name,l.make,l.model FROM moderation m JOIN users u ON u.id=m.actor_id
    JOIN listings l ON l.id=m.listing_id WHERE l.scope=?
    ORDER BY m.created_at DESC,(m.action IN ('auto_published','auto_review')) DESC LIMIT 100`,ctx.scope);
  return {offers:listings.map(x=>({...hydrate(ctx,x),reviewReason:x.review_reason})),reports,history};
}

export async function reviewDetail(ctx,key) {
  requireStaff(ctx);
  const listing=await byId(ctx,key);
  if (!listing || ['draft','archived'].includes(listing.status)) missing();
  const history=await rows(ctx.db,`SELECT m.*,u.name FROM moderation m JOIN users u ON u.id=m.actor_id
    WHERE listing_id=? ORDER BY created_at DESC,(action IN ('auto_published','auto_review')) DESC LIMIT 100`,listing.id);
  return {offer:hydrate(ctx,listing),history};
}

function audit(ctx,action,target,reason) {
  return stmt(ctx.db,`INSERT INTO audit(id,scope,actor_id,action,target,reason,created_at) VALUES(?,?,?,?,?,?,?)`,
    id(),ctx.scope,ctx.user.id,action,target,reason,now());
}

export async function resolveReport(ctx,key,body) {
  const user=requireStaff(ctx);
  const reason=text(body.reason,2000);
  if (reason.length<5) fail(422,'Podaj uzasadnienie decyzji.','Enter a reason for the decision.');
  const record=await row(ctx.db,'SELECT * FROM reports WHERE id=? AND scope=?',key,ctx.scope);
  if (!record) missing();
  const at=now();
  const result=await ctx.db.batch([
    stmt(ctx.db,"UPDATE reports SET state='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND scope=? AND state='open'",reason,user.id,at,key,ctx.scope),
    stmt(ctx.db,`INSERT INTO audit(id,scope,actor_id,action,target,reason,created_at) SELECT ?,?,?, 'report_resolved',?,?,? WHERE changes()=1`,id(),ctx.scope,user.id,key,reason,at),
    stmt(ctx.db,`INSERT INTO notifications(id,user_id,kind,data,created_at)
      SELECT ?,reporter_id,'report',?,? FROM reports WHERE id=? AND reporter_id IS NOT NULL AND resolved_at=?`,
      id(),JSON.stringify({reason,reportId:key}),at,key,at)
  ]);
  if (!changes(result[0])) fail(409,'Zgłoszenie zostało już rozpatrzone.','This report has already been resolved.');
}

export async function adminData(ctx) {
  requireAdmin(ctx);
  const queries=[
    ['users','SELECT id,email,name,role,profile_type,verified_at FROM users WHERE scope=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100'],
    ['banners','SELECT * FROM banners WHERE scope=? ORDER BY position,id'],
    ['contacts','SELECT * FROM contacts WHERE scope=? ORDER BY (handled_at IS NULL) DESC,created_at DESC LIMIT 120'],
    ['dictionary','SELECT * FROM dictionary WHERE scope=? ORDER BY kind,parent,value LIMIT 250'],
    ['audit','SELECT a.*,u.name FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.scope=? ORDER BY a.created_at DESC LIMIT 150'],
    ['featured',"SELECT id,slug,make,model,featured_until FROM listings WHERE scope=? AND status='published' ORDER BY featured_until DESC,published_at DESC LIMIT 100"]
  ];
  const values=await Promise.all(queries.map(async ([key,sql])=>[key,await rows(ctx.db,sql,ctx.scope)]));
  return Object.fromEntries(values);
}

function justification(body) {
  const reason=text(body.reason,1200);
  if (reason.length<3) fail(422,'Podaj powód zmiany.','Enter a reason for the change.');
  return reason;
}

export async function adminRole(ctx,key,body) {
  const user=requireAdmin(ctx);
  const role=text(body.role,20);
  const reason=justification(body);
  if (user.id===key || !Object.hasOwn(options.role,role)) forbidden();
  const subject=await row(ctx.db,'SELECT id,role,verified_at,password FROM users WHERE id=? AND scope=? AND deleted_at IS NULL',key,ctx.scope);
  if (!subject) missing();
  if (role!=='user' && !subject.verified_at) fail(422,'Najpierw potwierdź e-mail konta.','The account email must be confirmed first.');
  if (role!=='user' && !subject.password) fail(422,'Konto obsługi musi mieć ustawione hasło.','Staff accounts must have a password.');
  if (role===subject.role) return;
  await ctx.db.batch([
    stmt(ctx.db,'UPDATE users SET role=? WHERE id=? AND scope=?',role,key,ctx.scope),
    stmt(ctx.db,'DELETE FROM sessions WHERE user_id=?',key),
    audit(ctx,'role_'+role,key,reason)
  ]);
}

const settingKeys=['name','accent','logo_key','home_logo','launch_logo','operator_name','operator_address','operator_email','operator_tax_id','operator_registry','operator_dsa_email','help_pl','help_en','terms_pl','terms_en','privacy_pl','privacy_en','dealers_pl','dealers_en','ads_pl','ads_en'];
export async function adminSettings(ctx,body) {
  requireAdmin(ctx);
  const reason=justification(body);
  const updates=[];
  for (const key of settingKeys) {
    if (!Object.hasOwn(body,key) || key==='logo_key') continue;
    const value=text(body[key],key.endsWith('_pl')||key.endsWith('_en')?15000:key==='operator_address'?300:120);
    if ((key==='home_logo'||key==='launch_logo')&&!isBrandLogo(value)) fail(422,'Wybierz logo z galerii.','Select a logo from the gallery.');
    if ((key==='accent' && !/^#[0-9a-f]{6}$/i.test(value)) || (key==='name' && value.length<2) ||
        ((key==='operator_email'||key==='operator_dsa_email') && value && !isEmail(emailOf(value)))) fail(422,'Sprawdź nazwę, kolor lub adres e-mail.','Check the brand name, color or email address.');
    updates.push(stmt(ctx.db,'INSERT INTO settings(scope,key,value) VALUES(?,?,?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value',ctx.scope,key,value));
  }
  await ctx.db.batch([...updates,audit(ctx,'settings',updates.length+' settings',reason)]);
}

export async function adminDictionary(ctx,body) {
  requireAdmin(ctx);
  const reason=justification(body);
  const kind=text(body.kind,12), value=text(body.value,60), parent=text(body.parent,50);
  if (!['type','make','model'].includes(kind) || value.length<2 || (kind==='type' && !/^[a-z][a-z0-9-]{1,24}$/.test(value)) ||
    (kind==='model' && !parent) || ['__proto__','constructor','prototype'].includes(value)) fail(422,'Sprawdź pozycję słownika.','Check the dictionary entry.');
  await ctx.db.batch([
    stmt(ctx.db,`INSERT INTO dictionary(scope,kind,parent,value,label_pl,label_en,active) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(scope,kind,parent,value) DO UPDATE SET label_pl=excluded.label_pl,label_en=excluded.label_en,active=excluded.active`,ctx.scope,kind,kind==='model'?parent:'',value,text(body.label_pl,80),text(body.label_en,80),+truth(body.active)),
    audit(ctx,'dictionary',kind+'/'+value,reason)
  ]);
}

function dateOption(value) {
  if (!value) return null;
  const date=Date.parse(value);
  if (!Number.isFinite(date)) fail(422,'Sprawdź datę.','Check the date.');
  return new Date(date).toISOString();
}
export async function adminBanner(ctx,key,body) {
  requireAdmin(ctx);
  const reason=justification(body);
  const old=key ? await row(ctx.db,'SELECT id,advertiser FROM banners WHERE id=? AND scope=?',key,ctx.scope) : null;
  if (key && !old) missing();
  const titlePl=text(body.title_pl,160), titleEn=text(body.title_en,160), href=safeLink(text(body.link,700));
  const start=dateOption(body.starts_at), end=dateOption(body.ends_at);
  if (!titlePl || !titleEn || !href || (start && end && start>=end)) fail(422,'Uzupełnij oba teksty, link i prawidłowy okres emisji.','Enter both titles, a valid link and a valid display period.');
  key=key || id();
  await ctx.db.batch([
    stmt(ctx.db,`INSERT INTO banners(id,scope,title_pl,title_en,label_pl,label_en,link,position,starts_at,ends_at,active,advertiser) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title_pl=excluded.title_pl,title_en=excluded.title_en,label_pl=excluded.label_pl,label_en=excluded.label_en,link=excluded.link,
        position=excluded.position,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,advertiser=excluded.advertiser`,
      key,ctx.scope,titlePl,titleEn,text(body.label_pl,60),text(body.label_en,60),href,integer(body.position,0,10000)??0,start,end,+truth(body.active),
      body.advertiser===undefined?old?.advertiser||'':text(body.advertiser,80)),
    audit(ctx,'banner',key,reason)
  ]);
  return key;
}
export async function adminFeature(ctx,key,body) {
  requireAdmin(ctx);
  const reason=justification(body);
  const offer=await byId(ctx,key);
  if (!offer || offer.status!=='published') missing();
  await ctx.db.batch([
    stmt(ctx.db,'UPDATE listings SET featured_until=? WHERE id=? AND scope=?',dateOption(body.featured_until),offer.id,ctx.scope),
    audit(ctx,'feature',offer.id,reason)
  ]);
}
export async function adminContact(ctx,key,body) {
  requireAdmin(ctx);
  const reason=justification(body);
  const found=await row(ctx.db,'SELECT id FROM contacts WHERE id=? AND scope=?',key,ctx.scope);
  if (!found) missing();
  await ctx.db.batch([
    stmt(ctx.db,'UPDATE contacts SET handled_at=? WHERE id=? AND scope=?',now(),key,ctx.scope),
    audit(ctx,'contact_handled',key,reason)
  ]);
}

export async function uploadBrandAsset(ctx,kind,target) {
  if (!['avatar','panorama','company','banner','logo'].includes(kind)) missing();
  const profileAsset=['avatar','panorama','company'].includes(kind);
  if (profileAsset) {
    const user=requireUser(ctx);
    if (kind!=='avatar' && user.profile_type!=='company') forbidden();
  } else requireAdmin(ctx);
  if (kind==='banner' && !await row(ctx.db,'SELECT id FROM banners WHERE id=? AND scope=?',target,ctx.scope)) missing();
  if (kind==='company' && !await row(ctx.db,'SELECT user_id FROM companies WHERE user_id=?',ctx.user.id)) fail(409,'Najpierw zapisz dane firmy.','Save your company details first.');
  const bytes=await limitedBody(ctx.req,maxUpload);
  const file=cleanImage(bytes,kind==='avatar'?800:2400);
  const key=id();
  const db=ctx.db;
  await ctx.env.BUCKET.put('assets/'+kind+'/'+key,file.bytes,{httpMetadata:{contentType:file.mime}});
  const update = {
    avatar:()=>stmt(db,'UPDATE users SET avatar_key=? WHERE id=? AND deleted_at IS NULL',key,ctx.user.id),
    panorama:()=>stmt(db,'UPDATE users SET panorama_key=? WHERE id=? AND deleted_at IS NULL',key,ctx.user.id),
    company:()=>stmt(db,'UPDATE companies SET logo_key=? WHERE user_id=?',key,ctx.user.id),
    banner:()=>stmt(db,'UPDATE banners SET image_key=? WHERE id=? AND scope=?',key,target,ctx.scope),
    logo:()=>stmt(db,"INSERT INTO settings(scope,key,value) VALUES(?,'logo_key',?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value",ctx.scope,key)
  }[kind]();
  await db.batch(profileAsset?[update]:[update,audit(ctx,kind+'_image',target||key,'image upload')]);
  return key;
}
