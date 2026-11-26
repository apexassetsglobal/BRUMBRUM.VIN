import { changes, fail, missing, now, parse, requireStaff, requireUser, rows, run, text } from './core.js';
import { apiForm, area, day, e, field, flash, hidden, icon, loginPath, panel, submit } from './ui.js';

const namespace=ctx=>ctx.scope+':youtube-promotions';
const validVideoId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{11}$/.test(value);
const videoUrl=id=>'https://www.youtube.com/watch?v='+id;
export const youtubePromotionReturn=(ctx,submitted=false)=>ctx.prefix+'/'+(submitted?'?film=zgloszony':'')+'#filmy-youtube';

export function youtubeVideoId(value) {
  if (typeof value!=='string'||value.length>600) return '';
  try {
    const url=new URL(value.trim());
    if (url.protocol!=='https:'||url.username||url.password||url.port) return '';
    const parts=url.pathname.split('/').filter(Boolean);
    let candidate='';
    if (url.hostname==='youtu.be'&&parts.length===1) candidate=parts[0];
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) {
      if (url.pathname==='/watch') candidate=url.searchParams.get('v');
      else if (['shorts','live'].includes(parts[0])&&parts.length===2) candidate=parts[1];
    }
    return validVideoId(candidate)?candidate:'';
  } catch {
    return '';
  }
}

async function select(ctx,where,value,limit) {
  const result=await rows(ctx.db,`SELECT s.key,s.value FROM settings s
    JOIN users u ON u.id=json_extract(s.value,'$.owner') AND u.deleted_at IS NULL
    WHERE s.scope=? AND ${where}=? ORDER BY json_extract(s.value,'$.updated') DESC LIMIT ?`,
    namespace(ctx),value,limit);
  return result.filter(row=>validVideoId(row.key)).map(row=>({...parse(row.value),id:row.key}));
}

export async function submitYouTubePromotion(ctx,body) {
  const user=requireUser(ctx);
  const video=youtubeVideoId(body.url);
  const title=text(body.title,100);
  if (!video||title.length<3) fail(422,'Podaj tytuł i prawidłowy link do filmu, Shorts lub transmisji na YouTube.','Enter a title and a valid YouTube video, Shorts or live stream link.');
  const entry={owner:user.id,title,description:text(body.description,280),state:'pending',updated:now()};
  const result=await run(ctx.db,'INSERT OR IGNORE INTO settings(scope,key,value) VALUES(?,?,?)',namespace(ctx),video,JSON.stringify(entry));
  if (!changes(result)) fail(409,'Ten film jest już zgłoszony.','This video has already been submitted.');
}

export async function changeYouTubePromotion(ctx,video,action) {
  if (!validVideoId(video)) missing();
  if (action==='remove') {
    const user=requireUser(ctx);
    const result=await run(ctx.db,`DELETE FROM settings WHERE scope=? AND key=? AND json_extract(value,'$.owner')=?`,namespace(ctx),video,user.id);
    if (!changes(result)) missing();
    return youtubePromotionReturn(ctx);
  }
  requireStaff(ctx);
  const transitions={approve:['pending','published'],reject:['pending','rejected'],hide:['published','rejected']};
  if (!Object.hasOwn(transitions,action)) missing();
  const [previous,next]=transitions[action];
  const result=await run(ctx.db,`UPDATE settings SET value=json_set(value,'$.state',?,'$.updated',?)
    WHERE scope=? AND key=? AND json_extract(value,'$.state')=?`,next,now(),namespace(ctx),video,previous);
  if (!changes(result)) missing();
  return ctx.prefix+'/moderacja?sekcja=youtube';
}

export async function youtubePromotionsSection(ctx) {
  const t=ctx.t;
  const stateLabels={pending:t('W kolejce','Pending'),published:t('Opublikowany','Published'),rejected:t('Odrzucony lub ukryty','Rejected or hidden')};
  const [published,own]=await Promise.all([
    select(ctx,"json_extract(s.value,'$.state')",'published',12),
    ctx.user?select(ctx,"json_extract(s.value,'$.owner')",ctx.user.id,30):[]
  ]);
  const cards=published.map(video=>`<article class="youtube-promo-card">
    <a href="${videoUrl(video.id)}" target="_blank" rel="noopener noreferrer">
      <span class="youtube-promo-image"><img src="https://i.ytimg.com/vi/${video.id}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${t('Oglądaj na YouTube','Watch on YouTube')} ↗</span></span>
      <strong>${e(video.title)}</strong></a>
    ${video.description?`<p>${e(video.description)}</p>`:''}</article>`).join('');
  const form=apiForm('/youtube-promotions',`<div class="field-grid">
    ${field('url',t('Link do filmu na YouTube','YouTube video link'),'',{type:'url',required:true,placeholder:'https://youtu.be/…',attributes:'maxlength="600"'})}
    ${field('title',t('Tytuł na stronie','Title on the site'),'',{required:true,attributes:'minlength="3" maxlength="100"'})}
    </div>${area('description',t('Krótki opis (opcjonalnie)','Short description (optional)'),'',{attributes:'maxlength="280" rows="2"'})}
    ${submit(t('Wyślij do moderacji','Submit for review'),'check')}`);
  const mine=own.length?`<ul class="youtube-promo-mine">${own.map(video=>`<li><div><strong>${e(video.title)}</strong> <small>${e(stateLabels[video.state]||'')}</small></div>
    ${apiForm('/youtube-promotions/'+video.id,hidden('action','remove')+submit(t('Usuń zgłoszenie','Remove submission'),'close'),{confirm:t('Usunąć zgłoszenie filmu?','Remove this video submission?')})}</li>`).join('')}</ul>`:'';
  return `<section class="youtube-promos market-section" id="filmy-youtube" aria-labelledby="youtube-promos-title">
    <div class="section-head"><div><h2 id="youtube-promos-title">${t('Filmy motoryzacyjne z YouTube','Automotive videos from YouTube')}</h2>
    <p>${t('Pokaż swój test auta, poradnik lub materiał z targów. Zgłoszenia sprawdzamy przed publikacją.','Share your car review, guide or motor show coverage. We review submissions before publishing.')}</p></div>
    ${ctx.user?'<a class="btn primary" href="#zglos-film-youtube">'+t('Dodaj swój film','Add your video')+'</a>':`<a class="btn primary" href="${e(loginPath(ctx,youtubePromotionReturn(ctx)))}">${icon('video')}${t('Zaloguj się, aby dodać film','Sign in to add a video')}</a>`}</div>
    ${ctx.user&&ctx.url.searchParams.get('film')==='zgloszony'?flash(t('Film zgłoszony. Pojawi się po zatwierdzeniu.','Video submitted. It will appear after approval.')):''}
    ${cards?`<div class="youtube-promo-grid">${cards}</div>`:`<p class="muted">${t('Tutaj pojawią się zatwierdzone filmy.','Approved videos will appear here.')}</p>`}
    ${ctx.user?`<div id="zglos-film-youtube">${panel(t('Zgłoś film','Submit a video'),form+mine)}</div>`:''}
  </section>`;
}

export async function youtubeModeration(ctx) {
  requireStaff(ctx);
  const t=ctx.t;
  const [pending,published]=await Promise.all([
    select(ctx,"json_extract(s.value,'$.state')",'pending',100),
    select(ctx,"json_extract(s.value,'$.state')",'published',100)
  ]);
  const form=(video,action,label)=>apiForm('/youtube-promotions/'+video.id,hidden('action',action)+submit(label,action==='approve'?'check':'close'));
  const cards=[...pending,...published].map(video=>panel(e(video.title),`<p class="muted">${e(day(ctx,video.updated,true))} · ${video.state==='pending'?t('Do sprawdzenia','Pending review'):t('Opublikowany','Published')}</p>
    ${video.description?`<p>${e(video.description)}</p>`:''}
    <p><a href="${videoUrl(video.id)}" target="_blank" rel="noopener noreferrer">${t('Sprawdź film na YouTube','Review video on YouTube')} ↗</a></p>
    <div class="inline">${video.state==='pending'?form(video,'approve',t('Opublikuj','Publish'))+form(video,'reject',t('Odrzuć','Reject')):form(video,'hide',t('Ukryj film','Hide video'))}</div>`)).join('');
  return cards||panel(t('Brak filmów w kolejce','No videos in the queue'),'');
}
