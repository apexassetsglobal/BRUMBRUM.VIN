import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { layout } from '../src/ui.js';

const ids=[
  'leather-classic','leather-cognac','leather-bordeaux','leather-navy','leather-graphite',
  'stone-diamond','stone-onyx','stone-obsidian','stone-portoro','stone-labradorite'
];
const storageKey='a4-launch-surface';
const script=await readFile(new URL('../public/assets/launch-screen.js',import.meta.url),'utf8');

function page(path='/',brandLogo='original',robotics=false) {
  const origin='https://launch.example.test';
  return layout({robotics,prefix:'',demo:false,t:pl=>pl,lang:'pl',path,origin,url:new URL(path,origin),
    env:{PUBLIC_INDEXING:'1'},brand:{name:'BRUMBRUM.VIN',accent:'#134578',launch_logo:brandLogo},
    user:null,badges:{messages:0,notifications:0}},{title:'Test',body:'',index:true});
}

test('the start screen picker offers five leathers and five stones using the configured launch logo',()=>{
  const html=page('/','07');
  const labels=[...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)]
    .map(match=>match[1]).filter(label=>label.includes('data-launch-surface-option'));
  assert.equal(labels.length,10);
  assert.match(html,/<legend>Skóra<\/legend>/);
  assert.match(html,/<legend>Kamień<\/legend>/);
  const values=[];
  for(const label of labels) {
    const radio=label.match(/<input\b[^>]*>/)?.[0];
    assert.match(radio,/type="radio"/);
    const id=radio.match(/value="([^"]+)"/)[1];
    values.push(id);
    assert.ok(label.includes('/assets/launch/thumbs/'+id+'.webp'));
    assert.match(label,/brand-logos\/07\.webp/,'thumbnail follows the current brand setting');
  }
  assert.deepEqual(values.sort(),[...ids].sort());
  assert.match(html,/<dialog\b[^>]*\bdata-launch-preview\b/);
  assert.match(html,/\bdata-launch-preview-open\b/);
  assert.match(html,/\bdata-launch-preview-close\b/);
  const preview=html.match(/<dialog\b[^>]*\bdata-launch-preview\b[^>]*>([\s\S]*?)<\/dialog>/)[1];
  assert.match(preview,/brand-logos\/07\.webp/);
  const classic=page().match(/<dialog\b[^>]*\bdata-launch-preview\b[^>]*>([\s\S]*?)<\/dialog>/)[1];
  assert.match(classic,/class="brumbrum-mark"/,'the default vector mark remains sharp in the full-screen preview');
  assert.doesNotMatch(preview,/data-engine-start/,'preview never starts the engine');
  assert.doesNotMatch(page('/roboty','original',true),/data-launch-surface-option|data-launch-preview-open/);
  const eligible=html.match(/<script\b[^>]*src="\/assets\/launch-screen\.js[^"]*"[^>]*>/)?.[0];
  assert.match(eligible,/data-launch-home/);
  assert.doesNotMatch(eligible,/\b(?:async|defer)\b/);
  assert.ok(html.indexOf(eligible)<html.indexOf('<body'),'restore the splash before its first paint');
  const ordinary=page('/szukaj');
  assert.match(ordinary,/data-launch-surface-option/);
  assert.doesNotMatch(ordinary,/<script\b[^>]*data-launch-home/);
});

test('each start screen has its own full-size WebP and lightweight preview artwork',async()=>{
  const full=new Set(),thumbs=new Set();
  for(const id of ids) {
    const path='../public/assets/';
    const artwork=id==='leather-classic'?'launch-leather.webp':'launch/'+id+'.webp';
    const [image,thumb]=await Promise.all([artwork,'launch/thumbs/'+id+'.webp']
      .map(file=>readFile(new URL(path+file,import.meta.url))));
    for(const buffer of [image,thumb]) {
      assert.equal(buffer.toString('ascii',0,4),'RIFF');
      assert.equal(buffer.toString('ascii',8,12),'WEBP');
    }
    assert.ok(thumb.length<image.length,'thumbnail is smaller than the main artwork: '+id);
    full.add(createHash('sha256').update(image).digest('hex'));
    thumbs.add(createHash('sha256').update(thumb).digest('hex'));
  }
  assert.equal(full.size,10);
  assert.equal(thumbs.size,10);
});

function launch({storage=new Map(),search='',home=true,standalone=false,ios=false,referrer='',type='navigate'}={}) {
  const documentEvents=new Map(),rootEvents=new Map();
  const classes=new Set();
  const style=new Map();
  const dataset={launchSurfaces:JSON.stringify(ids)};
  const options=ids.map(value=>({value,checked:false,matches:selector=>selector==='[data-launch-surface-option]'}));
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}};
  const location=new URL('https://launch.example.test/'+search);
  const document={
    documentElement:{dataset,classList:classes,style:{setProperty:(key,value)=>style.set(key,value)},
      addEventListener:(type,listener)=>rootEvents.set(type,listener)},
    currentScript:{hasAttribute:attribute=>home&&attribute==='data-launch-home'},
    referrer,readyState:'loading',
    querySelectorAll:selector=>selector==='[data-launch-surface-option]'?options:[],
    querySelector:selector=>selector==='[data-launch-preview]'?dialog:null,
    addEventListener:(type,listener)=>documentEvents.set(type,listener)
  };
  runInNewContext(script,{document,URL,location,window:{addEventListener(){}},
    matchMedia:()=>({matches:standalone}),navigator:{standalone:ios},
    performance:{getEntriesByType:()=>[{type}]},
    history:{state:null,replaceState:(_state,_title,url)=>{location.href=url;}},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}});
  return {dataset,classes,location,style,options,dialog,
    mount(){documentEvents.get('DOMContentLoaded')();},
    reset(){rootEvents.get('reset-site-theme')();},
    select(id){
      const input=options.find(option=>option.value===id);
      input.checked=true;
      documentEvents.get('change')({target:input});
    },
    preview(open) {
      const control=open?'[data-launch-preview-open]':'[data-launch-preview-close]';
      documentEvents.get('click')({target:{closest:selector=>selector===control?{}:selector==='dialog'?dialog:null}});
    }
  };
}

test('a surface selected away from home is used on the next real start before controls mount',()=>{
  const storage=new Map([['a4-button-finish','unchanged']]);
  const settings=launch({home:false,storage});
  settings.mount();
  for(const id of ids) {
    settings.select(id);
    assert.equal(storage.get(storageKey),id);
    assert.deepEqual(settings.options.filter(option=>option.checked).map(option=>option.value),[id]);
    settings.preview(true);
    assert.ok(settings.dialog.open);
    assert.equal(settings.dataset.launchSurface,id);
    settings.preview(false);
    assert.ok(!settings.dialog.open);
    assert.ok(!settings.classes.has('app-launch'),'preview does not run the startup or its audio');
    const cold=launch({storage,search:'?launch=1&lang=pl#filtry'});
    assert.equal(cold.dataset.launchSurface,id);
    const file=id==='leather-classic'?'launch-leather.webp':'launch/'+id+'.webp';
    assert.ok(cold.style.get('--launch-surface-image').includes(file));
    assert.ok(cold.classes.has('app-launch'));
    assert.equal(cold.location.search,'?lang=pl');
    assert.equal(cold.location.hash,'#filtry');
    cold.mount();
    assert.deepEqual(cold.options.filter(option=>option.checked).map(option=>option.value),[id]);
  }
  settings.reset();
  assert.equal(storage.has(storageKey),false);
  assert.equal(settings.dataset.launchSurface,'leather-classic');
  assert.equal(storage.get('a4-button-finish'),'unchanged');
  const invalid=launch({storage:new Map([[storageKey,'unknown-surface']])});
  assert.equal(invalid.dataset.launchSurface,'leather-classic');
});

test('standalone and explicit launches keep their entry behavior and ordinary page visits stay unobstructed',()=>{
  assert.ok(launch({standalone:true}).classes.has('app-launch'));
  assert.ok(launch({ios:true}).classes.has('app-launch'));
  for(const options of [{},{standalone:true,type:'reload'},{standalone:true,referrer:'https://launch.example.test/szukaj'},
    {ios:true,type:'back_forward'},{home:false,standalone:true,search:'?launch=1'}]) {
    assert.ok(!launch(options).classes.has('app-launch'));
  }
});
