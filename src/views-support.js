import { requireAdmin } from './core.js';
import { owned } from './market.js';
import { hostedCheckout, paymentUrl, supportWebhookUrl, auditSupport, supportConfiguration, supportPackage, supportPackages, supportReturn } from './support.js';
import { apiForm, day, e, flash, hidden, keyInput, link, pageHead, panel, price, submit, wrap } from './ui.js';

const title=ctx=>ctx.t('Dobrowolnie wesprzyj reklamę i rozwój BRUMBRUM.VIN','Voluntarily support BRUMBRUM.VIN advertising and development');
const terms=ctx=>ctx.t('Publikacja ogłoszenia jest zawsze bezpłatna. Wpłata jest całkowicie dobrowolna i nie wpływa na widoczność ani pozycjonowanie ogłoszenia.',
  'Publishing a listing is always free. A contribution is entirely voluntary and does not affect your listing’s visibility or ranking.');
const oneTime=ctx=>ctx.t('Wpłata jednorazowa','One-time contribution');
const supportArt=id=>`<span class="support-art" data-support-art="${e(id)}" aria-hidden="true"></span>`;

export function supportChoices(ctx) {
  const t=ctx.t;
  const hosted=hostedCheckout(ctx);
  return `<section class="support-choice"><h3>${e(title(ctx))}</h3>
    <p>${e(terms(ctx))}</p><p>${t('Wybór pakietu najpierw przesyła ogłoszenie do publikacji. Wpłatę potwierdzisz osobno w Stripe.',
      'Choosing a package first submits your listing for publication. You confirm the contribution separately in Stripe.')}</p>
    <div class="support-grid">${supportPackages.map(item=>`<button type="submit" class="panel support-option" name="support" value="${item.id}"${hosted&&!ctx.demo&&(!hosted.enabled||!hosted.links.has(item.id))?' disabled':''}>
      ${supportArt(item.id)}<strong>${e(item.name)}</strong><span class="support-price">${e(price(ctx,item.amount/100,'PLN'))}</span>
      <small>${e(ctx.t(...item.description))}</small><span class="support-once">${oneTime(ctx)}</span><span class="support-choice-action">${e(t('Wybierz wsparcie','Choose support'))} · ${e(price(ctx,item.amount/100,'PLN'))}</span></button>`).join('')}</div>
  </section>`;
}

export function supportInvitation(ctx,listing='') {
  return panel(ctx.t('Dobrowolne wsparcie BRUMBRUM.VIN','Voluntary support for BRUMBRUM.VIN'),
    `<p>${e(terms(ctx))}</p><div class="inline">${link(ctx,'/wsparcie'+(listing?'?ogloszenie='+encodeURIComponent(listing):''),
      ctx.t('Zobacz cztery pakiety wsparcia','View the four support packages'),'btn','',{buttonFinish:true})}
    ${listing?link(ctx,'/moje-ogloszenia',ctx.t('Przejdź do moich ogłoszeń','Go to my listings'),'text-link'):''}</div>`,'listing-support');
}

export async function supportPage(ctx) {
  const t=ctx.t;
  const listing=ctx.url.searchParams.get('ogloszenie')||'';
  if (listing) await owned(ctx,listing);
  const selected=supportPackage(ctx.url.searchParams.get('pakiet'));
  const hosted=hostedCheckout(ctx);
  const ready=hosted?hosted.enabled && hosted.links.size>0:supportConfiguration(ctx).ready;
  const notice=ctx.demo?flash(t('Tryb demo. Pakiety są pokazane poglądowo.','Demo mode. Packages are shown for illustration.')):
    !ready?flash(t('Wpłaty są jeszcze niedostępne. Twoje ogłoszenie możesz opublikować bezpłatnie.',
      'Contributions are not available yet. You can publish your listing for free.'),'warn'):hosted?flash(t(
        'Stripe pokaże kwotę końcową i potwierdzenie wpłaty.','Stripe shows the final total and payment confirmation.')):'';
  const cancelled=ctx.url.searchParams.get('anulowano')==='1'?flash(t('Przerwano płatność. Możesz wrócić do ogłoszeń lub ponownie wybrać wsparcie.',
    'Payment was interrupted. You can return to your listings or choose a contribution again.')):'';
  const cards=supportPackages.map(item=>{
    const caption=t('Przejdź do Stripe','Continue to Stripe')+' · '+price(ctx,item.amount/100,'PLN');
    const target=hosted?.enabled && hosted.links.get(item.id);
    let form=`<button class="btn" type="button" disabled>${t('Wpłaty niedostępne','Contributions unavailable')}</button>`;
    if (target) form=`<a class="btn primary" referrerpolicy="no-referrer" href="${e(target)}">${e(caption)}</a>`;
    else if (!hosted && ready) form=apiForm('/support/start',keyInput()+hidden('listing',listing)+hidden('package',item.id)+submit(caption,'','btn primary'));
    return `<article data-package="${item.id}" class="panel support-package${selected?.id===item.id?' support-selected':''}">
      ${supportArt(item.id)}<h2>${e(item.name)}</h2><p class="support-price">${e(price(ctx,item.amount/100,'PLN'))}</p>
      <p>${e(t(...item.description))}</p><small>${oneTime(ctx)}</small>${form}</article>`;
  }).join('');
  return {title:title(ctx),body:wrap(pageHead(title(ctx))+`<section class="support-intro"><p>${e(terms(ctx))}</p>
    ${ctx.user?link(ctx,'/moje-ogloszenia',t('Przejdź do moich ogłoszeń','Go to my listings'),'btn primary'):''}</section>
    ${cancelled}${notice}<div class="support-grid">${cards}</div>`,'support-page')};
}

export async function supportReturnPage(ctx) {
  const t=ctx.t;
  const payment=await supportReturn(ctx);
  if (!payment && hostedCheckout(ctx) && !ctx.demo) {
    const heading=t('Status wpłaty w Stripe','Payment status in Stripe');
    return {title:heading,body:wrap(panel(heading,`<p>${t('Potwierdzenie wpłaty znajdziesz w Stripe.','You can find your payment confirmation in Stripe.')}</p>
      ${link(ctx,'/moje-ogloszenia',t('Przejdź do moich ogłoszeń','Go to my listings'),'btn primary')}`),'support-page')};
  }
  const paid=payment?.status==='paid';
  const failed=['failed','expired'].includes(payment?.status);
  const heading=paid?t('Dziękujemy za wsparcie','Thank you for your support'):
    failed?t('Płatność nie została potwierdzona','Payment was not confirmed'):t('Sprawdzamy potwierdzenie płatności','Waiting for payment confirmation');
  const message=paid?t('Stripe potwierdził jednorazową wpłatę. Dziękujemy za wsparcie BRUMBRUM.VIN.',
    'Stripe confirmed your one-time contribution. Thank you for supporting BRUMBRUM.VIN.'):
    failed?t('Możesz ponownie wybrać pakiet wsparcia. Publikacja pozostaje bezpłatna.',
      'You can choose a support package again. Publication remains free.'):
    t('Potwierdzenie może pojawić się po chwili. Odśwież tę stronę, aby sprawdzić status.',
      'Confirmation may take a moment. Refresh this page to check the status.');
  return {title:heading,body:wrap(panel(heading,`<p role="status">${e(message)}</p>
    ${paid?`<p class="support-price">${e(price(ctx,payment.amount/100,'PLN'))}</p>`:''}
    <p>${e(terms(ctx))}</p><div class="inline">
    ${link(ctx,'/moje-ogloszenia',t('Przejdź do moich ogłoszeń','Go to my listings'),'btn primary')}
    ${!paid?link(ctx,ctx.url.pathname+ctx.url.search,t('Odśwież status','Refresh status'),'btn'):''}
    ${link(ctx,'/wsparcie',t('Pakiety wsparcia','Support packages'),'text-link')}</div>`),'support-page')};
}

export async function supportAdminPanel(ctx) {
  requireAdmin(ctx);
  const t=ctx.t;
  const hosted=hostedCheckout(ctx);
  if (hosted) {
    const rows=supportPackages.map(item=>{
      const url=hosted.links.get(item.id);
      return `<article class="support-option"><strong>${e(item.name)}</strong><p>${e(price(ctx,item.amount/100,'PLN'))}</p>
        ${url?`<code class="support-code">${e(url)}</code>`:e(t('Brak linku','Missing link'))}</article>`;
    }).join('');
    return panel(t('Jednorazowe wsparcie Stripe','One-time Stripe support'),`<p>Stripe Payment Links · ${hosted.enabled?hosted.links.size:0}/${supportPackages.length}</p>
      <p>${t('Płatności i ich statusy znajdziesz w panelu Stripe.','Payments and their statuses are available in the Stripe Dashboard.')}</p>
      <div class="support-grid">${rows}</div>`);
  }
  let audit=supportConfiguration(ctx),failure='';
  if (audit.configured) {
    try {audit=await auditSupport(ctx);}
    catch (error) {audit={...audit,ready:false};failure=t(error.pl||'Nie udało się sprawdzić Stripe.',error.en||'Stripe could not be verified.');}
  }
  const missing=audit.missing.length?`<ul>${audit.missing.map(name=>`<li><code>${e(name)}</code></li>`).join('')}</ul>`:'';
  return panel(t('Jednorazowe wsparcie Stripe','One-time Stripe support'),
    `<p>${e(terms(ctx))}</p><p>${t('Stan','Status')} · <strong>${audit.ready?t('Zweryfikowane','Verified'):audit.verified?t('Zweryfikowane · wpłaty wyłączone','Verified · contributions disabled'):t('Wymaga konfiguracji','Configuration required')}</strong></p>
    ${failure?flash(failure,'warn'):''}${missing}<p>${t('Adres powrotu po płatności','Payment return URL')}</p>
    <code class="support-code">${e(audit.returnUrl)}</code><p>${t('Adres webhooka','Webhook URL')}</p>
    <code class="support-code">${e(supportWebhookUrl(ctx))}</code>
    <div class="support-grid">${supportPackages.map(item=>`<article class="support-option"><strong>${e(item.name)}</strong>
      <p>${e(price(ctx,item.amount/100,'PLN'))} · ${oneTime(ctx)}</p>${paymentUrl(ctx,item)?`<code class="support-code">${e(paymentUrl(ctx,item))}</code>`:''}</article>`).join('')}</div>
    ${audit.taxReviewedAt?`<p>Stripe Tax · ${e(audit.taxStatus)} · ${e(day(ctx,audit.taxReviewedAt))}${[audit.country,audit.businessType,audit.legalStructure,audit.taxCountry].filter(Boolean).map(v=>' · '+e(v)).join('')}</p>`:''}
    <p>${t('Klucze Stripe i sekret webhooka skonfiguruj wyłącznie w sekretach serwera. Zatwierdź ustawienia podatkowe przed włączeniem wpłat.',
      'Configure Stripe keys and the webhook secret only in server secrets. Review the tax configuration before enabling contributions.')}</p>`);
}
