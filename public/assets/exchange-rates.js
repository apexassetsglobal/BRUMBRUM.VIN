const currencyFlags=new Map([
  ['EUR','eu'],['USD','us'],['GBP','gb'],['CHF','ch'],
  ['CZK','cz'],['SEK','se'],['NOK','no'],['DKK','dk'],
  ['CAD','ca'],['AUD','au'],['JPY','jp'],['UAH','ua']
]);
const bar=document.querySelector('[data-exchange-rates]');

if (bar) {
  const track=bar.querySelector('[data-rate-track]');
  const status=bar.querySelector('[data-rate-status]');
  const pause=bar.querySelector('[data-rate-pause]');
  pause.addEventListener('click',()=>{
    const paused=bar.toggleAttribute('data-rates-paused');
    pause.setAttribute('aria-pressed',String(paused));
  });

  try {
    const response=await fetch('/api/exchange-rates');
    if (!response.ok) throw new Error('Exchange rates unavailable');
    const {date,rates}=await response.json();
    const amount=new Intl.NumberFormat(document.documentElement.lang,{minimumFractionDigits:2,maximumFractionDigits:4});
    const list=document.createElement('ul');
    for(const {code,mid} of rates) {
      const item=document.createElement('li');
      const currency=document.createElement('strong');
      currency.textContent='1 '+code;
      const flagCode=currencyFlags.get(code);
      if (flagCode) {
        const flag=document.createElement('img');
        flag.className='exchange-flag';
        flag.alt='';
        flag.width=22;
        flag.height=16;
        flag.src='/assets/exchange-flags/'+flagCode+'.png';
        item.append(flag);
      }
      item.append(currency,' = '+amount.format(mid)+' PLN');
      list.append(item);
    }
    const duplicate=list.cloneNode(true);
    duplicate.setAttribute('aria-hidden','true');
    track.append(list,duplicate);
    const reference=bar.querySelector('time');
    reference.dateTime=date;
    reference.textContent=date;
    status.hidden=true;
    bar.setAttribute('data-rates-ready','');
  } catch {
    status.textContent=status.dataset.unavailable;
  }
}
