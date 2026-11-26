import { json } from './core.js';

const feeds=[
  {name:'CarNewsChina',url:'https://carnewschina.com/feed/'},
  {name:'CnEVPost',url:'https://cnevpost.com/feed/'}
];
const refreshInterval=15*60*1000;
const feedsCache=new Map();
const xmlEntities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
let refreshAfter=0;
let pending;

function decodeXml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(match,entity)=>{
    if (entity[0]!=='#') return Object.hasOwn(xmlEntities,entity)?xmlEntities[entity]:match;
    const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
    return code>0&&code<=0x10ffff?String.fromCodePoint(code):match;
  });
}

function field(item,name) {
  const value=item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]?.trim()||'';
  const cdata=value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return cdata?cdata[1]:decodeXml(value);
}

function plainText(html) {
  return decodeXml(html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}

function articleImage(item,html,origin) {
  const matches=[
    ...item.matchAll(/<media:(?:thumbnail|content)\b[^>]*?\surl\s*=\s*["']([^"']+)["']/gi),
    ...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)
  ];
  for (const [,image] of matches) {
    try {
      const url=new URL(decodeXml(image));
      const host=url.hostname;
      if (url.protocol==='https:'&&!url.username&&!url.password&&(host===origin||host.endsWith('.'+origin))&&
          !/\.(?:svg|gif)(?:$|\?)/i.test(url.pathname)&&!/\b(?:logo|pixel|avatar|tracking)\b/i.test(url.pathname)) return url.href;
    } catch {
      continue;
    }
  }
  return '';
}

export function parseMarketFeed(xml,source) {
  const origin=new URL(source.url).hostname;
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,20).flatMap(([,item])=>{
    const title=plainText(field(item,'title'));
    const date=Date.parse(field(item,'pubDate'));
    if (!title||!Number.isFinite(date)) return [];
    try {
      const url=new URL(field(item,'link'));
      if (url.protocol!=='https:'||url.hostname.replace(/^www\./,'')!==origin||url.username||url.password) return [];
      url.search='';
      url.hash='';
      const description=field(item,'description');
      const content=field(item,'content:encoded');
      const words=plainText(description).replace(/(?:The post|This article) [^]*$/i,'').trim().split(' ').filter(Boolean);
      const excerpt=words.slice(0,20).join(' ')+(words.length>20?'…':'');
      const image=articleImage(item,description+' '+content,origin);
      return [{title:title.slice(0,240),date:new Date(date).toISOString(),url:url.href,source:source.name,image,excerpt}];
    } catch {
      return [];
    }
  });
}

async function refreshFeed(source) {
  try {
    const response=await fetch(source.url,{signal:AbortSignal.timeout(5500),headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
    if (!response.ok) return false;
    const items=parseMarketFeed(await response.text(),source);
    if (!items.length) return false;
    feedsCache.set(source.name,{items,checkedAt:new Date().toISOString()});
    return true;
  } catch {
    return false;
  }
}

export async function chinaMarketNews() {
  if (Date.now()>=refreshAfter&&!pending) {
    pending=Promise.all(feeds.map(refreshFeed)).then(results=>{
      refreshAfter=Date.now()+(results.every(Boolean)?refreshInterval:60*1000);
    }).finally(()=>{pending=null;});
  }
  if (pending) await pending;
  const entries=[...feedsCache.values()];
  const articles=[...new Map(entries.flatMap(({items})=>items).map(item=>[item.url,item])).values()]
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
  const checkedAt=entries.map(entry=>entry.checkedAt).sort().at(-1);
  return articles.length?json({articles,checkedAt},200,{'Cache-Control':'private, max-age=60'}):json({articles:[]},503);
}
