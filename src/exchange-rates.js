import { json } from './core.js';

const currencies=['EUR','USD','GBP','CHF','CZK','SEK','NOK','DKK','CAD','AUD','JPY','UAH'];
const refreshInterval=30*60*1000;
let snapshot;
let refreshAfter=0;
let pending;

async function refreshRates() {
  try {
    const response=await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json',{
      signal:AbortSignal.timeout(4500)
    });
    if (!response.ok) return;
    const [table]=await response.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(table?.effectiveDate)||!Array.isArray(table.rates)) return;
    const quotes=new Map(table.rates.map(({code,mid})=>[code,mid]));
    const rates=currencies.flatMap(code=>{
      const mid=quotes.get(code);
      return Number.isFinite(mid)&&mid>0?[{code,mid}]:[];
    });
    if (!rates.some(rate=>rate.code==='EUR')||!rates.some(rate=>rate.code==='USD')) return;
    snapshot={date:table.effectiveDate,rates};
    refreshAfter=Date.now()+refreshInterval;
  } catch {
    // Keep the last dated snapshot if the source is temporarily unavailable.
  } finally {
    pending=null;
  }
}

export async function exchangeRates() {
  if (Date.now()>=refreshAfter) {
    refreshAfter=Date.now()+60*1000;
    pending=refreshRates();
  }
  if (pending) await pending;
  return snapshot
    ? json(snapshot,200,{'Cache-Control':'public, max-age=300'})
    : json({rates:[]},503);
}
