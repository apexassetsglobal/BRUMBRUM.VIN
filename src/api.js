import { submitYouTubePromotion, changeYouTubePromotion, youtubePromotionReturn } from './youtube-promotions.js';
import { publishReel, removeReel } from './reels.js';
import { assertSameOrigin, cleanReturn, cookie, forbidden, input, invalid, isId, json, missing, rate, redirect, requireUser, row, run, text, truth, withAuthReturn } from './core.js';
import * as auth from './accounts.js';
import * as market from './market.js';
import * as comms from './inbox.js';
import * as staff from './staff.js';
import * as dealer from './dealer.js';
import { catalogFor } from './data.js';
import { canRecordBanner } from './banners.js';
import { isHumanTraffic, recordBannerEvent } from './traffic.js';
import { startSupport, supportPackage } from './support.js';
import { createOrder, listOrders, orderDetail, changeOrderStatus } from './robot-orders.js';
import { robotBrands, robotCategories, robotCurrencies, robotRentalUnits, robotTradeModes } from './robot-catalog.js';
import { saveSoundSettings, soundEventsSince, soundSettings } from './sounds.js';

const ok = (data = {}) => json({ok:true,...data});
const withCookies = (data, values) => {
  const headers=new Headers(values);
  headers.set('Cache-Control','no-store');
  return Response.json({ok:true,...data},{headers});
};
const cookieHeader = value => ({'Set-Cookie':value});

import {serviceApi} from './services.js';
import {automationApi,allowImport,allowPublication} from './automation.js';

export async function api(ctx) {
  const path=ctx.path.slice(4).split('/').filter(Boolean);
  const [area,key,action,target]=path;
  const method=ctx.req.method;
  if(area==='services')return serviceApi(ctx,path.slice(1));
  if(area==='automation')return automationApi(ctx,path.slice(1));
  if(area==='dealer' && method==='POST')await allowImport(ctx);
  if(area==='listings'&&action==='submit'&&method==='POST')await allowPublication(ctx);
  if (method==='GET') {
    if(area==='sound-settings'&&!key)return ok(await soundSettings(ctx));
    if(area==='sound-events'&&!key)return ok(await soundEventsSince(ctx));
    if(area==='appearance'&&!key) {
      if(!ctx.user)return ok({engine:null});
      const saved=await row(ctx.db,"SELECT value FROM settings WHERE scope=? AND key='ultimate_visual'",'user:'+ctx.user.id);
      let engine=null;try{engine=JSON.parse(saved?.value||'null');}catch{}
      return ok({engine});
    }
    if(area==='robot-orders'&&!key)return ok({orders:await listOrders(ctx)});
    if(area==='robot-orders'&&key&&!action)return ok({order:await orderDetail(ctx,key)});
    if (area==='catalog' && !key) return ok(ctx.robotics||ctx.url.searchParams.get('market')==='robotics'?
      {market:'robotics',categories:robotCategories,brands:robotBrands,currencies:robotCurrencies,rentalUnits:robotRentalUnits,tradeModes:robotTradeModes}:
      await catalogFor(ctx));
    if (area==='search' && !key) return ok(await market.search(ctx,ctx.url.searchParams));
    if (area==='compare' && !key) return ok({offers:await market.listingsByKeys(ctx,(ctx.url.searchParams.get('keys')||'').split(',').filter(isId).slice(0,4))});
    if (area==='favorites' && !key) return ok({keys:await comms.favorites(ctx)});
    if (area==='badges' && !key) return ok(await comms.badges(ctx));
    if (area==='listings' && action==='edit') {
      const listing=await market.owned(ctx,key);
      return ok(await market.editState(ctx,listing));
    }
    if (area==='offers' && key && action==='phone') {
      await rate(ctx,'phone',30,3600);
      return ok({phone:await market.phoneFor(ctx,key)});
    }
    if (area==='messages' && key && !action) return ok(await comms.messages(ctx,key));
    if (area==='dealer' && key==='template' && !action) {
      await dealer.importHistory(ctx);
      const robotics=ctx.robotics||ctx.url.searchParams.get('market')==='robotics';
      return new Response(dealer.csvTemplate({robotics}),{headers:{'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename='+(robotics?'roboty-import.csv':'brumbrum-vin-import.csv'),'Cache-Control':'no-store'}});
    }
    missing();
  }
  if (!['POST','PUT'].includes(method)) missing();
  assertSameOrigin(ctx);
  if (area==='banner-event'&&method==='POST'&&!key) {
    if (ctx.demo||!isHumanTraffic(ctx.req)) return ok();
    const {banner,event}=await input(ctx,512);
    if (typeof banner!=='string'||!['impression','click'].includes(event)||!await canRecordBanner(ctx,banner,event)) invalid();
    await rate(ctx,'banner-event',720,600,ctx.ip);
    await recordBannerEvent(ctx.db,banner,event);
    return ok();
  }
  await rate(ctx,'writes',380,600);
  if (area==='listings' && ['photo','spin'].includes(action) && method==='POST') {
    await rate(ctx,'photos',70,3600);
    const {version,photos,spin,video,smartCamera,duplicate,needsRefresh,data}=await market.upload(ctx,key,action==='spin'?'spin':'photos');
    return ok({version,photos,spin,video,smartCamera,duplicate,needsRefresh:Boolean(needsRefresh),photoDetails:data.photoDetails||{}});
  }
  if (area==='listings' && action==='video' && method==='POST') {
    await rate(ctx,'listing-video',12,3600);
    const {version,photos,spin,video}=await market.uploadVideo(ctx,key);
    return ok({version,photos,spin,video});
  }
  if (area==='reels' && method==='POST' && !key) {
    await rate(ctx,'company-reels',12,3600);
    await publishReel(ctx);
    return ok({next:ctx.prefix+'/panel-dealera#rolki'});
  }
  if (area==='asset' && method==='POST') return ok({key:await staff.uploadBrandAsset(ctx,key,action)});
  const body=await input(ctx,area==='dealer'?300000:area==='admin'?240000:65536);
  if(area==='sound-settings'&&method==='PUT'&&!key)return ok(await saveSoundSettings(ctx,body));
  if(area==='appearance'&&method==='PUT'&&!key) {
    const user=requireUser(ctx);
    if(!body.engine||typeof body.engine!=='object'||Array.isArray(body.engine))invalid();
    const value=JSON.stringify(body.engine);
    if(value.length>24000)invalid();
    await run(ctx.db,"INSERT INTO settings(scope,key,value) VALUES(?,'ultimate_visual',?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value",'user:'+user.id,value);
    return ok();
  }
  if(area==='robot-orders'&&method==='POST') {
    if(!key)return ok(await createOrder(ctx,body.listingId,body));
    if(action==='status'&&!target)return ok(await changeOrderStatus(ctx,key,body));
  }
  if (area==='support'&&key==='start'&&!action&&method==='POST') {
    await rate(ctx,'support-start',12,3600);
    return ok(await startSupport(ctx,body));
  }
  if (area==='access' && method==='POST' && !key && ctx.demo) {
    const headers=await auth.demoSession(ctx,body);
    const next=cleanReturn(body.next,'/demo/konto');
    return withCookies({next:next.startsWith('/demo/')||next==='/demo'?next:'/demo/konto'},headers);
  }
  if (area==='auth' && method==='POST') {
    if (key==='logout') {
      const headers=new Headers(cookieHeader(await auth.logout(ctx)));
      const chatGPT=!ctx.demo && ctx.cookies.a4_chatgpt_session==='1';
      if (chatGPT) headers.append('Set-Cookie',cookie(ctx,'a4_chatgpt_session','',0));
      return withCookies({next:chatGPT?'/signout-with-chatgpt':ctx.prefix+'/'},headers);
    }
    if (ctx.demo) forbidden();
    if (key==='register') {await auth.register(ctx,body);return ok({next:withAuthReturn('/sprawdz-poczte',body.next)});}
    if (key==='login') {
      const headers=new Headers(cookieHeader(await auth.login(ctx,body)));
      if (ctx.cookies.a4_chatgpt_session) headers.append('Set-Cookie',cookie(ctx,'a4_chatgpt_session','',0));
      if (ctx.cookies.a4_chatgpt_pending) headers.append('Set-Cookie',cookie(ctx,'a4_chatgpt_pending','',0));
      return withCookies({next:cleanReturn(body.next,'/konto')},headers);
    }
    if (key==='resend' || key==='reset-request') {await auth.requestToken(ctx,body,key==='resend'?'verify':'reset');return ok({next:withAuthReturn('/sprawdz-poczte',body.next)});}
    if (key==='verify' || key==='reset') {await auth.redeem(ctx,body,key);return ok({next:withAuthReturn('/zaloguj?confirmed='+key,body.next)});}
    if (key==='owner') {await auth.bootstrapOwner(ctx,body);return ok({next:'/administracja'});}
    if (key==='change') {await auth.changePassword(ctx,body);return ok();}
    if (key==='delete') return withCookies({next:'/'},cookieHeader(await auth.removeAccount(ctx,body)));
  }
  if (area==='reels' && method==='POST' && action==='remove' && !target && isId(key)) {
    await removeReel(ctx,key);
    return ok();
  }
  if (area==='profile' && method==='PUT') {
    const language=await auth.updateProfile(ctx,body);
    return withCookies({},cookieHeader(cookie(ctx,'a4_lang',language,365*86400)));
  }
  if (area==='listings') {
    if (!key && method==='POST') {
      await rate(ctx,'create-draft',30,3600);
      const listing=await market.createDraft(ctx,body);
      const robotics=ctx.robotics||body.market==='robotics'||body.type==='robot';
      return ok({id:listing,next:ctx.prefix+(robotics?'/roboty':'')+'/sprzedaj/'+listing});
    }
    if (action==='edit' && method==='PUT') return ok(await market.saveEdit(ctx,key,body));
    if (action==='submit' && method==='POST') {
      const result={...await market.submitListing(ctx,key,body),listingId:key};
      if (supportPackage(body.support)) result.next=ctx.prefix+'/wsparcie?ogloszenie='+encodeURIComponent(key)+'&pakiet='+body.support;
      return ok(result);
    }
    if (action==='status' && method==='POST') {await market.ownerAction(ctx,key,body);return ok();}
  }
  if (area==='offers' && key && action==='message' && method==='POST') return ok(await comms.startMessage(ctx,key,body));
  if (area==='favorites' && !key && method==='POST') {
    await comms.favorite(ctx,Array.isArray(body.keys)?body.keys:[body.key],truth(body.add));
    return ok({keys:await comms.favorites(ctx)});
  }
  if (area==='messages' && key && method==='POST') {
    if (action==='read') {await comms.readThread(ctx,key);return ok();}
    if (action==='block') {await comms.blockThread(ctx,key,body);return ok();}
    if (action==='proposal') {await comms.proposal(ctx,key,body);return ok();}
    if (!action) return ok(await comms.reply(ctx,key,body));
  }
  if (area==='notifications' && key==='read' && method==='POST') {await comms.readNotices(ctx);return ok();}
  if (area==='report' && !key && method==='POST') return ok({id:await comms.report(ctx,body)});
  if (area==='youtube-promotions'&&method==='POST'&&!action) {
    if (key) return ok({next:await changeYouTubePromotion(ctx,key,body.action)});
    await rate(ctx,'youtube-promotions',8,3600);
    await submitYouTubePromotion(ctx,body);
    return ok({next:youtubePromotionReturn(ctx,true)});
  }
  if (area==='contact' && !key && method==='POST') return ok({id:await comms.contacts(ctx,body)});
  if (area==='dealer' && method==='POST') {
    if (key==='preview') return ok(await dealer.previewCSV(ctx,body));
    if (key==='import') return ok(await dealer.importCSV(ctx,body));
  }
  if (area==='moderation' && method==='POST') {
    if (key==='reports') {await staff.resolveReport(ctx,action,body);return ok();}
    if (key) {if(body.action==='published'||body.action==='approve')await allowPublication(ctx);await market.moderate(ctx,key,body);return ok({next:ctx.prefix+'/moderacja'});}
  }
  if (area==='admin' && method==='POST') {
    if (key==='roles') {await staff.adminRole(ctx,action,body);return ok();}
    if (key==='settings') {await staff.adminSettings(ctx,body);return ok();}
    if (key==='dictionary') {await staff.adminDictionary(ctx,body);return ok();}
    if (key==='banners') return ok({id:await staff.adminBanner(ctx,action,body)});
    if (key==='features') {await staff.adminFeature(ctx,action,body);return ok();}
    if (key==='contacts') {await staff.adminContact(ctx,action,body);return ok();}
  }
  missing();
}
