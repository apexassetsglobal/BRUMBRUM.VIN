import { chinaMarketNews } from './china-market.js';
import { exchangeRates } from './exchange-rates.js';
import { reelsPage } from './views-reels.js';
import { reelResponse } from './reels.js';
import { api } from './api.js';
import { AppError, cleanReturn, cookie, cookies, digest, emailOf, isId, json, missing, now, redirect, requireStaff, row, rows, withAuthReturn } from './core.js';
import { defaultBrand, brandFor, ensureDemo } from './data.js';
import { adMediaPath, adMediaSetup, installAdMedia, readAdMedia } from './ad-media.js';
import { demoMediaSetup, installDemoMedia, readDemoMedia } from './demo-media.js';
import { chatGPTLogin, sessionUser } from './accounts.js';
import { photoResponse, videoResponse, publicOffer, owned, editState, hydrate, mine } from './market.js';
import { publicAsset } from './images.js';
import { badges, inbox, messages, notices } from './inbox.js';
import { adminData, reviewDetail, reviewQueue } from './staff.js';
import { importHistory } from './dealer.js';
import * as market from './views-market.js';
import * as account from './views-account.js';
import * as staff from './views-staff.js';
import { info, errorPage } from './views-info.js';
import { trafficPage } from './views-traffic.js';
import { isPageNavigation, recordPageView } from './traffic.js';
import { installPage, offlinePage, watchError, watchPage } from './views-devices.js';
import { e, href, layout, loginPath } from './ui.js';
import { languageCode, translator } from './i18n.js';
import { drainStripeInbox, hostedCheckout, stripeWebhook } from './support.js';
import { supportPage, supportReturnPage } from './views-support.js';
import * as robots from './views-robots.js';
import { listOrders, orderDetail } from './robot-orders.js';

import {servicePage} from './views-services.js';
import {serviceMedia,serviceSitemap} from './services.js';
import {automationTick} from './automation.js';
import {automationPage} from './views-automation.js';

const authPages={'/zaloguj':'login','/zarejestruj':'register','/potwierdz-email':'verify','/ponow-potwierdzenie':'resend',
  '/odzyskaj-haslo':'reset-request','/ustaw-haslo':'reset','/sprawdz-poczte':'mail','/dostep-wlasciciela':'owner'};
const infoPages={'/pomoc':'help','/dealerzy':'dealers','/reklama':'ads','/kontakt':'contact','/regulamin':'terms','/prywatnosc':'privacy','/cookies':'cookies'};
const publicViewPaths=new Set(['/','/szukaj','/aplikacja','/rolki',...Object.keys(infoPages)]);

const responseHeaders={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://carnewschina.com https://*.carnewschina.com https://cnevpost.com https://*.cnevpost.com https://i.ytimg.com; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Permissions-Policy':'geolocation=(), camera=(), microphone=()'
};
function withHeaders(response,extra={},langCookie='') {
  const headers=new Headers(response.headers);
  for (const [k,v] of Object.entries({...responseHeaders,...extra})) headers.set(k,v);
  if (langCookie) headers.append('Set-Cookie',langCookie);
  return new Response(response.body,{status:response.status,headers});
}
const asHTML=(ctx,view,status=200)=>new Response(layout(ctx,view),{status,headers:{'Content-Type':'text/html; charset=utf-8','Content-Language':ctx.lang,
  'Cache-Control':'private, no-store',...(ctx.demo||!view.index||ctx.env.PUBLIC_INDEXING!=='1'?{'X-Robots-Tag':'noindex, nofollow'}:{})}});

function context(req,env,asset) {
  const url=new URL(req.url);
  const demo=url.pathname==='/demo'||url.pathname.startsWith('/demo/');
  const prefix=demo?'/demo':'';
  const fullPath=url.pathname.slice(prefix.length).replace(/\/+$/,'')||'/';
  const robotics=/^\/roboty(?:\/|$)/.test(fullPath);
  const cookieValues=cookies(req);
  const requestedLanguage=languageCode(url.searchParams.get('lang'));
  const preferredLanguage=requestedLanguage||languageCode(cookieValues.a4_lang);
  const lang=preferredLanguage||'pl';
  return {
    req,env,asset,db:env.DB,url,origin:env.APP_ORIGIN||url.origin,path:robotics?(fullPath.slice('/roboty'.length)||'/'):fullPath,robotics,
    demo,prefix,scope:demo?'demo:seed':'live',cookies:cookieValues,user:null,lang,t:translator(lang),requestedLanguage,preferredLanguage,
    brand:{...defaultBrand},badges:{messages:0,notifications:0},
    ip:(env.runtime==='node'?req.headers.get('X-A4-Peer'):req.headers.get('CF-Connecting-IP')) || 'unknown'
  };
}
async function hydrateContext(ctx) {
  if (ctx.demo) {
    const token=ctx.cookies.a4_workspace;
    if (/^[a-f0-9]{64}$/.test(token||'')) {
      const work=await row(ctx.db,'SELECT scope FROM demo_workspaces WHERE token=? AND expires_at>?',await digest(token),now());
      if (work) ctx.scope=work.scope;
    }
    await ensureDemo(ctx);
  }
  ctx.user=await sessionUser(ctx,ctx.cookies[ctx.demo?'a4_demo':'a4_session']);
  const accountLanguage=languageCode(ctx.user?.lang);
  if (!ctx.preferredLanguage&&accountLanguage) {
    ctx.lang=accountLanguage;
    ctx.t=translator(accountLanguage);
  }
  ctx.brand=await brandFor(ctx);
}

async function sitemap(ctx) {
  const urls=ctx.env.PUBLIC_INDEXING==='1'?['/','/szukaj','/roboty','/roboty/szukaj','/dealerzy','/kontakt','/pomoc','/reklama']:[];
  if (urls.length) {
    const offers=await rows(ctx.db,"SELECT slug,type FROM listings WHERE scope='live' AND status='published' ORDER BY published_at DESC LIMIT 49000");
    urls.push(...await serviceSitemap(ctx),...offers.map(x=>(x.type==='robot'?'/roboty':'')+'/oferta/'+x.slug));
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    urls.map(path=>'<url><loc>'+e(ctx.origin+path)+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
const manifest=ctx=>new Response(JSON.stringify({
  name:(ctx.robotics?'Roboty i automatyka':ctx.brand.name)+(ctx.demo?' Demo':''),short_name:(ctx.robotics?'Roboty':ctx.brand.name)+(ctx.demo?' Demo':''),lang:ctx.lang,
  id:href(ctx,'/'),start_url:href(ctx,'/')+'?launch=1',scope:href(ctx,'/'),
  display:'standalone',background_color:ctx.robotics?'#ffffff':'#000000',theme_color:ctx.robotics?'#ffffff':'#000000',
  shortcuts:[{name:ctx.robotics?ctx.t('Szukaj robotów','Search robots'):ctx.t('Szukaj pojazdów','Search vehicles'),url:href(ctx,'/szukaj')},
    {name:ctx.t('Ulubione','Saved'),url:href(ctx,'/ulubione')}],
  icons:ctx.robotics?[192,512].map(size=>({src:'/assets/robots/icon-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'})):[192,512].map(size=>({src:'/assets/icon-'+size+'.png?v=emblem',sizes:size+'x'+size,type:'image/png',purpose:'any maskable'}))}),
  {headers:{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'private, no-cache'}});

async function page(ctx) {
  const path=ctx.path;
  if(ctx.robotics&&(/^\/(uslugi|moje-uslugi|moderacja-uslug)(\/|$)/.test(path)||path==='/moje-ogloszenia/import'||path==='/administracja/import')) {
    return redirect(ctx.prefix+path+ctx.url.search);
  }
  if(ctx.robotics) {
    if(path==='/') return robots.home(ctx);
    if(path==='/demo') return robots.demoPage(ctx);
    if(/^\/demo\/[^/]+$/.test(path)) return robots.demoDetail(ctx,path.split('/')[2]);
    if(path==='/szukaj') return robots.searchPage(ctx);
    if(path==='/ulubione') return robots.favoritesPage(ctx);
    if(path==='/porownanie') return robots.comparePage(ctx);
    if(path==='/asystent') return robots.assistantPage(ctx);
    if(path==='/rezerwacje') return redirect(href(ctx,'/zamowienia?widok=rentals'));
    if(path==='/zamowienia'||/^\/zamowienia\/[^/]+$/.test(path)) {
      if(!ctx.user)return redirect(loginPath(ctx,ctx.url.pathname+ctx.url.search));
      return path==='/zamowienia'?robots.ordersPage(ctx,await listOrders(ctx)):robots.orderPage(ctx,await orderDetail(ctx,path.split('/')[2]));
    }
  }
  if(path==='/moje-ogloszenia/import'||path==='/administracja/import')return automationPage(ctx);
  if (/^\/(uslugi|moje-uslugi|moderacja-uslug)(\/|$)/.test(path))return servicePage(ctx);
  if (path==='/') return market.home(ctx);
  if (path==='/szukaj') return market.searchPage(ctx);
  if (path==='/rolki') return reelsPage(ctx);
  if (path==='/salon') return redirect(href(ctx,'/szukaj'));
  if (path==='/ulubione') return market.favoritesPage(ctx);
  if (path==='/porownanie') return market.comparePage(ctx);
  if (!ctx.demo&&path==='/statystyki') return trafficPage(ctx);
  if (path==='/aplikacja') return installPage(ctx);
  if (path==='/zegarek') return watchPage(ctx);
  if (Object.hasOwn(authPages,path)) return account.authPage(ctx,authPages[path]);
  if (Object.hasOwn(infoPages,path)) return info(ctx,infoPages[path]);
  const [,section,key,extra]=path.split('/');
  if (key && !extra) {
    if (section==='kategorie'&&!ctx.robotics) return market.vehicleCategoryPage(ctx,key);
    if (section==='oferta') {
      const offer=await publicOffer(ctx,key,{includePhone:true});
      const robotics=offer.type==='robot';
      if(robotics!==Boolean(ctx.robotics))return redirect(href({...ctx,robotics},'/oferta/'+offer.slug));
      return robotics?robots.detail(ctx,offer):market.detail(ctx,offer);
    }
    if (section==='rolki') return reelsPage(ctx,key);
    if (section==='salon') {
      const offer=await publicOffer(ctx,key);
      return redirect(href(ctx,'/oferta/'+offer.slug));
    }
    if (section==='sprzedawca'||section==='dealer') {
      const view=await market.sellerPage(ctx,key,section==='dealer');
      if (!view) missing();
      return view;
    }
  }
  const privateAreas=['konto','sprzedaj','podglad','moje-ogloszenia','ustawienia','wiadomosci','powiadomienia','panel-dealera','moderacja','administracja','wsparcie'];
  if (!privateAreas.includes(section)||extra) missing();
  if (!ctx.user) {
    if (path==='/wsparcie' && !ctx.url.searchParams.has('ogloszenie')) {
      const hosted=hostedCheckout(ctx);
      if (hosted?.enabled && hosted.links.size) return supportPage(ctx);
    }
    if (section==='moderacja'||section==='administracja') return asHTML(ctx,errorPage(ctx,403,ctx.t('Zaloguj się na uprawnione konto.','Sign in with an authorized account.')),403);
    return redirect(loginPath(ctx,ctx.url.pathname+ctx.url.search));
  }
  if (!key) {
    if (section==='wsparcie') return supportPage(ctx);
    if (section==='konto') return account.account(ctx);
    if (section==='sprzedaj') return ctx.robotics?robots.sellStart(ctx):account.sellStart(ctx);
    if (section==='moje-ogloszenia') return account.listingsPage(ctx,(await mine(ctx)).filter(item=>!ctx.robotics||item.type==='robot'));
    if (section==='ustawienia') return account.profilePage(ctx);
    if (section==='wiadomosci') return account.messagesPage(ctx,await inbox(ctx));
    if (section==='powiadomienia') return account.noticesPage(ctx,await notices(ctx));
    if (section==='panel-dealera') return account.dealerPage(ctx,await importHistory(ctx));
    if (section==='moderacja') return staff.moderationPage(ctx,await reviewQueue(ctx));
    if (section==='administracja') return staff.adminPage(ctx,await adminData(ctx));
    missing();
  }
  if (section==='sprzedaj'||section==='podglad') {
    const item=await owned(ctx,key);
    const state=await editState(ctx,item);
    const offer=hydrate(ctx,item,section==='podglad'?state.raw:null,section==='podglad');
    const robotics=offer.type==='robot';
    if(robotics!==Boolean(ctx.robotics))return redirect(href({...ctx,robotics},'/'+section+'/'+offer.id));
    if (section==='sprzedaj') {
      if (offer.status==='pending') return redirect(href(ctx,'/podglad/'+offer.id));
      return robotics?robots.wizard(ctx,offer,state):account.wizard(ctx,offer,state);
    }
    return robotics?robots.detail(ctx,offer,{mode:'preview',extras:robots.previewActions(ctx,offer,state)}):market.detail(ctx,offer,{mode:'preview',extras:account.previewActions(ctx,offer,state)});
  }
  if (section==='wsparcie'&&key==='powrot') return supportReturnPage(ctx);
  if (section==='wiadomosci') return account.threadPage(ctx,await messages(ctx,key));
  if (section==='moderacja') {
    const {offer,history}=await reviewDetail(ctx,key);
    if(offer.type==='robot') {
      ctx.robotics=true;
      return robots.detail(ctx,offer,{mode:'moderation',extras:staff.moderationActions(ctx,offer,history)});
    }
    return market.detail(ctx,offer,{mode:'moderation',extras:staff.moderationActions(ctx,offer,history)});
  }
  missing();
}
export async function handler(req,env,asset,execution) {
  const ctx=context(req,env,asset);
  ctx.wakeAutomation=()=>scheduledAutomation(env,asset);
  const path=ctx.path;
  const isAPI=path==='/api'||path.startsWith('/api/');
  const langCookie=ctx.requestedLanguage?cookie(ctx,'a4_lang',ctx.requestedLanguage,365*86400):'';
  let result;
  try {
    const readable=req.method==='GET'||req.method==='HEAD';
    if (path==='/api/stripe/webhook') return withHeaders(await stripeWebhook(ctx));
    if (!ctx.demo&&req.method==='GET'&&path==='/api/china-market-news') return withHeaders(await chinaMarketNews());
    if (!ctx.demo&&req.method==='GET'&&path==='/api/exchange-rates') return withHeaders(await exchangeRates());
    if (!ctx.demo&&readable&&path==='/offline.html') return withHeaders(offlinePage(ctx));
    if (!ctx.demo && readable && (path.startsWith('/assets/')||['/app.js','/appearance.js','/ultimate-visual.js','/smart-camera.js','/smart-camera-guides.js','/smart-camera-quality.js','/styles.css','/sw.js'].includes(path))) {
      result=await asset(path,req.method);
      if (!result&&path.startsWith(adMediaPath)) result=await readAdMedia(ctx,path);
      if (!result&&path.startsWith('/assets/')) result=await readDemoMedia(ctx,path);
      if (!result) return withHeaders(new Response('Not found',{status:404}));
      if(path==='/assets/service-offline-ai-vendor/translate-worker.js')return withHeaders(result,{'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://storage.googleapis.com/download/storage/v1/b/moz-fx-translations-data--303e-prod-translations-data/o/; object-src 'none'"});
      return withHeaders(result,path==='/sw.js'?{'Service-Worker-Allowed':'/'}:{});
    }
    if (!ctx.demo&&path.startsWith(adMediaSetup)) return withHeaders(await installAdMedia(ctx,path.slice(adMediaSetup.length)));
    if (!ctx.demo&&path.startsWith(demoMediaSetup)) return withHeaders(await installDemoMedia(ctx,path.slice(demoMediaSetup.length)));
    if (path==='/healthz'&&readable) {
      const check=await row(ctx.db,'SELECT 1 AS ready FROM users LIMIT 1');
      return withHeaders(json({ok:true,database:true}));
    }
    if (readable&&path==='/robots.txt') return withHeaders(new Response('User-agent: *\n'+(ctx.env.PUBLIC_INDEXING==='1'?
      'Disallow: /demo\nDisallow: /api/\nDisallow: /konto\nDisallow: /sprzedaj\nDisallow: /moje-ogloszenia\nDisallow: /podglad\nDisallow: /moderacja\nDisallow: /administracja\nDisallow: /wiadomosci\nDisallow: /ustawienia\nSitemap: '+ctx.origin+'/sitemap.xml\n':'Disallow: /\n'),{headers:{'Content-Type':'text/plain; charset=utf-8'}}));
    if (readable&&path==='/sitemap.xml') return withHeaders(await sitemap(ctx));
    if (!ctx.demo && env.SITES_CHATGPT_SIGNIN==='1' && req.method==='GET') {
      const pending='a4_chatgpt_pending';
      if (path==='/logowanie-chatgpt') {
        const next=cleanReturn(ctx.url.searchParams.get('dalej'),'/konto');
        return withHeaders(redirect('/signin-with-chatgpt?return_to='+encodeURIComponent(next),{'Set-Cookie':cookie(ctx,pending,encodeURIComponent(next),600)}));
      }
      const email=emailOf(req.headers.get('oai-authenticated-user-email'));
      if (ctx.cookies[pending] && email && !isAPI) {
        const headers=new Headers({'Cache-Control':'no-store'});
        headers.append('Set-Cookie',cookie(ctx,pending,'',0));
        let next='/konto';
        try {next=cleanReturn(decodeURIComponent(ctx.cookies[pending]),next);} catch {}
        try {
          const token=await chatGPTLogin(ctx,email,req.headers.get('oai-authenticated-user-full-name'));
          headers.append('Set-Cookie',token);
          headers.append('Set-Cookie',cookie(ctx,'a4_chatgpt_session','1',14*86400));
          headers.set('Location',next);
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          headers.set('Location',withAuthReturn('/zaloguj?chatgpt=unavailable',next==='/konto'?'':next));
        }
        return withHeaders(new Response(null,{status:303,headers}));
      }
    }
    await hydrateContext(ctx);
    if (isAPI) {
      result=await api(ctx);
      if(execution?.waitUntil&&result.ok&&req.method==='POST'&&/^\/api\/automation\/(?:push\/|source\/[^/]+\/run$|sources$)/.test(path)){
        execution.waitUntil(automationTick(ctx,{force:true,budget:3}).catch(err=>console.error('automation_dispatch_failed',err.name)));
      }
    }
    else if (!readable) missing();
    else if (path==='/manifest.webmanifest') result=manifest(ctx);
    else if(path.startsWith('/uslugi-media/'))result=await serviceMedia(ctx,path.slice('/uslugi-media/'.length));
    else if (path.startsWith('/media/')) {
      const [,,key,thumb,extra]=path.split('/');
      if (!key||extra||(thumb&&thumb!=='thumb')) missing();
      result=await photoResponse(ctx,key,thumb==='thumb');
    } else if (path.startsWith('/rolka/')) {
      result=await reelResponse(ctx,path.slice('/rolka/'.length));
    } else if (path.startsWith('/wideo/')) {
      const [,,key,extra]=path.split('/');
      if (!key||extra) missing();
      result=await videoResponse(ctx,key);
    } else if (path.startsWith('/asset/')) {
      const [,,kind,key,extra]=path.split('/');
      if (extra) missing();
      result=await publicAsset(ctx,kind,key);
    } else if (path.startsWith('/fragment/')) {
      const keys=[...new Set((ctx.url.searchParams.get('keys')||'').split(',').filter(isId))];
      let html='';
      if (path==='/fragment/saved') html=await (ctx.robotics?robots:market).renderSaved(ctx,keys.slice(0,75));
      else if (path==='/fragment/compare') html=await (ctx.robotics?robots:market).renderCompare(ctx,keys.slice(0,4));
      else if (path==='/fragment/search') html=await market.renderSearchBatch(ctx);
      else if (path.startsWith('/fragment/thread/')) html=account.threadMessages(ctx,await messages(ctx,path.split('/')[3]));
      else missing();
      result=new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Language':ctx.lang,'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
    } else {
      ctx.badges=await badges(ctx);
      const view=await page(ctx);
      result=view instanceof Response?view:asHTML(ctx,view);
      if (!ctx.demo&&result.status===200&&isPageNavigation(req)&&
          (publicViewPaths.has(path)||/^\/(oferta|sprzedawca|dealer|kategorie)\/[^/]+$/.test(path))) {
        const measurement=recordPageView(ctx.db).catch(error=>console.error('page_view_write_failed',error.name));
        if (execution) execution.waitUntil(measurement);
        else await measurement;
      }
    }
  } catch (error) {
    const known=error instanceof AppError;
    if (!known) console.error('request_failed',ctx.req.method,ctx.path.split('/').slice(0,3).map(x=>/^[a-f0-9-]{36}$/.test(x)?':id':x.slice(0,32)).join('/'),error.name,error.code||'');
    const message=known?ctx.t(error.pl,error.en):ctx.t('Wystąpił błąd serwera. Odśwież stronę i ponów próbę.','A server error occurred. Reload the page and try again.');
    const status=known?error.status:500;
    if (isAPI||path.startsWith('/fragment/')) result=json({ok:false,error:message,...(known?error.details:{})},status);
    else result=asHTML(ctx,path==='/zegarek'?watchError(ctx,message):errorPage(ctx,status,message),status);
  }
  const extra=/^\/(uslugi|moje-uslugi|moderacja-uslug)(\/|$)/.test(path)?{
    'Permissions-Policy':'geolocation=(self), camera=(), microphone=()',
    'Content-Security-Policy':responseHeaders['Content-Security-Policy'].replace("img-src 'self'","media-src 'self' blob:; img-src 'self' https://tile.openstreetmap.org")
  }:!ctx.robotics&&ctx.user&&result.status===200&&/^\/sprzedaj\/[^/]+$/.test(path)?{
    'Permissions-Policy':'geolocation=(), camera=(self), microphone=()',
    'Content-Security-Policy':responseHeaders['Content-Security-Policy']+"; media-src 'self' blob:"
  }:{};
  return withHeaders(result,extra,langCookie);
}

export async function scheduledAutomation(env,asset,options={}) {
  const ctx=context(new Request((env.APP_ORIGIN||env.IMPORT_PUBLIC_ORIGIN||'http://127.0.0.1:'+String(env.PORT||3000))+'/api/automation/tick'),env,asset);
  let paymentBacklog=false;
  try{paymentBacklog=await drainStripeInbox(ctx);}catch{console.warn('stripe_inbox_retry');}
  const live=await automationTick(ctx,options);
  const pending=await rows(ctx.db,"SELECT DISTINCT scope FROM auto_jobs WHERE scope LIKE 'demo:%' AND state IN ('queued','running') UNION SELECT DISTINCT scope FROM auto_sources WHERE scope LIKE 'demo:%' AND interval_hours>0 AND enabled=1 AND next_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') LIMIT 8");
  for(const s of pending)await automationTick({...ctx,scope:s.scope,demo:true,prefix:'/demo'},options);
  const backlog=await row(ctx.db,"SELECT 1 AS ready FROM auto_jobs j JOIN auto_sources s ON s.id=j.source_id AND s.enabled=1 LEFT JOIN auto_policy p ON p.scope=j.scope WHERE j.state IN ('queued','running') AND coalesce(p.paused,0)=0 AND coalesce(p.imports,1)=1 AND (j.kind!='sync' OR coalesce(p.sync,1)=1) AND (j.lease IS NULL OR j.lease_until<?) LIMIT 1",new Date().toISOString());
  return {...live,backlog:Boolean(backlog||paymentBacklog)};
}
