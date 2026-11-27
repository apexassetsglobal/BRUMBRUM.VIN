(() => {
  const root=document.documentElement;
  const storageKey='a4-ultimate-visual-v1';
  const presetsKey='a4-ultimate-presets-v1';
  const defaults={bgMaterial:'alcantara-graphite',buttonMaterial:'nappa-black',textureIntensity:65,gloss:35,materialContrast:55,darkening:18,patternScale:100,reflectionMotion:false,stitchType:'double',threadPreset:'#ff003c',threadColor:'#ff003c',stitchWidth:2,stitchDensity:10,stitchInset:7,stitchShadow:3,hardwareMetal:'titanium',torx:false,buckle:false,debossing:false,decorTrim:'none',oledMode:'off',oledGlow:45,surfaceBrightness:18,ledColor:'#ff003c',ledHex:'#FF003C',rgbR:255,rgbG:0,rgbB:60,hue:346,saturation:100,alpha:100,lightEnabled:false,animation:'static',speed:35,brightness:85,glowBlur:18,direction:90,buttonBorderMaterial:'silver-chrome',buttonBorderEffect:'solid-led',cardBorderMaterial:'black-chrome',cardBorderEffect:'ambient-glow',borderWidth:2,edgeBrightness:80,edgeGlow:16,coreIntensity:90,borderRadius:12,borderSpeed:30,disableAnimations:false,reduceEffects:false,highContrast:false};
  defaults.engineEnabled=false;
  defaults.ambientEnabled=false;
  defaults.ambientColor='sea';
  defaults.ambientIntensity=10;
  defaults.oledPureBlack=false;
  const bespoke=[
    {bgMaterial:'nappa-black',buttonMaterial:'nappa-black',stitchType:'double',threadColor:'#ff003c',ledColor:'#ff003c',oledMode:'neon-red',lightEnabled:true,animation:'breathing'},
    {bgMaterial:'brushed-steel',buttonMaterial:'brushed-steel',threadColor:'#ffffff',ledColor:'#c0c0c0',oledMode:'silver',lightEnabled:true,animation:'static'},
    {bgMaterial:'dark-titanium',buttonMaterial:'brushed-titanium',ledColor:'#6500ff',oledMode:'titanium',lightEnabled:true,animation:'aurora'},
    {bgMaterial:'oil-slick',buttonMaterial:'iridescent-metal',ledColor:'#00ffff',oledMode:'spectrum',lightEnabled:true,animation:'rainbow-flow',buttonBorderMaterial:'silver-chrome'},
    {bgMaterial:'obsidian-glass',buttonMaterial:'nappa-black',ledColor:'#ff00cc',oledMode:'pure-black',lightEnabled:true,animation:'dual-color'},
    {bgMaterial:'frosted-glass',buttonMaterial:'brushed-steel',ledColor:'#00ccff',oledMode:'cyber-blue',lightEnabled:true,animation:'ice-glow'},
    {bgMaterial:'quilted-black',buttonMaterial:'quilted-black',threadColor:'#ffd700',ledColor:'#ffd700',oledMode:'gold',hardwareMetal:'brass',lightEnabled:true,animation:'breathing'},
    {bgMaterial:'gunmetal',buttonMaterial:'alcantara-rs',threadColor:'#bfff00',ledColor:'#39ff14',oledMode:'pure-black',lightEnabled:true,animation:'neon-chase'},
    {bgMaterial:'brushed-copper',buttonMaterial:'brushed-copper',ledColor:'#ffbf00',oledMode:'pure-black',lightEnabled:true,animation:'fire-glow'},
    {bgMaterial:'matte-ceramic',buttonMaterial:'forged-carbon',threadColor:'#ffffff',ledColor:'#ffffff',oledMode:'pure-black',lightEnabled:true,animation:'static',brightness:32},
    {bgMaterial:'polished-chrome',buttonMaterial:'polished-chrome',ledColor:'#ffffff',torx:true,gloss:90,lightEnabled:true,animation:'moving-edge'},
    {bgMaterial:'obsidian-glass',buttonMaterial:'carbon-twill',ledColor:'#ff00ff',oledMode:'pure-black',lightEnabled:true,animation:'rgb-wave',borderWidth:7,buttonBorderEffect:'rgb-gradient',cardBorderEffect:'flowing-energy'}
  ];
  let state=load(storageKey,defaults), saveTimer;
  const allowed=new Set(Object.keys(defaults));

  function load(key,fallback) {try {const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'?{...fallback,...value}:{...fallback};} catch {return {...fallback};}}
  function normalized(input) {
    const result={...defaults};
    if(!input||typeof input!=='object'||Array.isArray(input)) return result;
    for(const key of allowed) if(typeof input[key]===typeof defaults[key]) result[key]=input[key];
    if(!/^#[\da-f]{6}$/i.test(result.ledColor)) result.ledColor=defaults.ledColor;
    if(!/^#[\da-f]{6}$/i.test(result.threadColor)) result.threadColor=defaults.threadColor;
    result.lightEnabled=false;
    result.ambientEnabled=false;
    result.ambientIntensity=0;
    result.animation='static';
    result.reflectionMotion=false;
    result.disableAnimations=true;
    result.oledMode=result.oledPureBlack?'pure-black':'off';
    result.borderWidth=1;
    result.edgeGlow=0;
    return result;
  }
  function css(name,value,unit='') {root.style.setProperty('--uve-'+name,String(value)+unit);}
  function apply(next,{save=true}={}) {
    state=normalized(next);
    state.ledColor='#000000';
    for(const [key,value] of Object.entries(state)) root.dataset['uve'+key[0].toUpperCase()+key.slice(1)]=String(value);
    css('led',state.ledColor);css('thread',state.threadColor);css('texture',state.textureIntensity/100);css('gloss',state.gloss/100);css('contrast',state.materialContrast/100);css('darkening',state.darkening/100);css('pattern-scale',state.patternScale,'%');css('stitch-width',state.stitchWidth,'px');css('stitch-gap',state.stitchDensity,'px');css('stitch-inset',state.stitchInset,'px');css('stitch-shadow',state.stitchShadow,'px');css('oled-glow',state.oledGlow/100);css('surface',state.surfaceBrightness/100);css('alpha',state.alpha/100);css('speed','0s');css('brightness',state.ambientIntensity/40);css('blur',Math.max(2,state.ambientIntensity*.3),'px');css('direction','0deg');css('border-width','1px');css('edge-brightness',state.ambientIntensity/40);css('edge-glow',Math.max(0,state.ambientIntensity*.3),'px');css('core',state.ambientIntensity/40);css('radius',state.borderRadius,'px');css('border-speed','0s');
    syncControls();
    if(save) persist();
  }
  function persist() {
    try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {}
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>fetch('/api/appearance',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({engine:state})}).catch(()=>{}),900);
  }
  function syncControls() {
    document.querySelectorAll('[data-uve-field]').forEach(control=>{
      const key=control.dataset.uveField;if(!(key in state))return;
      if(control.type==='checkbox')control.checked=Boolean(state[key]);else if(control.type==='radio')control.checked=control.value===state[key];else control.value=state[key];
    });
    document.querySelectorAll('[data-uve-output]').forEach(output=>output.value=state[output.dataset.uveOutput]);
  }
  function rgbToHex(){return '#'+[state.rgbR,state.rgbG,state.rgbB].map(value=>Math.max(0,Math.min(255,+value)).toString(16).padStart(2,'0')).join('');}
  function hslToHex(h,s,l=50){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(value=>Math.round(255*value).toString(16).padStart(2,'0')).join('');}
  function setColor(color){state.ledColor=color.toLowerCase();state.ledHex=color.toUpperCase();const hex=color.slice(1);state.rgbR=parseInt(hex.slice(0,2),16);state.rgbG=parseInt(hex.slice(2,4),16);state.rgbB=parseInt(hex.slice(4),16);apply(state);}
  function readPresets(){return load(presetsKey,{});}
  function writePresets(value){try{localStorage.setItem(presetsKey,JSON.stringify(value));}catch{} renderPresetLists();}
  function renderPresetLists(){const items=readPresets();document.querySelectorAll('[data-uve-saved-list]').forEach(select=>{const current=select.value;select.innerHTML='<option value="">Wybierz zapisany preset</option>'+Object.keys(items).map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');select.value=Object.hasOwn(items,current)?current:'';});}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function panelData(origin){const rootPanel=origin.closest('[data-uve-root]');return {name:rootPanel?.querySelector('[data-uve-preset-name]'),list:rootPanel?.querySelector('[data-uve-saved-list]'),status:rootPanel?.querySelector('[data-uve-status]')};}
  function announce(origin,text){const {status}=panelData(origin);if(status)status.textContent=text;}
  function download(){const blob=new Blob([JSON.stringify({schema:'brumbrum-ultimate-visual-v1',state},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='brumbrum-visual-preset.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
  async function importFile(input){try{const data=JSON.parse(await input.files[0].text());if(data.schema!=='brumbrum-ultimate-visual-v1'||!data.state)throw new Error();apply(normalized(data.state));announce(input,'Preset zaimportowany.');}catch{announce(input,'Nieprawidłowy plik presetu.');}finally{input.value='';}}
  function action(button){const type=button.dataset.uveAction,{name,list}=panelData(button),items=readPresets(),selected=list?.value,typed=name?.value.trim();if(type==='reset'){apply(defaults);announce(button,'Przywrócono ustawienia domyślne.');return;}if(type==='export'){download();return;}if(type==='save'||type==='save-as'){const key=typed||(type==='save'&&selected);if(!key){announce(button,'Wpisz nazwę presetu.');return;}items[key]=state;writePresets(items);announce(button,'Preset zapisany.');return;}if(type==='rename'&&selected&&typed){items[typed]=items[selected];delete items[selected];writePresets(items);announce(button,'Nazwa zmieniona.');return;}if(type==='delete'&&selected){delete items[selected];writePresets(items);announce(button,'Preset usunięty.');}}

  apply(state,{save:false});
  document.addEventListener('DOMContentLoaded',()=>{syncControls();renderPresetLists();fetch('/api/appearance',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(data=>{if(data?.engine&&!localStorage.getItem(storageKey))apply(data.engine,{save:false});}).catch(()=>{});});
  document.addEventListener('input',event=>{
    const control=event.target.closest?.('[data-uve-field]');if(!control)return;const key=control.dataset.uveField;let value=control.type==='checkbox'?control.checked:control.value;if(control.type==='range')value=Number(value);state[key]=value;
    if(key==='ledColor')return setColor(value);if(key==='ledHex'&&/^#[\da-f]{6}$/i.test(value))return setColor(value);if(['rgbR','rgbG','rgbB'].includes(key)){state.ledColor=rgbToHex();state.ledHex=state.ledColor.toUpperCase();}
    if(['hue','saturation'].includes(key)){state.ledColor=hslToHex(+state.hue,+state.saturation);state.ledHex=state.ledColor.toUpperCase();const hex=state.ledColor.slice(1);state.rgbR=parseInt(hex.slice(0,2),16);state.rgbG=parseInt(hex.slice(2,4),16);state.rgbB=parseInt(hex.slice(4),16);}
    if(key==='threadPreset')state.threadColor=value;apply(state);
  });
  document.addEventListener('click',event=>{const color=event.target.closest?.('[data-uve-color]');if(color){setColor(color.dataset.uveColor);return;}const preset=event.target.closest?.('[data-uve-preset]');if(preset){apply({...defaults,...bespoke[Number(preset.dataset.uvePreset)-1],engineEnabled:true});return;}const button=event.target.closest?.('[data-uve-action]');if(button)action(button);});
  document.addEventListener('change',event=>{if(event.target.matches('[data-uve-import]')&&event.target.files?.[0])importFile(event.target);if(event.target.matches('[data-uve-saved-list]')){const chosen=readPresets()[event.target.value];if(chosen)apply(chosen);}});
  window.addEventListener('storage',event=>{if(event.key===storageKey)apply(load(storageKey,defaults),{save:false});if(event.key===presetsKey)renderPresetLists();});
})();
