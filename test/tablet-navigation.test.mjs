import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { layout } from '../src/ui.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf("const sideNav=$('[data-side-nav]');");
const end=app.indexOf("\nfor (const form of $$('[data-search-form]'))",start);
assert.ok(start>=0&&end>start,'test executes the real, complete sidebar block');
const script=app.slice(start,end);
const railQuery='(min-width:1041px) and (hover:hover) and (pointer:fine), (min-width:768px) and (min-height:480px) and (orientation:landscape)';

function harness({compact=true,hasNav=true,slide}={}) {
  let document;
  const deferred=[];
  class Element {
    constructor(tag='div',attrs={},parent=null) {
      this.tagName=tag.toUpperCase();this.attrs=new Map(Object.entries(attrs));this.parentElement=parent;
      this.children=[];this.listeners=new Map();this.textContent='';this.visible=true;this.focusVisible=false;
      const properties=new Map();
      this.style={setProperty:(key,value)=>properties.set(key,value),getPropertyValue:key=>properties.get(key)||''};
      this.dataset=Object.fromEntries(Object.entries(attrs).filter(([name])=>name.startsWith('data-')).map(([name,value])=>[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));
      this.classList={toggle:(name,force)=>{const names=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));const active=force??!names.has(name);if(active)names.add(name);else names.delete(name);this.setAttribute('class',[...names].join(' '));return active;}};
      parent?.children.push(this);
    }
    addEventListener(type,callback,options={}) {const entries=this.listeners.get(type)||[];entries.push({callback,once:!!options.once,capture:options===true||!!options.capture});this.listeners.set(type,entries);}
    setAttribute(name,value){this.attrs.set(name,String(value));}
    getAttribute(name){return this.attrs.get(name)??null;}
    removeAttribute(name){this.attrs.delete(name);}
    hasAttribute(name){return this.attrs.has(name);}
    toggleAttribute(name,force){const active=force??!this.hasAttribute(name);if(active)this.setAttribute(name,'');else this.removeAttribute(name);return active;}
    get hidden(){return this.hasAttribute('hidden');}set hidden(value){this.toggleAttribute('hidden',value);}
    get inert(){return this.hasAttribute('inert');}set inert(value){this.toggleAttribute('inert',value);}
    get open(){return this.hasAttribute('open');}set open(value){this.toggleAttribute('open',value);}
    get id(){return this.getAttribute('id')||'';}
    get href(){return this.getAttribute('href')||'';}
    contains(node){for(let current=node;current;current=current.parentElement)if(current===this)return true;return false;}
    matches(selector){
      return selector.split(',').some(part=>{
        let candidate=part.trim();
        if(candidate===':focus-visible')return this.focusVisible;
        if(candidate===':focus-within')return this.contains(document.activeElement);
        const not=[...candidate.matchAll(/:not\(([^)]+)\)/g)];
        if(not.some(match=>this.matches(match[1])))return false;
        candidate=candidate.replace(/:not\([^)]+\)/g,'');
        const tag=candidate.match(/^[a-z]+/i)?.[0];
        if(tag&&this.tagName!==tag.toUpperCase())return false;
        const id=candidate.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
        const className=candidate.match(/\.([\w-]+)/)?.[1];if(className&&!(this.getAttribute('class')||'').split(' ').includes(className))return false;
        for(const [,name,,value] of candidate.matchAll(/\[([\w:-]+)(?:=(['"]?)(.*?)\2)?\]/g)) {
          if(!this.hasAttribute(name)||(value!==undefined&&this.getAttribute(name)!==value))return false;
        }
        return true;
      });
    }
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    getClientRects(){return this.visible&&!this.hidden?[{}]:[];}
    getBoundingClientRect(){return {width:this.visible&&!this.hidden?(this.layoutWidth||0):0};}
    focus(){
      if(document.activeElement===this)return;
      const previous=document.activeElement;document.activeElement=this;
      if(previous)fire(previous,'focusout',{relatedTarget:this});
      fire(this,'focusin',{relatedTarget:previous});
    }
  }
  function fire(target,type,props={}) {
    const event={type,target,button:0,detail:type==='click'?1:0,defaultPrevented:false,...props,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;}};
    const path=[];
    for(let node=target;node;node=node.parentElement) path.push(node);
    function dispatch(node,capture) {
      event.currentTarget=node;
      for(const entry of [...node.listeners.get(type)||[]]) {
        if(entry.capture!==capture)continue;
        entry.callback(event);
        if(entry.once)node.listeners.set(type,node.listeners.get(type).filter(item=>item!==entry));
      }
    }
    for(const node of [...path].reverse()){dispatch(node,true);if(event.cancelBubble)return event;}
    for(const node of path){dispatch(node,false);if(event.cancelBubble)break;}
    return event;
  }
  document=new Element('document');
  const body=new Element('body',{},document);document.body=body;
  document.documentElement=new Element('html');document.activeElement=body;
  const sideNav=hasNav?new Element('nav',{'data-side-nav':'',id:'side-navigation'},body):null;
  if(sideNav)sideNav.getAnimations=()=>slide?[slide]:[];
  const toggle=hasNav?new Element('button',{'data-side-toggle':'','aria-expanded':'false'},sideNav):null;
  const toggleLabel=hasNav?new Element('span',{'data-side-toggle-label':''},toggle):null;
  const panel=hasNav?new Element('div',{id:'side-nav-panel',class:'side-nav-panel'},sideNav):null;
  const link=hasNav?new Element('a',{href:'/konto'},panel):null;
  const linkIcon=hasNav?new Element('svg',{},link):null;
  const linkLabel=hasNav?new Element('span',{},link):null;
  const action=hasNav?new Element('button',{'data-theme-toggle':''},panel):null;
  const actionLabel=hasNav?new Element('span',{},action):null;
  const themePicker=hasNav?new Element('details',{'data-side-theme-picker':''},panel):null;
  const themeSummary=hasNav?new Element('summary',{},themePicker):null;
  const dialogAction=hasNav?new Element('button',{'data-language-open':''},panel):null;
  const bottom=new Element('nav',{class:'bottom-nav'},body);
  const outside=new Element('a',{href:'/szukaj'},bottom);
  const profile=hasNav?new Element('a',{'data-profile-menu-toggle':'',href:'/konto','aria-controls':'side-navigation','aria-expanded':'false'},bottom):null;
  const profileIcon=hasNav?new Element('svg',{},profile):null;
  const dialog=new Element('dialog',{id:'language-picker'},body);
  const window=new Element('window'),media=new Element('media');media.matches=!compact;
  let observeSize;
  window.ResizeObserver=class {
    constructor(callback){observeSize=callback;}
    observe(){}
  };
  const queries=[];
  const matchMedia=query=>{queries.push(query);return media;};
  window.matchMedia=matchMedia;
  const requestAnimationFrame=callback=>deferred.push(callback);
  const $=(selector,within=document)=>within.querySelector(selector);
  const $$=(selector,within=document)=>within.querySelectorAll(selector);
  runInNewContext(script,{document,window,matchMedia,$,$$,root:body,t:pl=>pl,requestAnimationFrame,
    queueMicrotask:callback=>deferred.push(callback),setTimeout:callback=>deferred.push(callback),
    local:{get:()=>null,set(){}},keys:{menuSound:'a4-menu-sound'}});
  const flush=()=>{for(let count=0;deferred.length&&count<50;count++)deferred.shift()();assert.equal(deferred.length,0);};
  flush();
  const click=(node,props={})=>{fire(node,'pointerdown',props);node.closest('a[href],button,summary')?.focus();const event=fire(node,'click',props);flush();return event;};
  return {document,body,sideNav,toggle,toggleLabel,panel,link,linkIcon,linkLabel,action,actionLabel,themePicker,themeSummary,dialogAction,isRail:()=>media.matches,
    notifyResize:()=>observeSize(),
    profile,profileIcon,outside,dialog,window,queries,fire,click,flush,
    changeMode(value){media.matches=!value;fire(media,'change',{matches:!value});flush();},
    key(value,props={}){const event=fire(document.activeElement||document,'keydown',{key:value,...props});flush();return event;},
    focus(node){node.focus();flush();},
    open(){profile.focus();click(profileIcon);}
  };
}

function assertRail(env,visible,expanded=false) {
  assert.equal(env.sideNav.hasAttribute('data-side-visible'),visible);
  assert.equal(env.sideNav.hasAttribute('data-side-open'),expanded);
  assert.equal(env.profile.getAttribute('aria-expanded'),String(env.isRail()?expanded:visible));
  assert.equal(env.toggle.getAttribute('aria-expanded'),String(expanded));
  assert.equal(env.sideNav.inert,!visible);
  assert.equal(env.sideNav.getAttribute('aria-hidden')==='true',!visible);
}

for (const compact of [true]) {
  test('profile reveals icons, hover reveals one caption, and the toggle pins all captions, compact='+compact,()=>{
    const env=harness({compact});
    assert.deepEqual(env.queries,[railQuery]);assertRail(env,false);
    assert.equal(env.profile.getAttribute('role'),'button');
    assert.equal(env.profile.href,'/konto');
    env.fire(env.sideNav,'pointerenter',{pointerType:'mouse'});assertRail(env,false);
    env.open();assertRail(env,true);
    assert.equal(env.document.activeElement,env.toggle);
    env.fire(env.link,'pointerenter',{pointerType:'touch'});assert.equal(env.link.hasAttribute('data-side-caption'),false);
    env.fire(env.link,'pointerenter',{pointerType:'mouse'});assertRail(env,true);
    assert.equal(env.link.hasAttribute('data-side-caption'),true);
    env.fire(env.action,'pointerenter',{pointerType:'mouse'});
    assert.equal(env.action.hasAttribute('data-side-caption'),true);
    assert.equal(env.link.hasAttribute('data-side-caption'),false);
    env.fire(env.action,'pointerleave',{pointerType:'mouse'});
    assert.equal(env.action.hasAttribute('data-side-caption'),false);
    env.click(env.toggle);assertRail(env,true,true);
    env.fire(env.sideNav,'pointerleave');assertRail(env,true,true);
    env.click(env.toggle);assertRail(env,true);
    env.click(env.profileIcon);assertRail(env,false);
    assert.equal(env.document.activeElement,env.profile);
  });
}

test('desktop keeps the icon rail visible and expands every caption on hover',()=>{
  const env=harness({compact:false});
  assert.deepEqual(env.queries,[railQuery]);assertRail(env,true,false);
  env.fire(env.sideNav,'pointerenter',{pointerType:'mouse'});assertRail(env,true,true);
  assert.equal(env.sideNav.hasAttribute('data-side-ready'),true);
  env.fire(env.sideNav,'pointerleave',{pointerType:'mouse'});assertRail(env,true,false);
  assert.equal(env.sideNav.hasAttribute('data-side-ready'),false);
  env.click(env.toggle);assertRail(env,true,true);
  env.fire(env.sideNav,'pointerleave',{pointerType:'mouse'});assertRail(env,true,true);
  env.click(env.toggle);assertRail(env,true,false);
});

test('touch previews one icon at a time and pressing its caption activates the original action',()=>{
  for(const pointerType of ['touch','pen']) {
    const env=harness(),press=node=>env.click(node,{pointerType});
    let calls=0;
    env.dialogAction.addEventListener('click',()=>{calls++;});
    env.open();
    assert.equal(press(env.linkIcon).defaultPrevented,true);assertRail(env,true);
    assert.equal(env.link.hasAttribute('data-side-caption'),true);
    press(env.dialogAction);
    assert.equal(env.link.hasAttribute('data-side-caption'),false);
    assert.equal(env.dialogAction.hasAttribute('data-side-caption'),true);
    assert.equal(calls,0);
    press(env.dialogAction);assert.equal(calls,1);assertRail(env,false);
    env.open();press(env.linkIcon);
    assert.equal(press(env.linkLabel).defaultPrevented,false);assertRail(env,false);
    env.open();press(env.toggle);
    assert.equal(press(env.linkIcon).defaultPrevented,false);assertRail(env,false);
  }
});

test('the drawer fits one caption on preview and the longest visible caption when expanded',()=>{
  const env=harness();
  const drawerWidth=()=>env.body.style.getPropertyValue('--profile-caption-space');
  env.toggleLabel.layoutWidth=88;
  env.linkLabel.layoutWidth=49.5;
  env.actionLabel.layoutWidth=165.25;
  env.open();
  assert.equal(drawerWidth(),'0px');
  env.click(env.linkIcon,{pointerType:'touch'});
  assert.equal(drawerWidth(),'50px');
  env.click(env.toggle);
  assert.equal(drawerWidth(),'166px');
  env.linkLabel.layoutWidth=188.5;
  env.notifyResize();
  assert.equal(drawerWidth(),'189px');
  env.linkLabel.visible=false;
  env.notifyResize();
  assert.equal(drawerWidth(),'166px');
  env.click(env.toggle);
  assert.equal(drawerWidth(),'0px');
  env.fire(env.toggle,'pointerenter',{pointerType:'mouse'});
  assert.equal(drawerWidth(),'88px');
  env.key('Escape');
  assert.equal(drawerWidth(),'0px');
});

test('the toggle, links, buttons and theme summary share full-width rows with the icon in the first column',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const rows=css.match(/\.side-nav :is\(a,button,summary\)\s*\{([^}]+)\}/)?.[1];
  assert.ok(rows);
  assert.match(rows,/(?:^|;)\s*width:\s*100%\s*;/);
  assert.match(rows,/grid-template-columns:\s*var\(--rail-slot\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css,/\.side-nav :is\(a,button,summary\)>\.ui-icon\s*\{[^}]*grid-area:1\/1/);
  assert.match(css,/\.side-nav :is\(a,button,summary\)>span:not\(\.count\)\s*\{[^}]*grid-area:1\/2;justify-self:start/);
});

test('captions wait for the rail slide and a close during the slide keeps them hidden',async()=>{
  for(const close of [false,true]) {
    let land;
    const env=harness({slide:{transitionProperty:'transform',finished:new Promise(resolve=>{land=resolve;})}});
    env.open();
    env.fire(env.link,'pointerenter',{pointerType:'mouse'});
    assert.equal(env.link.hasAttribute('data-side-caption'),true);
    assert.equal(env.sideNav.hasAttribute('data-side-ready'),false);
    if(close)env.key('Escape');
    land();await Promise.resolve();
    assert.equal(env.sideNav.hasAttribute('data-side-ready'),!close);
  }
});

test('Space toggles the profile while modified anchor activation retains its native destination',()=>{
  const env=harness();env.focus(env.profile);
  assert.equal(env.key(' ').defaultPrevented,true);assertRail(env,true);
  env.key('Escape');assertRail(env,false);
  for(const modifiers of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]) {
    assert.equal(env.click(env.profileIcon,modifiers).defaultPrevented,false);assertRail(env,false);
  }
  assert.equal(env.fire(env.profileIcon,'auxclick',{button:1}).defaultPrevented,false);
});

test('outside interaction, Escape and menu selections dismiss the visible rail',()=>{
  for(const action of ['outside','escape','link','button']) {
    const env=harness();env.open();assertRail(env,true);
    if(action==='outside')env.fire(env.outside,'pointerdown');
    if(action==='escape')env.key('Escape');
    if(action==='link')assert.equal(env.click(env.linkIcon).defaultPrevented,false);
    if(action==='button')env.click(env.action);
    env.flush();assertRail(env,false);
    if(action==='escape')assert.equal(env.document.activeElement,env.profile);
  }
});

test('keyboard navigation reveals captions and leaving the rail respects the new focus',()=>{
  const env=harness();env.open();
  assert.equal(env.key('Tab').defaultPrevented,false);
  env.link.focusVisible=true;env.focus(env.link);assertRail(env,true);
  assert.equal(env.link.hasAttribute('data-side-caption'),true);
  env.focus(env.profile);assertRail(env,true);
  assert.equal(env.link.hasAttribute('data-side-caption'),false);
  env.focus(env.link);env.focus(env.outside);assertRail(env,false);
  assert.equal(env.document.activeElement,env.outside);
  env.open();env.themePicker.open=true;env.fire(env.themePicker,'toggle');assertRail(env,true,true);
  env.click(env.themeSummary);assertRail(env,true,true);
});

test('dialog actions return focus to the profile launcher after dismissal',()=>{
  const env=harness();env.open();
  env.key('Escape',{defaultPrevented:true});assertRail(env,true);
  env.dialog.open=true;env.key('Escape');assertRail(env,true);
  env.dialog.open=false;
  env.dialogAction.addEventListener('click',()=>{env.dialog.open=true;env.focus(env.dialog);});
  env.click(env.dialogAction);assertRail(env,false);
  env.dialog.open=false;env.fire(env.dialog,'close');env.flush();
  assert.equal(env.document.activeElement,env.profile);
});

test('rotation and back navigation reset the disclosure',()=>{
  const env=harness();env.open();env.click(env.toggle);assertRail(env,true,true);
  env.changeMode(false);assertRail(env,true,false);
  env.open();env.changeMode(true);assertRail(env,false);
  env.open();env.fire(env.window,'pageshow',{persisted:true});assertRail(env,false);
});

test('pages without the vehicle sidebar do not install compact-navigation behavior',()=>{
  const env=harness({hasNav:false});
  assert.deepEqual(env.queries,[]);
  assert.equal(env.document.listeners.size,0);
  assert.equal(env.window.listeners.size,0);
});

const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(match=>[match[1],match[2]??match[3]??match[4]??'']));

test('rendered main and demo pages expose the labelled profile disclosure and keep Robot Zone separate',()=>{
  for(const [robotics,prefix] of [[false,''],[false,'/demo'],[true,'']]) {
    const origin='https://navigation.example.test';
    const ctx={robotics,prefix,demo:prefix==='/demo',t:pl=>pl,lang:'pl',path:'/',origin,
      url:new URL(prefix+(robotics?'/roboty':'/'),origin),env:{PUBLIC_INDEXING:'1'},
      brand:{name:'BRUMBRUM.VIN',accent:'#1976ff'},user:null,badges:{messages:0,notifications:0}};
    const html=layout(ctx,{body:'<p>Navigation test</p>',index:true});
    if(robotics) {
      assert.doesNotMatch(html,/data-side-nav|data-side-backdrop|data-profile-menu-toggle/);
      assert.match(html,/class="robot-bottom-nav"/);continue;
    }
    const navTag=html.match(/<nav\b[^>]*data-side-nav[^>]*>/)?.[0];assert.ok(navTag);
    const navAttributes=attrs(navTag);assert.equal(navAttributes.id,'side-navigation');
    assert.equal((html.match(/ data-profile-menu-toggle/g)||[]).length,2);
    const profileTag=html.match(/<a\b[^>]*data-profile-menu-toggle[^>]*>[\s\S]*?<\/a>/)?.[0];assert.ok(profileTag);
    const profileAttributes=attrs(profileTag.split('>')[0]);
    assert.equal(profileAttributes.href,prefix+'/konto');
    assert.equal(profileAttributes['aria-controls'],navAttributes.id);
    assert.match(profileTag,/Mój profil/);
    const navStart=html.indexOf(navTag),navEnd=html.indexOf('</nav>',navStart);
    const rail=html.slice(navStart,navEnd);
    assert.ok(rail.includes('href="'+prefix+'/uslugi"'));
    assert.match(rail,/data-language-open/);
    assert.match(rail,/data-side-toggle-label/);
    const bottom=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(bottom);
    assert.equal((bottom.match(/<a\b/g)||[]).length,6,'all original bottom destinations remain available');
  }
});
