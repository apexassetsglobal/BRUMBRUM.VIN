import {id,isStaff,missing,parse,redirect,requireStaff,row,rows} from './core.js';
import {summarizeFacts} from '../public/assets/service-copy.js';
import {apiForm,area,check,e,embed,empty,field,hidden,href,icon,link,loginPath,pageHead,panel,wrap} from './ui.js';
import {categoryDescription,categoryName,countryName,countryOptions,serviceCategories} from './service-catalog.js';
import {categoryIds,discover,getFirm,hasCloudAI,languages,myFirms,reviewList} from './services.js';
const button=(s,primary=false,attributes='')=>'<button class="btn '+(primary?'primary':'')+'" '+attributes+'>'+e(s)+'</button>';
export function selectField(name,title,entries,current,blank=''){
  return '<label class="field"><span>'+e(title)+'</span><select name="'+e(name)+'">'+(blank?'<option value="">'+e(blank)+'</option>':'')+entries.map(([key,label])=>'<option value="'+e(key)+'"'+(String(key)===String(current)?' selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>';
}
const countrySelect=(ctx,current,blank)=>selectField('country',ctx.t('Kraj','Country'),countryOptions(ctx.lang).map(x=>[x.code,x.name]),current,blank);
const cats=ctx=>serviceCategories.map(x=>[x.id,categoryName(x.id,ctx.lang)]);
const mediaPath=(ctx,key)=>href(ctx,'/uslugi-media/'+key);
const companyPath=(ctx,slug)=>href(ctx,'/uslugi/firma/'+encodeURIComponent(slug));
const out=(ctx,title,body,props={})=>({title,body:wrap(body,'svc-page'),services:true,...props});
const state=(ctx,s)=>({pending:ctx.t('W moderacji','Pending review'),published:ctx.t('Opublikowana','Published'),rejected:ctx.t('Do poprawy','Needs changes'),draft:ctx.t('Szkic','Draft')})[s]||s;
const languageOptions=languages.map(x=>[x,{pl:'Polski',en:'English',de:'Deutsch',cs:'Čeština',sk:'Slovenčina',uk:'Українська'}[x]]);
const categoryPhoto = category => '/assets/service-categories/' + (categoryIds.has(category) ? category : 'pozostale') + '.webp';

function mapsSearch(label, city, region, country) {
  const query = [label, city, region, country].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?' + new URLSearchParams({api:'1', query});
}

function categoryTiles(ctx, route, publicLinks, city) {
  const filters = ctx.url.searchParams;
  const country = filters.get('country') ? countryName(filters.get('country'), ctx.lang) : '';
  const tiles = serviceCategories.map(({id}, index) => {
    const label = categoryName(id, ctx.lang);
    const query = new URLSearchParams(filters);
    query.delete('page');
    query.delete('category');
    if (route.city) query.set('city', city);
    let path = '/uslugi/' + id;
    if (query.size || !publicLinks.some(item => item.category === id)) {
      query.set('category', id);
      path = '/uslugi?' + query;
    }
    const maps = mapsSearch(label, city, filters.get('region'), country);
    const selected = (route.category || filters.get('category')) === id;
    return `<div class="svc-tile">
      <a class="category svc-category" href="${e(href(ctx,path))}#wyniki-firm"${selected?' aria-current="true"':''}>
        <img src="${categoryPhoto(id)}" width="356" height="233" alt="" loading="${index < 4 ? 'eager' : 'lazy'}">
        <strong>${e(label)}</strong>
      </a>
      <a class="svc-map-shortcut" href="${e(maps)}" target="_blank" rel="noopener noreferrer"
        aria-label="${e(label + ' · Google Maps')}" title="${e(label + ' · Google Maps')}">${icon('pin',16)}<span>Google Maps</span></a>
    </div>`;
  }).join('');
  const heading = ctx.t('Kategorie usług','Service categories');
  return `<section class="svc-categories" aria-labelledby="service-categories-title"><h2 id="service-categories-title">${e(heading)}</h2>
    <nav class="svc-tile-grid" aria-label="${e(heading)}">${tiles}</nav></section>`;
}

function businessCard(ctx, firm, selectedCategory) {
  const url = e(companyPath(ctx, firm.slug));
  const image = firm.cover ? mediaPath(ctx, firm.cover) : categoryPhoto(selectedCategory || firm.primary_category);
  const location = [firm.city, countryName(firm.country,ctx.lang), firm.km != null && firm.km.toFixed(1)+' km',
    firm.rating && '★ '+Number(firm.rating).toFixed(1)].filter(Boolean).join(' · ');
  const description = (parse(firm.translations,{})[ctx.lang] || firm.description || '').slice(0,220);
  return `<article class="svc-card"><a href="${url}">
    <img class="svc-cover" src="${e(image)}" width="356" height="233" alt="" loading="lazy">
    <div><h3>${e(firm.name)}</h3><p>${e(location)}</p>${description ? '<p>'+e(description)+'</p>' : ''}</div>
  </a></article>`;
}
async function directory(ctx,route){
 const t=ctx.t,p=ctx.url.searchParams,r=await discover(ctx,p,route);
 if(route.category && !r.total){const base=await discover(ctx,new URLSearchParams(),route);if(!base.total)missing();}
 const category=route.category||p.get('category'),cityLabel=route.city?(r.items[0]?.city||route.city):'',title=route.category?categoryName(route.category,ctx.lang)+(cityLabel?' · '+cityLabel:''):t('Usługi motoryzacyjne','Automotive services');
 const filterBase=href(ctx,'/uslugi'),mk=(values)=>{const q=new URLSearchParams(p);for(const [k,v] of Object.entries(values)){v?q.set(k,v):q.delete(k);}return e(ctx.url.pathname+(q.size?'?'+q:''));};
 const switcher='<div class="svc-switch">'+[['list',t('Lista','List')],['map',t('Mapa','Map')]].map(([k,s])=>'<a class="btn" '+((p.get('view')||'list')===k?'aria-current="true"':'')+' href="'+mk({view:k})+'#wyniki-firm">'+s+'</a>').join('')+'</div>';
 const search='<form id="filtry-firm" method="get" action="'+filterBase+'" class="panel svc-filter"><div class="svc-grid">'+selectField('category',t('Rodzaj usługi','Service category'),cats(ctx),category,t('Wszystkie usługi','All services'))+countrySelect(ctx,p.get('country'),t('Wszystkie kraje','All countries'))+field('region',t('Region / województwo','State / region'),p.get('region')||'')+field('city',t('Miasto','City'),cityLabel||p.get('city')||'')+field('brand',t('Obsługiwana marka','Supported make'),p.get('brand')||'')+selectField('rating',t('Ocena od','Minimum rating'),[1,2,3,4,5].map(x=>[x,'★ '+x]),p.get('rating'),t('Każda ocena','Any rating'))+selectField('radius',t('Odległość','Distance'),[5,10,25,50,100,200].map(x=>[x,x+' km']),p.get('radius'),t('Bez limitu','Any distance'))+check('mobile',t('Usługi mobilne','Mobile services'),['true','on','1'].includes(p.get('mobile')))+'</div>'+'<details class="svc-manual-origin"><summary>'+t('Wskaż punkt początkowy na mapie','Choose a starting point on the map')+'</summary><div class="svc-grid">'+field('lat',t('Szerokość geograficzna','Latitude'),p.get('lat')||'',{attributes:'inputmode="decimal"'})+field('lon',t('Długość geograficzna','Longitude'),p.get('lon')||'',{attributes:'inputmode="decimal"'})+'</div><div data-services-map="picker"></div></details>'+hidden('view',p.get('view')||'list')+'<div class="inline">'+button(t('Moja lokalizacja','Use my location'),false,'type="button" data-service-locate="search"')+button(t('Szukaj firm','Search businesses'),true)+'<a href="'+filterBase+'">'+t('Wyczyść filtry','Clear filters')+'</a></div><span data-service-location-status role="status"></span></form>';
 const publicLinks=await rows(ctx.db,"SELECT c.category,f.city_key,MIN(f.city) AS city FROM service_categories c JOIN service_firms f ON f.id=c.firm_id JOIN users u ON u.id=f.owner_id AND u.deleted_at IS NULL WHERE f.scope=? AND f.status='published' GROUP BY c.category,f.city_key ORDER BY f.city,c.category LIMIT 120",ctx.scope);
 const cards=r.items.map(firm=>businessCard(ctx,firm,category)).join('');
 const markers=r.items.map(i=>({lat:i.lat,lon:i.lon,name:i.name,url:companyPath(ctx,i.slug)}));
 const results=(p.get('view')==='map'?'<div data-services-map="results" data-service-markers="'+embed(markers)+'"></div>':'')+(r.total?(p.get('view')==='map'?'':'<div class="svc-cards">'+cards+'</div>'):empty(ctx,t('Brak firm dla tych kryteriów','No businesses match these filters'),t('Zmień filtry lub dodaj pierwszą firmę z tej okolicy.','Adjust the filters or add the first business in this area.'),'','search'));
 const hero='<header class="svc-hero"><div><h1>'+e(title)+'</h1><p>'+e(route.category?categoryDescription(route.category,ctx.lang):t('Znajdź warsztat, specjalistę lub pomoc drogową w swojej okolicy.','Find a repair shop, a specialist or roadside assistance near you.'))+'</p><div class="inline">'+link(ctx,'/moje-uslugi',t('Dodaj ogłoszenie swojej firmy','List your business'),'btn primary','plus')+'<a class="btn" href="#filtry-firm">'+e(t('Szukaj firm','Search businesses'))+'</a></div></div></header>';
 const locations=publicLinks.length?'<nav class="svc-chips">'+publicLinks.map(x=>link(ctx,'/uslugi/'+x.category+'/'+encodeURIComponent(x.city_key),categoryName(x.category,ctx.lang)+' · '+x.city,'btn')).join('')+'</nav>':'';
 const city=cityLabel||p.get('city')||'';
 const catMenu=categoryTiles(ctx,route,publicLinks,city);
 const filtered=Boolean(route.category||[...p.keys()].some(k=>k!=='lang'));
 const google=mapsSearch(category?categoryName(category,ctx.lang):t('Usługi motoryzacyjne','Automotive services'),city,p.get('region'),p.get('country')?countryName(p.get('country'),ctx.lang):'');
 const mapsLink='<a class="btn" href="'+e(google)+'" target="_blank" rel="noopener noreferrer">'+icon('pin',16)+' Google Maps</a>';
 return out(ctx,title,hero+(filtered?'':catMenu)+search+'<div id="wyniki-firm" class="page-head"><h2>'+t('Znalezione firmy','Businesses found')+' · '+r.total+'</h2><div class="svc-result-actions">'+switcher+mapsLink+'</div></div>'+results+'<nav class="inline">'+(r.page>1?'<a href="'+mk({page:r.page-1})+'">← '+t('Wstecz','Back')+'</a>':'')+(r.page<r.pages?'<a href="'+mk({page:r.page+1})+'">'+t('Dalej','Next')+' →</a>':'')+'</nav>'+locations+(filtered?catMenu:''),{index:!p.size||[...p.keys()].every(k=>k==='lang'),description:route.category?title+'. '+categoryDescription(route.category,ctx.lang):undefined});
}
const contacts=(ctx,f)=>{
 const d=f.details,t=ctx.t;if(!d.contactConsent)return '';
 const a=(url,label)=>'<a class="btn" href="'+e(url)+'" rel="nofollow noreferrer">'+e(label)+'</a>';
 return '<div class="inline">'+(d.phone?a('tel:'+d.phone.replace(/[ ()-]/g,''),t('Zadzwoń','Call')):'')+(d.email?a('mailto:'+d.email,t('Napisz','Write')):'')+(d.whatsapp?a('https://wa.me/'+d.whatsapp.replace(/\D/g,''),'WhatsApp'):'')+a('https://www.google.com/maps/dir/?api=1&destination='+f.lat+','+f.lon,t('Wyznacz trasę','Get directions'))+(d.website?a(d.website,t('Strona internetowa','Website')):'')+a('#oferta',t('Zobacz ofertę','View services'))+'</div>';
};
async function profile(ctx,f,preview=false){
 const t=ctx.t,d=f.details,reviews=await reviewList(ctx,f.id),stars=reviews.length?reviews.reduce((n,r)=>n+r.stars,0)/reviews.length:0;
 const cover=f.media.filter(x=>x.kind==='cover').at(-1),logo=f.media.filter(x=>x.kind==='logo').at(-1),pairs=new Map();
 for(const m of f.media.filter(x=>['before','after'].includes(x.kind))){if(!pairs.has(m.pair_key))pairs.set(m.pair_key,{});pairs.get(m.pair_key)[m.kind]=m;}
 const picture=m=>'<img loading="lazy" src="'+mediaPath(ctx,m.id)+'" alt="'+e(f.name)+'">';
 const media=f.media.filter(x=>['video','gallery'].includes(x.kind)).map(m=>m.kind==='video'?'<video controls preload="metadata" src="'+mediaPath(ctx,m.id)+'"></video>':picture(m)).join('');
 const desc=d.translations?.[ctx.lang]||d.description||'';
 const reviewForm=preview?'':ctx.user&&ctx.user.id!==f.owner_id?apiForm('/services/'+f.id+'/review',selectField('stars',t('Twoja ocena','Your rating'),[5,4,3,2,1].map(s=>[s,'★ '+s]),5)+area('content',t('Twoja opinia','Your review'),'',{required:true})+button(t('Wyślij do moderacji','Submit for review'),true),{success:t('Opinia trafiła do moderacji.','Your review was sent for moderation.')}):!ctx.user?'<a class="btn" href="'+e(loginPath(ctx,ctx.url.pathname))+'">'+t('Zaloguj się, aby dodać opinię','Sign in to write a review')+'</a>':'';
 const report=(review='')=>ctx.user&&!preview?'<details><summary>'+t('Zgłoś','Report')+'</summary>'+apiForm('/services/'+f.id+'/report',hidden('review',review)+area('reason',t('Powód zgłoszenia','Reason'),'',{required:true})+button(t('Wyślij','Send')))+'</details>':'';
 const publicURL=new URL(companyPath(ctx,f.slug),ctx.origin).href;
 const schema={'@context':'https://schema.org','@type':'AutomotiveBusiness','@id':publicURL,url:publicURL,name:f.name,description:desc,address:{'@type':'PostalAddress',addressLocality:f.city,addressRegion:f.region,addressCountry:f.country,streetAddress:f.address},geo:{'@type':'GeoCoordinates',latitude:f.lat,longitude:f.lon},...(cover?{image:new URL(mediaPath(ctx,cover.id),ctx.origin).href}:{}),...(logo?{logo:new URL(mediaPath(ctx,logo.id),ctx.origin).href}:{}),...(d.contactConsent&&d.phone?{telephone:d.phone}:{}),...(reviews.length?{aggregateRating:{'@type':'AggregateRating',ratingValue:+stars.toFixed(2),reviewCount:reviews.length}}:{})};
 return out(ctx,f.name,(preview?'<p>'+state(ctx,f.status)+'</p>':'')+'<section class="panel svc-profile">'+(cover?'<img class="svc-main-photo" src="'+mediaPath(ctx,cover.id)+'" alt="">':'')+(logo?'<img class="svc-logo" src="'+mediaPath(ctx,logo.id)+'" alt="">':'')+pageHead(f.name,[f.address,f.city,f.region,countryName(f.country,ctx.lang)].filter(Boolean).join(', '))+contacts(ctx,f)+'</section><section class="panel" id="oferta"><h2>'+t('Oferta firmy','Business services')+'</h2><p class="svc-lines">'+e(desc)+'</p><p>'+f.categories.map(x=>e(categoryName(x,ctx.lang))).join(' · ')+'</p>'+[['Cennik','Prices',d.prices],['Godziny otwarcia','Opening hours',d.hours],['Obsługiwane marki','Supported makes',d.brands?.join(', ')]].filter(x=>x[2]).map(([pl,en,v])=>'<h3>'+t(pl,en)+'</h3><p class="svc-lines">'+e(v)+'</p>').join('')+(f.mobile?'<p>'+t('Usługi mobilne','Mobile services')+'</p>':'')+'</section>'+(media?panel(t('Galeria realizacji','Work gallery'),'<div class="svc-gallery">'+media+'</div>'):'')+([...pairs.values()].some(p=>p.before&&p.after)?panel(t('Przed i po','Before and after'),[...pairs].filter(([,p])=>p.before&&p.after).map(([key,p])=>'<figure><figcaption>'+e(key)+'</figcaption><div class="svc-pair">'+[p.before,p.after].map((m,i)=>'<div>'+picture(m)+'<span>'+t(i?'Po':'Przed',i?'After':'Before')+'</span></div>').join('')+'</div></figure>').join('')):'')+
 panel(t('Opinie klientów','Customer reviews'),(stars?'<strong>★ '+stars.toFixed(1)+' / 5 · '+reviews.length+'</strong>':'')+reviews.map(r=>'<article><h3>'+e(r.name)+' · ★ '+r.stars+'</h3><p>'+e(r.content)+'</p>'+(r.reply?'<blockquote>'+e(r.reply)+'</blockquote>':'')+report(r.id)+(ctx.user?.id===f.owner_id?apiForm('/services/'+f.id+'/reply',hidden('review',r.id)+area('reply',t('Odpowiedź firmy','Business reply'))+button(t('Odpowiedz','Reply'))):'')+'</article>').join('')+reviewForm)+report(),{description:desc.slice(0,200),index:!preview,canonical:companyPath(ctx,f.slug),structured:preview?null:schema,...(cover?{image:mediaPath(ctx,cover.id)}:{})});
}
async function manager(ctx){
 const t=ctx.t,items=await myFirms(ctx),submitted=ctx.url.searchParams.has('submitted');
 const support=submitted?panel(t('Wizytówka trafiła do moderacji','Your profile was submitted'),'<p>'+t('Publikacja jest darmowa. Dobrowolne wsparcie platformy nie wpływa na kolejność wyników.','Publishing is free. Voluntary support does not affect search ranking.')+'</p>'+'<div class="inline">'+link(ctx,'/wsparcie?pakiet=pit-stop','10 zł')+link(ctx,'/wsparcie?pakiet=v8-club','100 zł')+link(ctx,'/wsparcie',t('Wszystkie pakiety','All packages'))+'</div>'):'';
 return out(ctx,t('Moje firmy','My businesses'),pageHead(t('Moje firmy','My businesses'),'',link(ctx,'/uslugi',t('Katalog usług','Service directory')))+support+panel(t('Dodaj firmę bezpłatnie','Add a business for free'),apiForm('/services/create',hidden('key',id())+field('name',t('Nazwa firmy','Business name'),'',{required:true})+button(t('Utwórz wizytówkę','Create business profile'),true)))+items.map(f=>panel(f.name,'<p>'+state(ctx,f.status)+' '+e(f.reason)+'</p><div class="inline">'+link(ctx,'/moje-uslugi/'+f.id,t('Edytuj','Edit'))+(f.status==='published'?link(ctx,'/uslugi/firma/'+encodeURIComponent(f.slug),t('Zobacz ofertę','View services')):'')+'</div>')).join(''));
}
async function editor(ctx,f){
 const t=ctx.t,d=f.details,endpoint='/services/'+f.id,action=ctx.prefix+'/api'+endpoint;
 const props=(n,pl,en,obj=f)=>field(n,t(pl,en),obj[n]??'');
 const catChecks=cats(ctx).map(([k,v])=>'<label><input type="checkbox" data-svc-category value="'+k+'" '+(f.categories.includes(k)?'checked':'')+'> '+e(v)+'</label>').join('');
 const form='<form data-svc-edit="'+e(action)+'/save" class="stack">'+hidden('revision',f.revision)+'<div class="svc-grid">'+props('name','Nazwa firmy','Business name')+countrySelect(ctx,f.country,'—')+props('region','Województwo / region','State / region')+props('city','Miasto','City')+props('address','Adres','Address')+check('mobile',t('Usługi mobilne','Mobile services'),f.mobile)+'</div><div class="svc-grid">'+props('lat','Szerokość geograficzna','Latitude')+props('lon','Długość geograficzna','Longitude')+'</div>'+button(t('Moja lokalizacja','Use my location'),false,'type="button" data-service-locate="picker"')+'<div data-services-map="picker"></div>'+selectField('language',t('Język opisu','Description language'),languageOptions,d.language||ctx.lang)+area('description',t('Opis działalności','Business description'),d.description||'')+
 '<div class="inline">'+button(t('Zaproponuj kategorie','Suggest categories'),false,'type="button" data-ai-action="categories"')+'<span data-ai-controls data-cloud="'+(+hasCloudAI(ctx.env))+'"></span></div><fieldset><legend>'+t('Kategorie usług','Service categories')+'</legend><div class="svc-checks">'+catChecks+'</div></fieldset>'+
 props('brands','Obsługiwane marki (po przecinku)','Supported makes (comma-separated)',{brands:d.brands?.join(', ')})+area('prices',t('Cennik z walutą','Prices with currencies'),d.prices||'')+area('hours',t('Godziny otwarcia','Opening hours'),d.hours||'')+'<div class="svc-grid">'+props('phone','Telefon','Phone',d)+props('whatsapp','WhatsApp (numer międzynarodowy)','WhatsApp (international number)',d)+props('email','E-mail','Email',d)+props('website','Strona internetowa','Website',d)+'</div>'+
 check('contactConsent',t('Zgadzam się na pokazanie podanych danych kontaktowych firmy.','I agree to display these business contact details.'),d.contactConsent)+'<details><summary>'+t('Tłumaczenia opisu','Description translations')+'</summary>'+languageOptions.map(([k,n])=>area('translation_'+k,n,d.translations?.[k]||'',{rows:2})).join('')+'</details><div class="inline">'+button(t('Zapisz szkic','Save draft'),false,'name="intent" value="draft"')+button(t('Opublikuj za darmo — 0 zł','Publish for free — PLN 0'),true,'name="intent" value="submit"')+'</div><p role="status"></p></form>';
 const kinds=[['logo','Logo'],['cover',t('Zdjęcie główne','Cover image')],['gallery',t('Zdjęcie galerii','Gallery image')],['video',t('Film','Video')],['before',t('Przed','Before')],['after',t('Po','After')]];
 const gallery=panel(t('Zdjęcia i filmy','Photos and videos'),'<form data-svc-upload="'+e(action)+'/media" class="stack">'+selectField('kind',t('Rodzaj materiału','Media type'),kinds,'gallery')+field('pair',t('Nazwa pary dla zdjęć przed i po','Pair name for before and after'))+'<input name="file" type="file" accept="image/jpeg,image/webp,image/png,video/mp4,video/webm" required multiple>'+button(t('Dodaj materiały','Upload media'))+'<p role="status"></p></form><div class="svc-gallery">'+f.media.map(m=>'<div>'+(m.kind==='video'?'<video controls src="'+mediaPath(ctx,m.id)+'"></video>':'<img loading="lazy" alt="" src="'+mediaPath(ctx,m.id)+'">')+'<span>'+e(kinds.find(k=>k[0]===m.kind)?.[1])+' '+e(m.pair_key)+'</span>'+apiForm(endpoint+'/delete-media',hidden('media',m.id)+hidden('revision',f.revision)+button(t('Usuń','Delete')),{confirm:t('Usunąć materiał?','Remove this file?')})+'</div>').join('')+'</div>');
 const promo={name:f.name,city:f.city,description:summarizeFacts(d.translations?.[ctx.lang]||d.description,2),url:f.status==='published'?new URL(companyPath(ctx,f.slug),ctx.origin).href:'',lang:ctx.lang,media:f.media.map(m=>({url:mediaPath(ctx,m.id),kind:m.kind==='video'?'video':'image'}))};
 return out(ctx,f.name,pageHead(f.name,state(ctx,f.status),link(ctx,'/moje-uslugi',t('Moje firmy','My businesses')))+panel(t('Profil firmy','Business profile'),form)+gallery+(f.media.length?panel('','<div data-services-promo="'+embed(promo)+'"></div>'):'')+apiForm(endpoint+'/delete',hidden('revision',f.revision)+button(t('Usuń wizytówkę','Delete business profile')),{confirm:t('Trwale usunąć wizytówkę i jej materiały?','Permanently delete this business and its media?')}));
}
async function moderation(ctx){
 requireStaff(ctx);const t=ctx.t;
 const firms=await rows(ctx.db,"SELECT id,name,reason FROM service_firms WHERE scope=? AND status='pending' ORDER BY updated_at",ctx.scope);
 const reviews=await rows(ctx.db,"SELECT r.*,f.name,f.slug FROM service_reviews r JOIN service_firms f ON f.id=r.firm_id WHERE f.scope=? AND f.status!='deleted' AND (r.state='pending' OR r.reply_state='pending')",ctx.scope);
 const reports=await rows(ctx.db,"SELECT r.*,f.name FROM service_reports r JOIN service_firms f ON f.id=r.firm_id WHERE r.scope=? AND r.state='pending'",ctx.scope);
 const decision=(type,key)=>apiForm('/services/moderate',hidden('type',type)+hidden('id',key)+field('reason',t('Uzasadnienie odrzucenia','Rejection reason'))+'<div class="inline">'+button(t('Zatwierdź','Approve'),true,'name="action" value="approve"')+button(t('Odrzuć','Reject'),false,'name="action" value="reject"')+'</div>',{reload:true});
 return out(ctx,t('Moderacja usług','Service moderation'),pageHead(t('Moderacja usług','Service moderation'))+firms.map(f=>panel(f.name,link(ctx,'/moderacja-uslug/'+f.id,t('Otwórz całą wizytówkę','Open full profile'))+'<p>'+e(f.reason)+'</p>'+decision('firm',f.id))).join('')+reviews.map(r=>panel(r.name,'<p>★ '+r.stars+' '+e(r.content)+'</p>'+(r.state==='pending'?decision('review',r.id):'')+(r.reply_state==='pending'?'<blockquote>'+e(r.reply)+'</blockquote>'+decision('reply',r.id):''))).join('')+reports.map(r=>panel(r.name,'<p>'+e(r.reason)+'</p>'+link(ctx,'/moderacja-uslug/'+r.firm_id,t('Otwórz profil','Open profile'))+decision(r.review_id?'review':'firm',r.review_id||r.firm_id)+apiForm('/services/moderate',hidden('type','report')+hidden('id',r.id)+hidden('action','approve')+button(t('Zamknij zgłoszenie','Close report')),{reload:true}))).join('')+(!firms.length&&!reviews.length&&!reports.length?empty(ctx,t('Brak zgłoszeń','No pending items')):''));
}
export async function servicePage(ctx){
 const bits=ctx.path.split('/').slice(1).map(k=>{try{return decodeURIComponent(k);}catch{missing();}}),[section,key,third,extra]=bits;
 if(section==='uslugi'){
  if(bits.length>3||extra)missing();if(key==='firma'&&third)return profile(ctx,await getFirm(ctx,third));
  if(key&&!categoryIds.has(key))missing();
  return directory(ctx,{category:key||'',city:third||''});
 }
 if(!ctx.user)return redirect(loginPath(ctx,ctx.url.pathname));
 if(third)missing();
 if(section==='moje-uslugi')return key?editor(ctx,await getFirm(ctx,key,'owner')):manager(ctx);
 requireStaff(ctx);return key?profile(ctx,await getFirm(ctx,key,'staff'),true):moderation(ctx);
}
