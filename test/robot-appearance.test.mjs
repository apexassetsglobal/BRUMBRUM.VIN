import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { robotFrameControls } from '../src/robot-appearance.js';
import { appearanceControls, layout } from '../src/ui.js';

const script=await readFile(new URL('../public/assets/robot-appearance.js',import.meta.url),'utf8');
const key='a4-robot-frame';
const defaults={mode:'neon',color:'#13c8ff',width:2,glow:60};
const saved={mode:'normal',color:'#a13ee8',width:5,glow:35};
const unrelated=[['a4-theme','dark'],['a4-icon-style','classic'],['a4-button-finish','{"color":"ivory"}']];
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(match=>[match[1],match[2]??match[3]??match[4]??'']));
const inputs=html=>[...html.matchAll(/<input\b[^>]*>/g)].map(match=>({tag:match[0],...attributes(match[0])}));
const text=html=>html.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim();

function harness({stored,storage=new Map(unrelated),market='robotics',failRead=false,failWrite=false}={}) {
  if(stored!==undefined)storage.set(key,typeof stored==='string'?stored:JSON.stringify(stored));
  const failures={read:failRead,write:failWrite};
  const listeners={document:new Map(),window:new Map()};
  const add=(target,type,callback)=>{
    const callbacks=listeners[target].get(type)||[];
    callbacks.push(callback);listeners[target].set(type,callbacks);
  };
  const fire=(target,type,event={})=>{
    for(const callback of listeners[target].get(type)||[])callback(event);
  };
  const properties=new Map(),operations=[];
  const root={dataset:{market},style:{
    setProperty:(name,value)=>properties.set(name,String(value)),
    getPropertyValue:name=>properties.get(name)||''
  }};
  const panels=Array.from({length:2},(_,index)=>{
    const panel={outputs:['width','glow'].map(field=>({dataset:{robotFrameValue:field},textContent:'',value:''})),neon:{hidden:false},error:{hidden:true}};
    panel.controls=inputs(robotFrameControls({t:pl=>pl},'test-'+index))
      .filter(input=>Object.hasOwn(input,'data-robot-frame-control')).map(input=>({
        tagName:'INPUT',type:input.type,value:input.value,checked:Object.hasOwn(input,'checked'),dataset:{robotFrameControl:input['data-robot-frame-control']},
        attributes:new Map(),setAttribute(name,value){this.attributes.set(name,String(value));},getAttribute(name){return this.attributes.get(name)??null;},
        matches(selector){return selector==='[data-robot-frame-control]'||selector==='input[data-robot-frame-control]';},
        closest(selector){return selector==='[data-robot-frame-settings]'?panel:this.matches(selector)?this:null;}
      }));
    panel.querySelector=selector=>selector==='[data-robot-frame-color-error]'?panel.error:null;
    return panel;
  });
  let mounted=false;
  const document={documentElement:root,readyState:'loading',
    addEventListener:(type,callback)=>add('document',type,callback),
    querySelectorAll:selector=>mounted?({
      '[data-robot-frame-control]':panels.flatMap(panel=>panel.controls),
      '[data-robot-frame-value]':panels.flatMap(panel=>panel.outputs),
      '[data-robot-frame-color-error]':panels.map(panel=>panel.error),
      '[data-robot-neon-options]':panels.map(panel=>panel.neon)
    })[selector]||[]:[]
  };
  const localStorage={
    getItem(name){operations.push(['get',name]);if(failures.read)throw new Error('Storage denied');return storage.get(name)??null;},
    setItem(name,value){operations.push(['set',name]);if(failures.write)throw new Error('Storage denied');storage.set(name,String(value));},
    removeItem(name){operations.push(['remove',name]);if(failures.write)throw new Error('Storage denied');storage.delete(name);}
  };
  runInNewContext(script,{document,localStorage,window:{addEventListener:(type,callback)=>add('window',type,callback)}});
  return {root,properties,storage,failures,panels,operations,listeners,
    mount(){mounted=true;document.readyState='interactive';fire('document','DOMContentLoaded');},
    pick(field,value,{event='change',checked=true,panel=0,type}={}) {
      const control=panels[panel].controls.find(input=>input.dataset.robotFrameControl===field&&(!type||input.type===type)&&(input.type!=='radio'||input.value===String(value)));
      assert.ok(control,'known frame control: '+field);
      control.value=String(value);control.checked=checked;
      fire('document',event,{target:control});
      return control;
    },
    reset(){fire('document','click',{target:{closest:selector=>selector==='[data-robot-frame-reset]'?{}:null},preventDefault(){}});},
    storageEvent(name=key){fire('window','storage',{key:name,newValue:storage.get(name)??null});},
    pageshow(persisted=true){fire('window','pageshow',{persisted});}
  };
}

function readState(env) {
  const {dataset}=env.root;
  return {mode:dataset.robotFrameMode,color:dataset.robotFrameColor,width:Number(dataset.robotFrameWidth),glow:Number(dataset.robotFrameGlow)};
}
function assertState(env,expected,{controls=true}={}) {
  assert.deepEqual(readState(env),expected);
  const {properties}=env;
  assert.equal(properties.get('--robot-frame-color'),expected.color);
  assert.equal(properties.get('--robot-frame-width'),expected.width+'px');
  assert.equal(properties.get('--robot-frame-rgb'),[1,3,5].map(index=>parseInt(expected.color.slice(index,index+2),16)).join(' '));
  assert.match(properties.get('--robot-frame-blur'),/^\d+(?:\.\d+)?px$/);
  const aura=Number(properties.get('--robot-frame-aura'));
  assert.ok(Number.isFinite(aura)&&aura>=0,'glow produces a finite CSS opacity');
  if(!controls)return;
  for(const panel of env.panels) {
    for(const control of panel.controls) {
      const value=String(expected[control.dataset.robotFrameControl]);
      if(control.type==='radio')assert.equal(control.checked,control.value===value);
      else assert.equal(control.value,value);
    }
    for(const output of panel.outputs)assert.ok(String(output.textContent||output.value).includes(String(expected[output.dataset.robotFrameValue])),'the visible value is updated');
    assert.equal(panel.neon.hidden,expected.mode==='normal');
  }
}

test('saved robot frame preferences apply before controls exist and synchronize both panels when ready',()=>{
  const env=harness({stored:saved});
  assertState(env,saved,{controls:false});
  env.mount();
  assertState(env,saved);
  assert.deepEqual(JSON.parse(env.storage.get(key)),saved);
});

test('independent changes persist across visits, preserve hidden neon choices and leave vehicle preferences alone',()=>{
  const env=harness();env.mount();
  const expected={...defaults};
  for(const [field,value,event] of [['color','#91e0ab','input'],['width',6,'input'],['glow',85,'input'],['mode','normal','change']]) {
    env.pick(field,value,{event});expected[field]=value;
    assertState(env,expected);
    assert.deepEqual(JSON.parse(env.storage.get(key)),expected);
  }
  env.pick('mode','neon',{checked:false});
  assert.deepEqual(readState(env),expected,'an unchecked radio cannot change the selected mode');
  env.pick('mode','neon',{panel:1});expected.mode='neon';
  assertState(env,expected);
  env.pick('color','#8454e8',{panel:1});expected.color='#8454e8';
  assertState(env,expected);
  const revisit=harness({storage:env.storage});revisit.mount();
  assertState(revisit,expected);
  for(const [name,value] of unrelated)assert.equal(env.storage.get(name),value);
  assert.ok(env.operations.filter(([operation])=>operation!=='get').every(([,name])=>name===key));
});

test('malformed preferences fall back per field while valid boundary values and hexadecimal colors survive',()=>{
  for(const stored of ['broken JSON','null','[]','"normal"',{}]) {
    const env=harness({stored});env.mount();assertState(env,defaults);
  }
  const valid={mode:'normal',color:'#ABCDEF',width:6,glow:0};
  const normalized={...valid,color:'#abcdef'};
  const boundary=harness({stored:valid});boundary.mount();assertState(boundary,normalized);
  const otherBoundary=harness({stored:{...valid,width:1,glow:100}});otherBoundary.mount();
  assertState(otherBoundary,{...normalized,width:1,glow:100});
  const numericStrings=harness({stored:{...valid,width:'3',glow:'40'}});numericStrings.mount();
  assertState(numericStrings,{...normalized,width:3,glow:40});
  for(const [field,values] of Object.entries({
    mode:['unknown',null],color:['red','#fff','#123456; background:url(https://invalid.test)',null],
    width:[0,7,2.5,'wide','',null],glow:[-1,101,40.5,'bright','',null]
  }))for(const value of values) {
    const env=harness({stored:{...valid,[field]:value}});env.mount();
    assertState(env,{...normalized,[field]:defaults[field]});
  }
});

test('unavailable storage does not prevent live changes or overwrite them when the document becomes ready',()=>{
  const env=harness({stored:saved,failRead:true,failWrite:true});
  assertState(env,defaults,{controls:false});
  env.pick('color','#f3a41b',{event:'input'});
  env.pick('mode','normal');
  env.mount();
  assertState(env,{...defaults,color:'#f3a41b',mode:'normal'});
  env.pick('width',4,{event:'input',panel:1});
  assertState(env,{...defaults,color:'#f3a41b',mode:'normal',width:4});
  env.storageEvent();env.pageshow();
  assertState(env,{...defaults,color:'#f3a41b',mode:'normal',width:4});
  env.reset();assertState(env,defaults);
});

test('storage changes and cached-page restoration synchronize all controls without reacting to unrelated preferences',()=>{
  const env=harness();env.mount();
  env.storage.set(key,JSON.stringify(saved));
  env.storageEvent('a4-theme');assertState(env,defaults);
  env.storageEvent();assertState(env,saved);
  const next={mode:'neon',color:'#f5b824',width:3,glow:100};
  env.storage.set(key,JSON.stringify(next));
  env.pageshow(false);assertState(env,saved);
  env.pageshow();assertState(env,next);
  env.storage.set(key,'broken JSON');env.storageEvent();assertState(env,defaults);
  env.storage.set(key,JSON.stringify(next));env.storageEvent();assertState(env,next);
  env.storage.delete(key);env.storageEvent(null);assertState(env,defaults);
});

test('reset restores defaults in every panel and removes only robot frame preferences',()=>{
  const env=harness({stored:saved});env.mount();env.reset();
  assertState(env,defaults);
  assert.equal(env.storage.has(key),false);
  for(const [name,value] of unrelated)assert.equal(env.storage.get(name),value);
  const revisit=harness({storage:env.storage});revisit.mount();assertState(revisit,defaults);
});

test('the robot appearance script is inert on the vehicle site',()=>{
  const env=harness({stored:saved,market:'vehicles'});env.mount();env.pageshow();env.storageEvent();
  assert.deepEqual(env.root.dataset,{market:'vehicles'});
  assert.equal(env.properties.size,0);
  assert.equal(env.operations.length,0);
  assert.equal(env.listeners.document.size,0);
  assert.equal(env.listeners.window.size,0);
  assert.deepEqual(JSON.parse(env.storage.get(key)),saved);
});

test('frame controls use labelled native inputs with independent radio groups and appear only in Robot Zone settings',()=>{
  const ctx={robotics:true,t:(pl)=>pl,brand:{name:'BRUMBRUM.VIN'}};
  const first=robotFrameControls(ctx,'toolbar-theme'),second=robotFrameControls(ctx,'inline-icon-theme');
  const controls=inputs(first).filter(control=>Object.hasOwn(control,'data-robot-frame-control'));
  assert.deepEqual([...new Set(controls.map(control=>control['data-robot-frame-control']))].sort(),['color','glow','mode','width']);
  const labels=[...first.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)].map(match=>({attributes:attributes(match[1]),content:match[2]}));
  for(const control of controls) {
    assert.ok(control['aria-label']||labels.some(label=>text(label.content)&&(label.content.includes(control.tag)||(control.id&&label.attributes.for===control.id))),
      'accessible label for '+control['data-robot-frame-control']);
    assert.notEqual(control.tabindex,'-1','native inputs remain in keyboard navigation');
  }
  const modes=controls.filter(control=>control['data-robot-frame-control']==='mode');
  assert.deepEqual(modes.map(control=>control.value).sort(),['neon','normal']);
  assert.ok(modes.every(control=>control.type==='radio'&&control.name));
  assert.equal(new Set(modes.map(control=>control.name)).size,1);
  const otherModes=inputs(second).filter(control=>control['data-robot-frame-control']==='mode');
  assert.ok(otherModes.every(control=>control.name!==modes[0].name),'separate settings panels must not share a radio group');
  const colorPresets=controls.filter(control=>control['data-robot-frame-control']==='color'&&control.type==='radio');
  assert.equal(colorPresets.length,18);
  assert.equal(new Set(colorPresets.map(control=>control.name)).size,1);
  assert.notEqual(colorPresets[0].name,modes[0].name,'color and style choices remain independent');
  const otherColors=inputs(second).filter(control=>control['data-robot-frame-control']==='color'&&control.type==='radio');
  assert.ok(otherColors.every(control=>control.name!==colorPresets[0].name));
  for(const control of colorPresets)assert.match(control.value,/^#[0-9a-f]{6}$/i);
  for(const [field,min,max] of [['width','1','6'],['glow','0','100']]) {
    const control=controls.find(input=>input['data-robot-frame-control']===field);
    assert.equal(control.type,'range');assert.equal(control.min,min);assert.equal(control.max,max);
    assert.match(first,new RegExp('data-robot-frame-value="'+field+'"'));
  }
  assert.equal(controls.filter(control=>control['data-robot-frame-control']==='color'&&control.type==='color').length,1);
  const hex=controls.find(control=>control['data-robot-frame-control']==='color'&&control.type==='text');
  assert.ok(hex,'an explicit HEX input supports any LED shade');
  assert.equal(hex.maxlength,'7');
  assert.ok(hex['aria-describedby']&&first.includes('id="'+hex['aria-describedby']+'"'),'color validation is linked to its field');
  assert.match(first,/<button\b[^>]*data-robot-frame-reset[^>]*>[\s\S]*?<\/button>/);
  assert.match(appearanceControls(ctx,'toolbar-theme'),/data-robot-frame-control/);
  assert.doesNotMatch(appearanceControls({...ctx,robotics:false},'toolbar-theme'),/data-robot-frame-control/);
});

test('custom LED color edits synchronize presets and both panels while incomplete or invalid HEX preserves the saved color',()=>{
  const env=harness();env.mount();
  env.pick('color','#A1B2C3',{type:'text',event:'input'});
  const custom={...defaults,color:'#a1b2c3'};
  assertState(env,custom);
  assert.deepEqual(JSON.parse(env.storage.get(key)),custom);
  for(const panel of env.panels) {
    assert.ok(panel.controls.filter(control=>control.type==='radio'&&control.dataset.robotFrameControl==='color').every(control=>!control.checked));
    assert.equal(panel.error.hidden,true);
  }
  for(const value of ['', '#12', 'orange', '#aabbcc;background:red']) {
    const beforeWrites=env.operations.filter(([operation])=>operation==='set').length;
    const input=env.pick('color',value,{type:'text',event:'input'});
    assert.deepEqual(readState(env),custom,'invalid or incomplete typing must not reset the displayed border');
    assert.deepEqual(JSON.parse(env.storage.get(key)),custom,'saved color is not overwritten by a partial edit');
    assert.equal(env.operations.filter(([operation])=>operation==='set').length,beforeWrites);
    assert.equal(input.value,value,'unfinished text remains editable');
    assert.equal(input.getAttribute('aria-invalid'),'true');
    assert.equal(env.panels[0].error.hidden,false);
    assert.equal(env.panels[1].error.hidden,true,'validation belongs only to the edited panel');
  }
  env.pick('color','#13c8ff',{type:'radio',panel:1});
  assertState(env,defaults);
  for(const panel of env.panels) {
    assert.equal(panel.error.hidden,true);
    assert.equal(panel.controls.find(control=>control.type==='text').getAttribute('aria-invalid'),'false');
  }
  env.pick('color','#ffe4b0',{type:'color',event:'input'});
  assertState(env,{...defaults,color:'#ffe4b0'});
  for(const panel of env.panels)assert.ok(panel.controls.some(control=>control.type==='radio'&&control.value==='#ffe4b0'&&control.checked),'native color picker also selects a matching preset');
  const revisit=harness({storage:env.storage});revisit.mount();
  assertState(revisit,{...defaults,color:'#ffe4b0'});
});

test('real page layouts load frame restoration before CSS only for Robot Zone and expose the labelled settings dialog',()=>{
  for(const [robotics,prefix] of [[true,''],[true,'/demo'],[false,'']]) {
    const origin='https://appearance.example.test';
    const ctx={robotics,prefix,demo:prefix==='/demo',t:pl=>pl,lang:'pl',path:'/',origin,
      url:new URL(prefix+(robotics?'/roboty':'/'),origin),env:{PUBLIC_INDEXING:'1'},
      brand:{name:'BRUMBRUM.VIN',accent:'#13c8ff'},user:null,badges:{messages:0,notifications:0}};
    const html=layout(ctx,{title:'Test ustawień',body:'<p>Test</p>',index:true});
    if(!robotics) {
      assert.doesNotMatch(html,/\/assets\/robot-appearance\.(?:js|css)|data-robot-frame-control/);
      continue;
    }
    const loading=html.match(/<script src="\/assets\/robot-appearance\.js(?:\?[^"]*)?"><\/script>/g)||[];
    assert.equal(loading.length,1,'frame preferences restore synchronously exactly once');
    assert.ok(html.indexOf(loading[0])<html.indexOf('<link rel="stylesheet"'),'preferences restore before the first stylesheet');
    assert.match(html,/<html\b[^>]*data-market="robotics"/);
    assert.match(html,/<dialog\b[^>]*id="icon-style-dialog"[^>]*aria-labelledby="icon-style-title"/);
    assert.match(html,/<button\b[^>]*data-icon-style-open[^>]*aria-haspopup="dialog"[^>]*aria-controls="icon-style-dialog"[^>]*aria-label="[^"]+"/);
    assert.match(html,/data-robot-frame-settings/);
    const header=html.match(/<header class="robot-header">([\s\S]*?)<\/header>/)?.[1];
    assert.ok(header);
    assert.doesNotMatch(header,/BRUMBRUM|robot-parent-link/);
  }
});
