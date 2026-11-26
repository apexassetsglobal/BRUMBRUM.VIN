import { parse, row, rows, run } from './core.js';

const warsawDate=new Intl.DateTimeFormat('en',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
const warsawDay=date=>{
  const {year,month,day}=Object.fromEntries(warsawDate.formatToParts(date).map(({type,value})=>[type,value]));
  return `${year}-${month}-${day}`;
};
// Use UTC for calendar arithmetic after resolving the Warsaw day.
const previousDay=(day,offset)=>new Date(Date.parse(day+'T00:00:00Z')-offset*86400000).toISOString().slice(0,10);
function validDay(day) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(day)) return false;
  const date=new Date(day+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;
}

export function isHumanTraffic(request) {
  const agent=request.headers.get('User-Agent')||'';
  return /\bMozilla\/|Opera\//i.test(agent)&&!/bot\b|crawl|spider|preview|facebookexternalhit|headlesschrome/i.test(agent);
}

export function isPageNavigation(request) {
  const headers=request.headers;
  const mode=headers.get('Sec-Fetch-Mode');
  const destination=headers.get('Sec-Fetch-Dest');
  return request.method==='GET'&&/\btext\/html\b/i.test(headers.get('Accept')||'')&&
    (!mode||mode==='navigate')&&(!destination||destination==='document')&&
    !/prefetch|prerender/i.test((headers.get('Sec-Purpose')||'')+' '+(headers.get('Purpose')||''))&&
    isHumanTraffic(request);
}

export const recordPageView=(db,date=new Date())=>run(db,`INSERT INTO site_page_views(day,views) VALUES(?,1)
  ON CONFLICT(day) DO UPDATE SET views=site_page_views.views+1`,warsawDay(date));

export async function readPageViews(db,until='',date=new Date()) {
  const today=warsawDay(date);
  const endDay=validDay(until)&&until<=today?until:today;
  const dates=Array.from({length:7},(_,offset)=>previousDay(endDay,offset));
  const totals=await row(db,`SELECT MIN(day) AS first_day, COALESCE(SUM(views),0) AS total,
    COALESCE(SUM(CASE WHEN day>=? THEN views END),0) AS week,
    COALESCE(MAX(CASE WHEN day=? THEN views END),0) AS today,
    (SELECT json_group_object(day,views) FROM site_page_views WHERE day BETWEEN ? AND ?) AS daily
    FROM site_page_views WHERE day<=?`,previousDay(today,6),today,dates.at(-1),endDay,today);
  const daily=parse(totals.daily);
  const days=dates.map(day=>({day,views:day===today||(totals.first_day&&day>=totals.first_day)?daily[day]??0:null}));
  return {days,endDay,todayDate:today,today:totals.today,week:totals.week,total:totals.total,firstDay:totals.first_day};
}

export function recordBannerEvent(db,banner,event,date=new Date()) {
  const impression=event==='impression';
  return run(db,`INSERT INTO site_banner_stats(day,banner_id,impressions,clicks) VALUES(?,?,?,?)
    ON CONFLICT(day,banner_id) DO UPDATE SET impressions=impressions+excluded.impressions,clicks=clicks+excluded.clicks`,
    warsawDay(date),banner,Number(impression),Number(!impression));
}

export function readBannerStats(db,range,endDay) {
  const from=range==='all'?'0000-01-01':range==='week'?previousDay(endDay,6):endDay;
  return rows(db,`WITH totals AS (
      SELECT banner_id AS id,SUM(impressions) AS impressions,SUM(clicks) AS clicks
      FROM site_banner_stats WHERE day BETWEEN ? AND ? GROUP BY banner_id
    ) SELECT totals.*,banners.advertiser,banners.title_pl,banners.title_en FROM totals
    LEFT JOIN banners ON totals.id LIKE 'managed-%' AND banners.id=substr(totals.id,9) AND banners.scope='live'`,from,endDay);
}
