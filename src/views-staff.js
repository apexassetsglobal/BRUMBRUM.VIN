import { brandLogoAsset, brandLogoIds, originalBrandLogo } from './brand-logos.js';
import { youtubeModeration } from './youtube-promotions.js';
import { options } from './data.js';
import { mailReady } from './accounts.js';
import { autoReviewReasons } from './listing-review.js';
import { apiForm, area, check, choice, day, e, empty, field, flash, hidden, href, icon, link, localized, logo, pageHead, panel, price, sectionHead, submit, tag, titleOf, wrap } from './ui.js';
import { assetForm } from './views-account.js';
import { supportAdminPanel } from './views-support.js';

function auditLog(ctx,items,kind) {
  const t=ctx.t;
  const actions={bootstrap_admin:['Aktywacja właściciela','Owner activation'],settings:['Ustawienia','Settings'],dictionary:['Słownik','Dictionary'],
    banner:['Baner','Banner'],feature:['Wyróżnienie','Feature'],contact_handled:['Zgłoszenie kontaktowe','Contact enquiry'],report_resolved:['Rozpatrzenie zgłoszenia','Report resolution'],
    submit:['Przekazano do moderacji','Submitted for review'],csv_submit:['Import CSV','CSV import'],moderator_published:['Zatwierdzono','Approved'],
    auto_published:['Opublikowano automatycznie','Published automatically'],auto_review:['Skierowano do moderatora','Sent to a moderator'],
    moderator_rejected:['Odrzucono','Rejected'],moderator_held:['Ukryto','Hidden'],held:['Wstrzymano','Paused'],sold:['Sprzedane','Sold'],archived:['Zarchiwizowano','Archived']};
  return items.length?`<div class="table-scroll" tabindex="0"><table><thead><tr><th>${t('Data','Time')}</th><th>${t('Osoba','Actor')}</th><th>${t('Decyzja','Action')}</th><th>${t('Powód','Reason')}</th></tr></thead><tbody>
    ${items.map(x=>`<tr><td>${e(day(ctx,x.created_at,true))}</td><td>${e(['auto_published','auto_review'].includes(x.action)?t('Automat','System'):x.name)}</td><td>${e(actions[x.action]?t(...actions[x.action]):x.action)}
      ${kind==='moderation'&&x.listing_id?`<a href="${href(ctx,'/moderacja/'+e(x.listing_id))}">${e([x.make,x.model].filter(Boolean).join(' '))}</a>`:''}
      ${kind==='audit'?`<small>${e(x.target)}</small>`:''}</td><td>${e(x.action==='auto_review'&&Object.hasOwn(autoReviewReasons,x.reason)?t(...autoReviewReasons[x.reason]):x.reason||'—')}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted">${t('Brak zapisanych decyzji.','No recorded decisions.')}</p>`;
}

export async function moderationPage(ctx,data) {
  const t=ctx.t;
  const section=ctx.url.searchParams.get('sekcja')||'queue';
  const nav=`<div class="status-tabs">${link(ctx,'/moderacja-uslug',t('Moderacja usług','Service moderation'),'chip')}${[['queue',t('Kolejka','Queue')+' · '+data.offers.length],['reports',t('Zgłoszenia','Reports')+' · '+data.reports.filter(x=>x.state==='open').length],['history',t('Historia decyzji','Decision history')],['youtube',t('Filmy YouTube','YouTube videos')]].map(([key,label])=>link(ctx,'/moderacja?sekcja='+key,label,key===section?'chip active-chip':'chip')).join('')}</div>`;
  const offers=data.offers.map(offer=>`<article class="panel listing-row"><div class="row-head"><div class="row-main">
    ${offer.cover?`<img src="${e(offer.cover)}" alt="" width="102" height="65">`:''}<div><h2>${e(titleOf(offer))}</h2><p>${e(offer.variant)} · ${e(price(ctx,offer.price,offer.currency))}</p>
    ${Object.hasOwn(autoReviewReasons,offer.reviewReason)?`<p class="muted">${t(...autoReviewReasons[offer.reviewReason])}</p>`:''}</div></div>
    ${link(ctx,'/moderacja/'+offer.id,t('Otwórz całą ofertę','Open full listing'),'btn primary','arrow')}</div></article>`).join('');
  const reports=data.reports.map(x=>panel(e(x.kind==='illegal'?t('Nielegalna treść','Illegal content'):x.kind==='appeal'?t('Odwołanie','Appeal'):x.kind==='message'?t('Nadużycie w rozmowie','Conversation abuse'):t('Naruszenie zasad','Rules violation')),
    `<p class="muted">${e(day(ctx,x.created_at,true))} · ${e(x.email||'—')} · ${x.state==='open'?t('Otwarte','Open'):t('Rozpatrzone','Resolved')}</p>
    <p class="prose">${e(x.reason)}</p>${x.listing_id?link(ctx,'/moderacja/'+x.listing_id,t('Otwórz powiązaną ofertę','Open related listing'),'text-link','arrow'):''}
    ${x.state==='open'?apiForm('/moderation/reports/'+x.id,area('reason',t('Rozstrzygnięcie','Resolution'),'',{required:true,attributes:'minlength="5" maxlength="2000"'})+submit(t('Zapisz decyzję','Save decision'),'check'),{reload:true}):`<p>${e(x.resolution)}</p>`}`)).join('');
  const content=section==='youtube'?await youtubeModeration(ctx):section==='reports'?reports||empty(ctx,t('Brak zgłoszeń','No reports')):section==='history'?panel(t('Historia decyzji','Decision history'),auditLog(ctx,data.history,'moderation')):
    offers||empty(ctx,t('Kolejka jest pusta','The queue is empty'),t('Nowe oferty pojawią się po przesłaniu do moderacji.','New listings appear here after submission.'),'','shield');
  return {title:t('Panel moderacji','Moderation'),body:wrap(pageHead(t('Panel moderacji','Moderation'),'',link(ctx,'/konto',t('Konto','Account'),'btn','back'))+nav+`<div class="listing-stack">${content}</div>`)};
}
export function moderationActions(ctx,offer,history) {
  const t=ctx.t;
  const revision=hidden('revision',offer.revision);
  const form=(action,label,reason=false)=>apiForm('/moderation/'+offer.id,revision+hidden('action',action)+
    (reason?area('reason',t('Uzasadnienie dla sprzedawcy','Reason for the seller'),'',{required:true,attributes:'minlength="5" maxlength="1600"'}):'')+
    submit(label,action==='published'?'check':'close',action==='published'?'btn primary':'btn danger'));
  const actions=offer.user_id===ctx.user.id?flash(t('Decyzję musi podjąć inny moderator.','A different moderator must make the decision.'),'warn'):
    offer.status==='pending'?form('published',t('Zatwierdź ofertę','Approve listing'))+form('rejected',t('Odrzuć ofertę','Reject listing'),true):
    offer.status==='published'?form('held',t('Ukryj ofertę','Hide listing'),true):'';
  return panel(t('Decyzja moderatora','Moderation decision'),tag(ctx,offer.status)+actions)+panel(t('Historia oferty','Listing history'),auditLog(ctx,history,'offer'));
}
const reasonField=ctx=>field('reason',ctx.t('Powód zmiany','Reason for the change'),'',{required:true,attributes:'minlength="3" maxlength="1200"'});
const localDate=value=>value?String(value).slice(0,16):'';
function bannerForm(ctx,b) {
  const t=ctx.t;
  return apiForm('/admin/banners'+(b.id?'/'+b.id:''),`<div class="field-grid">
    ${field('advertiser',t('Nazwa firmy','Advertiser name'),b.advertiser,{attributes:'maxlength="80"'})}
    ${field('title_pl',t('Tekst PL','Text PL'),b.title_pl,{required:true,attributes:'maxlength="160"'})}
    ${field('title_en',t('Tekst EN','Text EN'),b.title_en,{required:true,attributes:'maxlength="160"'})}
    ${field('label_pl',t('Przycisk PL','Button PL'),b.label_pl,{attributes:'maxlength="60"'})}
    ${field('label_en',t('Przycisk EN','Button EN'),b.label_en,{attributes:'maxlength="60"'})}
    ${field('link',t('Adres linku','Link address'),b.link,{required:true,attributes:'maxlength="700"'})}
    ${field('position',t('Kolejność','Display order'),b.position??0,{type:'number',attributes:'min="0" max="10000"'})}
    ${field('starts_at',t('Początek emisji','Starts at'),localDate(b.starts_at),{type:'datetime-local',attributes:'data-utc-field'})}
    ${field('ends_at',t('Koniec emisji','Ends at'),localDate(b.ends_at),{type:'datetime-local',attributes:'data-utc-field'})}</div>
    <p class="muted">${t('Daty wpisz w UTC.','Enter dates in UTC.')}</p>
    ${check('active',t('Aktywny','Active'),b.active??true)}${reasonField(ctx)}${submit(t('Zapisz baner','Save banner'),'check')}`,{reload:true});
}
function brandLogoSettings(ctx) {
  const t=ctx.t;
  const choices={[originalBrandLogo]:t('Oryginalne logo','Original logo'),
    ...Object.fromEntries(brandLogoIds.map(id=>[id,t('Wariant','Variant')+' '+id]))};
  const form=apiForm('/admin/settings',`<div class="field-grid">
    ${choice(ctx,'home_logo',t('Logo w nagłówku całej strony','Site-wide header logo'),choices,ctx.brand.home_logo,{placeholder:false})}
    ${choice(ctx,'launch_logo',t('Logo na ekranie startowym','Launch screen logo'),choices,ctx.brand.launch_logo,{placeholder:false})}
    </div>${reasonField(ctx)}${submit(t('Zapisz wybór logo','Save logo choices'),'check')}`,{reload:true});
  const gallery=`<div class="field-grid" style="margin-top:16px">
    <figure class="panel" style="margin:0">${logo(ctx)}<figcaption>${e(choices[originalBrandLogo])}</figcaption></figure>
    ${brandLogoIds.map(id=>`<figure class="panel" style="margin:0"><img src="${brandLogoAsset(id)}" width="510" height="170" loading="lazy" style="width:100%;height:auto" alt=""><figcaption>${e(choices[id])}</figcaption></figure>`).join('')}
    </div>`;
  return form+gallery;
}

export async function adminPage(ctx,data) {
  const t=ctx.t;
  const tab=ctx.url.searchParams.get('sekcja')||'settings';
  const tabs=[['settings',t('Marka i integracje','Brand and integrations')],['users',t('Użytkownicy','Users')],['dictionary',t('Słowniki','Dictionaries')],
    ['banners',t('Banery','Banners')],['features',t('Wyróżnienia','Featured listings')],['content',t('Treści','Content')],
    ['contacts',t('Kontakt i reklama','Contact and advertising')],['support',t('Wsparcie Stripe','Stripe support')],['audit',t('Audyt','Audit log')]];
  const nav=`<div class="status-tabs">${link(ctx,'/administracja/import',t('Import i automatyczna publikacja','Import and automatic publication'),'chip')}${link(ctx,'/moderacja-uslug',t('Moderacja usług','Service moderation'),'chip')}${tabs.map(([k,l])=>link(ctx,'/administracja?sekcja='+k,l,k===tab?'chip active-chip':'chip')).join('')}</div>`;
  let body;
  if (tab==='users') body=panel(t('Użytkownicy i role','Users and roles'),`<div class="stack">${data.users.map(u=>`<details><summary>${e(u.name)} · ${e(u.email)} · ${e(localized(ctx,'role',u.role))}</summary>
    <p>${u.verified_at?t('E-mail potwierdzony','Email confirmed'):t('E-mail oczekuje na potwierdzenie','Email pending confirmation')}</p>${u.id!==ctx.user.id?apiForm('/admin/roles/'+u.id,
      choice(ctx,'role',t('Rola','Role'),options.role,u.role,{placeholder:false})+reasonField(ctx)+submit(t('Zapisz rolę','Save role'),'check'),{reload:true}):''}</details>`).join('')}</div>`);
  else if (tab==='dictionary') body=panel(t('Kategorie, marki i modele','Categories, makes and models'),apiForm('/admin/dictionary',`<div class="field-grid">
    ${choice(ctx,'kind',t('Słownik','Dictionary'),{type:t('Kategoria','Category'),make:t('Marka','Make'),model:t('Model','Model')},'type',{placeholder:false})}
    ${field('value',t('Kod kategorii lub nazwa','Category code or name'),'',{required:true,attributes:'maxlength="60"'})}
    ${field('parent',t('Marka modelu','Model’s make'),'',{attributes:'maxlength="50"'})}
    ${field('label_pl',t('Etykieta PL','Label PL'),'',{attributes:'maxlength="80"'})}
    ${field('label_en',t('Etykieta EN','Label EN'),'',{attributes:'maxlength="80"'})}</div>
    ${check('active',t('Aktywna pozycja','Active entry'),true)}${reasonField(ctx)}${submit(t('Zapisz pozycję','Save entry'),'check')}`,{reload:true})+
    `<div class="stack">${data.dictionary.map(d=>`<p>${e(d.kind+' · '+[d.parent,d.value].filter(Boolean).join(' / '))} · ${d.active?t('Aktywna','Active'):t('Wyłączona','Disabled')}</p>`).join('')}</div>`);
  else if (tab==='banners') body=panel(t('Nowy baner','New banner'),bannerForm(ctx,{}))+
    data.banners.map(b=>panel(b.title_pl,bannerForm(ctx,b)+(b.image_key?`<img class="admin-preview" src="${href(ctx,'/asset/banner/'+e(b.image_key))}" alt="">`:'')+assetForm(ctx,'banner/'+b.id))).join('');
  else if (tab==='features') body=panel(t('Wyróżnienia ofert','Featured listings'),data.featured.length?data.featured.map(o=>`<details><summary>${e(o.make+' '+o.model)}</summary>
    ${apiForm('/admin/features/'+o.id,field('featured_until',t('Wyróżnione do (UTC)','Featured until (UTC)'),localDate(o.featured_until),{type:'datetime-local',attributes:'data-utc-field'})+
    reasonField(ctx)+submit(t('Zapisz wyróżnienie','Save feature'),'check'),{reload:true})}</details>`).join(''):`<p>${t('Brak opublikowanych ofert.','No published listings.')}</p>`);
  else if (tab==='content') body=panel(t('Treści informacyjne','Informational content'),apiForm('/admin/settings',
    [['help',t('Pomoc','Help')],['terms',t('Regulamin','Terms')],['privacy',t('Prywatność','Privacy')],['dealers',t('Dla dealerów','For dealers')],['ads',t('Reklama','Advertising')]].map(([key,title])=>`<details><summary>${e(title)}</summary><div class="field-grid">
      ${area(key+'_pl',title+' · PL',ctx.brand[key+'_pl'],{attributes:'maxlength="15000"'})}${area(key+'_en',title+' · EN',ctx.brand[key+'_en'],{attributes:'maxlength="15000"'})}</div></details>`).join('')+
      reasonField(ctx)+submit(t('Zapisz treści','Save content'),'check'),{reload:true}));
  else if (tab==='contacts') body=panel(t('Zapytania kontaktowe i reklamowe','Contact and advertising enquiries'),data.contacts.length?data.contacts.map(c=>`<details>
    <summary>${c.kind==='ad'?t('Reklama','Advertising'):t('Kontakt','Contact')} · ${e(c.name)} · ${e(day(ctx,c.created_at,true))} · ${c.handled_at?t('Obsłużone','Handled'):t('Nowe','New')}</summary>
    <p>${e(c.email)}</p><p class="prose">${e(c.body)}</p>${!c.handled_at?apiForm('/admin/contacts/'+c.id,reasonField(ctx)+submit(t('Oznacz jako obsłużone','Mark as handled'),'check'),{reload:true}):''}</details>`).join(''):
    `<p class="muted">${t('Brak zapytań.','No enquiries.')}</p>`);
  else if (tab==='support') body=await supportAdminPanel(ctx);
  else if (tab==='audit') body=panel(t('Historia działań administratorów','Administrator audit log'),auditLog(ctx,data.audit,'audit'));
  else body=panel(t('Marka i dane operatora','Brand and operator details'),apiForm('/admin/settings',`<div class="field-grid">
    ${field('name',t('Nazwa marki','Brand name'),ctx.brand.name,{required:true,attributes:'maxlength="120"'})}
    ${field('accent',t('Kolor akcentu','Accent color'),ctx.brand.accent,{type:'color',required:true})}
    ${field('operator_name',t('Nazwa operatora','Operator name'),ctx.brand.operator_name,{attributes:'maxlength="120"'})}
    ${field('operator_email',t('E-mail operatora','Operator email'),ctx.brand.operator_email,{type:'email'})}
    ${field('operator_address',t('Adres operatora','Operator address'),ctx.brand.operator_address,{attributes:'maxlength="300"'})}
    ${field('operator_tax_id',t('NIP i REGON','Tax and statistical identifiers'),ctx.brand.operator_tax_id,{attributes:'maxlength="120"'})}
    ${field('operator_registry',t('KRS i sąd rejestrowy lub CEIDG','Company register and registration court'),ctx.brand.operator_registry,{attributes:'maxlength="120"'})}
    ${field('operator_dsa_email',t('E-mail do zgłoszeń DSA','DSA reporting email'),ctx.brand.operator_dsa_email,{type:'email'})}</div>
    ${reasonField(ctx)}${submit(t('Zapisz ustawienia','Save settings'),'check')}`,{reload:true}))+panel(t('Logo','Logo'),brandLogoSettings(ctx)+assetForm(ctx,'logo'))+
    panel(t('Stan integracji','Integration status'),`<ul class="list-clean"><li>${t('Poczta kont','Account email')} · ${mailReady(ctx)?ctx.env.localMail?t('Skrzynka testowa','Local test mailbox'):t('Skonfigurowana','Configured'):t('Brak konfiguracji','Not configured')}</li>
    <li>${t('Import zdjęć HTTPS','HTTPS photo import')} · ${ctx.env.IMPORT_IMAGE_ORIGINS?t('Skonfigurowany','Configured'):t('Brak domen zewnętrznych','No external domains configured')}</li>
    <li>${link(ctx,'/administracja?sekcja=support',t('Wsparcie Stripe','Stripe support'),'text-link')}</li>
    <li>${t('Google, SMS, mapy i feedy','Google, SMS, maps and feeds')} · ${t('Wyłączone','Disabled')}</li></ul>`);
  return {title:t('Administracja','Administration'),body:wrap(pageHead(t('Panel administratora','Administration'),'',link(ctx,'/konto',t('Konto','Account'),'btn','back'))+nav+`<div class="settings-stack">${body}</div>`)};
}
