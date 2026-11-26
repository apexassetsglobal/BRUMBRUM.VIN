import { changes, id, stmt } from './core.js';

export const autoReviewReasons = {
  payment:['Prośba o kod, hasło lub płatność przez link.', 'A request for a code, password or payment via a link.'],
  duplicate_vin:['Aktywne ogłoszenie ma ten sam numer VIN.', 'An active listing has the same VIN.'],
  video:['Ogłoszenie zawiera film do sprawdzenia.', 'The listing has a video to review.']
};

export function listingVin(value) {
  const normalized=String(value??'').trim().toUpperCase().replace(/[\s-]/g,'');
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)?normalized:'';
}

function hasPaymentSignal(data) {
  const copy=[data.make,data.model,data.variant,data.description,data.description_en,data.history].join('\n')
    .toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replaceAll('ł','l');
  const asksForCode=/\b(?:podaj|przeslij|wyslij|wpisz|send|share|enter|provide)\b[^\n.!?]{0,45}\b(?:kod\s+(?:blik|sms|weryfikacyjny|jednorazowy)|hasl[oa]|password|(?:verification|2fa)\s+code)\b/.test(copy);
  const asksForPayment=/\b(?:link\s+do\s+platnosci|zaplac\s+(?:przez|tutaj|tu)|payment\s+link|pay\s+here)\b/.test(copy);
  return asksForCode || (asksForPayment && /(?:https?:\/\/|www\.)\S+/.test(copy));
}

export function moderationStatement(ctx, actor, listing, action, reason, at) {
  const decision=id();
  return {decision,sql:stmt(ctx.db,`INSERT INTO moderation(id,listing_id,actor_id,action,reason,created_at)
    SELECT ?,?,?,?,?,? WHERE changes()=1`,decision,listing,actor,action,reason,at)};
}

export function statusNotice(ctx, listingId, slug, decision, at, reason = '') {
  return stmt(ctx.db,`INSERT INTO notifications(id,user_id,kind,data,created_at)
    SELECT ?,l.user_id,l.status,?,? FROM listings l JOIN users u ON u.id=l.user_id
    WHERE l.id=? AND u.notify_listings=1 AND EXISTS(SELECT 1 FROM moderation WHERE id=?)`,
    id(),JSON.stringify({listingId,slug:slug||listingId,reason}),at,listingId,decision);
}

function automaticReview(ctx, listingId, data, submitted, at, allTypes=false) {
  if (!allTypes && data.type!=='car') return [];
  const vin=listingVin(data.vin);
  const decision=id();
  // Read the active VINs and publish inside the submission transaction.
  return [
    stmt(ctx.db,`WITH review AS (
      SELECT l.id,l.user_id,CASE
        WHEN ?=1 THEN 'payment'
        WHEN ?<>'' AND EXISTS(SELECT 1 FROM listings other
          WHERE other.scope=l.scope AND other.status='published' AND other.id<>l.id
          AND upper(replace(replace(json_extract(other.data,'$.vin'),' ',''),'-',''))=?) THEN 'duplicate_vin'
        WHEN l.video_id IS NOT NULL THEN 'video'
        ELSE '' END AS reason
      FROM listings l WHERE l.id=? AND l.scope=? AND l.status='pending'
      AND EXISTS(SELECT 1 FROM moderation WHERE id=?) AND NOT EXISTS(SELECT 1 FROM auto_policy WHERE scope=l.scope AND (publish=0 OR paused=1))
    )
    INSERT INTO moderation(id,listing_id,actor_id,action,reason,created_at)
    SELECT ?,id,user_id,CASE WHEN reason='' THEN 'auto_published' ELSE 'auto_review' END,reason,? FROM review`,
    +hasPaymentSignal(data),vin,vin,listingId,ctx.scope,submitted,decision,at),
    stmt(ctx.db,`UPDATE listings SET status='published',published_at=?
      WHERE id=? AND EXISTS(SELECT 1 FROM moderation WHERE id=? AND action='auto_published')`,
    at,listingId,decision)
  ];
}

export async function saveSubmission(ctx, {listingId,slug,data,at,write,decision,afterWrite,allTypes=false}) {
  const review=automaticReview(ctx,listingId,data,decision.decision,at,allTypes);
  const submission=[write,decision.sql,...review];
  const results=await ctx.db.batch([...submission,statusNotice(ctx,listingId,slug,decision.decision,at),...afterWrite]);
  const published=review.length>0 && changes(results[submission.length-1])===1;
  return {changed:changes(results[0])===1,status:published?'published':'pending'};
}
