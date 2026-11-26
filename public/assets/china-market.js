const section=document.querySelector('[data-china-market]');

if (section) {
  const list=section.querySelector('[data-market-articles]');
  const status=section.querySelector('[data-market-status]');
  const more=section.querySelector('[data-market-more]');
  const formatter=new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'medium',timeZone:'Europe/Warsaw'});
  const checked=new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Warsaw'});
  let expanded=false;

  function showArticles() {
    [...list.children].forEach((article,index)=>{article.hidden=!expanded&&index>=6;});
    more.hidden=list.children.length<=6;
    more.setAttribute('aria-expanded',String(expanded));
    more.textContent=expanded?more.dataset.less:more.dataset.more;
  }

  more.addEventListener('click',()=>{
    expanded=!expanded;
    showArticles();
    if (expanded) list.children[6]?.querySelector('summary')?.focus();
  });

  async function update() {
    try {
      const response=await fetch('/api/china-market-news');
      if (!response.ok) throw new Error('Market feed unavailable');
      const {articles,checkedAt}=await response.json();
      if (!articles.length) throw new Error('Market feed empty');
      // Preserve keyboard focus during a background refresh.
      if (list.contains(document.activeElement)) return;
      const openUrl=list.querySelector('details[open]')?.dataset.url;
      const cards=articles.map(article=>{
        const item=document.createElement('li');
        const details=document.createElement('details');
        details.name='china-market-stories';
        details.dataset.url=article.url;
        details.open=article.url===openUrl;
        const summary=document.createElement('summary');
        const cover=document.createElement('img');
        cover.alt='';
        cover.loading='lazy';
        cover.decoding='async';
        cover.referrerPolicy='no-referrer';
        const title=document.createElement('span');
        title.lang='en';
        title.textContent=article.title;
        summary.append(cover,title);

        const info=document.createElement('div');
        info.className='china-market-story';
        const meta=document.createElement('div');
        meta.className='china-market-meta';
        const date=document.createElement('time');
        date.dateTime=article.date;
        date.textContent=formatter.format(new Date(article.date));
        meta.append(article.source,' · ',date);
        const illustrative=document.createElement('small');
        illustrative.textContent=section.dataset.illustrative;
        illustrative.hidden=Boolean(article.image);
        const fallback='/assets/china-market-cover.webp';
        cover.addEventListener('error',()=>{
          illustrative.hidden=false;
          cover.src=fallback;
        },{once:true});
        cover.src=article.image||fallback;
        info.append(meta);
        if (article.excerpt) {
          const excerpt=document.createElement('p');
          excerpt.lang='en';
          excerpt.textContent=article.excerpt;
          info.append(excerpt);
        }
        const link=document.createElement('a');
        link.href=article.url;
        link.textContent=section.dataset.readArticle;
        info.append(link,illustrative);
        details.append(summary,info);
        item.append(details);
        return item;
      });
      list.replaceChildren(...cards);
      status.textContent=status.dataset.checked+' '+checked.format(new Date(checkedAt));
      showArticles();
    } catch {
      if (!list.children.length) status.textContent=status.dataset.unavailable;
    }
  }

  await update();
  setInterval(()=>{if (!document.hidden) update();},15*60*1000);
}
