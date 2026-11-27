import { defaultSoundSettings, soundCatalog, soundCategories, soundEvents } from './sound-catalog.js?v=1';
import { createSoundEngine, normalizeSoundSettings } from './sound-engine.js?v=1';

const storageKey='a4-sound-garage-v1';
const priceKey='a4-sound-prices-v1';
const sessionStartKey='a4-sound-session-start-v1';
const sessionCursorKey='a4-sound-events-cursor-v1';
const eventKeys=new Set(soundEvents.map(([key])=>key));
const root=document.body;
const language=root.dataset.lang||'pl';
const translate=(pl,en)=>language==='pl'?pl:en;
const prefix=root.dataset.prefix||'';
const marketPrefix=root.dataset.market==='robotics'?'/roboty':'';
const apiPath=path=>prefix+marketPrefix+'/api'+path;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const readSession=key=>{try{return sessionStorage.getItem(key);}catch{return null;}};
const writeSession=(key,value)=>{try{sessionStorage.setItem(key,value);}catch{}};

const engine=createSoundEngine();
let settings=normalizeSoundSettings(read(storageKey,defaultSoundSettings()));
let saveTimer;

async function request(path,options={}) {
  const response=await fetch(apiPath(path),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.ok)throw new Error(result?.error||'sound-request-failed');
  return result;
}

async function loadSettings() {
  if(!root.dataset.user)return settings;
  try {
    const result=await request('/sound-settings');
    if(result.settings)settings=normalizeSoundSettings(result.settings);
    else await request('/sound-settings',{method:'PUT',body:JSON.stringify({settings})});
    write(storageKey,settings);
  }catch{}
  return settings;
}

function saveSettings() {
  settings=normalizeSoundSettings(settings);write(storageKey,settings);
  document.dispatchEvent(new CustomEvent('soundgarage:settings',{detail:settings}));
  const status=document.querySelector('[data-sound-save-status]');
  if(status)status.textContent=translate('Zapisano na tym urządzeniu.','Saved on this device.');
  if(!root.dataset.user)return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try {
      const result=await request('/sound-settings',{method:'PUT',body:JSON.stringify({settings})});
      settings=normalizeSoundSettings(result.settings);write(storageKey,settings);
      if(status)status.textContent=translate('Zapisano na koncie.','Saved to your account.');
    }catch{if(status)status.textContent=translate('Zapis lokalny. Synchronizacja konta nie powiodła się.','Saved locally. Account sync failed.');}
  },420);
}

async function playEvent(eventKey,override={}) {
  if(!eventKeys.has(eventKey))return false;
  const preference=settings.events[eventKey];
  if(preference.muted||preference.volume<=0)return false;
  await engine.play(preference.soundId,{kind:eventKey==='appStart'?'start':'notification',volume:preference.volume,...override});
  return true;
}

function blockedStart() {
  const screen=document.querySelector('.launch-screen');
  const button=document.querySelector('[data-engine-start]');
  if(screen&&button) {
    screen.setAttribute('aria-hidden','false');button.hidden=false;
    document.documentElement.classList.add('sound-start-required');
  }
}

function finishStartPrompt() {
  document.querySelector('[data-engine-start]')?.setAttribute('hidden','');
  document.documentElement.classList.remove('sound-start-required');
  document.querySelector('.launch-screen')?.setAttribute('aria-hidden','true');
}

async function appStart() {
  if(readSession(sessionStartKey))return;
  writeSession(sessionStartKey,'attempted');
  if(settings.events.appStart.muted||settings.events.appStart.volume<=0){writeSession(sessionStartKey,'muted');return;}
  try {await playEvent('appStart');writeSession(sessionStartKey,'played');}
  catch {blockedStart();}
}

function installStartPrompt() {
  const button=document.querySelector('[data-engine-start]');
  if(button)button.addEventListener('click',async()=>{
    button.disabled=true;
    try {await playEvent('appStart');writeSession(sessionStartKey,'played');finishStartPrompt();}
    catch {button.disabled=false;}
  });
  const unlock=async event=>{
    if(event.target.closest?.('[data-engine-start]'))return;
    if(readSession(sessionStartKey)!=='attempted')return;
    try {await playEvent('appStart');writeSession(sessionStartKey,'played');finishStartPrompt();document.removeEventListener('pointerup',unlock);}
    catch{}
  };
  document.addEventListener('pointerup',unlock,{passive:true});
}

function optionMarkup(selected) {
  const favorites=new Set(settings.favorites);
  return [...soundCatalog].sort((a,b)=>(favorites.has(b.id)-favorites.has(a.id))||a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name))
    .map(item=>`<option value="${item.id}"${item.id===selected?' selected':''}>${favorites.has(item.id)?'★ ':''}${item.brand} · ${item.name}</option>`).join('');
}

function renderGarage() {
  const garage=document.querySelector('[data-sound-garage]');
  if(!garage)return;
  const search=garage.querySelector('[data-sound-search]');
  const category=garage.querySelector('[data-sound-category]');
  const favoriteOnly=garage.querySelector('[data-sound-favorites-only]');
  const catalogNode=garage.querySelector('[data-sound-catalog]');
  const eventNode=garage.querySelector('[data-sound-events]');
  category.innerHTML=`<option value="">${translate('Wszystkie kategorie','All categories')}</option>`+Object.entries(soundCategories).map(([key,label])=>`<option value="${key}">${label[language==='pl'?0:1]}</option>`).join('');
  const updateCatalog=()=>{
    const query=search.value.trim().toLocaleLowerCase(language);
    const favorites=new Set(settings.favorites);
    const visible=soundCatalog.filter(item=>(!category.value||item.category===category.value)&&(!favoriteOnly.checked||favorites.has(item.id))&&(!query||`${item.brand} ${item.name}`.toLocaleLowerCase(language).includes(query)));
    catalogNode.innerHTML=visible.map(item=>`<article class="sound-card" data-sound-id="${item.id}">
      <button type="button" class="sound-favorite" data-sound-favorite aria-pressed="${favorites.has(item.id)}" aria-label="${translate('Dodaj do ulubionych','Add to favorites')}">★</button>
      <div><strong>${item.name}</strong><span>${item.brand} · ${translate('efekt syntetyczny','synthetic effect')}</span></div>
      <button type="button" class="btn sound-preview" data-sound-preview ${item.available?'':'disabled'}>${translate('Odsłuch','Preview')}</button>
    </article>`).join('')||`<p class="muted">${translate('Brak pasujących dźwięków.','No matching sounds.')}</p>`;
  };
  const updateEvents=()=>{
    eventNode.innerHTML=soundEvents.map(([key,pl,en])=>{
      const value=settings.events[key];
      return `<fieldset class="sound-event" data-sound-event="${key}"${value.muted?' data-muted':''}>
        <legend>${translate(pl,en)}</legend>
        <label><span>${translate('Dźwięk','Sound')}</span><select data-sound-select>${optionMarkup(value.soundId)}</select></label>
        <label class="sound-volume"><span>${translate('Głośność','Volume')} <output>${value.volume}%</output></span><input type="range" min="0" max="100" step="1" value="${value.volume}" data-sound-volume></label>
        <label class="settings-switch"><span>${translate('Wycisz zdarzenie','Mute event')}</span><input type="checkbox" role="switch" data-sound-muted${value.muted?' checked':''}></label>
      </fieldset>`;
    }).join('');
  };
  updateCatalog();updateEvents();
  search.addEventListener('input',updateCatalog);category.addEventListener('change',updateCatalog);favoriteOnly.addEventListener('change',updateCatalog);
  catalogNode.addEventListener('click',async event=>{
    const card=event.target.closest('[data-sound-id]');if(!card)return;
    if(event.target.closest('[data-sound-favorite]')) {
      const set=new Set(settings.favorites);set.has(card.dataset.soundId)?set.delete(card.dataset.soundId):set.add(card.dataset.soundId);settings.favorites=[...set];saveSettings();updateCatalog();updateEvents();return;
    }
    if(event.target.closest('[data-sound-preview]')) {
      try {await engine.play(card.dataset.soundId,{kind:'preview',volume:62});}
      catch {blockedStart();}
    }
  });
  eventNode.addEventListener('input',event=>{
    const fieldset=event.target.closest('[data-sound-event]');if(!fieldset)return;
    const value=settings.events[fieldset.dataset.soundEvent];
    if(event.target.matches('[data-sound-select]'))value.soundId=event.target.value;
    if(event.target.matches('[data-sound-volume]')){value.volume=Number(event.target.value);event.target.closest('label').querySelector('output').textContent=value.volume+'%';}
    if(event.target.matches('[data-sound-muted]')){value.muted=event.target.checked;fieldset.toggleAttribute('data-muted',value.muted);}
    saveSettings();
  });
}

async function pollEvents() {
  if(!root.dataset.user||document.hidden)return;
  const after=readSession(sessionCursorKey)||new Date().toISOString();
  try {
    const result=await request('/sound-events?after='+encodeURIComponent(after));
    writeSession(sessionCursorKey,result.cursor);
    const previous=read(priceKey,{});const next=result.favoritePrices||{};
    const changed=Object.keys(next).some(id=>Object.hasOwn(previous,id)&&previous[id]!==next[id]);
    write(priceKey,next);
    const type=changed?'watchedPrice':result.events?.at(-1)?.type;
    if(type)await playEvent(type);
  }catch{}
}

window.BrumbrumSounds={playEvent,play:(id,options)=>engine.play(id,options),stop:engine.stop,menuTone:engine.menuTone,get settings(){return settings;}};
document.addEventListener('brumbrum:sound',event=>playEvent(event.detail?.type).catch(()=>{}));
installStartPrompt();
(async()=>{
  await loadSettings();
  renderGarage();
  await appStart();
  if(root.dataset.user){pollEvents();setInterval(pollEvents,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollEvents();});}
})();
