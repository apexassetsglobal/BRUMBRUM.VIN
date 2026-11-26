(() => {
  const root=document.documentElement;
  if(root.dataset.market!=='robotics')return;
  const key='a4-robot-frame';
  const defaults={mode:'neon',color:'#13c8ff',width:2,glow:60};
  const selector='[data-robot-frame-control]';
  const number=(value,min,max,fallback)=>{
    const n=typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
    return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;
  };
  function normalize(value){
    const input=value&&typeof value==='object'?value:{};
    return {mode:['normal','neon'].includes(input.mode)?input.mode:defaults.mode,
      color:typeof input.color==='string'&&/^#[0-9a-f]{6}$/i.test(input.color)?input.color.toLowerCase():defaults.color,
      width:number(input.width,1,6,defaults.width),glow:number(input.glow,0,100,defaults.glow)};
  }
  let current={...defaults};
  function read(){
    let saved;
    try {saved=localStorage.getItem(key);}catch {return null;}
    if(!saved)return {...defaults};
    try {return normalize(JSON.parse(saved));}catch {return {...defaults};}
  }
  function sync(){
    for(const control of document.querySelectorAll(selector)){
      const field=control.dataset.robotFrameControl;
      if(!Object.hasOwn(defaults,field))continue;
      if(control.type==='radio')control.checked=control.value===String(current[field]);
      else control.value=String(current[field]);
      if(control.type==='text'&&field==='color')control.setAttribute('aria-invalid','false');
    }
    for(const error of document.querySelectorAll('[data-robot-frame-color-error]'))error.hidden=true;
    for(const output of document.querySelectorAll('[data-robot-frame-value]')){
      const field=output.dataset.robotFrameValue;
      if(field==='width')output.textContent=current.width+' px';
      if(field==='glow')output.textContent=current.glow+'%';
    }
    for(const group of document.querySelectorAll('[data-robot-neon-options]'))group.hidden=current.mode!=='neon';
  }
  function apply(value){
    current=normalize(value);
    for(const [field,value] of Object.entries(current))root.dataset['robotFrame'+field[0].toUpperCase()+field.slice(1)]=String(value);
    const rgb=[1,3,5].map(start=>parseInt(current.color.slice(start,start+2),16)).join(' ');
    root.style.setProperty('--robot-frame-color',current.color);
    root.style.setProperty('--robot-frame-rgb',rgb);
    root.style.setProperty('--robot-frame-width',current.width+'px');
    root.style.setProperty('--robot-frame-blur',(current.glow*.3)+'px');
    root.style.setProperty('--robot-frame-aura',String(current.glow*.004));
    sync();
  }
  function update(event){
    const control=event.target;
    if(!control?.matches?.(selector)||(control.type==='radio'&&!control.checked))return;
    const field=control.dataset.robotFrameControl;
    if(!Object.hasOwn(defaults,field))return;
    const value=field==='color'?control.value.trim():control.value;
    if(field==='color'&&!/^#[0-9a-f]{6}$/i.test(value)){
      if(control.type==='text'){
        control.setAttribute('aria-invalid','true');
        const error=control.closest('[data-robot-frame-settings]')?.querySelector('[data-robot-frame-color-error]');
        if(error)error.hidden=false;
      }
      return;
    }
    apply({...current,[field]:value});
    try {localStorage.setItem(key,JSON.stringify(current));}catch{}
  }
  apply(read()||defaults);
  document.addEventListener('DOMContentLoaded',sync,{once:true});
  document.addEventListener('input',update);
  document.addEventListener('change',update);
  document.addEventListener('click',event=>{
    if(!event.target?.closest?.('[data-robot-frame-reset]'))return;
    event.preventDefault();
    try {localStorage.removeItem(key);}catch{}
    apply(defaults);
  });
  window.addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    const saved=read();if(saved)apply(saved);
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    const saved=read();if(saved)apply(saved);
  });
})();
