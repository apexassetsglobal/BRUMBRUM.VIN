import { searchCombobox } from '/assets/search-combobox.js?v=1';
const root=document.body;
const {prefix,user,lang}=root.dataset;
const translations=['cs','sk','de','uk'].includes(lang)
  ? await import(`/assets/locales/${lang}.js?v=1`).then(module=>module.default,()=>null)
  : null;
const t=(pl,english)=>lang==='pl'?pl:translations&&Object.hasOwn(translations,english)?translations[english]:english;
const $=(selector,within=document)=>within.querySelector(selector);
const $$=(selector,within=document)=>Array.from(within.querySelectorAll(selector));
const languagePicker=$('#language-picker');
if (languagePicker) {
  let languageTrigger;
  for (const button of $$('[data-language-open]')) button.addEventListener('click',()=>{
    languageTrigger=button;
    for (const link of $$('.language-option',languagePicker)) link.hash=location.hash;
    languagePicker.showModal();
    $('[aria-current=true]',languagePicker)?.focus();
  });
  languagePicker.addEventListener('close',()=>languageTrigger?.focus());
}
const localPath=path=>prefix+(root.dataset.market==='robotics'&&!/^\/(?:api|assets|asset|media|wideo|rolka)(?:\/|$)/.test(path)?'/roboty':'')+path;
const apiPath=path=>localPath('/api'+path);
const isId=value=>/^[a-z0-9][a-z0-9_-]{2,90}$/i.test(value);
const fallbackError=()=>t('Operacja się nie powiodła. Ponów próbę.','The operation failed. Try again.');
const networkError=()=>t('Brak połączenia. Dane formularza są nadal na ekranie.','Connection unavailable. Your form data is still on screen.');
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback;}catch{return fallback;}};
const scoped=prefix?'demo':'live';
const keys={favorite:'a4-saved-'+scoped,compare:'a4-compare-'+scoped+(root.dataset.market==='robotics'?'-robotics':''),accountButtons:'a4-account-buttons',accountHover:'a4-account-hover',accountPress:'a4-account-press',menuSound:'a4-menu-sound',
  iconStyle:'a4-icon-style',iconSurface:'a4-icon-surface',accountTextSize:'a4-account-text-size',buttonFinish:'a4-button-finish'};
const local={
  get(key) {try{return localStorage.getItem(key);}catch{return null;}},
  set(key,value) {try{localStorage.setItem(key,value);}catch{}},
  clear(key) {try{localStorage.removeItem(key);}catch{}}
};
const selection=key=>{
  const result=parse(local.get(key),[]);
  if (!Array.isArray(result)) return [];
  const ids=result.filter(isId);
  if (prefix&&user) return ids.map(item=>item.startsWith('demo-seed-car-')?user.replace(/-[^-]+$/,'')+item.slice('demo-seed'.length):item);
  return ids;
};
const saveSelection=(key,items)=>local.set(key,JSON.stringify([...new Set(items)]));
const profileForm=$('#account-profile');
const profileFeedback=profileForm?$$('[data-form-feedback] [data-form-status]'):[];

async function request(path,settings={}) {
  let response;
  const {method='GET',data,body,headers={},...other}=settings;
  const payload=data===undefined?body:JSON.stringify(data);
  try {
    response=await fetch(apiPath(path),{method,headers:{Accept:'application/json',...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},
      body:payload,credentials:'same-origin',cache:'no-store',...other});
  } catch { throw new Error(networkError()); }
  const result=await response.json().catch(()=>null);
  if (!response.ok || !result?.ok) {
    const error=new Error(result?.error||fallbackError());
    error.fields=result?.fields;
    error.status=response.status;
    throw error;
  }
  return result;
}
async function fragment(path) {
  const response=await fetch(localPath('/fragment/'+path),{cache:'no-store',credentials:'same-origin'});
  if (!response.ok) throw new Error(fallbackError());
  return response.text();
}
function report(node,message,error=false) {
  if (!node) return;
  node.textContent=message||'';
  node.classList.toggle('bad',error);
}
let toastTimer;
function toast(message,error=false) {
  const node=$('[data-toast]');
  report(node,message,error);
  node.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{node.hidden=true;},4200);
}
function formData(form,submitter) {
  const data=Object.fromEntries(new FormData(form,submitter));
  for (const control of form.elements) {
    if (control.type==='checkbox'&&control.name&&!control.checked&&!control.matches(':disabled')) data[control.name]=false;
  }
  for (const date of $$('input[type=datetime-local]',form)) {
    if (date.value) data[date.name]=date.hasAttribute('data-utc-field')?date.value+':00Z':new Date(date.value).toISOString();
  }
  return data;
}
const fieldLabels={
  robotCategory:t('kategoria robota','robot category'),tradeMode:t('rodzaj oferty','offer type'),stock:t('pula sztuk','unit pool'),rentalPrice:t('stawka najmu','rental rate'),rentalUnit:t('okres rozliczeniowy','billing period'),minimumRental:t('minimalny okres najmu','minimum rental period'),currency:t('waluta','currency'),country:t('kraj','country'),photos:t('zdjęcia','photos'),make:t('marka','make'),model:t('model','model'),type:t('rodzaj pojazdu','vehicle type'),body:t('nadwozie lub odmiana','body style or variant'),
  fuel:t('paliwo','fuel'),gearbox:t('skrzynia biegów','transmission'),drive:t('napęd','drivetrain'),condition:t('stan','condition'),damage:t('uszkodzenia','damage'),
  year:t('rocznik','year'),mileage:t('przebieg','mileage'),power:t('moc','power'),price:t('cena końcowa','final price'),city:t('miejscowość','city'),
  region:t('region','region'),description:t('opis','description'),registered:t('data rejestracji','registration date'),netPrice:t('cena netto','net price'),contact:t('kontakt','contact'),listingPhone:t('numer telefonu','phone number'),
  hours:t('motogodziny','operating hours'),grossWeight:t('DMC','gross vehicle weight'),axles:t('liczba osi','number of axles')
};
const errorText=err=>err.message+(err.fields?.length?' '+err.fields.map(key=>fieldLabels[key]||key).join(', ')+'.':'');
async function genericForm(event,form) {
  event.preventDefault();
  if (form.dataset.busy==='1') return;
  if (form.dataset.confirm&&!window.confirm(form.dataset.confirm)) return;
  const isProfile=form===profileForm;
  const section=isProfile?event.submitter?.closest('[data-settings-panel]'):null;
  const status=$('[data-form-status]',section||form);
  const buttons=Array.from(form.elements).filter(control=>control.type==='submit'&&!control.disabled);
  const payload=formData(form,event.submitter);
  form.dataset.busy='1';
  buttons.forEach(x=>{x.disabled=true;});
  if (isProfile) profileFeedback.forEach(node=>report(node,''));
  report(status,t('Zapisywanie…','Saving…'));
  try {
    const result=await request(form.dataset.api,{method:form.dataset.method||'POST',data:payload});
    const go=form.dataset.go;
    if (result.next) {location.assign(result.next);return;}
    if (go==='listing-submitted') {location.assign(localPath('/moje-ogloszenia?wyslano='+encodeURIComponent(result.listingId)));return;}
    if (go==='thread') {location.assign(localPath('/wiadomosci/'+result.thread));return;}
    if (form.hasAttribute('data-reload')) {
      if (isProfile) {
        const url=new URL(location.href);
        if (url.searchParams.has('lang')) url.searchParams.set('lang',form.elements.lang.value);
        if (section) url.hash=section.id;
        try {
          sessionStorage.setItem('a4-profile-saved',url.pathname+url.hash);
          sessionStorage.setItem('a4-profile-branches',JSON.stringify($$('[data-settings-panel][open]').map(branch=>branch.id)));
        } catch {}
        history.replaceState(history.state,'',url);
      }
      location.reload();return;
    }
    if (go==='reset-form') form.reset();
    if (go==='reported') {form.reset();form.closest('dialog')?.close();toast((form.dataset.success||t('Zapisano.','Saved.'))+' '+result.id);}
    if (go==='reply') {
      form.elements.body.value='';
      form.elements.key.value=crypto.randomUUID();
      await refreshThread(true);
    }
    report(status,form.dataset.success||t('Zapisano.','Saved.'));
  } catch (err) {report(status,errorText(err),true);}
  finally {form.dataset.busy='';buttons.forEach(x=>{x.disabled=false;});}
}
async function uploadReel(event,form) {
  event.preventDefault();
  if (form.dataset.busy==='1') return;
  const status=$('[data-form-status]',form);
  const file=form.elements.video.files[0];
  if (!file) return;
  if (file.size>24*1024*1024) {
    report(status,t('Wybierz film do 24 MB.','Choose a video up to 24 MB.'),true);
    return;
  }
  const button=$('button[type=submit]',form);
  form.dataset.busy='1';
  button.disabled=true;
  report(status,t('Przesyłanie rolki…','Uploading reel…'));
  try {
    const result=await request('/reels',{method:'POST',body:file,headers:{
      'X-Reel-Caption':encodeURIComponent(form.elements.caption.value),
      'X-Reel-Listing':form.elements.listing?.value||'',
      'X-Reel-Market':form.dataset.market||'vehicles'
    }});
    history.replaceState(history.state,'',result.next);
    location.reload();
  } catch (error) {
    report(status,errorText(error),true);
  } finally {
    form.dataset.busy='';
    button.disabled=false;
  }
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if (form.matches('[data-reel-upload]')) uploadReel(event,form);
  if (form.matches('[data-api]')) genericForm(event,form);
  if (form.matches('[data-search-form]')) {
    event.preventDefault();
    const url=new URL(form.action);
    const values=new FormData(form,event.submitter);
    const category=String(values.get('category')??'');
    const [type,body]=category.split(':');
    values.delete('category');
    if (type) values.set('type',type);
    if (body&&(category!=='trailer:semi_trailer'||!values.get('body'))) values.set('body',body);
    for (const [key,value] of values) if (String(value).trim() && !(key==='sort'&&value==='latest')) url.searchParams.set(key,String(value).trim());
    location.assign(url);
  }
});

function paintAccountTextSize(value) {
  const size=['large','extra'].includes(value)?value:'standard';
  document.documentElement.dataset.accountTextSize=size;
  for (const choice of $$('[data-account-text-choice]')) choice.checked=choice.value===size;
}
paintAccountTextSize(local.get(keys.accountTextSize));
for (const choice of $$('[data-account-text-choice]')) choice.addEventListener('change',()=>{
  local.set(keys.accountTextSize,choice.value);
  paintAccountTextSize(choice.value);
});
function paintAccountButtons(value) {
  const mode=['outline','text'].includes(value)?value:'buttons';
  document.documentElement.dataset.accountButtons=mode;
  for (const option of $$('button[data-account-buttons]')) option.setAttribute('aria-pressed',String(option.dataset.accountButtons===mode));
}
paintAccountButtons(local.get(keys.accountButtons));
for (const option of $$('button[data-account-buttons]')) option.addEventListener('click',()=>{
  const mode=option.dataset.accountButtons;
  local.set(keys.accountButtons,mode);
  paintAccountButtons(mode);
});
const buttonColors=['auto','blue','green','gold','purple','gray'];
for (const [state,key,attribute] of [['hover',keys.accountHover,'accountHover'],['press',keys.accountPress,'accountPress']]) {
  const pickers=$$(`[data-account-button-color="${state}"]`);
  const paint=value=>{
    const color=buttonColors.includes(value)?value:'auto';
    document.documentElement.dataset[attribute]=color;
    for (const picker of pickers) picker.value=color;
  };
  paint(local.get(key));
  for (const picker of pickers) picker.addEventListener('change',()=>{
    local.set(key,picker.value);
    paint(picker.value);
  });
  window.addEventListener('storage',event=>{
    if (event.key===key||event.key===null) paint(local.get(key));
  });
  document.documentElement.addEventListener('reset-account-colors',()=>paint('auto'));
}
window.addEventListener('storage',event=>{
  if (event.key===keys.accountButtons||event.key===null) paintAccountButtons(local.get(keys.accountButtons));
  if (event.key===keys.accountTextSize||event.key===null) paintAccountTextSize(local.get(keys.accountTextSize));
});

function revealSettingsPanel() {
  const panel=document.getElementById(location.hash.slice(1));
  if (panel?.matches('details[data-settings-panel]')) panel.open=true;
  return panel;
}
if (profileForm) {
  const opened=revealSettingsPanel();
  try {
    if (opened&&sessionStorage.getItem('a4-profile-saved')===location.pathname+location.hash) {
      for (const id of JSON.parse(sessionStorage.getItem('a4-profile-branches')||'[]')) {
        const branch=document.getElementById(id);
        if (branch?.matches('details[data-settings-panel]')) branch.open=true;
      }
      sessionStorage.removeItem('a4-profile-branches');
      report($('[data-form-status]',opened),t('Zapisano ustawienia.','Settings saved.'));
      sessionStorage.removeItem('a4-profile-saved');
    }
  } catch {}
  window.addEventListener('hashchange',revealSettingsPanel);
  document.addEventListener('invalid',event=>{
    if (event.target.form!==profileForm) return;
    const panel=event.target.closest('[data-settings-panel]');
    if (panel) panel.open=true;
  },true);
}

const iconStyleDialog=$('#icon-style-dialog');
const iconSettings=iconStyleDialog||$('[data-icon-settings]');
if (iconSettings) {
  const styles=$$('input[name="icon-style"]',iconSettings);
  const iconBoard=$('[data-icon-board]',iconSettings);
  const boardName=$('[data-icon-board-name]',iconBoard);
  const boardCount=$('[data-icon-board-count]',iconBoard);
  const boardApply=$('[data-icon-board-apply]',iconBoard);
  const boardUse=$('[data-icon-board-use]',boardApply);
  const boardActive=$('[data-icon-board-active]',boardApply);
  let previewIndex=0;
  let startGesture=null;
  function showIconPreview(index) {
    previewIndex=(index+styles.length)%styles.length;
    const option=styles[previewIndex];
    const active=option.value===document.documentElement.dataset.iconStyle;
    option.checked=true;
    iconBoard.dataset.iconStyle=option.value;
    boardName.textContent=option.parentElement.textContent.trim();
    boardCount.textContent=`${previewIndex+1} / ${styles.length}`;
    boardApply.disabled=active;
    boardUse.hidden=active;
    boardActive.hidden=!active;
  }
  function applyIconStyle(value) {
    const selected=styles.find(option=>option.value===value)||styles.find(option=>option.defaultChecked);
    document.documentElement.dataset.iconStyle=selected.value;
    showIconPreview(styles.indexOf(selected));
  }
  function selectIconStyle(value) {
    applyIconStyle(value);
    local.set(keys.iconStyle,value);
  }
  for (const step of $$('[data-icon-board-step]',iconBoard)) {
    step.addEventListener('click',()=>showIconPreview(previewIndex+Number(step.dataset.iconBoardStep)));
  }
  boardApply.addEventListener('click',()=>selectIconStyle(styles[previewIndex].value));
  iconBoard.addEventListener('keydown',event=>{
    if (event.key!=='ArrowLeft'&&event.key!=='ArrowRight') return;
    event.preventDefault();
    showIconPreview(previewIndex+(event.key==='ArrowRight'?1:-1));
  });
  iconBoard.addEventListener('pointerdown',event=>{
    if (event.pointerType!=='touch'||!event.isPrimary||event.target.closest('button')) return;
    startGesture={id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  iconBoard.addEventListener('pointercancel',()=>{startGesture=null;});
  iconBoard.addEventListener('pointerup',event=>{
    if (event.pointerId!==startGesture?.id) return;
    const dx=event.clientX-startGesture.x;
    const dy=event.clientY-startGesture.y;
    startGesture=null;
    if (Math.abs(dx)>=48&&Math.abs(dx)>1.5*Math.abs(dy)) {
      showIconPreview(previewIndex+(dx<0?1:-1));
    }
  });
  const surfaces=$$('input[name="icon-surface"]',iconSettings);
  function applyIconSurface(value) {
    const selected=surfaces.find(option=>option.value===value)||surfaces[0];
    document.documentElement.dataset.iconSurface=selected.value;
    selected.checked=true;
  }
  function restoreIconSettings() {
    applyIconSurface(local.get(keys.iconSurface));
    applyIconStyle(local.get(keys.iconStyle));
  }
  local.clear('a4-icon-overrides');
  restoreIconSettings();
  document.documentElement.addEventListener('reset-icon-preferences',restoreIconSettings);
  window.addEventListener('pageshow',event=>{
    if (event.persisted) restoreIconSettings();
  });
  for (const trigger of $$('[data-icon-style-open]')) {
    if (!iconStyleDialog) {
      trigger.removeAttribute('aria-haspopup');
      trigger.setAttribute('aria-controls','wyglad-ikon');
    }
    trigger.addEventListener('click',()=>{
      if (iconStyleDialog) {
        iconStyleDialog.showModal();
        $('.appearance-menu',iconStyleDialog).scrollTop=0;
      } else {
        const panel=iconSettings.closest('details');
        panel.open=true;
        panel.querySelector('summary').focus({preventScroll:true});
        panel.scrollIntoView({block:'start'});
      }
    });
  }
  iconSettings.addEventListener('click',event=>{
    // A card already checked by the preview can be applied without a radio change event.
    const preview=styles[previewIndex];
    if (event.target===preview&&preview.value!==document.documentElement.dataset.iconStyle) {
      selectIconStyle(preview.value);
    }
  });
  iconSettings.addEventListener('change',event=>{
    if (surfaces.includes(event.target)) {
      applyIconSurface(event.target.value);
      local.set(keys.iconSurface,event.target.value);
    }
    if (!styles.includes(event.target)) return;
    selectIconStyle(event.target.value);
  });
  window.addEventListener('storage',event=>{
    if (event.key===keys.iconSurface||event.key===null) applyIconSurface(local.get(keys.iconSurface));
    if (event.key===keys.iconStyle||event.key===null) applyIconStyle(local.get(keys.iconStyle));
  });
}

const sideNav=$('[data-side-nav]');
if (sideNav) {
  const toggle=$('[data-side-toggle]',sideNav);
  const toggleLabel=$('[data-side-toggle-label]',sideNav);
  const themePicker=$('[data-side-theme-picker]',sideNav);
  const profileTriggers=$$('[data-profile-menu-toggle]');
  const itemSelector='a[href],button,summary';
  const menuItems=$$(itemSelector,sideNav);
  const captions=menuItems.map(item=>$('span:not(.count)',item)).filter(Boolean);
  const railLayout=matchMedia('(min-width:1041px) and (hover:hover) and (pointer:fine), (min-width:768px) and (min-height:480px) and (orientation:landscape)');
  let opener=null,pinned=false,hoverOpen=false,captionItem=null,touchPreview=null,openingSlide=null;

  function sizeCaptions() {
    const labels=sideNav.hasAttribute('data-side-open')?captions:captions.filter(label=>label.parentElement===captionItem);
    const widest=Math.max(0,...labels.map(label=>label.getBoundingClientRect().width));
    document.body.style.setProperty('--profile-caption-space',Math.ceil(widest)+'px');
  }

  function showCaption(item) {
    if (captionItem===item) return;
    captionItem?.removeAttribute('data-side-caption');
    captionItem=item;
    item?.setAttribute('data-side-caption','');
    if (!sideNav.hasAttribute('data-side-open')) sizeCaptions();
  }

  function updateSideNav() {
    const visible=railLayout.matches||Boolean(opener);
    const expanded=visible&&(pinned||hoverOpen||Boolean(themePicker?.open));
    sideNav.toggleAttribute('data-side-visible',visible);
    sideNav.toggleAttribute('data-side-open',expanded);
    sideNav.inert=!visible;
    if (visible) sideNav.removeAttribute('aria-hidden');
    else sideNav.setAttribute('aria-hidden','true');
    for (const trigger of profileTriggers) trigger.setAttribute('aria-expanded',String(railLayout.matches?expanded:visible));
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?t('Zwiń menu','Collapse menu'):t('Rozwiń menu','Expand menu'));
    if (toggleLabel) toggleLabel.textContent=expanded?t('Zwiń menu','Collapse menu'):t('Rozwiń menu','Expand menu');
    sizeCaptions();
  }
  function closeSideNav(restoreFocus=false) {
    const trigger=opener;
    opener=null;
    pinned=false;
    hoverOpen=false;
    touchPreview=openingSlide=null;
    showCaption(null);
    sideNav.removeAttribute('data-side-ready');
    if (themePicker) themePicker.open=false;
    if (restoreFocus) trigger?.focus({preventScroll:true});
    updateSideNav();
  }
  function toggleProfileMenu(event) {
    if (event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    if (opener) {closeSideNav(true);return;}
    opener=event.currentTarget;
    updateSideNav();
    $('.side-nav-panel',sideNav).scrollTop=0;
    const links=$('.side-nav-links',sideNav);
    if (links) links.scrollTop=0;
    toggle.focus({preventScroll:true});
    // Wait for the icon strip to land before revealing even an early tap or hover.
    const slide=sideNav.getAnimations?.().find(animation=>animation.transitionProperty==='transform');
    openingSlide=slide;
    const ready=()=>{
      if (opener&&openingSlide===slide) sideNav.setAttribute('data-side-ready','');
    };
    if (slide) slide.finished.then(ready,ready);
    else ready();
  }
  for (const trigger of profileTriggers) {
    trigger.setAttribute('role','button');
    trigger.addEventListener('click',toggleProfileMenu);
    trigger.addEventListener('keydown',event=>{
      if (event.key===' '&&!event.repeat) toggleProfileMenu(event);
    });
  }
  if (window.ResizeObserver) {
    const observer=new window.ResizeObserver(sizeCaptions);
    for (const label of captions) observer.observe(label);
  } else window.addEventListener('resize',sizeCaptions);
  for (const item of menuItems) {
    item.addEventListener('pointerenter',event=>{
      if (opener&&event.pointerType==='mouse') showCaption(item);
    });
    item.addEventListener('pointerleave',event=>{
      if (event.pointerType==='mouse'&&captionItem===item) showCaption(null);
    });
  }
  sideNav.addEventListener('focusin',event=>{
    const item=event.target.closest(itemSelector);
    if (item?.matches(':focus-visible')&&(item!==toggle||sideNav.hasAttribute('data-side-ready'))) showCaption(item);
  });
  sideNav.addEventListener('focusout',event=>{
    if (captionItem===event.target) showCaption(null);
    if (sideNav.contains(event.relatedTarget)) return;
    if (event.relatedTarget&&!event.relatedTarget.closest('[data-profile-menu-toggle]')&&!$('dialog[open]')) closeSideNav();
  });
  toggle.addEventListener('click',()=>{
    if (sideNav.hasAttribute('data-side-open')) {
      pinned=false;
      if (themePicker) themePicker.open=false;
    } else pinned=true;
    showCaption(null);
    updateSideNav();
  });
  sideNav.addEventListener('pointerenter',event=>{
    if (!railLayout.matches||event.pointerType!=='mouse') return;
    hoverOpen=true;
    sideNav.setAttribute('data-side-ready','');
    updateSideNav();
  });
  sideNav.addEventListener('pointerleave',event=>{
    if (!railLayout.matches||event.pointerType!=='mouse'||pinned||sideNav.contains(event.relatedTarget)) return;
    hoverOpen=false;
    if (themePicker) themePicker.open=false;
    sideNav.removeAttribute('data-side-ready');
    showCaption(null);
    updateSideNav();
  });
  themePicker?.addEventListener('toggle',updateSideNav);
  sideNav.addEventListener('pointerdown',event=>{
    const item=event.target.closest(itemSelector);
    const touch=event.pointerType==='touch'||event.pointerType==='pen';
    touchPreview=touch&&item!==toggle&&captionItem!==item&&!sideNav.hasAttribute('data-side-open')?item:null;
  });
  sideNav.addEventListener('pointercancel',()=>{touchPreview=null;});
  // Capture the first tap before a link navigates or a button opens a dialog.
  sideNav.addEventListener('click',event=>{
    const item=touchPreview;
    touchPreview=null;
    if (!item||!event.detail||!item.contains(event.target)||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    showCaption(item);
  },true);
  sideNav.addEventListener('click',event=>{
    const action=event.target.closest('a[href],button');
    if (!action||action===toggle) return;
    const dialog=$('dialog[open]');
    const trigger=opener;
    if (dialog) dialog.addEventListener('close',()=>{
      if (!opener) trigger?.focus({preventScroll:true});
    },{once:true});
    closeSideNav(!dialog);
  });
  document.addEventListener('pointerdown',event=>{
    if (!opener||$('dialog[open]')||sideNav.contains(event.target)||event.target.closest('[data-profile-menu-toggle]')) return;
    closeSideNav();
  });
  document.addEventListener('keydown',event=>{
    if (event.key!=='Escape'||event.defaultPrevented||!opener||$('dialog[open]')) return;
    event.preventDefault();
    closeSideNav(true);
  });
  railLayout.addEventListener('change',()=>{
    const restore=sideNav.contains(document.activeElement);
    closeSideNav();
    if (restore) profileTriggers.find(trigger=>trigger.getClientRects().length)?.focus({preventScroll:true});
  });
  window.addEventListener('pageshow',()=>closeSideNav());
  updateSideNav();

  const Audio=window.AudioContext||window.webkitAudioContext;
  if (Audio) {
    const sound=$('[data-side-sound]',sideNav);
    let enabled=local.get(keys.menuSound)!=='off';
    let audio,lastNote=-Infinity;
    function unlockSound() {
      if (!enabled||!sideNav.getClientRects().length||audio?.state==='running') return;
      try {
        audio??=new Audio();
        audio.resume().catch(()=>{});
      } catch {}
    }
    sound.hidden=false;
    sound.setAttribute('aria-pressed',String(enabled));
    sound.addEventListener('click',()=>{
      enabled=!enabled;
      local.set(keys.menuSound,enabled?'on':'off');
      sound.setAttribute('aria-pressed',String(enabled));
      unlockSound();
    });
    document.addEventListener('pointerup',unlockSound,{passive:true});
    document.addEventListener('keydown',unlockSound);
    for (const item of menuItems) item.addEventListener('pointerenter',event=>{
      if (!enabled||event.pointerType!=='mouse'||audio?.state!=='running') return;
      const time=audio.currentTime;
      if (time-lastNote<.075) return;
      lastNote=time;
      const tone=audio.createOscillator();
      const volume=audio.createGain();
      tone.type='triangle';
      tone.frequency.setValueAtTime(850,time);
      tone.frequency.exponentialRampToValueAtTime(440,time+.045);
      volume.gain.setValueAtTime(.0001,time);
      volume.gain.linearRampToValueAtTime(.035,time+.004);
      volume.gain.exponentialRampToValueAtTime(.0001,time+.055);
      tone.connect(volume).connect(audio.destination);
      tone.start(time);
      tone.stop(time+.06);
    });
  }
}

for (const form of $$('[data-search-form]')) {
  const type=$('[data-filter-type]',form);
  const body=$('[data-filter-body]',form);
  const make=$('[data-filter-make]',form);
  const model=$('[data-filter-model]',form);
  const catalogData=$('[data-catalog]',form)?.dataset;
  const catalog=parse(catalogData?.catalog,{});
  const bodyOptions=parse(catalogData?.bodyOptions,{});
  if (!type||!make||!model) continue;
  const suggestionLabels={noResults:t('Brak pasujących wyników','No matches')};
  const syncMake=searchCombobox(make,suggestionLabels);
  const syncModel=searchCombobox(model,suggestionLabels);
  const makesForType=()=>Object.hasOwn(catalog,type.value)?catalog[type.value]:{};
  function setChoices(select,names,placeholder) {
    const previous=select.value;
    select.replaceChildren(new Option(placeholder,''),...names.map(name=>new Option(name,name)));
    if (names.includes(previous)) select.value=previous;
  }
  function updateModels() {
    const makes=makesForType();
    const names=Object.hasOwn(makes,make.value)?makes[make.value]:[];
    model.disabled=!make.value||!names.length;
    const hint=!make.value?t('Wybierz markę','Choose a brand'):
      names.length?t('Każdy model','All models'):t('Brak modeli na liście','No models listed');
    setChoices(model,names,hint);
    syncModel();
  }
  function updateMakes() {
    const names=Object.keys(makesForType());
    make.disabled=!names.length;
    setChoices(make,names,names.length?t('Wszystkie marki','All brands'):t('Brak marek na liście','No brands listed'));
    syncMake();
    updateModels();
  }
  function updateBodies() {
    if (!body) return;
    const key=Object.hasOwn(bodyOptions,type.value)?type.value:type.value.split(':')[0];
    const choices=Object.hasOwn(bodyOptions,key)?bodyOptions[key]:bodyOptions[''];
    if (!choices) return;
    const hint=body.options[0].text;
    body.replaceChildren(new Option(hint,''),...choices.map(([value,label])=>new Option(label,value)));
  }
  type.addEventListener('change',()=>{
    updateBodies();
    updateMakes();
  });
  body?.addEventListener('change',()=>{
    if (type.value==='trailer:semi_trailer') return;
    const activeType=type.value.split(':')[0];
    const match=Object.keys(catalog).find(category=>category.endsWith(':'+body.value));
    type.value=match||activeType;
    if (match) updateBodies();
    updateMakes();
  });
  make.addEventListener('change',updateModels);
  const shortcuts=$$('[data-filter-shortcut]',form);
  for (const shortcut of shortcuts) {
    const control=form.elements.namedItem(shortcut.dataset.filterShortcut);
    const sync=()=>shortcut.setAttribute('aria-pressed',String(control.value===shortcut.value));
    shortcut.addEventListener('click',()=>{
      control.value=control.value===shortcut.value?'':shortcut.value;
      control.dispatchEvent(new Event('change',{bubbles:true}));
    });
    control.addEventListener('change',sync);
    sync();
  }
  if (shortcuts.length) form.addEventListener('reset',()=>queueMicrotask(()=>{
    make.value='';
    model.value='';
    updateBodies();
    updateMakes();
    for (const shortcut of shortcuts) shortcut.setAttribute('aria-pressed','false');
  }));
}
$('[data-sort]')?.addEventListener('change',event=>event.target.form.requestSubmit());

const filterPanel=$('[data-filter-panel]');
const filterOpen=$('[data-filter-open-button]');
const phoneFilters=matchMedia('(max-width: 700px)');
const filtersAreModal=()=>phoneFilters.matches&&!filterPanel.hasAttribute('data-filter-inline');
let backdrop;
function toggleFilters(open,focus=true) {
  if (!filterPanel) return;
  filterPanel.toggleAttribute('data-filter-open',open);
  filterOpen?.setAttribute('aria-expanded',String(open));
  if (open&&filtersAreModal()) {
    if (!backdrop) {
      backdrop=document.createElement('button');
      backdrop.className='filter-backdrop';
      backdrop.type='button';
      backdrop.tabIndex=-1;
      backdrop.setAttribute('aria-hidden','true');
      backdrop.addEventListener('click',()=>toggleFilters(false));
      document.body.append(backdrop);
    }
    backdrop.hidden=false;
    root.classList.add('filter-active');
    filterPanel.setAttribute('role','dialog');
    filterPanel.setAttribute('aria-modal','true');
    if (focus) $('[data-filter-close]',filterPanel)?.focus();
  } else {
    if (backdrop) backdrop.hidden=true;
    root.classList.remove('filter-active');
    filterPanel.removeAttribute('role');
    filterPanel.removeAttribute('aria-modal');
    if (focus&&!open) filterOpen?.focus();
  }
}
filterOpen?.addEventListener('click',event=>{
  event.preventDefault();
  toggleFilters(!filterPanel.hasAttribute('data-filter-open'));
});
$('[data-filter-close]')?.addEventListener('click',()=>toggleFilters(false));
filterPanel?.addEventListener('invalid',()=>{
  if (!filterPanel.hasAttribute('data-filter-open')) toggleFilters(true,false);
},true);
phoneFilters.addEventListener('change',()=>{
  const open=filterPanel?.hasAttribute('data-filter-open');
  const focus=open&&filtersAreModal()&&!filterPanel.contains(document.activeElement);
  toggleFilters(open,focus);
});
if (filterPanel?.hasAttribute('data-filter-open')) toggleFilters(true,false);
document.addEventListener('keydown',event=>{
  if (!filterPanel?.hasAttribute('data-filter-open')||event.defaultPrevented) return;
  const modal=root.classList.contains('filter-active');
  const inFilters=filterPanel.closest('form').contains(document.activeElement);
  if (event.key==='Escape'&&(modal||inFilters)) {
    event.preventDefault();
    toggleFilters(false);
  }
  if (event.key==='Tab'&&modal) {
    const focusable=$$('button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),a[href]',filterPanel);
    const first=focusable[0],last=focusable.at(-1);
    if (event.shiftKey&&document.activeElement===first) {event.preventDefault();last?.focus();}
    if (!event.shiftKey&&document.activeElement===last) {event.preventDefault();first?.focus();}
  }
});

function enableAdSwipe(stage,slides,current,step,engaged) {
  if (slides.length<2) return;
  let gesture,peek,settling,neighborMotion,suppressClick=false;

  function clearPreview() {
    if (settling) {settling.onfinish=null;settling.cancel();settling=null;}
    neighborMotion?.cancel();
    neighborMotion=null;
    if (peek) {
      delete peek.dataset.adPeek;
      peek.inert=false;
      peek=null;
    }
  }

  function finish(commit,dx=0) {
    const dragged=gesture?.axis==='x', width=stage.clientWidth;
    const direction=dx<0?1:-1;
    const advance=dragged&&commit&&Math.abs(dx)>=Math.min(56,Math.max(32,width*.1));
    const neighbor=advance?slides[current()]:peek;
    gesture=null;
    clearPreview();
    delete stage.dataset.dragging;
    stage.style.removeProperty('--ad-drag');
    if (advance) step(direction);
    const offset=advance?direction*width+dx:dx;
    if (dragged&&offset&&neighbor&&!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const side=advance?-direction:direction;
      peek=neighbor;
      peek.dataset.adPeek=side>0?'next':'previous';
      peek.inert=true;
      const frames=(start,end)=>[start,end].map(x=>({transform:`translateX(${x}px)`}));
      const timing={duration:180,easing:'ease-out'};
      neighborMotion=peek.animate(frames(side*width+offset,side*width),timing);
      settling=slides[current()].animate(frames(offset,0),timing);
      settling.onfinish=clearPreview;
    }
    engaged(false);
  }

  stage.addEventListener('pointerdown',event=>{
    if (!event.isPrimary) {
      if (gesture) {suppressClick=true;finish(false);}
      return;
    }
    suppressClick=false;
    if (event.pointerType==='mouse'||event.target.closest('[data-ad-toggle],[data-ad-next]')) return;
    clearPreview();
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,axis:null};
    engaged(true);
  });
  stage.addEventListener('pointermove',event=>{
    if (event.pointerId!==gesture?.id) return;
    const dx=event.clientX-gesture.x, dy=event.clientY-gesture.y;
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx),Math.abs(dy))<8) return;
      gesture.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
      suppressClick=true;
      if (gesture.axis==='x') stage.setPointerCapture(event.pointerId);
    }
    if (gesture.axis!=='x') return;
    const direction=dx<0?1:-1;
    const next=slides[(current()+direction+slides.length)%slides.length];
    if (peek!==next) {
      if (peek) {delete peek.dataset.adPeek;peek.inert=false;}
      peek=next;
      peek.inert=true;
    }
    peek.dataset.adPeek=direction>0?'next':'previous';
    stage.dataset.dragging='';
    stage.style.setProperty('--ad-drag',Math.max(-stage.clientWidth,Math.min(stage.clientWidth,dx))+'px');
  });
  stage.addEventListener('pointerup',event=>{
    if (event.pointerId!==gesture?.id) return;
    const dx=Math.max(-stage.clientWidth,Math.min(stage.clientWidth,event.clientX-gesture.x));
    finish(true,dx);
  });
  stage.addEventListener('pointercancel',event=>{if (event.pointerId===gesture?.id) finish(false);});
  stage.addEventListener('lostpointercapture',event=>{
    if (event.target===stage&&event.pointerId===gesture?.id) finish(false);
  });
  stage.closest('[data-ad-carousel],[data-banner]').addEventListener('click',event=>{
    if (settling&&event.target.closest('button')) clearPreview();
  },true);
  stage.addEventListener('click',event=>{
    if (!suppressClick||event.detail===0) return;
    suppressClick=false;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
}

const carousel=$('[data-ad-carousel]');
if (carousel) {
  const stage=$('[data-ad-stage]',carousel);
  const slides=$$('[data-ad-slide]',stage);
  const dots=$$('[data-ad-dot]',carousel);
  const position=$('[data-ad-position]',carousel);
  const rotation=$('[data-ad-rotation]',carousel);
  const desktop=matchMedia('(min-width: 761px) and (hover: hover)');
  const mouse=matchMedia('(hover: hover) and (pointer: fine)');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0, playing=slides.length>1&&!motion.matches, hovering=desktop.matches&&carousel.matches(':hover');
  let rotateTimer, collapseTimer, touching=false;

  function loadAdjacentAds() {
    if (navigator.connection?.saveData) return;
    for (const offset of [-1,1]) {
      const neighbor=slides[(index+offset+slides.length)%slides.length];
      const photo=neighbor.querySelector('.ad-carousel-image,.ad-carousel-house-photo');
      if (neighbor!==slides[index]&&photo?.loading==='lazy') {
        photo.fetchPriority='low';
        photo.loading='eager';
      }
    }
  }
  const setCollapsed=collapsed=>{
    carousel.toggleAttribute('data-collapsed',collapsed);
    $('[data-ad-preview]',slides[index])?.setAttribute('aria-expanded',String(!collapsed));
  };
  const show=(next,announce=false)=>{
    slides[index].hidden=true;
    dots[index].removeAttribute('aria-current');
    index=(next+slides.length)%slides.length;
    slides[index].hidden=false;
    dots[index].setAttribute('aria-current','true');
    position.textContent=`${index+1} / ${slides.length}`;
    loadAdjacentAds();
    setCollapsed(carousel.hasAttribute('data-collapsed'));
    if (announce) $('[data-ad-announcement]',carousel).textContent=slides[index].dataset.adSlide;
  };
  function schedule() {
    clearTimeout(rotateTimer);
    clearTimeout(collapseTimer);
    if (hovering||touching||document.hidden||carousel.querySelector(':focus-visible')) return;
    if (playing) rotateTimer=setTimeout(()=>{show(index+1);schedule();},6500);
    if (desktop.matches&&!motion.matches&&!carousel.hasAttribute('data-collapsed')) {
      collapseTimer=setTimeout(()=>setCollapsed(true),3000);
    }
  }
  function setPlaying(enabled) {
    playing=slides.length>1&&enabled;
    rotation.setAttribute('aria-label',playing?t('Wstrzymaj automatyczną zmianę reklam','Pause ad rotation'):
      t('Wznów automatyczną zmianę reklam','Resume ad rotation'));
    $('[data-ad-play]',rotation).hidden=playing;
    $('[data-ad-pause]',rotation).hidden=!playing;
    schedule();
  }
  $('[data-ad-controls]',carousel).hidden=slides.length<2;
  loadAdjacentAds();
  setCollapsed(false);
  setPlaying(playing);
  const navigate=next=>{
    setCollapsed(false);
    show(next,true);
    schedule();
  };
  rotation.addEventListener('click',()=>setPlaying(!playing));
  $('[data-ad-previous]',carousel).addEventListener('click',()=>navigate(index-1));
  $('[data-ad-forward]',carousel).addEventListener('click',()=>navigate(index+1));
  for (const [i,dot] of dots.entries()) dot.addEventListener('click',()=>navigate(i));
  carousel.addEventListener('pointerenter',event=>{
    if (event.pointerType!=='mouse'||!mouse.matches) return;
    hovering=true;
    schedule();
  });
  stage.addEventListener('pointerenter',event=>{
    if (event.pointerType==='mouse'&&mouse.matches) setCollapsed(false);
  });
  carousel.addEventListener('pointerleave',event=>{
    if (event.pointerType!=='mouse'||!mouse.matches) return;
    hovering=false;
    schedule();
  });
  carousel.addEventListener('focusin',event=>{
    if (stage.contains(event.target)) setCollapsed(false);
    if (event.target.matches('[data-ad-preview]')) $('.ad-carousel-image',slides[index]).focus({preventScroll:true});
    schedule();
  });
  carousel.addEventListener('focusout',()=>queueMicrotask(schedule));
  $('[data-ad-preview]',stage)?.addEventListener('click',()=>setCollapsed(false));
  desktop.addEventListener('change',()=>{
    hovering=desktop.matches&&carousel.matches(':hover');
    setCollapsed(false);
    schedule();
  });
  motion.addEventListener('change',()=>{
    if (motion.matches) setCollapsed(false);
    setPlaying(!motion.matches);
  });
  document.addEventListener('visibilitychange',schedule);

  enableAdSwipe(stage,slides,()=>index,direction=>navigate(index+direction),active=>{
    touching=active;
    schedule();
  });
}

const ad=$('[data-banner]');
if (ad) {
  const toggle=$('[data-ad-toggle]',ad);
  const slides=$$('[data-slide]',ad);
  const desktop=matchMedia('(min-width: 761px)');
  let timer,pinned=false,index=0;
  const setOpen=open=>{
    ad.classList.toggle('expanded',open);
    toggle.setAttribute('aria-expanded',String(open));
  };
  const engaged=()=>ad.matches(':focus-within')||matchMedia('(hover:hover)').matches&&ad.matches(':hover');
  const collapseAfter=(delay=3000)=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{if (!pinned&&!engaged())setOpen(false);},delay);
  };
  if (desktop.matches) collapseAfter();
  else setOpen(false);
  desktop.addEventListener('change',()=>{pinned=false;setOpen(desktop.matches);if (desktop.matches) collapseAfter();});
  toggle.addEventListener('click',()=>{
    const open=!ad.classList.contains('expanded');
    pinned=open;
    setOpen(open);
  });
  const step=direction=>{
    slides[index].hidden=true;
    index=(index+direction+slides.length)%slides.length;
    slides[index].hidden=false;
  };
  $('[data-ad-next]',ad)?.addEventListener('click',()=>step(1));
  enableAdSwipe(ad,slides,()=>index,step,active=>{
    if (active) clearTimeout(timer);
    else if (desktop.matches) collapseAfter();
  });
  ad.addEventListener('pointerenter',event=>{if(desktop.matches&&event.pointerType==='mouse'){clearTimeout(timer);setOpen(true);}});
  ad.addEventListener('pointerleave',()=>{if(desktop.matches)collapseAfter(350);});
  ad.addEventListener('focusin',event=>{if(desktop.matches&&event.target!==toggle){clearTimeout(timer);setOpen(true);}});
  ad.addEventListener('focusout',()=>{if(desktop.matches)collapseAfter(350);});
}

function trackBanners(banners) {
  const send=(banner,event)=>{
    const body=new URLSearchParams({banner:banner.dataset.bannerId,event});
    fetch(apiPath('/banner-event'),{method:'POST',body,credentials:'same-origin',keepalive:true}).catch(()=>{});
  };
  const trackClick=event=>{
    if (event.defaultPrevented||document.hidden||(event.type==='auxclick'&&event.button!==1)) return;
    const link=event.target.closest('a[data-banner-click]');
    const banner=link?.closest('[data-banner-id]:not([hidden])');
    if (banner) send(banner,'click');
  };
  document.addEventListener('click',trackClick);
  document.addEventListener('auxclick',trackClick);
  if (!('IntersectionObserver' in window)) return;
  const visible=new Set(),counted=new Set(),timers=new Map();
  function update(banner) {
    const onScreen=!document.hidden&&!banner.hidden&&visible.has(banner);
    if (!onScreen) {
      clearTimeout(timers.get(banner));
      timers.delete(banner);
      return;
    }
    if (counted.has(banner)||timers.has(banner)) return;
    timers.set(banner,setTimeout(()=>{
      timers.delete(banner);
      if (document.hidden||banner.hidden||!visible.has(banner)) return;
      counted.add(banner);
      send(banner,'impression');
    },1000));
  }
  const observer=new IntersectionObserver(entries=>{
    for (const {target,isIntersecting,intersectionRatio} of entries) {
      if (isIntersecting&&intersectionRatio>=.5) visible.add(target);
      else visible.delete(target);
      update(target);
    }
  },{threshold:.5});
  for (const banner of banners) observer.observe(banner);
  document.addEventListener('visibilitychange',()=>banners.forEach(update));
}
const trackedBanners=$$('[data-banner-id]');
if (!prefix&&trackedBanners.length) trackBanners(trackedBanners);

let selectedCompare=selection(keys.compare).slice(0,4);
let selectedSaved=user?$$('[data-favorite][aria-pressed=true]').map(x=>x.dataset.favorite):selection(keys.favorite);
const comparisonPage=$('[data-compare-page]');
const comparisonEmpty=comparisonPage?.innerHTML;
const savedPage=$('[data-saved-page]');
const savedEmpty=savedPage?.querySelector('.empty')?.outerHTML;
const tray=$('[data-compare-tray]');
function paintMarks() {
  for (const [key,items] of [['favorite',selectedSaved],['compare',selectedCompare]]) {
    for (const button of $$('[data-'+key+']')) {
      const active=items.includes(button.dataset[key]);
      button.classList.toggle('selected',active);
      button.setAttribute('aria-pressed',String(active));
      if (button.textContent.trim()) continue;
      const label=key==='favorite'?(active?t('Usuń z ulubionych','Remove from favorites'):t('Dodaj do ulubionych','Save as favorite')):
        active?t('Usuń z porównania','Remove from comparison'):t('Dodaj do porównania','Add to comparison');
      button.setAttribute('aria-label',label);
    }
  }
  const browsePath=location.pathname.slice(prefix.length)||'/';
  const showTray=['/','/szukaj','/ulubione'].includes(browsePath)||browsePath.startsWith('/oferta/');
  tray.hidden=selectedCompare.length===0||!showTray;
  root.classList.toggle('has-compare-tray',!tray.hidden);
  if (!tray.hidden) {
    const anchor=document.createElement('a');
    anchor.href=localPath('/porownanie');
    anchor.className='btn primary';
    anchor.textContent=t('Porównaj','Compare')+' · '+selectedCompare.length+'/4';
    const clear=document.createElement('button');
    clear.type='button';clear.className='btn';clear.dataset.clearCompare='';
    clear.textContent=t('Wyczyść','Clear');
    tray.replaceChildren(anchor,clear);
  }
}
let compareRender=0;
async function showCompare() {
  if (!comparisonPage) return;
  const version=++compareRender;
  try {
    const html=selectedCompare.length?await fragment('compare?keys='+encodeURIComponent(selectedCompare.join(','))):'';
    if(version===compareRender) comparisonPage.innerHTML=html||comparisonEmpty;
  } catch (err) {toast(err.message,true);}
}

function syncReel(reel) {
  const track=$('[data-reel-track]',reel);
  const controls=$('[data-reel-controls]',reel);
  const size=String(track.children.length);
  if (reel.dataset.reelSize!==size) {
    reel.dataset.reelSize=size;
    reel.style.setProperty('--reel-size',size);
  }
  $('[data-reel-toolbar]',reel).hidden=track.children.length<2;
  const left=track.scrollLeft;
  const right=left+track.clientWidth;
  const max=track.scrollWidth-track.clientWidth;
  controls.hidden=!reel.classList.contains('reel-single')||max<=2;
  $('[data-reel-prev]',reel).disabled=left<=2;
  $('[data-reel-next]',reel).disabled=max-left<=2;
  if (controls.hidden) return;
  const cards=[...track.children];
  const first=cards.findIndex(card=>card.offsetLeft+card.offsetWidth>left+2)+1;
  const last=cards.findLastIndex(card=>card.offsetLeft<right-2)+1;
  const visible=first===last?String(first):first+'–'+last;
  const position=$('[data-reel-position]',reel);
  const label=visible+' '+t('z','of')+' '+cards.length;
  if (position.textContent!==label) position.textContent=label;
}

function setupReels(container=document) {
  for (const reel of $$('[data-reel]:not([data-reel-ready])',container)) {
    reel.dataset.reelReady='';
    const track=$('[data-reel-track]',reel);
    const scrollTo=left=>track.scrollTo({left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    function move(direction) {
      const cards=[...track.children];
      const edge=track.scrollLeft;
      const target=direction>0?cards.find(card=>card.offsetLeft>edge+2):cards.findLast(card=>card.offsetLeft<edge-2);
      scrollTo(target?.offsetLeft ?? (direction>0?track.scrollWidth:0));
    }
    $('[data-reel-prev]',reel).addEventListener('click',()=>move(-1));
    $('[data-reel-next]',reel).addEventListener('click',()=>move(1));
    const mode=$('[data-reel-mode]',reel);
    let lastCard=null;
    mode.addEventListener('click',()=>{
      if (reel.classList.contains('reel-single')) {
        lastCard=[...track.children].find(card=>card.offsetLeft+card.offsetWidth>track.scrollLeft+2);
      }
      const single=reel.classList.toggle('reel-single');
      mode.setAttribute('aria-pressed',String(single));
      track.tabIndex=single?0:-1;
      if (single) track.scrollTo({left:lastCard?.offsetLeft??0,behavior:'instant'});
      syncReel(reel);
    });
    track.addEventListener('keydown',event=>{
      if (!reel.classList.contains('reel-single')||event.target!==track||event.altKey||event.ctrlKey||event.metaKey) return;
      const actions={ArrowLeft:()=>move(-1),ArrowRight:()=>move(1),Home:()=>scrollTo(0),End:()=>scrollTo(track.scrollWidth)};
      if (Object.hasOwn(actions,event.key)) {event.preventDefault();actions[event.key]();}
    });
    let frame=0,drag=null,suppressClick=0;
    track.addEventListener('scroll',()=>{
      if (frame) return;
      frame=requestAnimationFrame(()=>{frame=0;syncReel(reel);});
    },{passive:true});
    track.addEventListener('dragstart',event=>{if(reel.classList.contains('reel-single'))event.preventDefault();});
    track.addEventListener('pointerdown',event=>{
      if (!reel.classList.contains('reel-single')||event.pointerType!=='mouse'||event.button!==0||event.target.closest('button')||track.scrollWidth<=track.clientWidth+2) return;
      drag={id:event.pointerId,x:event.clientX,left:track.scrollLeft,active:false};
    });
    track.addEventListener('pointermove',event=>{
      if (!drag||drag.id!==event.pointerId) return;
      const delta=event.clientX-drag.x;
      if (!drag.active&&Math.abs(delta)<8) return;
      if (!drag.active) {
        drag.active=true;
        track.classList.add('reel-dragging');
        track.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      track.scrollLeft=drag.left-delta;
    });
    const endDrag=()=>{
      if (drag?.active) {
        suppressClick=performance.now()+180;
        track.classList.remove('reel-dragging');
      }
      drag=null;
    };
    track.addEventListener('pointerup',endDrag);
    track.addEventListener('pointercancel',endDrag);
    track.addEventListener('pointerleave',()=>{if (!drag?.active) drag=null;});
    track.addEventListener('click',event=>{
      if (performance.now()<suppressClick) {event.preventDefault();event.stopPropagation();}
    },true);
    syncReel(reel);
  }
}

const moreListings=$('[data-search-more]');
if (moreListings) {
  const results=moreListings.closest('[data-search-results]');
  const reel=$('[data-reel]',results);
  const track=$('[data-reel-track]',reel);
  const status=$('[data-search-status]',results);
  moreListings.addEventListener('click',async event=>{
    if (event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    if (moreListings.getAttribute('aria-disabled')==='true') return;
    moreListings.setAttribute('aria-disabled','true');
    track.setAttribute('aria-busy','true');
    report(status,t('Ładowanie ogłoszeń…','Loading listings…'));
    try {
      const markup=await fragment('search'+new URL(moreListings.href).search);
      const template=document.createElement('template');
      template.innerHTML=markup;
      const batch=$('[data-search-batch]',template.content);
      if (!batch) throw new Error();
      const visible=new Set([...track.children].map(card=>card.id));
      const added=[...batch.children].filter(card=>!visible.has(card.id));
      track.append(...added);
      syncReel(reel);
      paintMarks();
      $('[data-search-count]').textContent=t('Wyniki','Results')+' · '+batch.dataset.total;
      history.replaceState(history.state,'',batch.dataset.current);
      if (batch.dataset.next) moreListings.href=batch.dataset.next;
      else moreListings.hidden=true;
      const first=added[0];
      if (first) {
        if (reel.classList.contains('reel-single')) track.scrollTo({left:first.offsetLeft,behavior:'instant'});
        first.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        $('h3 a',first)?.focus({preventScroll:true});
      }
      report(status,'');
    } catch {report(status,t('Nie udało się wczytać ogłoszeń. Ponów próbę.','Listings could not be loaded. Try again.'),true);}
    finally {
      moreListings.removeAttribute('aria-disabled');
      track.removeAttribute('aria-busy');
    }
  });
}

async function refreshSaved() {
  if (!savedPage) return;
  try {
    const html=selectedSaved.length?await fragment('saved?keys='+encodeURIComponent(selectedSaved.join(','))):'';
    if (html) savedPage.innerHTML=html;
    else if (savedEmpty) savedPage.innerHTML=savedEmpty;
    else {
      const empty=document.createElement('div');
      empty.className='empty';
      const title=document.createElement('h2');
      title.textContent=t('Brak zapisanych pojazdów','No saved vehicles');
      const a=document.createElement('a');
      a.className='btn primary';a.href=localPath('/szukaj');a.textContent=t('Przeglądaj pojazdy','Browse vehicles');
      empty.append(title,a);
      savedPage.replaceChildren(empty);
    }
    setupReels(savedPage);
    paintMarks();
  } catch (err) {toast(err.message,true);}
}
async function initSaved() {
  if (user) {
    try {
      const guest=selection(keys.favorite);
      const result=guest.length?await request('/favorites',{method:'POST',data:{keys:guest,add:true}}):await request('/favorites');
      selectedSaved=result.keys;
      if (guest.length) {local.clear(keys.favorite);await refreshSaved();}
    } catch { /* current server-rendered state remains available */ }
  } else await refreshSaved();
  paintMarks();
}
paintMarks();
setupReels();
window.addEventListener('resize',()=>$$('[data-reel]').forEach(syncReel));
const savedReady=initSaved();
showCompare();
let favoriteQueue=savedReady.catch(()=>{});
function toggleFavorite(button) {
  const key=button.dataset.favorite;
  button.disabled=true;
  favoriteQueue=favoriteQueue.then(async()=>{
    const add=!selectedSaved.includes(key);
    try {
      if (user) selectedSaved=(await request('/favorites',{method:'POST',data:{key,add}})).keys;
      else {
        selectedSaved=add?[...selectedSaved,key].slice(-75):selectedSaved.filter(item=>item!==key);
        saveSelection(keys.favorite,selectedSaved);
      }
      paintMarks();
      if (savedPage) await refreshSaved();
      toast(add?t('Dodano do ulubionych.','Saved to favorites.'):t('Usunięto z ulubionych.','Removed from favorites.'));
    } catch (err) {toast(err.message,true);}
    finally {button.disabled=false;}
  });
}
function toggleCompare(key,remove=false) {
  if (remove||selectedCompare.includes(key)) selectedCompare=selectedCompare.filter(item=>item!==key);
  else {
    if (selectedCompare.length===4) {toast(t('Możesz porównać maksymalnie cztery samochody.','You can compare up to four vehicles.'),true);return;}
    selectedCompare=[...selectedCompare,key];
  }
  saveSelection(keys.compare,selectedCompare);
  paintMarks();
  showCompare();
}

async function copyText(value) {
  try {await navigator.clipboard.writeText(value);toast(t('Skopiowano.','Copied.'));}
  catch {
    const area=document.createElement('textarea');
    area.value=value;area.readOnly=true;area.className='clipboard-field';
    document.body.append(area);
    area.select();
    try {if(document.execCommand('copy'))toast(t('Skopiowano.','Copied.'));else throw new Error();}
    catch {toast(t('Kopiowanie jest niedostępne.','Clipboard is unavailable.'),true);}
    finally {area.remove();}
  }
}
async function revealPhone(button) {
  button.disabled=true;
  try {
    const data=await request('/offers/'+button.dataset.phone+'/phone');
    const links=$('[data-phone-links]',button.parentNode);
    $('[data-phone-number]',links).textContent=data.phone;
    $('[data-call]',links).href='tel:'+data.phone.replace(/[^+0-9]/g,'');
    $('[data-copy-phone]',links).dataset.copyPhone=data.phone;
    links.hidden=false;button.hidden=true;
    $('[data-call]',links).focus();
  } catch (err) {toast(err.message,true);}
  finally {button.disabled=false;}
}
function share(path) {
  const url=new URL(path,location.origin).href;
  if (navigator.share) navigator.share({title:document.title,url}).catch(err=>{if(err.name!=='AbortError') copyText(url);});
  else copyText(url);
}

for (const button of $$('[data-copy-vin]')) button.hidden=false;
function setupFinanceCalculator(calculator) {
  const priceValue=Number(calculator.dataset.financePrice)||0;
  const currency=calculator.dataset.financeCurrency||'PLN';
  const term=$('[data-finance-term]',calculator);
  const contribution=$('[data-finance-contribution]',calculator);
  const payment=$('[data-finance-payment]',calculator);
  const termValue=$('[data-finance-term-value]',calculator);
  const contributionValue=$('[data-finance-contribution-value]',calculator);
  const lead=$('[data-finance-lead-text]');
  const format=value=>new Intl.NumberFormat(lang==='pl'?'pl-PL':undefined,{style:'currency',currency,maximumFractionDigits:0}).format(value);
  const sync=()=>{
    const months=Number(term.value), own=Number(contribution.value)/100;
    const financed=priceValue*(1-own), residual=financed*.2;
    const monthly=Math.max(0,((financed-residual)/months)+(financed+residual)*.079/24);
    payment.textContent=t('od ','from ')+format(Math.round(monthly))+'/'+t('mies.','month');
    termValue.textContent=months+' '+t('mies.','months');
    contributionValue.textContent=Math.round(own*100)+'%';
    if (lead) lead.value=t('Proszę o ofertę finansowania. Kalkulator: ','Please send me a financing offer. Calculator: ')+
      format(Math.round(monthly))+'/'+t('mies., ','month, ')+months+' '+t('miesięcy, wpłata własna ','months, own contribution ')+Math.round(own*100)+'%.';
  };
  term.addEventListener('input',sync);contribution.addEventListener('input',sync);sync();
}
for (const calculator of $$('[data-finance-calculator]')) setupFinanceCalculator(calculator);
document.addEventListener('click',event=>{
  const enquiry=event.target.closest('[data-open-enquiry]');
  if (enquiry&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey) {
    const dialog=$(`dialog[data-dialog="${enquiry.dataset.openEnquiry}"]`);
    if (dialog) {event.preventDefault();dialog.showModal();}
  }
  const button=event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-favorite')) toggleFavorite(button);
  if (button.hasAttribute('data-compare')) toggleCompare(button.dataset.compare);
  if (button.hasAttribute('data-remove-compare')) toggleCompare(button.dataset.removeCompare,true);
  if (button.hasAttribute('data-clear-compare')) {selectedCompare=[];saveSelection(keys.compare,[]);paintMarks();showCompare();}
  if (button.hasAttribute('data-phone')) revealPhone(button);
  if (button.hasAttribute('data-copy-phone')) copyText(button.dataset.copyPhone);
  if (button.hasAttribute('data-copy-vin')) copyText(button.dataset.copyVin);
  if (button.hasAttribute('data-share')) share(button.dataset.share);
  if (button.hasAttribute('data-open')) $('dialog[data-dialog="'+button.dataset.open+'"]')?.showModal();
  if (button.hasAttribute('data-close')) button.closest('dialog')?.close();
  if (button.hasAttribute('data-reset-preferences')) {
    Object.values(keys).forEach(key=>local.clear(key));
    document.documentElement.dispatchEvent(new Event('reset-site-theme'));
    document.documentElement.dispatchEvent(new Event('reset-icon-preferences'));
    document.documentElement.dispatchEvent(new Event('reset-button-finish'));
    for (const mode of ['live','demo']) {local.clear('a4-saved-'+mode);local.clear('a4-compare-'+mode);}
    selectedCompare=[];if(!user)selectedSaved=[];
    paintAccountButtons('buttons');document.documentElement.dispatchEvent(new Event('reset-account-colors'));paintAccountTextSize('standard');paintMarks();toast(t('Ustawienia lokalne wyczyszczone.','Local preferences cleared.'));
  }
});
const contact=new URLSearchParams(location.search).get('kontakt');
if (contact) $('dialog[data-dialog="'+(contact==='ogledziny'?'viewing':'contact')+'"]')?.showModal();
const vinSection=$('#sprawdz-vin');
if (vinSection) {
  const revealVinSection=()=>{
    if (location.hash==='#sprawdz-vin') vinSection.open=true;
  };
  revealVinSection();
  window.addEventListener('hashchange',revealVinSection);
  $('.showcase-vin-link').addEventListener('click',()=>{vinSection.open=true;});
}
for (const input of $$('input[name=proposed_at]')) {
  const date=new Date();
  date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
  input.min=date.toISOString().slice(0,16);
}
const offerPanel=$('[data-showcase-panel]');
if (offerPanel) {
  const toggle=$('[data-showcase-toggle]',offerPanel);
  const caption=$('span',toggle);
  const summary=$('#listing-summary',offerPanel);
  const canHover=matchMedia('(any-hover: hover)');
  const wide=matchMedia('(min-width: 701px)');
  let expanded=true,visible=!('IntersectionObserver' in window),pressed=false,timer;

  function canCollapse() {
    return wide.matches&&expanded&&visible&&!pressed&&!document.hidden&&!summary.contains(document.activeElement)&&
      !toggle.matches(':focus-visible')&&!(canHover.matches&&(summary.matches(':hover')||toggle.matches(':hover')))&&
      !$('dialog[open]');
  }
  function scheduleCollapse() {
    clearTimeout(timer);
    if (canCollapse()) timer=setTimeout(()=>{if(canCollapse()) setExpanded(false);},5000);
  }
  function setExpanded(open) {
    expanded=open;
    offerPanel.toggleAttribute('data-collapsed',!open);
    summary.toggleAttribute('inert',!open);
    toggle.setAttribute('aria-expanded',String(open));
    const label=open?t('Schowaj dane','Hide details'):t('Pokaż cenę i dane','Show price and details');
    toggle.setAttribute('aria-label',label);
    caption.textContent=label;
    scheduleCollapse();
  }

  toggle.hidden=!wide.matches;
  wide.addEventListener('change',()=>{
    toggle.hidden=!wide.matches;
    setExpanded(true);
  });
  toggle.addEventListener('click',()=>setExpanded(!expanded));
  for (const element of [summary,toggle]) {
    element.addEventListener('pointerenter',scheduleCollapse);
    element.addEventListener('pointerleave',scheduleCollapse);
  }
  offerPanel.addEventListener('focusin',scheduleCollapse);
  offerPanel.addEventListener('focusout',()=>queueMicrotask(scheduleCollapse));
  offerPanel.addEventListener('pointerdown',()=>{pressed=true;scheduleCollapse();});
  for (const event of ['pointerup','pointercancel']) document.addEventListener(event,()=>{
    if (pressed) {pressed=false;scheduleCollapse();}
  });
  window.addEventListener('scroll',scheduleCollapse,{passive:true});
  document.addEventListener('visibilitychange',scheduleCollapse);
  document.addEventListener('close',scheduleCollapse,true);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting&&entry.intersectionRatio>=.2;
    scheduleCollapse();
  },{threshold:.2}).observe(summary);
  scheduleCollapse();
}
function setupMobilePhotoView(gallery,stack,photos) {
  const showcase=gallery.closest('.listing-showcase');
  const toggle=$('[data-photo-view-toggle]',showcase);
  const openLabel=$('[data-photo-view-open]',toggle);
  const closeLabel=$('[data-photo-view-close]',toggle);
  const actions=$('.contact-actions',showcase)||$('.showcase-photo-actions',showcase);
  const stage=$('.gallery-main',gallery);
  const pane=gallery.closest('[data-media-pane]');
  const images=$$('img',stack);
  const mobile=matchMedia('(max-width: 700px)');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=!(window.IntersectionObserver),pressed=false,used=false,timer,fade;

  function preparePhotos() {
    images.forEach((image,index)=>{
      if (image.hasAttribute('src')) return;
      const {url,thumb,wide}=photos[index];
      if (thumb!==url) image.addEventListener('error',()=>{
        image.removeAttribute('srcset');
        image.src=thumb;
      },{once:true});
      if (wide) image.srcset=thumb+' 640w, '+url+' 1920w';
      image.src=url;
    });
  }
  function cancelPending() {
    clearTimeout(timer);
    clearTimeout(fade);
    showcase.removeAttribute('data-photo-view-fading');
  }
  function setView(open) {
    cancelPending();
    if (open) {
      used=true;
      preparePhotos();
    }
    showcase.toggleAttribute('data-photo-view-open',open);
    stack.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    openLabel.hidden=open;
    closeLabel.hidden=!open;
    gallery.dispatchEvent(new Event('gallery-mode'));
  }
  const available=()=>mobile.matches&&!pane?.hidden;
  const canOpen=()=>available()&&!used&&visible&&!pressed&&!motion.matches&&!document.hidden&&
    !$(':focus-visible',showcase)&&!$('dialog[open]');
  function schedule() {
    cancelPending();
    if (!canOpen()) return;
    preparePhotos();
    timer=setTimeout(()=>{
      if (!canOpen()) return;
      showcase.setAttribute('data-photo-view-fading','');
      fade=setTimeout(()=>{
        if (canOpen()) setView(true);
        else cancelPending();
      },180);
    },3000);
  }
  function updateAvailability() {
    toggle.hidden=!available();
    if (toggle.hidden&&!stack.hidden) setView(false);
    else schedule();
  }

  toggle.addEventListener('click',()=>{
    const useKeyboard=toggle.matches(':focus-visible');
    const open=stack.hidden;
    setView(open);
    const landing=open?showcase:actions;
    landing.scrollIntoView({block:open?'start':'center'});
    if (useKeyboard) {
      const focus=open?$('#listing-title',showcase):$('button,a[href]',actions);
      focus?.focus({preventScroll:true});
    }
  });
  showcase.addEventListener('pointerdown',()=>{pressed=true;schedule();});
  for (const event of ['pointerup','pointercancel']) document.addEventListener(event,()=>{
    if (pressed) {pressed=false;schedule();}
  });
  showcase.addEventListener('focusin',schedule);
  showcase.addEventListener('focusout',()=>queueMicrotask(schedule));
  window.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('visibilitychange',schedule);
  document.addEventListener('close',schedule,true);
  motion.addEventListener('change',schedule);
  mobile.addEventListener('change',updateAvailability);
  gallery.addEventListener('gallery-mode',updateAvailability);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{
    visible=entry.intersectionRatio>=.25;
    schedule();
  },{threshold:.25,rootMargin:'0px 0px -80px 0px'}).observe(stage);
  updateAvailability();
}

for (const gallery of $$('[data-gallery]')) {
  const photos=parse(gallery.dataset.gallery,[]);
  if (!photos.length) continue;
  let current=0,start=null,swiped=false;
  const dialog=$('[data-lightbox]',gallery);
  const image=$('[data-gallery-image]',gallery);
  const expanded=$('[data-lightbox-image]',gallery);
  const position=$('[data-gallery-count]',gallery);
  const enlarge=$('[data-enlarge]',gallery);
  const main=$('.gallery-main',gallery);
  const play=$('[data-gallery-play]',gallery);
  const strip=$('.gallery-thumbs',gallery);
  const stack=$('[data-photo-stack]',gallery);
  const thumbs=$$('[data-thumb]',gallery);
  const pane=gallery.closest('[data-media-pane]');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const warmed=new Set();
  let playing=false,inView=true,hovering=false,timer;
  function schedule() {
    clearTimeout(timer);
    if (!playing||!inView||hovering||document.hidden||pane?.hidden||(stack&&!stack.hidden)||dialog.open) return;
    timer=setTimeout(()=>{view(current+1);schedule();},5500);
  }
  function setPlaying(enabled) {
    if (!play) return;
    playing=enabled;
    play.setAttribute('aria-pressed',String(playing));
    play.setAttribute('aria-label',playing?t('Wstrzymaj pokaz slajdów','Pause slideshow'):t('Włącz pokaz slajdów','Play slideshow'));
    $('[data-play-icon]',play).hidden=playing;
    $('[data-pause-icon]',play).hidden=!playing;
    position.setAttribute('aria-live',playing?'off':'polite');
    schedule();
  }
  function preloadNext() {
    if (!play) return;
    const url=photos[(current+1)%photos.length].url;
    if (warmed.has(url)) return;
    warmed.add(url);
    const preload=new Image();
    preload.src=url;
  }
  function setGalleryBackdrop() {
    enlarge.style.setProperty('--gallery-backdrop',`url("${image.src}")`);
  }
  image.addEventListener('load',setGalleryBackdrop);
  if (image.complete&&image.naturalHeight) setGalleryBackdrop();
  function view(index) {
    current=(index+photos.length)%photos.length;
    const photo=photos[current];
    gallery.toggleAttribute('data-gallery-wide',Boolean(photo.wide));
    image.src=photo.url;
    gallery.dispatchEvent(new Event('gallery-photo-change'));
    if (dialog.open) expanded.src=photo.url;
    position.textContent=(current+1)+' / '+photos.length;
    thumbs.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===current)));
    if (strip&&strip.scrollWidth>strip.clientWidth) {
      const area=strip.getBoundingClientRect();
      const selected=thumbs[current].getBoundingClientRect();
      if (selected.left<area.left) strip.scrollLeft+=selected.left-area.left-2;
      else if (selected.right>area.right) strip.scrollLeft+=selected.right-area.right+2;
    }
    preloadNext();
  }
  function choose(index) {
    setPlaying(false);
    view(index);
  }
  function openPhoto(index=current) {
    if (index!==current) choose(index);
    else setPlaying(false);
    expanded.src=photos[current].url;
    dialog.showModal();
  }
  $$('[data-gallery-prev]',gallery).forEach(btn=>btn.addEventListener('click',()=>choose(current-1)));
  $$('[data-gallery-next]',gallery).forEach(btn=>btn.addEventListener('click',()=>choose(current+1)));
  for (const control of $$('.gallery-controls .icon-button',gallery)) {
    let contact;
    control.addEventListener('touchstart',event=>{
      contact=event.touches.length===1?event.changedTouches[0]:null;
    },{passive:true});
    control.addEventListener('touchend',event=>{
      const end=event.changedTouches[0];
      const tap=contact&&end.identifier===contact.identifier&&!event.touches.length&&
        Math.hypot(end.clientX-contact.clientX,end.clientY-contact.clientY)<10;
      contact=null;
      if (!tap||!event.cancelable) return;
      // Chromium can suppress the synthetic click immediately after a swipe.
      event.preventDefault();
      control.click();
    },{passive:false});
    control.addEventListener('touchcancel',()=>{contact=null;});
  }
  strip?.addEventListener('click',event=>{
    if (swiped) {
      event.stopPropagation();
      return;
    }
    const thumb=event.target.closest('[data-thumb]');
    if (thumb) choose(Number(thumb.dataset.thumb));
  });
  enlarge.addEventListener('click',()=>{
    if (!swiped) openPhoto();
  });
  if (stack) for (const button of $$('[data-stack-photo]',stack)) {
    button.addEventListener('click',()=>openPhoto(Number(button.dataset.stackPhoto)));
  }
  gallery.addEventListener('keydown',event=>{
    if (!play||!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    choose(current+(event.key==='ArrowLeft'?-1:1));
  });
  for (const target of $$('[data-swipe]',gallery)) {
    target.addEventListener('pointerdown',event=>{swiped=false;if(event.pointerType!=='mouse')start={x:event.clientX,y:event.clientY};});
    target.addEventListener('pointerup',event=>{
      if (!start) return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      start=null;
      if (play&&Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)) {swiped=true;choose(current+(dx<0?1:-1));setTimeout(()=>{swiped=false;},150);}
    });
    target.addEventListener('pointercancel',()=>{start=null;});
  }
  if (play) {
    play.addEventListener('click',()=>setPlaying(!playing));
    gallery.addEventListener('focusin',event=>{if(event.target!==play)setPlaying(false);});
    main.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovering=true;schedule();}});
    main.addEventListener('pointerleave',()=>{hovering=false;schedule();});
    document.addEventListener('visibilitychange',schedule);
    gallery.addEventListener('gallery-mode',schedule);
    gallery.addEventListener('gallery-detail-open',()=>setPlaying(false));
    motion.addEventListener('change',()=>{if(motion.matches)setPlaying(false);});
    if ('IntersectionObserver' in window) {
      const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;schedule();},{threshold:0.2});
      observer.observe(gallery);
    }
    setPlaying(gallery.hasAttribute('data-gallery-autoplay')&&!motion.matches);
    preloadNext();
  }
  if (stack) setupMobilePhotoView(gallery,stack,photos);
}

if (document.querySelector('[data-spin-frames]')) {
  import('/assets/spin-viewer.js?v=1').then(({bindSpinViewers})=>bindSpinViewers(document));
}

for (const media of $$('[data-listing-media]')) {
  const tabs=$$('[data-media-tab]',media);
  const panes=$$('[data-media-pane]',media);
  const video=$('[data-listing-video]',media);
  if (video) video.addEventListener('error',()=>{$('[data-video-error]',media).hidden=false;});
  for (const tab of tabs) tab.addEventListener('click',()=>{
    const mode=tab.dataset.mediaTab;
    for (const button of tabs) button.setAttribute('aria-pressed',String(button===tab));
    for (const pane of panes) pane.hidden=pane.dataset.mediaPane!==mode;
    $('[data-gallery]',media)?.dispatchEvent(new Event('gallery-mode'));
    if (mode==='video'&&!video.hasAttribute('src')) video.src=video.dataset.listingVideo;
    if (mode!=='video'&&video&&!video.paused) video.pause();
  });
}

for (const details of $$('[data-gallery-details]')) {
  const items=parse(details.dataset.galleryDetails,[]);
  const media=details.closest('.showcase-media');
  const gallery=$('[data-gallery]',media);
  const source=$('[data-gallery-image]',gallery);
  const main=$('.gallery-main',gallery);
  const hotspots=$$('.gallery-hotspot',details);
  const dialog=$('[data-gallery-detail-preview]',details);
  const heading=$('[data-gallery-detail-title]',dialog);
  const viewport=$('[data-gallery-detail-photo]',dialog);
  const image=$('[data-gallery-detail-image]',dialog);
  const error=$('[data-gallery-detail-error]',dialog);
  let opener;

  function placeHotspots() {
    const displayed=source.getBoundingClientRect();
    const bounds=main.getBoundingClientRect();
    const area=media.getBoundingClientRect();
    const ratio=source.naturalWidth/source.naturalHeight||16/9;
    const {objectFit,objectPosition}=getComputedStyle(source);
    const width=objectFit==='cover'?Math.max(displayed.width,displayed.height*ratio):Math.min(displayed.width,displayed.height*ratio);
    const height=width/ratio;
    const left=displayed.right-width;
    const top=objectPosition.endsWith('100%')?displayed.bottom-height:displayed.top+(displayed.height-height)/2;
    for (const point of hotspots) {
      const item=items[Number(point.dataset.openPhotoDetail)];
      const x=left+width*item.x/100,y=top+height*item.y/100;
      point.hidden=source.getAttribute('src')!==item.url||x<bounds.left+22||x>bounds.right-22||y<bounds.top+22||y>bounds.bottom-22;
      if (point.hidden) continue;
      point.style.left=(x-area.left)+'px';
      point.style.top=(y-area.top)+'px';
    }
  }

  if (hotspots.length) {
    source.addEventListener('load',placeHotspots);
    gallery.addEventListener('gallery-photo-change',placeHotspots);
    gallery.addEventListener('gallery-mode',placeHotspots);
    if ('ResizeObserver' in window) new ResizeObserver(placeHotspots).observe(main);
    else window.addEventListener('resize',placeHotspots,{passive:true});
    placeHotspots();
  }
  media.addEventListener('click',event=>{
    const button=event.target.closest('[data-open-photo-detail]');
    if (!button||dialog.open) return;
    const item=items[Number(button.dataset.openPhotoDetail)];
    if (!item) return;
    opener=button;
    gallery.dispatchEvent(new Event('gallery-detail-open'));
    $('[data-listing-video]',media)?.pause();
    heading.textContent=image.alt=item.label;
    viewport.toggleAttribute('data-detail-zoom',Number.isFinite(item.x));
    if (Number.isFinite(item.x)) {
      viewport.style.setProperty('--detail-x',item.x+'%');
      viewport.style.setProperty('--detail-y',item.y+'%');
    }
    error.hidden=true;
    viewport.classList.remove('is-loaded');
    image.src=item.url;
    if (image.complete&&image.naturalWidth) viewport.classList.add('is-loaded');
    dialog.showModal();
  });
  image.addEventListener('load',()=>viewport.classList.add('is-loaded'));
  image.addEventListener('error',()=>{error.hidden=false;});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{if(!dialog.open&&!opener?.hidden)opener?.focus({preventScroll:true});});
  details.hidden=false;
}

const chat=$('section.chat[data-thread]');
let chatUpdating=false,previousMessages=$('[data-bubbles]')?.innerHTML||'';
async function refreshThread(mark=false) {
  if (!chat||chatUpdating||document.hidden) return;
  chatUpdating=true;
  try {
    const html=await fragment('thread/'+chat.dataset.thread);
    const bubbles=$('[data-bubbles]',chat);
    if (html!==previousMessages) {
      const nearBottom=bubbles.scrollHeight-bubbles.scrollTop-bubbles.clientHeight<100;
      bubbles.innerHTML=html;previousMessages=html;
      if (mark||nearBottom) bubbles.scrollTop=bubbles.scrollHeight;
    }
    if (mark||document.hasFocus()) await request('/messages/'+chat.dataset.thread+'/read',{method:'POST',data:{}});
  } catch (err) {if(mark)toast(err.message,true);}
  finally {chatUpdating=false;}
}
if (chat) {
  const bubbles=$('[data-bubbles]',chat);
  bubbles.scrollTop=bubbles.scrollHeight;
  refreshThread(true);
  setInterval(()=>refreshThread(false),18000);
  $('[data-refresh-thread]',chat).addEventListener('click',()=>refreshThread(true));
}
const profileType=$('[data-profile-type]');
profileType?.addEventListener('change',()=>{
  const company=$('[data-company-fields]');
  company.hidden=company.disabled=profileType.value!=='company';
});

const installButton=$('[data-install]');
if (installButton) {
  let installEvent,installed=false;
  const status=$('[data-install-status]');
  const standalone=matchMedia('(display-mode: standalone)');
  const isInstalled=()=>installed||standalone.matches||navigator.standalone;
  const showInstallStatus=message=>{
    status.textContent=message;
    status.hidden=false;
  };
  const syncInstall=()=>{
    installButton.hidden=!installEvent||isInstalled();
    if (isInstalled()) showInstallStatus(t('Aplikacja jest zainstalowana.','The app is installed.'));
  };
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installEvent=event;
    syncInstall();
  });
  window.addEventListener('appinstalled',()=>{
    installed=true;
    installEvent=null;
    syncInstall();
  });
  standalone.addEventListener?.('change',syncInstall);
  installButton.addEventListener('click',async()=>{
    if (!installEvent||isInstalled()) return;
    const prompt=installEvent;
    installEvent=null;
    syncInstall();
    try {
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if (choice?.outcome==='dismissed'&&!isInstalled()) {
        showInstallStatus(t('Instalacja została anulowana. Wciąż możesz dodać aplikację z menu przeglądarki.',
          'Installation was cancelled. You can still add the app from your browser menu.'));
      }
    } catch {
      if (!isInstalled()) showInstallStatus(t('Użyj poniższej instrukcji dla swojego urządzenia.','Follow the instructions for your device below.'));
    }
  });
  syncInstall();
}
if ('serviceWorker' in navigator && isSecureContext) {
  navigator.serviceWorker.register('/sw.js').then(async ()=>{
    const registration=await navigator.serviceWorker.ready;
    registration.active?.postMessage({language:lang});
  }).catch(()=>{});
}

const viewport=window.visualViewport;
let fullHeight=viewport?.height||innerHeight, lastWidth=innerWidth;
function keyboardSpace() {
  const current=viewport?.height||innerHeight;
  if (Math.abs(lastWidth-innerWidth)>25) {fullHeight=current;lastWidth=innerWidth;}
  fullHeight=Math.max(fullHeight,current);
  const editing=document.activeElement?.matches('input:not([type=checkbox]):not([type=file]), textarea, select');
  const reduced=editing&&fullHeight-current>125;
  root.classList.toggle('keyboard-open',Boolean(reduced));
}
viewport?.addEventListener('resize',keyboardSpace);
window.addEventListener('orientationchange',()=>{fullHeight=0;setTimeout(keyboardSpace,250);});
document.addEventListener('focusin',keyboardSpace);
document.addEventListener('focusout',()=>setTimeout(keyboardSpace,150));

const IMAGE_LIMIT=12*1024*1024;
async function compressPhoto(file,thumb=true,mainSize=2560,studioCapture=false) {
  if (!file || file.size>IMAGE_LIMIT) throw new Error(t('Maksymalny rozmiar pliku to 12 MB.','The file size limit is 12 MB.'));
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const text=String.fromCharCode(...header);
  const valid=(header[0]===255&&header[1]===216)||(header[0]===137&&text.slice(1,4)==='PNG')||(text.slice(0,4)==='RIFF'&&text.slice(8,12)==='WEBP');
  if (!valid) throw new Error(t('Wybierz plik JPEG, PNG lub WebP.','Choose a JPEG, PNG or WebP file.'));
  let image, url;
  try {
    if (typeof createImageBitmap==='function') image=await createImageBitmap(file,{imageOrientation:'from-image'});
    else {
      image=new Image();url=URL.createObjectURL(file);image.src=url;await image.decode();
    }
    if (!image.width||!image.height||image.width*image.height>48e6) throw new Error();
    const encode=async size=>{
      const ratio=Math.min(1,size/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*ratio));
      canvas.height=Math.max(1,Math.round(image.height*ratio));
      const context=canvas.getContext('2d',{alpha:false});
      context.fillStyle='#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const encodeType=type=>new Promise(resolve=>canvas.toBlob(resolve,type,size>1000?.92:.79));
      try {
        const preferred=studioCapture?await encodeType('image/webp'):null;
        if (preferred?.type==='image/webp') return preferred;
        const jpeg=await encodeType('image/jpeg');
        if (!jpeg) throw new Error();
        return jpeg;
      } finally {canvas.width=canvas.height=1;}
    };
    // Studio files have already been oriented, downscaled and stripped of metadata.
    const reuseMain=studioCapture&&Math.max(image.width,image.height)<=mainSize&&['image/jpeg','image/webp'].includes(file.type);
    return [reuseMain?file:await encode(mainSize),thumb?await encode(560):null];
  } catch {
    throw new Error(t('Nie można odczytać zdjęcia. Sprawdź plik i ponów próbę.','The image could not be read. Check the file and try again.'));
  } finally {image?.close?.();if(url)URL.revokeObjectURL(url);}
}

const wizard=$('[data-wizard]');
if (wizard) {
  const key=wizard.dataset.wizard;
  const state={step:Number(wizard.dataset.step),version:Number(wizard.dataset.version),photos:parse(wizard.dataset.photos,[]),
    photoDetails:parse(wizard.dataset.photoDetails,{}),smartCamera:parse(wizard.dataset.smartCamera,{}),
    spin:parse(wizard.dataset.spin,[]),video:wizard.dataset.video||null};
  const photoDetailOptions=parse(wizard.dataset.photoDetailOptions,[]);
  const status=$('[data-save-status]',wizard);
  const imageGroups=[
    {field:'photos',route:'photo',grid:$('[data-photo-grid]',wizard),input:$('[data-photo-input]',wizard),errors:$('[data-photo-errors]',wizard),max:30},
    {field:'spin',route:'spin',grid:$('[data-spin-grid]',wizard),input:$('[data-spin-input]',wizard),errors:$('[data-spin-errors]',wizard),max:Number(wizard.dataset.spinMax)}
  ];
  const videoInput=$('[data-video-input]',wizard);
  const videoErrors=$('[data-video-errors]',wizard);
  const videoPreview=$('[data-video-preview]',wizard);
  const videoLabel=$('[data-video-label]',wizard);
  const removeVideo=$('[data-remove-video]',wizard);
  const clearSpin=$('[data-clear-spin]',wizard);
  const next=$('[data-step-next]',wizard);
  const back=$('[data-step-back]',wizard);
  const typeSelect=wizard.elements.namedItem('type');
  const bodySelect=wizard.elements.namedItem('body');
  const fuelSelect=$('[data-fuel]',wizard);
  const profiles=parse(wizard.dataset.vehicleProfiles,null);
  let selectedType=typeSelect.value;
  let queue=Promise.resolve(),timer,change=0,saved=0,working=false,needsRefresh=false;
  const refreshError=()=>new Error(t('Szkic zmienił się w innej karcie. Odśwież stronę, aby kontynuować.','This draft changed in another tab. Reload the page to continue.'));
  function enqueue(work) {
    const result=queue.then(()=>{
      if (needsRefresh) throw refreshError();
      return work();
    });
    queue=result.catch(()=>{});
    return result;
  }
  function readWizard() {
    const data=formData(wizard);
    data.equipment=Object.keys(data).filter(x=>x.startsWith('equip-')&&data[x]).map(x=>x.slice(6));
    for (const name of Object.keys(data)) if (name.startsWith('equip-')) delete data[name];
    data.photoDetails=state.photoDetails;
    return data;
  }
  function drawStep() {
    $$('[data-step-body]',wizard).forEach(section=>{section.hidden=Number(section.dataset.stepBody)!==state.step;});
    $$('[data-step-to]',wizard).forEach(button=>{
      const number=Number(button.dataset.stepTo);
      if(number===state.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      button.classList.toggle('done',number<state.step);
      button.disabled=working;
    });
    back.disabled=state.step===1||working;
    next.disabled=working;
    next.hidden=state.step===5;
  }
  function syncVehicleFields() {
    if (!profiles) return;
    const baseProfile=Object.hasOwn(profiles,typeSelect.value)?profiles[typeSelect.value]:profiles[''];
    if (selectedType!==typeSelect.value) {
      const previous=bodySelect.value;
      bodySelect.replaceChildren(new Option(t('Wybierz','Select'),''),...baseProfile.bodies.map(([value,label])=>new Option(label,value)));
      if (baseProfile.bodies.some(([key])=>key===previous)) bodySelect.value=previous;
      selectedType=typeSelect.value;
    }
    const profile=baseProfile.overrides?.[bodySelect.value]??baseProfile;
    const fuel=fuelSelect.value;
    const enabled={
      motor:profile.motorized,engine:profile.motorized&&fuel!=='electric',electric:profile.motorized&&['electric','plugin'].includes(fuel),
      doors:profile.doors,hours:profile.hours,trailer:typeSelect.value==='trailer'
    };
    for (const group of $$('[data-vehicle-field]',wizard)) {
      group.hidden=!enabled[group.dataset.vehicleField];
      for (const control of $$('input,select',group)) control.disabled=group.hidden;
    }
    const required={body:profile.road,gearbox:profile.road,drive:profile.road,mileage:profile.road,power:profile.road,powerUnit:profile.road,fuel:profile.fuelRequired};
    for (const [name,mandatory] of Object.entries(required)) {
      const control=wizard.elements.namedItem(name);
      control.required=mandatory;
      const star=$('.required',control.closest('.field'));
      if (star) star.hidden=!mandatory;
    }
  }
  async function persist() {
    clearTimeout(timer);
    return enqueue(async()=>{
      const revision=change;
      report(status,t('Zapisywanie szkicu…','Saving draft…'));
      const result=await request('/listings/'+key+'/edit',{method:'PUT',data:{data:readWizard(),photos:state.photos,spin:state.spin,
        video:state.video,version:state.version,step:state.step}});
      state.version=result.version;
      if (result.smartCamera) state.smartCamera=result.smartCamera;
      if (result.smartCamera&&revision===change&&Object.keys(result.smartCamera.frames||{}).length) state.spin=result.spin;
      saved=revision;
      report(status,t('Szkic zapisany na koncie.','Draft saved to your account.'));
      return result;
    }).catch(err=>{report(status,errorText(err),true);throw err;});
  }
  const autoSave=()=>{
    change++;
    clearTimeout(timer);
    report(status,t('Niezapisane zmiany…','Unsaved changes…'));
    timer=setTimeout(()=>persist().catch(()=>{}),760);
  };
  wizard.addEventListener('input',event=>{if(event.target.type!=='file'&&!event.target.hasAttribute('data-photo-detail'))autoSave();});
  wizard.addEventListener('submit',event=>{event.preventDefault();persist().catch(()=>{});});
  const updateStep=async number=>{
    if (working||number<1||number>5||number===state.step) return;
    state.step=number;
    change++;
    drawStep();
    const header=$('[data-step-body="'+number+'"] h2',wizard);
    header?.setAttribute('tabindex','-1');
    header?.focus({preventScroll:true});
    wizard.scrollIntoView({block:'start',behavior:'instant'});
    await persist().catch(()=>{});
  };
  $$('[data-step-to]',wizard).forEach(btn=>btn.addEventListener('click',()=>updateStep(Number(btn.dataset.stepTo))));
  next.addEventListener('click',()=>updateStep(state.step+1));
  back.addEventListener('click',()=>updateStep(state.step-1));
  $('[data-save-draft]',wizard).addEventListener('click',()=>persist().catch(()=>{}));
  $('[data-preview]',wizard).addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try {await persist();location.assign(localPath('/podglad/'+key));}
    catch {button.disabled=false;}
  });
  typeSelect.addEventListener('change',syncVehicleFields);
  bodySelect.addEventListener('change',syncVehicleFields);
  fuelSelect.addEventListener('change',syncVehicleFields);
  const make=$('[data-wizard-make]',wizard);
  const model=$('[data-wizard-model]',wizard);
  const makeList=$('#make-options',wizard);
  const modelList=$('#model-options',wizard);
  const catalog=parse(wizard.dataset.vehicleCatalog,{});
  const makesForType=()=>Object.hasOwn(catalog,typeSelect.value)?catalog[typeSelect.value]:{};
  function updateModelSuggestions() {
    const makes=makesForType();
    const models=Object.hasOwn(makes,make.value)?makes[make.value]:[];
    modelList.replaceChildren(...models.map(name=>new Option('',name)));
    return models;
  }
  typeSelect.addEventListener('change',()=>{
    makeList.replaceChildren(...Object.keys(makesForType()).map(name=>new Option('',name)));
    updateModelSuggestions();
  });
  let lastMake=make.value;
  make.addEventListener('change',()=>{
    const available=updateModelSuggestions();
    if (make.value!==lastMake&&available.length&&!available.includes(model.value)) model.value='';
    lastMake=make.value;
    autoSave();
  });

  function drawImages(group) {
    const isSpin=group.field==='spin';
    const items=state[group.field];
    group.grid.replaceChildren(...items.map((photo,index)=>{
      const card=document.createElement('article');card.className=isSpin?'edit-photo':'edit-photo listing-photo-editor';
      const img=new Image();img.src=localPath('/media/'+photo+'/thumb');img.loading='lazy';
      img.alt=(isSpin?t('Klatka 360°','360° frame'):t('Zdjęcie','Photo'))+' '+(index+1);
      const label=document.createElement('strong');label.textContent=!isSpin&&index===0?t('Zdjęcie główne','Cover photo'):img.alt;
      const buttons=document.createElement('div');buttons.className='photo-controls';
      const actions=[
        ...(!isSpin?[
          ['studio',t('Zmień tło','Change background'),items.length>=group.max],
          ...(index===0?[]:[['cover',t('Ustaw jako główne','Set as cover'),false]])
        ]:[]),
        ...(!isSpin||!Object.keys(state.smartCamera.frames||{}).length?[
          ['up',t('Przesuń wcześniej','Move earlier'),index===0],
          ['down',t('Przesuń później','Move later'),index===items.length-1]
        ]:[]),
        ['delete',isSpin?t('Usuń klatkę','Remove frame'):t('Usuń zdjęcie','Remove photo'),false]
      ];
      const symbols={up:'↑',down:'↓',delete:'×'};
      for (const [action,caption,disabled] of actions) {
        const button=document.createElement('button');button.type='button';button.className='btn small';
        button.dataset.photoAction=action;button.dataset.photoId=photo;button.disabled=disabled||working;
        const symbol=!isSpin&&symbols[action];
        button.textContent=symbol||caption;
        if (symbol) {
          button.setAttribute('aria-label',caption);
          button.title=caption;
        }
        buttons.append(button);
      }
      card.append(img,label);
      if (!isSpin) {
        const field=document.createElement('label');
        field.className='field photo-detail-field';
        const caption=document.createElement('span');
        caption.textContent=t('Zbliżenie w galerii (+)','Gallery close-up (+)');
        const select=document.createElement('select');
        select.dataset.photoDetail=photo;
        select.disabled=working;
        select.append(new Option(t('Bez etykiety','No label'),''),...photoDetailOptions.map(([key,text])=>new Option(text,key)));
        select.value=state.photoDetails[photo]||'';
        select.addEventListener('change',()=>{
          if (select.value) state.photoDetails[photo]=select.value;
          else delete state.photoDetails[photo];
          autoSave();
        });
        field.append(caption,select);
        card.append(field);
      }
      card.append(buttons);
      return card;
    }));
  }
  function drawMedia() {
    for (const group of imageGroups) {
      group.input.disabled=working||(group.field==='spin'&&state.spin.length>0&&Object.keys(state.smartCamera.frames||{}).length>0);
      drawImages(group);
    }
    clearSpin.hidden=!state.spin.length;
    clearSpin.disabled=working;
    const guidedCount=Object.keys(state.smartCamera.frames||{}).length?state.smartCamera.spinCount:null;
    $('[data-spin-count]',wizard).textContent=state.spin.length+' / '+(guidedCount||wizard.dataset.spinMax);
    const warning=$('[data-spin-warning]',wizard);
    warning.hidden=!state.spin.length||state.spin.length>=(guidedCount||Number(wizard.dataset.spinMin));
    if (guidedCount) warning.textContent=t('Dokończ serię w studiu przed publikacją.','Finish the studio sequence before submitting.');
    else warning.textContent=t('Uzupełnij serię do 8 klatek albo usuń ją przed publikacją.','Add at least 8 frames or remove the sequence before submitting.');
    videoInput.disabled=working;
    removeVideo.hidden=!state.video;
    removeVideo.disabled=working;
    videoLabel.textContent=state.video?t('Zmień rolkę','Replace reel'):t('Dodaj rolkę','Add reel');
    videoInput.setAttribute('aria-label',videoLabel.textContent);
    $('[data-video-status]',wizard).textContent=state.video?t('Dodano','Added'):'';
    videoPreview.hidden=!state.video;
    const url=state.video?localPath('/wideo/'+state.video):'';
    if (url&&videoPreview.getAttribute('src')!==url) videoPreview.src=url;
    if (!url&&videoPreview.hasAttribute('src')) {
      videoPreview.pause();videoPreview.removeAttribute('src');videoPreview.load();
    }
  }
  function saveMediaChange() {
    change++;
    drawMedia();
    persist().catch(()=>{});
  }
  async function withMediaUpload(task) {
    working=true;
    drawStep();drawMedia();
    try {return await task();}
    finally {working=false;drawStep();drawMedia();}
  }
  async function uploadMedia(route,body,headers={}) {
    if (change!==saved) await persist();
    return enqueue(async()=>{
      const result=await request('/listings/'+key+'/'+route,{method:'POST',body,headers:{
        'Content-Type':'application/octet-stream','X-Edit-Version':String(state.version),...headers
      }});
      if (result.needsRefresh) {
        needsRefresh=true;
        const reload=document.createElement('button');
        reload.type='button';reload.className='btn';reload.textContent=t('Wczytaj aktualny szkic','Reload the current draft');
        reload.addEventListener('click',()=>location.reload());
        status.after(reload);
        const error=refreshError();
        report(status,error.message,true);
        throw error;
      }
      Object.assign(state,{version:result.version,photos:result.photos,spin:result.spin,video:result.video});
      if (result.smartCamera) state.smartCamera=result.smartCamera;
      if (result.photoDetails) state.photoDetails=result.photoDetails;
      drawMedia();
      return result;
    });
  }
  async function sendImage(group,file) {
    const isSpin=group.field==='spin';
    if (state[group.field].length>=group.max) throw new Error(isSpin?t('Maksymalnie 36 klatek widoku 360°.','Up to 36 frames for the 360° view.'):
      t('Maksymalnie 30 zdjęć.','Up to 30 photos.'));
    const [main,thumb]=await compressPhoto(file,true,isSpin?1200:1800);
    const result=await uploadMedia(group.route,new Blob([main,thumb]),{'X-Image-Length':String(main.size)});
    report(status,result.duplicate?t('To ujęcie już jest na liście.','This image is already in the list.'):
      isSpin?t('Klatkę zapisano w szkicu.','The frame was saved to your draft.'):t('Zdjęcie zapisano w szkicu.','The photo was saved to your draft.'));
  }
  const cameraButtons=$$('[data-camera-open]',wizard);
  async function launchCamera(mode) {
    if (working||cameraButtons.some(button=>button.disabled)) return;
    cameraButtons.forEach(button=>{button.disabled=true;});
    try {
      const [{openSmartCamera},{steps}]=await Promise.all([import('/smart-camera.js'),import('/smart-camera-guides.js')]);
      if (change!==saved) await persist();
      const angles=new Map(steps.map(step=>[step.id,step.angle]));
      const mediaItem=id=>({id,url:localPath('/media/'+id),thumb:localPath('/media/'+id+'/thumb')});
      const getMedia=()=>{
        const camera=state.smartCamera;
        const shotById=new Map(Object.entries(camera.shots||{}).map(([shot,id])=>[id,shot]));
        const angleById=new Map(Object.entries(camera.frames||{}).map(([angle,id])=>[id,Number(angle)]));
        return {smartCamera:camera,skipped:camera.skipped||[],spinCount:camera.spinCount,
          photos:state.photos.map(id=>({...mediaItem(id),shotKey:shotById.get(id),angle:angles.get(shotById.get(id))})),
          spin:state.spin.map(id=>({...mediaItem(id),angle:angleById.get(id),count:camera.spinCount}))};
      };
      const progress=async action=>{
        if (change!==saved) await persist();
        await enqueue(async()=>{
          const result=await request('/listings/'+key+'/edit',{method:'PUT',data:{version:state.version,...action}});
          state.version=result.version;
          state.smartCamera=result.smartCamera;
        });
      };
      const spinHeaders=({count,angle})=>({'X-Studio-Frames':String(count),'X-Studio-Angle':String(angle)});
      const captureHeaders=({replaceId,captureId})=>({...replaceId&&{'X-Studio-Replace':replaceId},
        ...captureId&&{'X-Studio-Capture-Id':captureId}});
      await openSmartCamera({t,listingId:JSON.stringify([prefix,user,key]),vehicle:{type:typeSelect.value,body:bodySelect.value},
        getMedia,
        async updateProgress({skipped,spinCount}) {
          if (spinCount!=null&&spinCount!==state.smartCamera.spinCount) await progress({studioCount:spinCount});
          if (skipped) {
            const previous=state.smartCamera.skipped||[];
            for (const shot of new Set([...previous,...skipped])) {
              if (previous.includes(shot)!==skipped.includes(shot)) await progress({studioSkip:{shot,skip:skipped.includes(shot)}});
            }
          }
          return getMedia();
        },
        async save(capture) {
          const spin=capture.mode==='spin';
          await withMediaUpload(async()=>{
            const [main,thumb]=await compressPhoto(capture.file,true,2200,true);
            await uploadMedia(spin?'spin':'photo',new Blob([main,thumb]),{'X-Image-Length':String(main.size),
              ...spin?spinHeaders(capture):{'X-Studio-Shot':capture.key},...captureHeaders(capture)});
          });
          return getMedia();
        },
        async reuse(capture) {
          await withMediaUpload(()=>uploadMedia('spin',null,{...spinHeaders(capture),...captureHeaders(capture),'X-Studio-Reuse':capture.id}));
          return getMedia();
        },
        showGallery() {
          const gallery=imageGroups[0].grid;
          gallery.tabIndex=-1;gallery.focus();gallery.scrollIntoView({block:'center'});
        }
      },{mode});
    } catch (error) {report(status,errorText(error),true);toast(errorText(error),true);}
    finally {cameraButtons.forEach(button=>{button.disabled=false;});}
  }
  cameraButtons.forEach(button=>button.addEventListener('click',()=>launchCamera(button.dataset.cameraOpen)));
  async function sendVideo(file) {
    if (file.size>Number(wizard.dataset.videoLimit)) throw new Error(t('Maksymalny rozmiar wideo to 24 MB.','The video size limit is 24 MB.'));
    if (!/\.(mp4|webm)$/i.test(file.name)&&!['video/mp4','video/webm'].includes(file.type))
      throw new Error(t('Wybierz wideo MP4 (H.264) lub WebM.','Choose an MP4 (H.264) or WebM video.'));
    report(status,t('Przesyłanie wideo…','Uploading video…'));
    await uploadMedia('video',file);
    report(status,t('Wideo zapisano w szkicu.','The video was saved to your draft.'));
  }
  function showMediaError(errors,file,err,retryUpload) {
    const line=document.createElement('div');line.className='flash warn';
    const message=document.createElement('span');message.textContent=file.name+' · '+err.message;
    const retry=document.createElement('button');retry.type='button';retry.className='btn small';retry.textContent=t('Ponów','Retry');
    retry.addEventListener('click',async()=>{
      if (working) return;
      retry.disabled=true;
      try {await withMediaUpload(retryUpload);line.remove();}catch(error){message.textContent=file.name+' · '+error.message;retry.disabled=false;}
    });
    line.append(message,retry);errors.append(line);
  }
  for (const group of imageGroups) {
    group.grid.addEventListener('click',event=>{
      const button=event.target.closest('[data-photo-action]');
      if (!button||working) return;
      const items=state[group.field];
      const index=items.indexOf(button.dataset.photoId);
      if (index<0) return;
      const action=button.dataset.photoAction;
      if (action==='studio') {
        const dialog=$('[data-photo-studio]');
        import('/assets/showroom/editor.js?v=8').then(({openPhotoStudio})=>openPhotoStudio(dialog,
          localPath('/media/'+items[index]),file=>withMediaUpload(()=>sendImage(group,file)),t))
          .catch(()=>toast(t('Nie udało się otworzyć edytora tła.','Could not open the background editor.'),true));
        return;
      }
      const [photo]=items.splice(index,1);
      if (action!=='delete') items.splice(action==='cover'?0:action==='up'?index-1:index+1,0,photo);
      else if (group.field==='photos') delete state.photoDetails[photo];
      saveMediaChange();
    });
    group.input.addEventListener('change',async()=>{
      const files=Array.from(group.input.files);
      group.input.value='';
      if (working||!files.length) return;
      if (group.field==='spin') files.sort((a,b)=>a.name.localeCompare(b.name,lang,{numeric:true}));
      await withMediaUpload(async()=>{
        for (const file of files) {
          const upload=()=>sendImage(group,file);
          try {await upload();}catch(err){showMediaError(group.errors,file,err,upload);}
        }
      });
    });
  }
  clearSpin.addEventListener('click',()=>{state.spin=[];saveMediaChange();});
  removeVideo.addEventListener('click',()=>{state.video=null;saveMediaChange();});
  videoInput.addEventListener('change',async()=>{
    const file=videoInput.files[0];
    videoInput.value='';
    if (working||!file) return;
    videoErrors.replaceChildren();
    const upload=()=>sendVideo(file);
    try {await withMediaUpload(upload);}catch(err){showMediaError(videoErrors,file,err,upload);report(status,'');}
  });
  window.addEventListener('beforeunload',event=>{
    if(change!==saved||working){event.preventDefault();event.returnValue='';}
  });
  drawStep();syncVehicleFields();drawMedia();
}

for (const form of $$('[data-asset]')) {
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('button[type=submit]',form),status=$('[data-form-status]',form);
    button.disabled=true;
    report(status,t('Przesyłanie…','Uploading…'));
    try {
      const kind=form.dataset.asset;
      const size=kind==='avatar'?800:['company','panorama'].includes(kind)?2400:2560;
      const [main]=await compressPhoto(form.elements.photo.files[0],false,size);
      await request('/asset/'+form.dataset.asset,{method:'POST',body:main,headers:{'Content-Type':'application/octet-stream'}});
      const section=form.closest('#zdjecia-profilu');
      if (section) history.replaceState(null,'','#'+section.id);
      location.reload();
    } catch (error) {report(status,error.message,true);}
    finally {button.disabled=false;}
  });
}

const importer=$('[data-import]');
if (importer) {
  const status=$('[data-form-status]',importer),map=$('[data-mapping]',importer),columns=$('[data-columns]',map);
  const commit=$('[data-import-commit]',importer),preview=$('button[type=submit]',importer);
  const fields=parse(importer.dataset.fields,[]);
  const reportTarget=$('[data-import-report]',importer);
  let checked=null,filename='',csv='',lastHeader='';
  function drawMapping(header) {
    const signature=JSON.stringify(header);
    if (signature===lastHeader) return;
    lastHeader=signature;
    columns.replaceChildren(...fields.map(key=>{
      const label=document.createElement('label');label.className='field';
      const caption=document.createElement('span');caption.textContent=fieldLabels[key]||key;
      const select=document.createElement('select');select.dataset.mapKey=key;
      select.add(new Option(t('Pomiń','Skip'),''));
      for (const name of header) select.add(new Option(name,name));
      select.value=header.includes(key)?key:'';
      label.append(caption,select);
      return label;
    }));
    map.hidden=false;
  }
  function drawRows(items) {
    const container=document.createElement('div');container.className='table-scroll';container.tabIndex=0;
    const table=document.createElement('table'),header=table.createTHead().insertRow();
    for (const name of [t('Wiersz','Row'),'ID',t('Samochód','Vehicle'),t('Wynik','Result')]) {
      const th=document.createElement('th');th.textContent=name;th.scope='col';header.append(th);
    }
    const body=table.createTBody();
    for (const item of items) {
      const row=body.insertRow();
      for (const value of [item.line,item.externalId,[item.make,item.model].filter(Boolean).join(' ')]) row.insertCell().textContent=value;
      const result=row.insertCell();
      if (item.error) result.textContent=item.error;
      else if (item.listingId) {
        const a=document.createElement('a');a.href=localPath('/podglad/'+item.listingId);
        a.textContent=item.status==='published'?t('Opublikowano','Published'):t('W moderacji','In review');result.append(a);
      } else result.textContent=item.state==='update'?t('Aktualizacja','Update'):t('Nowa oferta','New listing');
    }
    container.append(table);reportTarget.replaceChildren(container);
  }
  importer.addEventListener('change',event=>{
    checked=null;commit.hidden=true;
    if (event.target===importer.elements.file) {lastHeader='';map.hidden=true;columns.replaceChildren();reportTarget.replaceChildren();}
  });
  importer.addEventListener('submit',async event=>{
    event.preventDefault();preview.disabled=true;commit.hidden=true;
    report(status,t('Sprawdzanie pliku…','Checking the file…'));
    try {
      const file=importer.elements.file.files[0];
      if (!file||file.size>220000) throw new Error(t('Wybierz plik CSV do 220 KB.','Choose a CSV file up to 220 KB.'));
      csv=await file.text();filename=file.name;
      const mapping=Object.fromEntries($$('[data-map-key]',columns).map(node=>[node.dataset.mapKey,node.value]));
      const payload={csv,filename,source:importer.elements.source.value,rights:importer.elements.rights.checked,mapping,key:importer.elements.key.value,...(importer.dataset.market==='robotics'?{market:'robotics'}:{})};
      const result=await request('/dealer/preview',{method:'POST',data:payload});
      drawMapping(result.header);drawRows(result.rows);
      checked=payload;commit.hidden=!result.rows.some(x=>!x.error);
      if (!result.rows.some(x=>!x.error)) map.open=true;
      report(status,t('Podgląd gotowy. Popraw błędy lub zatwierdź poprawne wiersze.','Preview ready. Correct errors or confirm valid rows.'));
    } catch (err) {report(status,err.message,true);}
    finally {preview.disabled=false;}
  });
  commit.addEventListener('click',async()=>{
    if(!checked)return;
    if(!window.confirm(t('Przesłać poprawne oferty do sprawdzenia? Aktualizowane oferty, które wymagają decyzji moderatora, zostaną czasowo ukryte.','Submit valid listings for review? Updated listings that need a moderator will be temporarily hidden.')))return;
    commit.disabled=true;preview.disabled=true;
    report(status,t('Importowanie ofert…','Importing listings…'));
    try {
      const result=await request('/dealer/import',{method:'POST',data:{...checked,confirm:true}});
      drawRows(result.rows);
      report(status,t('Zapisane oferty','Listings saved')+' · '+result.valid);
      importer.elements.key.value=crypto.randomUUID();commit.hidden=true;checked=null;
    } catch (err) {report(status,err.message,true);}
    finally {commit.disabled=false;preview.disabled=false;}
  });
}
