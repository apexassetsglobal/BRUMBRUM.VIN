import { soundCatalog, soundEvents, defaultSoundSettings } from '../public/assets/sound-catalog.js';
import { fail, now, parse, requireUser, row, rows, run, text, truth } from './core.js';

const soundIds=new Set(soundCatalog.map(item=>item.id));
const eventIds=new Set(soundEvents.map(([key])=>key));

export function normalizeSoundSettings(value) {
  const defaults=defaultSoundSettings();
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const favorites=Array.isArray(source.favorites)
    ? [...new Set(source.favorites.filter(id=>soundIds.has(id)))].slice(0,soundCatalog.length)
    : defaults.favorites;
  const events={};
  for(const key of eventIds) {
    const fallback=defaults.events[key];
    const selected=source.events?.[key];
    events[key]={
      soundId:soundIds.has(selected?.soundId)?selected.soundId:fallback.soundId,
      volume:Number.isFinite(Number(selected?.volume))?Math.max(0,Math.min(100,Math.round(Number(selected.volume)))):fallback.volume,
      muted:selected&&Object.hasOwn(selected,'muted')?truth(selected.muted):fallback.muted
    };
  }
  return {version:1,favorites,events};
}

export async function soundSettings(ctx) {
  if(!ctx.user)return {settings:null};
  const saved=await row(ctx.db,"SELECT value FROM settings WHERE scope=? AND key='sound_garage'",'user:'+ctx.user.id);
  if(!saved)return {settings:null};
  return {settings:normalizeSoundSettings(parse(saved.value))};
}

export async function saveSoundSettings(ctx,body) {
  const user=requireUser(ctx);
  const settings=normalizeSoundSettings(body?.settings);
  const value=JSON.stringify(settings);
  if(value.length>12000)fail(422,'Ustawienia dźwięków są nieprawidłowe.','Sound settings are invalid.');
  await run(ctx.db,"INSERT INTO settings(scope,key,value) VALUES(?,'sound_garage',?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value",'user:'+user.id,value);
  return {settings};
}

const eventFor=(kind,userId,sellerId)=>{
  if(kind==='message')return sellerId===userId?'listingInquiry':sellerId?'sellerReply':'newMessage';
  if(kind==='sold')return 'vehicleSold';
  if(kind==='published')return 'newOffer';
  if(kind==='viewing')return 'sellerReply';
  return 'system';
};

export async function soundEventsSince(ctx) {
  const user=requireUser(ctx);
  const cursor=now();
  const requested=text(ctx.url.searchParams.get('after'),40);
  const after=Number.isFinite(Date.parse(requested))?new Date(requested).toISOString():cursor;
  const notices=await rows(ctx.db,`SELECT n.id,n.kind,n.created_at,c.seller_id
    FROM notifications n LEFT JOIN conversations c ON c.id=json_extract(n.data,'$.thread')
    WHERE n.user_id=? AND n.created_at>? AND n.created_at<=? ORDER BY n.created_at,n.id LIMIT 40`,user.id,after,cursor);
  const prices=await rows(ctx.db,`SELECT f.listing_id AS id,l.price FROM favorites f JOIN listings l ON l.id=f.listing_id
    WHERE f.user_id=? AND l.scope=? AND l.status IN ('published','sold') ORDER BY f.created_at DESC LIMIT 250`,user.id,ctx.scope);
  return {
    cursor,
    events:notices.map(item=>({id:item.id,type:eventFor(item.kind,user.id,item.seller_id),at:item.created_at})),
    favoritePrices:Object.fromEntries(prices.map(item=>[item.id,item.price]))
  };
}
