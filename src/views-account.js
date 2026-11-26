import { manageReels } from './views-reels.js';
import { cleanReturn, emailOf, id, isStaff, row, truth, withAuthReturn } from './core.js';
import { mailReady } from './accounts.js';
import { catalogFor, features, options, regions } from './data.js';
import { bodyFeatureOverrides, vehicleBodyChoices, vehicleProfile } from './vehicle-types.js';
import { csvFields, robotCsvFields } from './dealer.js';
import { photoDetailLabels, spinLimits } from './market.js';
import { videoLimit } from './videos.js';
import { apiForm, appearanceControls, area, buttonEmbroideryLabel, check, choice, day, e, embed, empty, field, flash, formStatus, hidden, href, icon, keyInput, km, lang, link, localized, pageHead, panel, pillCount, price, sectionHead, submit, tag, titleOf, wrap } from './ui.js';
import { reportDialog } from './views-market.js';
import { languages } from './i18n.js';
import { supportChoices, supportInvitation } from './views-support.js';

const stringOptions=values=>Object.fromEntries(values.map(x=>[x,x]));
const cardTitle = (ctx,offer) => titleOf(offer)||ctx.t('Nienazwany szkic','Untitled draft');
const ownerEmail = ctx => emailOf(ctx.env.OWNER_EMAIL);
const canClaim = ctx => !ctx.demo && !!ctx.user?.email && ctx.user.email===ownerEmail(ctx) && ctx.user.role!=='admin' && (ctx.env.OWNER_SETUP_TOKEN||'').length>=32;

function menuRow(symbol,title,description='',badge='') {
  return `<span class="account-menu-icon">${icon(symbol,24)}</span>
    <span class="account-menu-copy"><strong>${e(title)}</strong>${description?`<small>${e(description)}</small>`:''}</span>
    <span class="account-menu-end">${badge}${icon('chevron',18)}</span>`;
}

function menuLink(ctx,path,symbol,title,description='',count=0) {
  return `<a class="account-menu-row" href="${e(href(ctx,path))}">${menuRow(symbol,title,description,pillCount(count))}</a>`;
}

function menuGroup(title,content,{id='',nested=false}={}) {
  const heading=nested?'h3':'h2';
  return `<section class="account-menu-group"${id?` id="${id}"`:''}><${heading}>${e(title)}</${heading}>
    <div class="account-menu-box">${content}</div></section>`;
}

function menuDisclosure(id,symbol,title,description,content,{feedback=false}={}) {
  return `<details class="account-menu-detail" id="${id}" data-settings-panel>
    <summary class="account-menu-row">${menuRow(symbol,title,description)}</summary>
    <div class="account-menu-panel"${feedback?' data-form-feedback':''}>${content}</div></details>`;
}

function menuPage(title,symbol,body,{description='',action='',pageTitle=title}={}) {
  return {title:pageTitle,body:`<div class="wrap page account-menu-page">
    <header class="account-menu-heading"><span class="account-menu-icon">${icon(symbol,27)}</span>
      <div><h1>${e(title)}</h1>${description?`<p>${e(description)}</p>`:''}</div>${action}</header>
    ${body}</div>`};
}

function accountIdentity(ctx,path,label) {
  const {t,user}=ctx;
  const initials=user.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
  const demoRole=ctx.demo?demoAccountRoles(ctx).find(([value])=>user.email===value+'@demo.invalid'):null;
  const profile=demoRole?.[2]||(ctx.demo?t('Konto demonstracyjne','Demo account'):localized(ctx,'seller',user.profile_type));
  const purpose=demoRole?.[3]||(user.role==='admin'
    ?t('Ustawienia serwisu, role i audyt.','Site settings, roles and audit log.')
    :isStaff(user)?t('Sprawdzanie ogłoszeń i zgłoszeń.','Review listings and reports.'):user.profile_type==='company'
      ?t('Dla komisów i dealerów zarządzających ofertami.','For dealerships managing vehicle listings.')
      :t('Dla osób szukających lub sprzedających pojazd.','For people looking for or selling a vehicle.'));
  const role=!ctx.demo&&isStaff(user)?(user.role==='admin'?t('Administrator','Administrator'):t('Moderator','Moderator')):profile;
  const company=user.profile_type==='company';
  const logo=company&&user.logo_key;
  const avatar=logo||user.avatar_key;
  const panorama=company&&user.panorama_key?profileImage(ctx,'panorama',user.panorama_key,'account-panorama'):'';
  return `<div class="account-identity">${panorama}<span class="account-avatar${logo?' company-avatar':''}" aria-hidden="true">${avatar?profileImage(ctx,logo?'company':'avatar',avatar):e(initials)}</span>
    <div><strong>${e(user.name)}</strong><div class="account-identity-role"><span>${e(role)}</span>${ctx.demo&&demoRole?'<span>Demo</span>':''}</div><small>${e(purpose)}</small>${link(ctx,path,label,'btn account-identity-action','chevron')}</div></div>`;
}

function demoAccountRoles({t}) {
  return [
    ['seller','car',t('Sprzedawca','Seller'),t('Dla osób, które chcą wystawić pojazd i zarządzać swoimi ogłoszeniami.','For people who want to list a vehicle and manage their listings.')],
    ['buyer','search',t('Kupujący','Buyer'),t('Dla osób szukających pojazdu, porównujących oferty i kontaktujących się ze sprzedawcami.','For people searching for vehicles, comparing listings and contacting sellers.')],
    ['dealer','building',t('Dealer','Dealer'),t('Dla komisów i dealerów, którzy prowadzą wizytówkę firmy i importują oferty z CSV.','For dealerships with a business profile and CSV listing imports.')],
    ['moderator','shield',t('Moderator','Moderator'),t('Dla osób sprawdzających ogłoszenia i rozpatrujących zgłoszenia.','For staff reviewing listings and reports.')],
    ['admin','settings',t('Administrator','Administrator'),t('Dla osób zarządzających ustawieniami, rolami i audytem serwisu.','For staff managing site settings, roles and the audit log.')]
  ];
}

function demoRoleOptions(ctx,next) {
  const t=ctx.t;
  const roleOption=([value,symbol,title,description])=>{
    const current=ctx.user?.email===value+'@demo.invalid';
    const badge=current?`<span class="account-menu-current">${t('Aktywna','Active')}</span>`:'';
    return apiForm('/access',hidden('actor',value)+hidden('next',next)+
      `<button type="submit" class="account-menu-row"${current?' aria-current="true"':''} aria-label="${e(t('Wybierz rolę','Select role')+' · '+title)}">${menuRow(symbol,title,description,badge)}</button>`,
      {className:'account-menu-form'});
  };
  return demoAccountRoles(ctx).map(roleOption);
}

export function authPage(ctx,kind) {
  const t=ctx.t;
  const returnTo=cleanReturn(ctx.url.searchParams.get('dalej'),'');
  const next=returnTo||href(ctx,'/konto');
  if (ctx.demo) {
    const roles=demoRoleOptions(ctx,next);
    return menuPage(t('Wybierz rolę w demo','Choose a demo role'),'test',
      `<div class="account-menu-columns demo-roles">
        <div>${menuGroup(t('Kupno i sprzedaż','Buying and selling'),roles.slice(0,3).join(''))}</div>
        <div>${menuGroup(t('Obsługa serwisu','Site management'),roles.slice(3).join(''))}</div>
      </div>`,{description:t('Zmiana roli zachowuje ogłoszenia i rozmowy w tej sesji demonstracyjnej.','Switching roles keeps listings and messages in this demo workspace.')});
  }
  const email=field('email',t('Adres e-mail','Email address'),'',{type:'email',required:true,attributes:'autocomplete="email" maxlength="254"'});
  const password=(type='current-password')=>field('password',t('Hasło','Password'),'',{type:'password',required:true,attributes:'autocomplete="'+type+'" maxlength="128"'+(type==='new-password'?' minlength="12"':'')});
  const emailAvailable=mailReady(ctx);
  const noMail=emailAvailable?'':flash(t('Poczta kont jest wyłączona w tym podglądzie. Procesy sprzedaży sprawdzisz w demo.','Account email is disabled in this preview. Use the demo to try the sales workflows.'),'warn');
  const demoLink=`<a class="text-link" href="/demo/zaloguj">${icon('test',17)} ${t('Przejdź do demo','Open demo')}</a>`;
  const authLink=(path,label,style='text-link',symbol='')=>link(ctx,withAuthReturn(path,returnTo),label,style,symbol);
  const returnField=returnTo?hidden('next',returnTo):'';
  const createWithChatGPT=kind==='register'&&!emailAvailable;
  const providerLabel=createWithChatGPT?t('Załóż konto przez ChatGPT','Create an account with ChatGPT'):t('Zaloguj się przez ChatGPT','Sign in with ChatGPT');
  const chatGPT=ctx.env.SITES_CHATGPT_SIGNIN==='1'
    ? `<a class="btn ${createWithChatGPT?'primary ':''}auth-provider" href="${e(withAuthReturn('/logowanie-chatgpt',next))}" target="_top">${icon('user')}${providerLabel}</a>`
    : '';
  const providers=chatGPT?`<div class="auth-providers"><span class="auth-divider">${t('lub','or')}</span>${chatGPT}</div>`:'';
  let title, body;
  switch (kind) {
    case 'register':
      title=t('Załóż konto','Create an account');
      if (!emailAvailable) {
        body=chatGPT?`<div class="stack"><p>${t('Użyj konta ChatGPT, aby utworzyć profil w {brand}.','Use your ChatGPT account to create a profile on {brand}.',{brand:ctx.brand.name})}</p>${chatGPT}</div>`:noMail;
      } else {
        body=apiForm('/auth/register',returnField+field('name',t('Nazwa profilu','Display name'),'',{required:true,attributes:'minlength="2" maxlength="80" autocomplete="name"'})+email+password('new-password')+
        choice(ctx,'profile_type',t('Rodzaj konta','Account type'),options.seller,'private',{required:true,placeholder:false})+
        check('terms',t('Akceptuję regulamin i potwierdzam zapoznanie się z informacją o prywatności.','I accept the terms and acknowledge the privacy notice.'),false,true)+
        `<div class="inline">${link(ctx,'/regulamin',t('Regulamin','Terms'),'text-link')}${link(ctx,'/prywatnosc',t('Prywatność','Privacy'),'text-link')}</div>`+submit(title,'arrow'))+
        providers;
      }
      body+=`<div class="auth-links">${authLink('/zaloguj',t('Mam już konto','I already have an account'))}${demoLink}</div>`;
      break;
    case 'reset-request':
    case 'resend': {
      const resend=kind==='resend';
      title=resend?t('Wyślij nowy link potwierdzający','Resend a confirmation link'):t('Odzyskaj hasło','Reset your password');
      body=noMail+apiForm('/auth/'+kind,returnField+email+submit(t('Wyślij link','Send link'),'arrow'))+authLink('/zaloguj',t('Wróć do logowania','Back to sign in'),'text-link','back');
      break;
    }
    case 'mail':
      title=t('Sprawdź pocztę','Check your email');
      body=`<div class="stack"><p>${t('Jeśli dla tego adresu potrzebny jest link, znajdziesz go w skrzynce odbiorczej. Sprawdź też spam.','If a link is needed for this address, check your inbox and spam folder.')}</p>${authLink('/zaloguj',t('Przejdź do logowania','Go to sign in'),'btn primary','arrow')}${authLink('/ponow-potwierdzenie',t('Poproś o nowy link','Request a new link'))}</div>`;
      break;
    case 'verify':
    case 'reset':
      title=kind==='verify'?t('Potwierdź adres e-mail','Confirm your email'):t('Ustaw nowe hasło','Set a new password');
      body=apiForm('/auth/'+kind,returnField+hidden('token',ctx.url.searchParams.get('token')||'')+(kind==='reset'?password('new-password'):password())+submit(title,'check'));
      break;
    case 'owner':
      title=t('Dostęp właściciela','Owner access');
      body=canClaim(ctx)?apiForm('/auth/owner',field('token',t('Jednorazowy sekret konfiguracji','One-time setup secret'),'',{type:'password',required:true,attributes:'autocomplete="off" maxlength="300"'})+submit(t('Aktywuj konto administratora','Activate administrator access'),'shield')):flash(t('Konto nie jest uprawnione do konfiguracji administratora.','This account is not eligible for administrator setup.'),'warn');
      break;
    default: {
      title=t('Zaloguj się','Sign in');
      const confirmed=ctx.url.searchParams.get('confirmed');
      const status=confirmed==='verify'?t('E-mail potwierdzony. Możesz się zalogować.','Email confirmed. You can sign in.'):confirmed==='reset'?t('Hasło zmienione. Zaloguj się nowym hasłem.','Password changed. Sign in with your new password.'):'';
      const chatGPTError=ctx.url.searchParams.get('chatgpt')==='unavailable'
        ? flash(t('To konto wymaga logowania e-mailem i hasłem.','This account requires email and password sign-in.'),'warn')
        : '';
      body=chatGPTError+(status?flash(status,'success'):'')+apiForm('/auth/login',hidden('next',next)+email+password()+submit(title,'arrow'))+
        providers+`<div class="auth-links">${authLink('/zarejestruj',t('Załóż konto','Create account'))}${authLink('/odzyskaj-haslo',t('Nie pamiętam hasła','Forgot password'))}${authLink('/ponow-potwierdzenie',t('Wyślij link potwierdzający','Resend confirmation'))}${demoLink}</div>`;
    }
  }
  return {title,body:wrap(`<div class="auth-layout">${panel('',`<div class="auth-header"><span class="mini-icon">${icon(kind==='owner'?'shield':'user',26)}</span><h1>${e(title)}</h1></div>${body}`)}</div>`)};
}

export async function account(ctx) {
  const t=ctx.t,u=ctx.user;
  const listings=menuLink(ctx,'/moje-ogloszenia','car',t('Moje ogłoszenia','My listings'),t('Szkice, moderacja i sprzedaż','Drafts, review and sales'))+
    menuLink(ctx,'/ulubione','star',t('Ulubione','Favorites'),(ctx.robotics?t('Zapisane roboty','Saved robots'):t('Zapisane pojazdy','Saved vehicles')))+
    menuLink(ctx,'/porownanie','scale',t('Porównywarka','Compare'),(ctx.robotics?t('Parametry wybranych robotów','Specifications of selected robots'):t('Parametry wybranych pojazdów','Specifications of selected vehicles')))+
    (ctx.robotics?(u.profile_type==='company'?menuLink(ctx,'/panel-dealera','upload',t('Import CSV robotów','Robot CSV import')):''):menuLink(ctx,'/moje-ogloszenia/import','upload',t('Import i automatyzacja','Import and automation')))+
    (u.profile_type==='company'?menuLink(ctx,'/panel-dealera','building',t('Panel dealera','Dealer dashboard'),t('Wizytówka firmy i import CSV','Business profile and CSV import')):'');
  const activity=menuLink(ctx,ctx.robotics?'/zamowienia':'/roboty/zamowienia','calendar',t('Zamówienia i rezerwacje robotów','Robot orders and reservations'),t('Zakupy, wynajem i obsługa klientów','Purchases, rentals and customer orders'))+
    (ctx.robotics?menuLink(ctx,'/asystent','sliders',t('Asystent wyboru robota','Robot selection assistant'))+menuLink(ctx,'/rolki','video',t('Rolki robotów','Robot reels')):'')+
    menuLink(ctx,'/wiadomosci','message',t('Wiadomości','Messages'),t('Rozmowy i terminy oględzin','Conversations and viewings'),ctx.badges.messages)+
    menuLink(ctx,'/powiadomienia','bell',t('Powiadomienia','Notifications'),t('Aktualizacje ogłoszeń i wiadomości','Listing and message updates'),ctx.badges.notifications);
  const session=(canClaim(ctx)?menuLink(ctx,'/dostep-wlasciciela','shield',t('Skonfiguruj dostęp właściciela','Set up owner access')):'')+
    apiForm('/auth/logout',`<button class="account-menu-row" type="submit">${menuRow('logout',t('Wyloguj się','Sign out'))}</button>`,{className:'account-menu-form'});
  const staff=(isStaff(u)?menuLink(ctx,'/moderacja','side-moderation',t('Panel moderacji','Moderation'),t('Oferty i zgłoszenia do rozpatrzenia','Listings and reports to review')):'')+
    (u.role==='admin'?menuLink(ctx,'/administracja','side-admin',t('Panel administratora','Administration'),t('Ustawienia, role i audyt','Settings, roles and audit log')):'');
  return {...menuPage(t('Twoje konto','Your account'),'user',
    accountIdentity(ctx,'/konto#ustawienia-konta',t('Zarządzaj kontem','Manage account'))+
    `<div class="account-menu-columns account-dashboard">
      ${menuGroup(t('Aktywność','Activity'),activity,{id:'aktywnosc'})}
      ${menuGroup(t('Ogłoszenia','Listings'),listings,{id:'ogloszenia'})}
      ${menuGroup(t('Usługi','Services'),
        menuLink(ctx,'/uslugi','pin',t('Usługi motoryzacyjne','Automotive services'))+
        menuLink(ctx,'/moje-uslugi','building',t('Moje firmy','My businesses')),{id:'uslugi-konta'})}
      ${staff?menuGroup(t('Zarządzanie','Management'),staff,{id:'zarzadzanie'}):''}
    </div>
    <section class="account-settings" id="ustawienia-konta" aria-labelledby="ustawienia-konta-title">
      <h2 id="ustawienia-konta-title">${t('Ustawienia konta','Account settings')}</h2>
      ${await profileSettings(ctx,true)}
    </section>
    <div class="account-menu-columns account-session">
      ${ctx.demo?menuGroup(t('Zmień rolę demo','Switch demo role'),demoRoleOptions(ctx,href(ctx,'/konto')).join(''),{id:'role-demo'}):''}
      ${menuGroup(t('Sesja','Session'),session,{id:'funkcje-konta'})}
    </div>`,
    {pageTitle:t('Konto','Account'),
      action:link(ctx,'/sprzedaj',(ctx.robotics?t('Wystaw sprzęt','List equipment'):t('Dodaj pojazd','Add a vehicle')),'btn primary account-heading-action','listing')}),inlineIconSettings:true};
}

async function profileSettings(ctx,nested=false) {
  const t=ctx.t,u=ctx.user;
  const firm=await row(ctx.db,'SELECT * FROM companies WHERE user_id=?',u.id)||{};
  const credentials=ctx.demo?null:await row(ctx.db,'SELECT password FROM users WHERE id=?',u.id);
  const hasPassword=Boolean(credentials?.password);
  const save=t('Zapisz ustawienia','Save settings');
  const profileFields='form="account-profile"';
  const saveProfile=apiForm('/profile','',{id:'account-profile',method:'PUT',reload:true});
  const saveButton=`<button type="submit" form="account-profile" class="btn primary">${icon('check')}${save}</button>${formStatus}`;
  const feedback={feedback:true};
  const profile=menuDisclosure('dane-konta','user',t('Dane konta','Account details'),
    t('Nazwa profilu, e-mail i rodzaj konta','Display name, email and account type'),
    `<div class="stack"><div class="field-grid">${field('name',t('Nazwa profilu','Display name'),u.name,{required:true,attributes:profileFields+' maxlength="80" autocomplete="name"'})}
    ${field('account_email',t('Adres e-mail','Email address'),u.email,{type:'email',attributes:'readonly'})}
    ${choice(ctx,'profile_type',t('Rodzaj profilu','Profile type'),options.seller,u.profile_type,{placeholder:false,attributes:profileFields+' data-profile-type'})}</div>
    ${area('bio',t('Publiczny opis sprzedawcy','Public seller bio'),u.bio,{attributes:profileFields+' maxlength="1500"'})}
    <fieldset data-company-fields${u.profile_type==='company'?'':' hidden disabled'}><legend>${t('Wizytówka firmy','Business profile')}</legend>
      <div class="stack"><div class="field-grid">${field('company',t('Nazwa firmy','Business name'),firm.name,{attributes:profileFields+' maxlength="100"'})}
      ${field('address',t('Publiczny adres firmy','Public business address'),firm.address,{attributes:profileFields+' maxlength="250"'})}
      ${field('hours',t('Godziny otwarcia','Opening hours'),firm.hours,{attributes:profileFields+' maxlength="200"'})}</div>
      ${area('description',t('Opis firmy','Business description'),firm.description,{attributes:profileFields+' maxlength="2400"'})}</div></fieldset>
    ${saveButton}</div>`,feedback);
  const contact=menuDisclosure('kontakt-profilu','pin',t('Kontakt i lokalizacja','Contact and location'),
    u.city?t('Miejscowość · ','City · ')+u.city:t('Miejscowość i numer telefonu','City and phone number'),
    `<div class="stack"><div class="field-grid">${field('city',t('Miejscowość','City'),u.city,{attributes:profileFields+' maxlength="90" autocomplete="address-level2"'})}
      ${field('phone',t('Numer telefonu','Phone number'),u.phone,{type:'tel',attributes:profileFields+' autocomplete="tel" maxlength="30"'})}</div>
      <label class="check"><input ${profileFields} type="checkbox" name="show_phone"${u.show_phone?' checked':''}>
        <span>${t('Zezwól na ujawnienie numeru w ofertach z kontaktem telefonicznym','Allow my number to be revealed on listings with phone contact')}</span></label>
      ${saveButton}</div>`,feedback);
  const notificationSwitch=(name,title,on)=>`<label class="settings-switch"><span>${e(title)}</span>
    <input form="account-profile" type="checkbox" role="switch" name="${name}"${on?' checked':''}></label>`;
  const notifications=menuDisclosure('preferencje-powiadomien','bell',t('Powiadomienia','Notifications'),
    t('Nowe wiadomości i status ogłoszeń','New messages and listing status'),
    `<div class="stack">${notificationSwitch('notify_messages',t('Nowe wiadomości','New messages'),u.notify_messages)}
      ${notificationSwitch('notify_listings',t('Status ogłoszeń','Listing status'),u.notify_listings)}${saveButton}</div>`,feedback);
  const language=menuDisclosure('jezyk','globe',t('Język interfejsu','Interface language'),languages[ctx.lang],
    `<div class="stack">${choice(ctx,'lang',t('Język interfejsu','Interface language'),languages,ctx.lang,{placeholder:false,attributes:profileFields})}${saveButton}</div>`,feedback);
  const imageEditor=(kind,title,key)=>`<div class="stack profile-image-editor"><h3>${e(title)}</h3>
    ${key?profileImage(ctx,kind,key,kind==='panorama'?'profile-panorama':'profile-avatar'):''}${assetForm(ctx,kind,title)}</div>`;
  const images=menuDisclosure('zdjecia-profilu','image',t('Zdjęcia profilu','Profile images'),
    t('Zdjęcie sprzedawcy, logo i panorama','Seller photo, logo and cover photo'),
    `<div class="stack profile-images">
      ${imageEditor('avatar',t('Zdjęcie sprzedawcy','Seller photo'),u.avatar_key)}
      ${u.profile_type==='company'?imageEditor('company',t('Logo firmy','Company logo'),u.logo_key)+
        imageEditor('panorama',t('Panoramiczne zdjęcie firmy','Company cover photo'),u.panorama_key):''}
      ${notificationSwitch('show_profile_images',t('Pokazuj zdjęcia profilu w ogłoszeniach i publicznej wizytówce','Show profile images in listings and on the public profile'),u.show_profile_images)}
      <p class="muted">${t('Po przesłaniu obraz jest widoczny w Twoim panelu. Włącz tę opcję i zapisz ustawienia, aby udostępnić go kupującym.','Uploaded images appear in your account. Enable this option and save settings to share them with buyers.')}</p>
      ${saveButton}</div>`,feedback);
  const security=ctx.demo?'':menuDisclosure('bezpieczenstwo','shield',t('Bezpieczeństwo','Security'),
    hasPassword?t('Zmiana hasła','Change your password'):t('Ustawienie hasła','Set a password'),hasPassword?apiForm('/auth/change',
    field('current',t('Aktualne hasło','Current password'),'',{type:'password',required:true,attributes:'autocomplete="current-password" maxlength="128"'})+
    field('password',t('Nowe hasło','New password'),'',{type:'password',required:true,attributes:'autocomplete="new-password" minlength="12" maxlength="128"'})+
    submit(t('Zapisz nowe hasło','Save new password'),'check'),{success:t('Hasło zmienione.','Password changed.'),go:'reset-form'}):
    (mailReady(ctx)?link(ctx,'/odzyskaj-haslo',t('Ustaw hasło przez e-mail','Set a password by email'),'btn','shield'):
      `<p>${t('Korzystasz z logowania przez ChatGPT. W sprawie ustawienia hasła skontaktuj się z obsługą.','You sign in with ChatGPT. Contact support about setting a password.')}</p>`+link(ctx,'/kontakt',t('Kontakt','Contact'),'btn','message')));
  const remove=ctx.demo||u.role!=='user'?'':menuDisclosure('usun-konto','close',t('Usuń konto','Delete account'),t('Trwałe usunięcie danych profilu','Permanently delete your profile data'),
    `<p>${t('Konto zostanie zanonimizowane, a Twoje oferty zarchiwizowane. Wcześniejsze rozmowy pozostają dostępne ich uczestnikom.','Your account will be anonymized and listings archived. Earlier conversations remain available to their participants.')}</p>
    ${hasPassword?apiForm('/auth/delete',field('password',t('Aktualne hasło','Current password'),'',{type:'password',required:true,attributes:'autocomplete="current-password"'})+
      check('confirm',t('Potwierdzam usunięcie konta','I confirm account deletion'),false,true)+submit(t('Usuń konto','Delete account'),'close','btn danger'),{confirm:t('Usunąć konto?','Delete your account?')}):link(ctx,'/kontakt',t('Poproś o zamknięcie konta','Request account closure'),'btn','message')}`);
  const textSize=menuDisclosure('rozmiar-tekstu','edit',t('Rozmiar tekstu','Text size'),
    t('Dostosuj czytelność menu','Adjust menu readability'),
    `<div class="settings-segments" role="radiogroup" aria-label="${t('Rozmiar tekstu w menu konta','Account menu text size')}">
      ${[['standard',t('Standardowy','Standard')],['large',t('Większy','Larger')],['extra',t('Największy','Largest')]].map(([value,title])=>
        `<label><input type="radio" name="account_text_size" value="${value}" data-account-text-choice${value==='standard'?' checked':''}><span>${title}</span></label>`).join('')}
    </div>`);
  const iconStyles=menuDisclosure('wyglad-ikon','side-appearance',ctx.robotics?t('Ramki i ikony','Frames and icons'):t('Wygląd ikon i przycisków','Icon and button appearance'),
    ctx.robotics?t('Styl ramki, kolor neonu i grubość','Frame style, neon color and thickness'):t('Zestawy ikon, przyciski i tła','Icon sets, buttons and backgrounds'),`<div data-icon-settings>${appearanceControls(ctx,'inline-icon-theme')}</div>`);
  const info=menuLink(ctx,'/aplikacja','mobile',t('O aplikacji','About the app'),t('Instalacja na telefonie i komputerze','Install on a phone or computer'))+
    menuLink(ctx,'/pomoc','message',t('Pomoc i FAQ','Help and FAQ'))+
    menuLink(ctx,'/regulamin','listing',t('Regulamin','Terms'))+
    menuLink(ctx,'/prywatnosc','shield',t('Polityka prywatności','Privacy policy'))+
    menuLink(ctx,'/cookies','sliders',t('Ustawienia cookies','Cookie settings'));
  return `${saveProfile}<div class="account-menu-columns account-settings-columns">
    <div>
      ${menuGroup(t('Dane i bezpieczeństwo','Details and security'),profile+images+security+remove,{nested})}
      ${menuGroup(t('Preferencje','Preferences'),notifications+contact+language,{nested})}
    </div>
    <div>
      ${menuGroup(t('Wygląd aplikacji','App appearance'),textSize+iconStyles,{nested})}
      ${menuGroup(t('Informacje i dokumenty','Information and documents'),info,{id:'dokumenty',nested})}
    </div>
  </div>`;
}

export async function profilePage(ctx) {
  const t=ctx.t;
  return {...menuPage(t('Ustawienia konta','Account settings'),'settings',
    accountIdentity(ctx,'/ustawienia#dane-konta',t('Zarządzaj kontem','Manage account'))+await profileSettings(ctx),
    {action:link(ctx,'/konto',t('Konto','Account'),'btn account-heading-action','back')}),inlineIconSettings:true};
}

function profileImage(ctx,kind,key,style='') {
  return `<img class="${style}" src="${href(ctx,'/asset/'+kind+'/'+e(key))}" alt="">`;
}

export function assetForm(ctx,path,title='') {
  const t=ctx.t;
  return `<form method="post" class="stack asset-form" data-asset="${e(path)}">${field('photo',title||t('Plik JPEG, PNG lub WebP','JPEG, PNG or WebP file'),'',{type:'file',required:true,attributes:'accept="image/jpeg,image/png,image/webp"'})}
    ${submit(t('Prześlij obraz','Upload image'),'upload')}${formStatus}</form>`;
}

function listingConfirmation(ctx, items) {
  const submitted=ctx.url.searchParams.get('wyslano');
  const item=submitted&&items.find(item=>item.id===submitted);
  if (!item || !['pending','published','rejected'].includes(item.status)) return '';
  const t=ctx.t;
  const confirmed=flash(item.status==='published'?t('Ogłoszenie jest już opublikowane.','Your listing is live.'):
    t('Ogłoszenie zostało wysłane do moderacji.','Your listing was submitted for review.'),'success');
  return confirmed;
}

export function listingsPage(ctx,items) {
  const t=ctx.t,status=ctx.url.searchParams.get('status');
  const visible=Object.hasOwn(options.status,status)?items.filter(x=>x.status===status):items;
  const tabs=`<div class="status-tabs">${link(ctx,'/moje-ogloszenia',t('Wszystkie','All')+' · '+items.length,status?'chip':'chip active-chip')}
    ${Object.keys(options.status).map(key=>link(ctx,'/moje-ogloszenia?status='+key,localized(ctx,'status',key)+' · '+items.filter(x=>x.status===key).length,status===key?'chip active-chip':'chip')).join('')}</div>`;
  const table=visible.map(offer=>{
    const editable=offer.status!=='pending';
    const listingContext=offer.type==='robot'?{...ctx,robotics:true}:ctx;
    const actions=[
      editable?link(listingContext,'/sprzedaj/'+offer.id,t('Edytuj','Edit'),'btn','edit'):'',
      link(listingContext,'/podglad/'+offer.id,t('Podgląd','Preview'),'btn','image'),
      ['published','sold'].includes(offer.status)?link(listingContext,'/oferta/'+offer.slug,t('Otwórz ofertę','Open listing'),'btn','arrow'):'',
      ...[['held',['published','pending'].includes(offer.status),t('Wstrzymaj','Pause'),'pause'],
        ['sold',offer.can_mark_sold,t('Oznacz jako sprzedane','Mark as sold'),'check'],
        ['archived',['draft','rejected','held','sold'].includes(offer.status),t('Archiwizuj','Archive'),'listing']]
        .filter(([,allowed])=>allowed)
        .map(([state,,label,symbol])=>apiForm('/listings/'+offer.id+'/status',hidden('status',state)+submit(label,symbol,'btn'),{reload:true}))
    ].join('');
    return `<article class="panel listing-row"><div class="row-head"><div class="row-main">${offer.cover?`<img src="${e(offer.cover)}" alt="" width="102" height="65">`:''}
      <div><h2>${e(cardTitle(ctx,offer))}</h2><p>${e(offer.variant)} ${offer.price?' · '+e(price(ctx,offer.price,offer.currency)):''}</p></div></div>
      <div>${tag(ctx,offer.status)}${offer.has_edit&&offer.status==='published'?`<p class="muted">${t('Masz zapisane zmiany w szkicu','You have saved draft changes')}</p>`:''}</div></div>
      ${offer.rejection?flash(t('Uzasadnienie','Reason')+' · '+offer.rejection,'warn'):''}
      <div class="inline listing-actions">${actions}</div></article>`;
  }).join('');
  return {title:t('Moje ogłoszenia','My listings'),body:`<div class="wrap page listings-manage">
    <header class="listings-manage-header">
      ${pageHead(t('Moje ogłoszenia','My listings'),'',link(ctx,'/sprzedaj',(ctx.robotics?t('Wystaw sprzęt','List equipment'):t('Dodaj pojazd','Add a vehicle')),'btn primary','listing'))}
      <div class="inline listings-manage-tools">${ctx.robotics?(ctx.user.profile_type==='company'?link(ctx,'/panel-dealera',t('Import CSV robotów','Robot CSV import'),'btn','upload'):''):link(ctx,'/moje-ogloszenia/import',t('Import i automatyzacja','Import and automation'),'btn','upload')}${link(ctx,'/moje-uslugi',t('Moje firmy','My businesses'),'btn','building')}</div>
    </header>
    ${listingConfirmation(ctx,items)}${supportInvitation(ctx,ctx.url.searchParams.get('wyslano')||'')}${tabs}<div class="listing-stack">${table||empty(ctx,t('Brak ogłoszeń','No listings'),t('Zapisz szkic lub zmień filtr statusu.','Start a draft or change the status filter.'),link(ctx,'/sprzedaj',(ctx.robotics?t('Wystaw sprzęt','List equipment'):t('Dodaj pojazd','Add a vehicle')),'btn primary','listing'))}</div>
  </div>`};
}
export function sellStart(ctx) {
  const t=ctx.t;
  return {title:t('Sprzedaj pojazd','Sell a vehicle'),body:wrap(`<div class="sell-start panel"><span class="mini-icon">${icon('listing',30)}</span><h1>${t('Sprzedaj pojazd','Sell a vehicle')}</h1>
    <p>${t('Wypełnij dane, dodaj zdjęcia i prześlij ogłoszenie. Publikacja podstawowej oferty jest bezpłatna.','Enter vehicle details, add photos and submit your listing. Basic listings are free.')}</p>
    ${apiForm('/listings',keyInput()+submit(t('Rozpocznij ogłoszenie','Start a listing'),'plus'))}
    ${link(ctx,'/moje-ogloszenia',t('Wróć do swoich szkiców','Return to your drafts'),'text-link','back')}</div>`)};
}

export async function wizard(ctx,offer,state) {
  const t=ctx.t;
  const d=state.data;
  const catalog=await catalogFor(ctx);
  const makes=Object.hasOwn(catalog.makesByType,d.type)?catalog.makesByType[d.type]:catalog.makesByType[''];
  const S=(key,caption,group,required=false,attributes='')=>choice(ctx,key,caption,group,d[key]||'',{required,attributes});
  const F=(key,caption,required=false,attributes='',type='text')=>field(key,caption,d[key]??'',{required,attributes,type});
  const N=(key,caption,required=false,min=0,max=1e8,decimal=false)=>F(key,caption,required,`min="${min}" max="${max}" step="${decimal?'0.01':'1'}" inputmode="${decimal?'decimal':'numeric'}"`,'number');
  const showFor=(group,control)=>`<div data-vehicle-field="${group}">${control}</div>`;
  const profiles=Object.fromEntries(['',...Object.keys(catalog.types)].map(type=>{
    const bodies=vehicleBodyChoices(type,type===d.type?d.body:'');
    const overrides=Object.hasOwn(bodyFeatureOverrides,type)?bodyFeatureOverrides[type]:undefined;
    return [type,{...vehicleProfile(type),overrides,bodies:Object.entries(bodies).map(([value,label])=>[value,lang(ctx,label)])}];
  }));
  const stepNames=[t('Dane pojazdu','Vehicle details'),t('Parametry i wyposażenie','Specifications and equipment'),t('Zdjęcia','Photos'),t('Cena i kontakt','Price and contact'),t('Podgląd','Preview')];
  const yr=new Date().getFullYear()+1;
  const makeField=F('make',t('Marka','Make'),true,'list="make-options" maxlength="50" data-wizard-make')+
    `<datalist id="make-options">${Object.keys(makes).map(make=>`<option value="${e(make)}"></option>`).join('')}</datalist>`;
  const modelField=F('model',t('Model','Model'),true,'list="model-options" maxlength="60" data-wizard-model')+
    `<datalist id="model-options">${(Object.hasOwn(makes,d.make)?makes[d.make]:[]).map(model=>`<option value="${e(model)}"></option>`).join('')}</datalist>`;
  const groups=Object.values(features).map(([pl,en,list])=>`<fieldset class="equipment-options"><legend>${t(pl,en)}</legend><div class="check-grid">
    ${Object.entries(list).map(([key,pair])=>check('equip-'+key,lang(ctx,pair),d.equipment?.includes(key))).join('')}</div></fieldset>`).join('');
  const steps=[
    `<div class="field-grid">${S('type',t('Rodzaj pojazdu','Vehicle type'),catalog.types,true)}${makeField}${modelField}
    ${F('variant',t('Wersja','Trim'),false,'maxlength="95"')}${N('year',t('Rok produkcji','Model year'),true,1886,yr)}
    ${S('condition',t('Stan','Condition'),options.condition,true)}${showFor('motor',N('mileage',t('Przebieg (km)','Mileage (km)'),true,0,20000000))}
    ${showFor('hours',N('hours',t('Motogodziny','Operating hours'),false,0,1000000,true))}
    ${S('body',t('Nadwozie lub odmiana','Body style or variant'),vehicleBodyChoices(d.type,d.body),true)}${F('color',t('Kolor','Color'),false,'maxlength="70"')}
    ${F('countryOrigin',t('Kraj pochodzenia','Country of origin'),false,'maxlength="80"')}
    ${F('registered',t('Pierwsza rejestracja','First registration'),false,'','date')}
    ${F('vin',t('VIN lub inny identyfikator pojazdu','VIN or other vehicle identifier'),false,'maxlength="35"')}</div>`,
    `<div class="field-grid">${showFor('motor',S('fuel',t('Paliwo','Fuel'),options.fuel,true,'data-fuel'))}
    ${showFor('motor',S('gearbox',t('Skrzynia biegów','Transmission'),options.gearbox,true))}
    ${showFor('motor',S('drive',t('Napęd','Drivetrain'),options.drive,true))}${showFor('motor',N('power',t('Moc','Power'),true,1,5000))}
    ${showFor('motor',S('powerUnit',t('Jednostka mocy','Power unit'),{KM:t('KM','hp'),kW:'kW'},true))}
    ${showFor('engine',N('engine',t('Pojemność silnika (cm³)','Engine capacity (cc)'),false,1,30000))}
    ${showFor('electric',N('battery',t('Akumulator (kWh)','Battery (kWh)'),false,1,300,true))}
    ${showFor('electric',N('range',t('Deklarowany zasięg (km)','Claimed range (km)'),false,1,2000))}
    ${showFor('doors',N('doors',t('Liczba drzwi','Doors'),false,1,12))}${showFor('motor',N('seats',t('Liczba miejsc','Seats'),false,1,100))}
    ${showFor('trailer',N('grossWeight',t('Dopuszczalna masa całkowita (kg)','Gross vehicle weight (kg)'),false,1,150000))}
    ${showFor('trailer',N('axles',t('Liczba osi','Number of axles'),false,1,24))}
    ${S('damage',t('Uszkodzenia','Damage'),options.damage,true)}</div>
    <fieldset><legend>${t('Deklaracje sprzedawcy','Seller declarations')}</legend><div class="check-grid">
    ${check('accidentFree',t('Bezwypadkowy','Accident-free'),d.accidentFree)}${check('firstOwner',t('Pierwszy właściciel','First owner'),d.firstOwner)}${check('service',t('Serwisowany','Serviced'),d.service)}</div>
    ${area('history',t('Historia i uszkodzenia','History and damage'),d.history,{attributes:'maxlength="1500"'})}</fieldset>
    ${groups}${area('description',t('Opis ogłoszenia','Listing description'),d.description,{required:true,attributes:'minlength="12" maxlength="7000"'})}
    ${area('description_en',t('Opis po angielsku (opcjonalnie)','English description (optional)'),d.description_en,{attributes:'maxlength="7000"'})}`,
    `<section class="media-editor smart-camera-entry" aria-labelledby="smart-camera-heading">
      <h3 id="smart-camera-heading">${icon('image',22)} BRUMBRUM.VIN — SMART CAMERA 360° STUDIO</h3>
      <p>${t('Nie musisz być fotografem. Wystarczy, że dopasujesz kontur.','You don’t need to be a photographer. Just line up the outline.')}</p>
      <div class="inline">${[
        ['guided','image',t('Zrób zdjęcie','Take a photo')],['guide','listing',t('Instrukcja zdjęć','Photo guide')],
        ['spin','rotate',t('Sesja 360°','360° session')]
      ].map(([mode,symbol,label])=>`<button class="btn${mode==='guided'?' primary':''}" type="button" data-camera-open="${mode}" data-button-finish-action>${icon(symbol,19)}${buttonEmbroideryLabel(label)}</button>`).join('')}</div>
      <details class="photo-master-guide">
        <summary>${icon('listing',19)}<span>${t('Pełny poradnik: 12–16 idealnych zdjęć','Complete guide: 12–16 ideal photos')}</span>${icon('down',16)}</summary>
        <div class="photo-master-guide-content">
          <img src="/assets/photo-guide/brumbrum-photo-guide.webp" width="1536" height="1152" loading="lazy" decoding="async"
            alt="${e(t('Poradnik BRUMBRUM.VIN: pozycje fotografa wokół auta, kolejność 12 zdjęć, prawidłowa odległość, kąt i wysokość aparatu oraz przykłady dobrego i złego kadru.','BRUMBRUM.VIN guide showing photographer positions around a car, the 12-shot sequence, correct distance, angle and camera height, plus good and poor framing examples.'))}">
          <div><strong>${t('Najważniejsze zasady','Key rules')}</strong><ul>
            <li>${t('Umyj auto, wybierz równe i spokojne tło oraz miękkie światło dzienne.','Clean the vehicle and choose a level, uncluttered background with soft daylight.')}</li>
            <li>${t('Stań 4–6 m od auta, trzymaj aparat na wysokości 1–1,3 m i użyj obiektywu 1×.','Stand 4–6 m away, hold the camera 1–1.3 m high and use the 1× lens.')}</li>
            <li>${t('Pokaż całe auto z marginesem. Nie ucinaj zderzaków, kół ani dachu.','Show the complete vehicle with a margin. Do not crop bumpers, wheels or the roof.')}</li>
            <li>${t('Po ośmiu ujęciach nadwozia dodaj kokpit, siedzenia, bagażnik, silnik i ważne detale.','After eight exterior angles, add the cockpit, seats, boot, engine bay and important details.')}</li>
          </ul></div>
        </div>
      </details>
      </section><div class="dropzone"><span class="mini-icon">${icon('upload',24)}</span><strong>${t('Dodaj zdjęcia pojazdu','Add vehicle photos')}</strong>
      <p>${t('JPEG, PNG lub WebP. Do 30 zdjęć i 12 MB na plik. Pierwsze zdjęcie będzie okładką.','JPEG, PNG or WebP. Up to 30 photos and 12 MB per file. The first photo is the cover.')}</p>
      <label class="btn file-button" data-button-finish-action>${icon('image',18)}${buttonEmbroideryLabel(t('Wybierz zdjęcia','Choose photos'))}<input type="file" data-photo-input multiple accept="image/jpeg,image/png,image/webp" aria-label="${t('Wybierz zdjęcia','Choose photos')}"></label></div>
      <section class="media-editor listing-reel-editor" aria-labelledby="listing-reel-heading">
          <h3 id="listing-reel-heading">${icon('video',20)}${t('Rolka pojazdu','Vehicle reel')} <small data-video-status></small></h3>
          <p>${t('Dodaj jeden film MP4 (H.264) lub WebM do 24 MB. Po publikacji pojawi się w ogłoszeniu i w zakładce Rolki.','Add one MP4 (H.264) or WebM video up to 24 MB. Once published, it appears in the listing and in Reels.')}</p>
          <div class="inline"><label class="btn file-button" data-button-finish-action>${icon('upload',18)}<span class="button-embroidery-label" data-video-label>${t('Dodaj rolkę','Add reel')}</span><input type="file" data-video-input accept="video/mp4,video/webm,.mp4,.webm" aria-label="${t('Dodaj rolkę','Add reel')}"></label>
            <button class="btn" type="button" data-remove-video hidden>${t('Usuń rolkę','Remove reel')}</button></div>
          <video class="edit-video" data-video-preview controls playsinline preload="none" hidden aria-label="${t('Podgląd rolki','Reel preview')}"></video>
          <div class="upload-failures" data-video-errors aria-live="polite"></div>
      </section>
      <details class="media-editor photo-detail-help">
        <summary>${icon('plus',18)}<span>${t('Jak dodać zbliżenia (+) do galerii?','How do I add close-ups (+) to the gallery?')}</span>${icon('down',16)}</summary>
        <ol>
          <li>${t('Dodaj zdjęcie całego pojazdu jako główne. Osobno wgraj zbliżenia, np. felgi, reflektora lub wnętrza.','Use a photo of the whole vehicle as your cover. Upload separate close-ups of the wheels, lights or interior.')}</li>
          <li>${t('Pod każdym zbliżeniem wybierz etykietę w polu „Zbliżenie w galerii (+)”, np. „Felgi” lub „Reflektory”.','Under each close-up, choose a label in “Gallery close-up (+)”, such as “Wheels” or “Headlights”.')}</li>
          <li>${t('W podglądzie ogłoszenia kliknij plus przy oznaczonym zdjęciu, aby sprawdzić powiększenie. Zwykłe zdjęcia zostaw bez etykiety.','In the listing preview, select the plus on a labelled photo to check its enlarged view. Leave ordinary photos unlabelled.')}</li>
        </ol>
      </details>
      <div class="photo-grid" data-photo-grid></div><div class="upload-failures" data-photo-errors aria-live="polite"></div>
      <div class="extra-media">
        <details class="media-editor" ${state.spin.length?'open':''}><summary>${icon('rotate',20)}<span>${t('Widok 360°','360° view')}</span><small data-spin-count></small>${icon('down',16)}</summary>
          <p>${t('Dodaj od 8 do 36 zdjęć z pełnego okrążenia pojazdu. Pliki z galerii są sortowane według nazw, a zdjęcia ze studia według kąta.','Add 8 to 36 photos taken around the vehicle. Gallery files are sorted by name and studio frames by angle.')}</p>
          <div class="inline"><label class="btn file-button" data-button-finish-action>${icon('image',18)}${buttonEmbroideryLabel(t('Wybierz klatki 360°','Choose 360° frames'))}<input type="file" data-spin-input multiple accept="image/jpeg,image/png,image/webp" aria-label="${t('Wybierz klatki 360°','Choose 360° frames')}"></label>
            <button class="btn" type="button" data-clear-spin hidden>${t('Usuń serię','Remove sequence')}</button></div>
          <p class="form-status bad" data-spin-warning hidden>${t('Uzupełnij serię do 8 klatek albo usuń ją przed publikacją.','Add at least 8 frames or remove the sequence before submitting.')}</p>
          <div class="photo-grid spin-grid" data-spin-grid></div><div class="upload-failures" data-spin-errors aria-live="polite"></div>
        </details>
      </div>`,
    `<div class="field-grid">${N('price',t('Cena końcowa dla kupującego (PLN)','Final buyer price (PLN)'),true,1,1e8,true)}
    ${N('netPrice',t('Cena netto (opcjonalnie, PLN)','Net price (optional, PLN)'),false,1,1e8,true)}
    ${S('document',t('Deklarowany dokument sprzedaży','Declared sales document'),options.document)}
    ${F('city',t('Miejscowość','City'),true,'maxlength="90"')}
    ${F('region',t('Region / województwo','Region / province'),true,'list="regions" maxlength="90"')}
    <datalist id="regions">${regions.map(region=>`<option value="${e(region)}"></option>`).join('')}</datalist>
    ${F('country',t('Kraj','Country'),false,'maxlength="80"')}
    ${S('contact',t('Preferowany kontakt','Preferred contact'),options.contact,true)}
    ${field('listingPhone',t('Publiczny numer telefonu w ogłoszeniu','Public phone number on this listing'),d.listingPhone??'',{
      type:'tel',placeholder:'+48 000 000 000',attributes:'autocomplete="tel" maxlength="30" aria-describedby="listing-phone-help"'
    })}</div>
    <p class="muted" id="listing-phone-help">${t('Wpisany numer będzie widoczny w tym ogłoszeniu pod ceną, w przycisku „Zadzwoń”. Przy kontakcie telefonicznym wpisz numer tutaj lub włącz numer konta w ustawieniach.','The number you enter will appear under the price on this listing, in the Call button. To offer phone contact, enter a number here or enable your account number in settings.')}</p>
    <div class="inline" aria-label="${t('Przykład przycisku w ogłoszeniu','Example listing button')}"><span class="muted">${t('Przykład','Example')}</span><span class="btn">${icon('phone',18)} ${t('Zadzwoń','Call')} · +48 000 000 000</span></div>
    ${check('negotiable',t('Cena do negocjacji','Price negotiable'),d.negotiable)}`,
    `<div class="review-step"><span class="mini-icon">${icon('image',27)}</span><h3>${t('Sprawdź pełne ogłoszenie','Review the full listing')}</h3>
    <p>${t('Sprawdź galerię i dane sprzedawcy przed przesłaniem ogłoszenia.','Check the gallery and seller details before submitting the listing.')}</p>
    <button class="btn primary" data-preview type="button">${icon('image',19)}${t('Otwórz pełny podgląd','Open full preview')}</button></div>`
  ];
  return {title:t('Edytuj ogłoszenie','Edit listing'),body:wrap(pageHead(offer.status==='draft'?(ctx.robotics?t('Wystaw sprzęt','List equipment'):t('Dodaj pojazd','Add a vehicle')):t('Edytuj ogłoszenie','Edit listing'),cardTitle(ctx,offer),link(ctx,'/moje-ogloszenia',t('Moje ogłoszenia','My listings'),'btn','back',{buttonFinish:true}))+
    ((state.data.importSeller?.name||state.data.importSeller?.email)?'<details class="panel"><summary>'+t('Dane sprzedawcy ze źródła','Seller details from source')+'</summary><p>'+e([state.data.importSeller.name,state.data.importSeller.email].filter(Boolean).join(' · '))+'</p></details>':'')+
    (offer.status==='published'?flash(t('Po przesłaniu zmian do ponownej moderacji ogłoszenie zniknie z aktywnych wyników do czasu zatwierdzenia.','After submission, the listing is hidden from active results until the changes are approved.'),'warn'):'')+
    `<form method="post" class="panel wizard" novalidate data-wizard="${e(offer.id)}" data-version="${state.version}" data-step="${state.step}"
      data-photos="${embed(state.photos)}" data-spin="${embed(state.spin)}" data-spin-min="${spinLimits.min}" data-spin-max="${spinLimits.max}"
      data-smart-camera="${embed(state.smartCamera||{})}"
      data-photo-details="${embed(d.photoDetails||{})}" data-photo-detail-options="${embed(Object.entries(photoDetailLabels).map(([key,words])=>[key,t(...words)]))}"
      data-video="${e(state.video)}" data-video-limit="${videoLimit}" data-vehicle-catalog="${embed(catalog.makesByType)}" data-vehicle-profiles="${embed(profiles)}">
      <div class="wizard-steps" aria-label="${t('Kroki formularza','Form steps')}">${stepNames.map((name,i)=>`<button type="button" data-step-to="${i+1}" data-button-finish-action="step"${state.step===i+1?' aria-current="step"':''}><span>${i+1}</span><strong>${e(name)}</strong></button>`).join('')}</div>
      <div class="wizard-body">${steps.map((html,i)=>`<section data-step-body="${i+1}" ${i+1===state.step?'':'hidden'}><div class="section-head"><div><h2>${e(stepNames[i])}</h2>${i<4?`<p>${t('Pola z gwiazdką są wymagane do publikacji.','Fields marked with an asterisk are required to publish.')}</p>`:''}</div></div>${html}</section>`).join('')}</div>
      <div class="wizard-footer"><button class="btn" type="button" data-step-back data-button-finish-action>${icon('back',17)}${buttonEmbroideryLabel(t('Wstecz','Back'))}</button><div class="inline">
      <button type="button" class="btn" data-save-draft data-button-finish-action>${icon('check',18)}${buttonEmbroideryLabel(t('Zapisz szkic','Save draft'))}</button>
      <button type="button" class="btn primary" data-step-next>${buttonEmbroideryLabel(t('Dalej','Next'))} ${icon('arrow',17)}</button></div></div>
      <p class="form-status" data-save-status role="status" aria-live="polite">${t('Szkic zapisany na koncie.','Draft saved to your account.')}</p></form>`+photoStudio(ctx))};
}

const newStudioScenes = [
  ['Białe studio','White studio'],['Grafit i cyjan','Graphite and cyan'],
  ['Stalowa obrotnica','Steel turntable'],['Ciemna obrotnica','Dark turntable'],
  ['Drewniana wiata','Timber carport'],['Betonowa willa','Concrete villa'],
  ['Nadmorski podjazd','Coastal driveway'],['Górska rezydencja','Mountain retreat'],
  ['Studio detailingu','Detailing studio'],['Ceglany garaż','Brick garage'],
  ['Warsztat','Service workshop'],['Parking wielopoziomowy','Multi-storey parking'],
  ['Salon o zmierzchu','Showroom at dusk'],['Salon z wapienia','Limestone showroom'],
  ['Parking na dachu','Rooftop parking'],['Hala przemysłowa','Industrial hangar'],
  ['Plac przy lesie','Forest-edge turnout'],['Pustynna willa','Desert villa'],
  ['Miejski plac po deszczu','Rain-damp urban forecourt'],['Japoński dziedziniec','Japanese courtyard']
];

function photoStudio(ctx) {
  const t=ctx.t;
  const range=(key,label,min,max,value)=>`<label class="field"><span>${label}</span><input type="range" data-studio-control="${key}" min="${min}" max="${max}" value="${value}"></label>`;
  return `<dialog class="modal photo-studio" data-photo-studio aria-labelledby="photo-studio-title">
    <div class="modal-head"><h2 id="photo-studio-title">${t('Zmień tło zdjęcia','Change photo background')}</h2>
      <button type="button" class="btn" data-studio-close>${t('Zamknij','Close')}</button></div>
    <h3 data-studio-cut-step>${t('1. Wytnij pojazd','1. Cut out the vehicle')}</h3>
    <h3 data-studio-scene-step hidden>${t('2. Wybierz nowe tło','2. Choose a new background')}</h3>
    <div class="studio-previews">
      <figure data-studio-trace-view><figcaption>${t('Oryginał','Original')}</figcaption><canvas data-studio-original width="768" height="432"></canvas></figure>
      <figure>
        <figcaption>${t('Podgląd','Preview')}</figcaption>
        <div class="studio-stage" data-studio-stage>
          <canvas data-studio-output width="1536" height="864" role="img" aria-label="${t('Podgląd','Preview')}"></canvas>
          <canvas class="studio-before" data-studio-before width="1536" height="864" aria-hidden="true" hidden></canvas>
          <div class="studio-divider" data-studio-divider aria-hidden="true" hidden>
            <span class="studio-side studio-side-before">${t('Przed','Before')}</span>
            <span class="studio-divider-line"><span class="studio-divider-handle"></span></span>
            <span class="studio-side studio-side-after">${t('Po','After')}</span>
          </div>
        </div>
        <label class="studio-scrubber" data-studio-scrubber hidden>
          <span class="visually-hidden">${t('Granica porównania przed i po','Before-and-after comparison divider')}</span>
          <input type="range" data-studio-compare min="0" max="100" value="50">
        </label>
      </figure>
    </div>
    <div class="inline" data-studio-cut-actions><button type="button" class="btn" data-studio-auto>${t('Wytnij automatycznie','Cut out automatically')}</button>
      <button type="button" class="btn" data-studio-outline>${t('Zaznacz obrys','Trace outline')}</button>
      <button type="button" class="btn" data-studio-undo hidden>${t('Cofnij punkt','Undo point')}</button>
      <button type="button" class="btn primary" data-studio-confirm disabled>${t('Zatwierdź wycięcie','Confirm cutout')}</button></div>
    <div class="inline studio-brush" data-studio-brush hidden>
      <button type="button" class="btn" data-studio-brush-mode="restore" aria-pressed="false">${t('Przywróć fragment','Restore area')}</button>
      <button type="button" class="btn" data-studio-brush-mode="erase" aria-pressed="false">${t('Usuń resztki tła','Erase background')}</button>
      <button type="button" class="btn" data-studio-brush-undo disabled>${t('Cofnij pociągnięcie','Undo stroke')}</button>
      <label class="field"><span>${t('Rozmiar pędzla','Brush size')}</span><input type="range" data-studio-brush-size min="3" max="64" value="16"></label>
    </div>
    <button type="button" class="btn" data-studio-back hidden>${t('Wróć do wycinania','Back to cutout')}</button>
    <fieldset class="studio-background-picker"><legend>${t('Wybierz tło','Choose background')}</legend>
      <p class="muted" data-studio-background-hint>${t('Wybierz gotową scenę lub własne zdjęcie. Tło pojawi się pod pojazdem po zatwierdzeniu wycięcia.','Choose a preset or your own photo. The background appears behind the vehicle after you confirm the cutout.')}</p>
      <label class="btn file-button">${t('Wybierz własne tło','Choose custom background')}<input type="file" data-studio-background accept="image/jpeg,image/png,image/webp" aria-label="${t('Wybierz własne tło','Choose custom background')}"></label>
      <div class="studio-scenes">
      ${Array.from({length:39+newStudioScenes.length},(_,i)=>{
        const number=i+1;
        const scene=newStudioScenes[i-39];
        const label=`${t('Tło','Background')} ${number}${scene?' · '+t(...scene):''}`;
        return `<button type="button" aria-pressed="false" data-studio-scene title="${e(label)}"
          aria-label="${e(label)}"><img src="/assets/showroom/${String(number).padStart(2,'0')}.jpg" alt="" loading="lazy"><span>${number}</span></button>`;
      }).join('')}
    </div></fieldset>
    <div data-studio-composition hidden>
    <div class="studio-adjustments">
      ${range('scale',t('Skala','Scale'),35,145,100)}
      ${range('x',t('Położenie w poziomie','Horizontal position'),20,80,48)}
      ${range('y',t('Położenie na posadzce','Floor position'),48,94,84)}
      ${range('tilt',t('Obrót','Rotation'),-12,12,0)}
      ${range('perspective',t('Perspektywa','Perspective'),-30,30,0)}
      <label class="check"><input type="checkbox" data-studio-control="shadow" checked> ${t('Cień','Shadow')}</label>
      <label class="check"><input type="checkbox" data-studio-control="reflection" checked> ${t('Odbicie','Reflection')}</label>
    </div>
    <div class="inline"><button type="button" class="btn primary" data-studio-apply disabled>${t('Zastosuj i dodaj kopię','Apply and add a copy')}</button>
      <span class="muted">${t('Oryginał pozostanie w galerii.','The original stays in the gallery.')}</span></div></div>
    <p class="form-status" data-studio-status role="status"></p>
  </dialog>`;
}

export function previewActions(ctx,offer,state) {
  const t=ctx.t;
  const editing=offer.status==='published';
  if (offer.status==='pending') return panel(t('Ogłoszenie w moderacji','Listing under review'),`<p>${t('Wróć do swoich ogłoszeń, aby śledzić decyzję.','Return to your listings to check the decision.')}</p>`+link(ctx,'/moje-ogloszenia',t('Moje ogłoszenia','My listings'),'btn','arrow'));
  return panel(t('Publikacja','Publication'),(offer.rejection?flash(offer.rejection,'warn'):'')+
    (offer.type==='car'?`<p>${t('Samochód pojawi się w katalogu automatycznie, jeśli ogłoszenie przejdzie kontrolę.','Your car will appear in the catalog automatically if the listing passes its checks.')}</p>`:'')+
    apiForm('/listings/'+offer.id+'/submit',hidden('version',state.version)+(editing?check('confirm',t('Potwierdzam czasowe ukrycie oferty podczas moderacji','I confirm the listing will be temporarily hidden during review'),false,true):'')+
      submit(t('Opublikuj za darmo — 0 zł','Publish for free — PLN 0'),'shield')+supportChoices(ctx),{go:'listing-submitted'})+
    link(ctx,'/sprzedaj/'+offer.id,t('Wróć do edycji','Back to editing'),'text-link','edit')+
    (offer.status==='rejected'?`<button type="button" class="text-link" data-open="report">${icon('flag',17)}${t('Odwołaj się od decyzji','Appeal the decision')}</button>`+reportDialog(ctx,'appeal',offer.id):''));
}

export function messagesPage(ctx,items) {
  const t=ctx.t;
  return {title:t('Wiadomości','Messages'),body:wrap(pageHead(t('Wiadomości','Messages'),'',link(ctx,'/konto',t('Konto','Account'),'btn','back'))+
    (items.length?`<div class="thread-list">${items.map(c=>`<a class="account-card ${c.unread?'unread':''}" href="${href(ctx,'/wiadomosci/'+e(c.id))}">
      <span class="mini-icon">${icon('message',22)}</span><div><strong>${e(c.make+' '+c.model)} ${pillCount(c.unread)}</strong><small>${e(c.buyer_id===ctx.user.id?c.seller_name:c.buyer_name)} · ${e(c.last_body?.slice(0,105))}</small></div><time datetime="${e(c.updated_at)}">${e(day(ctx,c.updated_at,true))}</time></a>`).join('')}</div>`:
      empty(ctx,t('Nie masz jeszcze rozmów','No conversations yet'),t('Napisz do sprzedawcy z poziomu ogłoszenia.','Send the seller a message from a listing.'),link(ctx,'/szukaj',t('Przeglądaj samochody','Browse cars'),'btn primary','search'),'message')), 'inbox-page')};
}
export function threadMessages(ctx,data) {
  const t=ctx.t,{items,c}=data;
  return items.map(m=>`<article class="bubble ${m.mine?'mine':'theirs'}"><div class="prose">${e(m.body)}</div>
    ${m.proposed_at?`<div class="proposal"><b>${e(localized(ctx,'proposal',m.proposal_status))}</b><time datetime="${e(m.proposed_at)}">${e(day(ctx,m.proposed_at,true))}</time>
      ${m.proposal_status==='proposed' && !data.blocked && c.seller_id===ctx.user.id && new Date(m.proposed_at).getTime()>Date.now()?
        `<div class="inline">${[['accepted',t('Potwierdź','Confirm')],['declined',t('Odrzuć termin','Decline')]].map(([status,label])=>apiForm('/messages/'+c.id+'/proposal',
          hidden('message',m.id)+hidden('status',status)+submit(label,'','btn small'),{reload:true})).join('')}</div>`:''}</div>`:''}
    <small><time datetime="${e(m.created_at)}">${e(day(ctx,m.created_at,true))}</time>${m.mine&&m.seen_at?' · '+t('Przeczytano','Read'):''}</small>
  </article>`).join('');
}
export function threadPage(ctx,data) {
  const t=ctx.t,{c,blocked,blockedByMe}=data;
  const title=c.make+' '+c.model;
  const publicListing=['published','sold'].includes(c.status);
  const peer=c.buyer_id===ctx.user.id?c.seller_name:c.buyer_name;
  return {title:t('Rozmowa','Conversation')+' · '+title,body:wrap(pageHead(title,peer,link(ctx,'/wiadomosci',t('Wiadomości','Messages'),'btn','back'))+
    `<section class="panel chat" data-thread="${e(c.id)}"><div class="chat-head"><div>${tag(ctx,c.status)} ${publicListing?link(ctx,'/oferta/'+c.slug,t('Zobacz ogłoszenie','View listing'),'text-link','arrow'):''}</div>
      <button class="btn small" type="button" data-refresh-thread>${t('Odśwież','Refresh')}</button></div>
      <div class="bubbles" data-bubbles aria-live="polite">${threadMessages(ctx,data)}</div>
      ${blocked?flash(t('Kontakt jest zablokowany lub niedostępny.','This contact is blocked or unavailable.'),'warn'):
        apiForm('/messages/'+c.id,keyInput()+area('body',t('Napisz wiadomość','Write a message'),'',{required:true,rows:3,attributes:'maxlength="3000" data-message-body'})+submit(t('Wyślij','Send'),'arrow'),{go:'reply',success:t('Wysłano.','Sent.')})}
      <div class="inline chat-actions"><button class="text-link" data-open="report" type="button">${icon('flag',17)}${t('Zgłoś nadużycie','Report abuse')}</button>
        ${!blocked||blockedByMe?apiForm('/messages/'+c.id+'/block',hidden('blocked',blockedByMe?'0':'1')+submit(blockedByMe?t('Odblokuj kontakt','Unblock contact'):t('Zablokuj kontakt','Block contact'),'','btn small'),{reload:true}):''}</div></section>
    ${reportDialog(ctx,'message',c.id)}`)};
}

export function noticesPage(ctx,items) {
  const t=ctx.t;
  const notices=items.map(n=>{
    const messages={import_distribution:t('Kanał odrzucił ogłoszenie','A channel rejected a listing'),message:t('Nowa wiadomość','New message'),pending:t('Ogłoszenie wysłano do moderacji','Listing submitted for review'),
      published:t('Ogłoszenie zaakceptowane','Listing approved'),rejected:t('Ogłoszenie odrzucone','Listing rejected'),
      held:t('Ogłoszenie wstrzymane','Listing paused'),sold:t('Oznaczono jako sprzedane','Marked as sold'),archived:t('Ogłoszenie zarchiwizowane','Listing archived'),
      viewing:n.data.status==='accepted'?t('Sprzedawca potwierdził oględziny','The seller confirmed the viewing'):t('Sprzedawca odrzucił termin oględzin','The seller declined the viewing'),report:t('Rozpatrzono zgłoszenie','Report resolved')};
    const orderStatus={requested:t('Nowe zamówienie robota','New robot order'),accepted:t('Zamówienie potwierdzone','Order confirmed'),rejected:t('Zamówienie odrzucone','Order declined'),cancelled:t('Zamówienie anulowane','Order cancelled'),completed:t('Zamówienie zrealizowane','Order completed')};
    const title=n.kind==='robot-order'?(orderStatus[n.data.status]||t('Aktualizacja zamówienia','Order update')):messages[n.kind]||t('Powiadomienie','Notification');
    const next=n.kind==='robot-order'&&n.data.order?'/roboty/zamowienia/'+n.data.order:n.data.thread?'/wiadomosci/'+n.data.thread:n.data.listingId?'/podglad/'+n.data.listingId:'';
    return `<article class="panel notice ${n.read_at?'':'unread'}"><span class="mini-icon">${icon(n.kind==='message'?'message':'bell',21)}</span><div>
      <strong>${next?`<a href="${e(href(ctx,next))}">${e(title)}</a>`:e(title)}</strong>${n.data.reason?`<p>${e(n.data.reason)}</p>`:''}
      <small>${e(day(ctx,n.created_at,true))}</small></div></article>`;
  }).join('');
  return {title:t('Powiadomienia','Notifications'),body:wrap(pageHead(t('Powiadomienia','Notifications'),'',items.some(n=>!n.read_at)?
    apiForm('/notifications/read',submit(t('Oznacz wszystkie jako przeczytane','Mark all as read'),'check','btn'),{reload:true}):'')+
    `<div class="listing-stack">${notices||empty(ctx,t('Brak powiadomień','No notifications'),'','','bell')}</div>`, 'notifications-page')};
}

function importReport(ctx,items) {
  const t=ctx.t;
  return items.length?`<div class="table-scroll" tabindex="0"><table><thead><tr><th>${t('Wiersz','Row')}</th><th>ID</th><th>${t('Samochód','Vehicle')}</th><th>${t('Wynik','Result')}</th></tr></thead>
    <tbody>${items.map(x=>`<tr><td>${e(x.line)}</td><td>${e(x.externalId)}</td><td>${e([x.make,x.model].filter(Boolean).join(' '))}</td>
    <td>${x.error?e(x.error):x.listingId?`<a href="${href(ctx,'/podglad/'+e(x.listingId))}">${x.status==='published'?t('Opublikowano','Published'):x.status==='pending'?t('W moderacji','In review'):t('Otwórz ofertę','Open listing')}</a>`:t('Gotowy','Ready')}</td></tr>`).join('')}</tbody></table></div>`:'';
}
export async function dealerPage(ctx,imports) {
  const t=ctx.t;
  const firm=await row(ctx.db,'SELECT name,address,hours,description,logo_key FROM companies WHERE user_id=?',ctx.user.id);
  const name=firm?.name||ctx.user.name;
  const importHead=panel(t('Import z pliku CSV','Import from CSV'),`<p>${(ctx.robotics?t('Wgraj do 25 robotów na plik. Użyj stałego ID sprzętu i tej samej nazwy źródła, aby aktualizować oferty. Szablon zawiera pola sprzedaży i wynajmu.','Upload up to 25 robots per file. Reuse equipment IDs and the source name to update listings. The template contains sale and rental fields.'):t('Wgraj do 25 wierszy na plik. Użyj stałego ID pojazdu i tej samej nazwy źródła, aby aktualizować oferty. Brak wiersza w nowym pliku nie usuwa pojazdu.','Upload up to 25 rows per file. Reuse a vehicle ID and source name to update an existing listing. Missing rows do not delete listings.'))}</p>
    <div class="inline"><a class="btn" href="${href(ctx,'/api/dealer/template')+(ctx.robotics?'?market=robotics':'')}">${icon('download',18)}${t('Pobierz wzór CSV','Download CSV template')}</a></div>
    <details><summary>${t('Zdjęcia i dozwolone źródła','Photos and approved sources')}</summary><p>${t('Podaj do czterech adresów rozdzielonych znakiem |. Dozwolone są adresy zdjęć własnych ofert (/media/ID) i zatwierdzone domeny HTTPS. Pierwszy import auta wymaga zdjęcia.','Enter up to four addresses separated by |. You can use your own listing photos (/media/ID) and approved HTTPS domains. A vehicle’s first import needs a photo.')}</p>
    ${ctx.demo?`<p>${t('Ścieżka zdjęcia do testu','Test photo path')} <code>/assets/vehicle-2.webp</code></p>`:''}</details>
    <form method="post" class="stack import-form" data-import data-market="${ctx.robotics?'robotics':'vehicles'}" data-fields="${embed(ctx.robotics?robotCsvFields:csvFields)}">${keyInput()}
      <div class="field-grid">${field('source',t('Nazwa źródła','Source name'),'',{required:true,attributes:'maxlength="80"'})}
      ${field('file',t('Plik CSV','CSV file'),'',{type:'file',required:true,attributes:'accept=".csv,text/csv"'})}</div>
      ${check('rights',t('Mam prawo do użycia tych danych i zdjęć.','I have the right to use this data and photos.'),false,true)}
      <details data-mapping hidden><summary>${t('Mapowanie kolumn','Map columns')}</summary><div class="field-grid" data-columns></div></details>
      <div class="inline">${submit(t('Sprawdź plik','Preview file'),'search')}<button type="button" class="btn primary" data-import-commit hidden>${icon('upload',18)}${t('Zatwierdź import','Confirm import')}</button></div>
      ${formStatus}<div data-import-report></div></form>`);
  const history=panel(t('Historia importów','Import history'),imports.length?`<div class="stack">${imports.map(x=>`<details><summary>${e(x.filename)} · ${e(day(ctx,x.created_at,true))} · ${x.valid}/${x.total}
    ${x.state==='running'?' · '+t('W trakcie lub przerwany','Running or interrupted'):''}</summary><p>${t('Źródło','Source')} · ${e(x.source)}</p>${importReport(ctx,x.report)}</details>`).join('')}</div>`:
    `<p class="muted">${t('Historia pojawi się po pierwszym imporcie.','Import history will appear after your first import.')}</p>`);
  return {title:t('Panel dealera','Dealer dashboard'),body:wrap(pageHead(t('Panel dealera','Dealer dashboard'),name,link(ctx,'/konto',t('Konto','Account'),'btn','back'))+
    `<div class="settings-stack">${panel(t('Wizytówka firmy','Business profile'),`<p>${e(firm?.address)}${firm?.hours?' · '+e(firm.hours):''}</p><div class="inline">${link(ctx,'/ustawienia',t('Edytuj wizytówkę','Edit profile'),'btn','edit')}
      ${link(ctx,'/dealer/'+ctx.user.id,t('Otwórz wizytówkę','View profile'),'btn','arrow')}${link(ctx,'/moje-ogloszenia',t('Moje ogłoszenia','My listings'),'btn','car')}</div>`)}${await manageReels(ctx)}${ctx.robotics?'':panel(t('Import i automatyzacja','Import and automation'),link(ctx,'/moje-ogloszenia/import',t('Podłącz źródło ofert','Connect a listing source'),'btn','upload'))}${importHead}${history}</div>`)};
}
