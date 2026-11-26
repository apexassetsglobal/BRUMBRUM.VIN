import { changes, fail, forbidden, id, isId, limitedBody, missing, now, requireUser, row, rows, run, text } from './core.js';
import { videoLimit, videoMime, videoObject } from './videos.js';

const reelLimit = 24;

function requireCompany(ctx) {
  const user = requireUser(ctx);
  if (user.profile_type !== 'company' || !user.verified_at) forbidden();
  return user;
}

export function companyReels(ctx,userId) {
  return rows(ctx.db,`SELECT r.id,r.caption,l.slug AS offer_slug,l.type AS listing_type
    FROM company_reels r LEFT JOIN listings l ON l.id=r.listing_id
      AND l.user_id=r.user_id AND l.status IN ('published','sold') AND l.scope=?
    WHERE r.user_id=? ${ctx.robotics?"AND l.type='robot'":''} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`,ctx.scope,userId,reelLimit);
}

export async function publishReel(ctx) {
  const user = requireCompany(ctx);
  const caption = text(ctx.req.headers.get('X-Reel-Caption'),3000);
  let decodedCaption;
  try { decodedCaption = decodeURIComponent(caption); }
  catch { fail(422,'Sprawdź opis rolki.','Check the reel caption.'); }
  const listingId = ctx.req.headers.get('X-Reel-Listing') || null;
  const robotics=Boolean(ctx.robotics||ctx.req.headers.get('X-Reel-Market')==='robotics'||ctx.url?.searchParams.get('market')==='robotics');
  if (robotics && !listingId) fail(422,'Wybierz opublikowane ogłoszenie robota, z którym powiążesz rolkę.',
    'Select a published robot listing to attach the reel to.');
  if (listingId && (!isId(listingId) || !await row(ctx.db,`SELECT id FROM listings
    WHERE id=? AND user_id=? AND scope=? AND status='published' ${robotics?"AND type='robot'":''}`,listingId,user.id,ctx.scope))) missing();
  const bytes = await limitedBody(ctx.req,videoLimit);
  const mime = videoMime(bytes);
  const reel = id();
  await ctx.env.BUCKET.put('videos/'+reel,bytes,{httpMetadata:{contentType:mime}});
  try {
    const result = await run(ctx.db,`INSERT INTO company_reels(id,user_id,listing_id,caption,mime,size,created_at)
      SELECT ?,u.id,?,?,?,?,? FROM users u WHERE u.id=? AND u.scope=? AND u.deleted_at IS NULL
      AND u.verified_at IS NOT NULL AND u.profile_type='company'
      AND (SELECT COUNT(*) FROM company_reels WHERE user_id=u.id) < ?`,
      reel,listingId,text(decodedCaption,240),mime,bytes.length,now(),user.id,ctx.scope,reelLimit);
    if (!changes(result)) fail(409,'Nie można opublikować rolki. Sprawdź konto i limit 24 rolek.','Could not publish. Check your account and the 24-reel limit.');
  } catch (error) {
    await ctx.env.BUCKET.delete('videos/'+reel).catch(() => {});
    throw error;
  }
}

export async function removeReel(ctx,key) {
  const user = requireCompany(ctx);
  const removed = await run(ctx.db,'DELETE FROM company_reels WHERE id=? AND user_id=?',key,user.id);
  if (!changes(removed)) missing();
  await ctx.env.BUCKET.delete('videos/'+key).catch(error => console.error('reel_cleanup_failed',error.name));
}

export async function reelResponse(ctx,key) {
  const reel = isId(key) && await row(ctx.db,`SELECT r.id,r.mime,r.size FROM company_reels r
    JOIN users u ON u.id=r.user_id WHERE r.id=? AND u.scope=? AND u.deleted_at IS NULL
    AND u.verified_at IS NOT NULL AND u.profile_type='company'`,key,ctx.scope);
  if (!reel) missing();
  return videoObject(ctx,reel,true);
}

const listingReelQuery = `SELECT l.video_id AS id,'' AS caption,l.user_id AS seller_id,
  COALESCE(NULLIF(c.name,''),u.name) AS seller_name,COALESCE(NULLIF(l.slug,''),l.id) AS offer_slug,
  l.city,u.profile_type,l.make,l.model,l.price/100.0 AS price,l.currency,l.published_at AS created_at,1 AS listing_video,
  l.type AS listing_type,json_extract(l.data,'$.tradeMode') AS tradeMode,json_extract(l.data,'$.rentalPrice') AS rentalPrice,
  json_extract(l.data,'$.rentalUnit') AS rentalUnit
  FROM listings l JOIN users u ON u.id=l.user_id
  LEFT JOIN companies c ON c.user_id=u.id AND u.profile_type='company'
  WHERE l.scope=? AND l.status IN ('published','sold') AND l.video_id IS NOT NULL AND u.deleted_at IS NULL`;

export function listingReel(ctx,slug) {
  return row(ctx.db,listingReelQuery+` AND l.type${ctx.robotics?'=':'<>'}'robot' AND (l.slug=? OR l.id=?)`,ctx.scope,slug,slug);
}

export function feedReels(ctx,limit,offset,companiesOnly=false,sellerId='') {
  const seller=sellerId&&isId(sellerId)?sellerId:'';
  const sellerWhere=seller?' AND u.id=?':'';
  const args=seller?[ctx.scope,seller,ctx.scope,seller,limit,offset]:[ctx.scope,ctx.scope,limit,offset];
  return rows(ctx.db,`SELECT r.id,r.caption,u.id AS seller_id,
    COALESCE(NULLIF(c.name,''),u.name) AS seller_name,l.slug AS offer_slug,COALESCE(NULLIF(l.city,''),u.city) AS city,
    u.profile_type,NULL AS make,NULL AS model,NULL AS price,NULL AS currency,r.created_at,0 AS listing_video,
    l.type AS listing_type,NULL AS tradeMode,NULL AS rentalPrice,NULL AS rentalUnit
    FROM company_reels r JOIN users u ON u.id=r.user_id
    LEFT JOIN companies c ON c.user_id=u.id
    LEFT JOIN listings l ON l.id=r.listing_id AND l.user_id=r.user_id
      AND l.scope=u.scope AND l.status IN ('published','sold')
    WHERE u.scope=? AND u.deleted_at IS NULL AND u.verified_at IS NOT NULL AND u.profile_type='company'
      ${ctx.robotics?"AND l.type='robot'":"AND NOT EXISTS(SELECT 1 FROM listings robot_link WHERE robot_link.id=r.listing_id AND robot_link.type='robot')"}${sellerWhere}
    UNION ALL ${listingReelQuery} AND l.type${ctx.robotics?'=':'<>'}'robot'${companiesOnly?" AND u.profile_type='company'":''}${sellerWhere}
    ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,...args);
}
