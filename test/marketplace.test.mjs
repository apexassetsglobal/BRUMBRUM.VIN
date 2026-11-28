import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { once } from 'node:events';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { csvFields } from '../src/dealer.js';
import { cleanImage } from '../src/images.js';
import { hydrate } from '../src/market.js';
import { digest } from '../src/core.js';
import { demoBaseCount, demoListingCount, externalCatalogGalleries } from '../src/data.js';
import { semiTrailerBodies, vehicleTypes } from '../src/vehicle-types.js';
import { readBannerStats, readPageViews, recordBannerEvent, recordPageView } from '../src/traffic.js';

const password='development-password-for-tests-only';
const newPassword='development-password-changed-for-tests';
const ownerEmail='owner@example.test';
const ownerToken='test-only-owner-secret-'+crypto.randomUUID();
const mediaToken='test-only-demo-media-'+crypto.randomUUID();
const catalogMediaToken='test-only-catalog-media-'+crypto.randomUUID();
const data={
  type:'car',make:'Toyota',model:'Corolla',variant:'1.8 Hybrid QA',year:2021,condition:'used',mileage:54000,
  body:'wagon',fuel:'hybrid',gearbox:'auto',drive:'fwd',power:122,powerUnit:'KM',damage:'no',city:'Warszawa',region:'Mazowieckie',
  price:68400,description:'Pojazd testowy z dokumentacją i wyposażeniem.',contact:'message',equipment:['abs','carplay'],accidentFree:true,
  vin:'ZZZ-TEST 0000000001'
};
let service,base,directory,car,publicPath,photoIds,third,seller,buyer,moderator,admin,dealership,thread,adId,confirmToken;
let serverErrors=[];

async function start() {
  service=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,APP_MODE:'development',APP_ORIGIN:'',MAIL_API_KEY:'',MAIL_FROM:'',PORT:'0',HOST:'127.0.0.1',DATA_DIR:directory,
      OWNER_EMAIL:ownerEmail,OWNER_SETUP_TOKEN:ownerToken,DEMO_MEDIA_SETUP_TOKEN:mediaToken,
      DEMO_CATALOG_MEDIA_TOKEN:catalogMediaToken,SITES_CHATGPT_SIGNIN:'1'},stdio:['ignore','pipe','pipe']
  });
  service.stderr.on('data',chunk=>serverErrors.push(String(chunk)));
  const [line]=await Promise.race([
    once(service.stdout,'data'),once(service,'exit').then(([code])=>{throw new Error('Server exited: '+code);})
  ]);
  base=String(line).trim().split(' · ')[1];
}
async function stop() {
  if (service?.exitCode==null) {service.kill();await once(service,'exit');}
}
before(async()=>{directory=await mkdtemp(resolve('var-test-'));await start();});
after(async()=>{await stop();if(directory)await rm(directory,{recursive:true,force:true});});

function browser() {
  const jar=new Map();
  return {
    jar,
    async go(path,{method='GET',data,bytes,headers={},code=200,location}={}) {
      const opts={method,headers:{...headers},redirect:'manual'};
      const cookie=[...jar.entries()].map(([k,v])=>k+'='+v).join('; ');
      if (cookie) opts.headers.Cookie=cookie;
      if (method!=='GET') opts.headers.Origin??=base;
      if (data!==undefined) {
        opts.headers['Content-Type']='application/json';
        opts.body=JSON.stringify(data);
      }
      if (bytes!==undefined) {opts.headers['Content-Type']='application/octet-stream';opts.body=bytes;}
      const response=await fetch(base+path,opts);
      for (const value of response.headers.getSetCookie()) {
        const [key,val]=value.split(';',1)[0].split('=');
        if (!val) jar.delete(key);else jar.set(key,val);
      }
      const buffer=Buffer.from(await response.arrayBuffer());
      const type=response.headers.get('content-type');
      const result=type?.includes('application/json')?JSON.parse(buffer.toString()):/^(image|video)\//.test(type||'')?buffer:buffer.toString();
      assert.equal(response.status,code,path+' · '+(typeof result==='string'?result.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(-280):JSON.stringify(result).slice(0,350)));
      if(location!==undefined) assert.equal(response.headers.get('location'),location);
      return {result,headers:response.headers};
    },
    async api(path,data,code=200,method='POST') {return (await this.go('/api'+path,{method,data,code})).result;}
  };
}
async function latestMailLink(email,purpose) {
  const lines=(await readFile(join(directory,'mailbox.jsonl'),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
  const result=lines.findLast(x=>x.to===email&&x.purpose===purpose);
  assert.ok(result);
  return new URL(result.url);
}
const latestToken=async (email,purpose)=>(await latestMailLink(email,purpose)).searchParams.get('token');
async function signup(email,type='private',client=browser()) {
  await client.api('/auth/register',{email,password,name:email.split('@')[0],profile_type:type,terms:true});
  const token=await latestToken(email,'verify');
  await client.api('/auth/verify',{token,password});
  await client.api('/auth/login',{email,password});
  return client;
}
async function makeDraft(client) {
  const key=crypto.randomUUID();
  const result=await client.api('/listings',{key});
  const duplicate=await client.api('/listings',{key});
  assert.equal(duplicate.id,result.id);
  return result.id;
}
async function upload(client,listing,version,bytes,code=200) {
  return (await client.go('/api/listings/'+listing+'/photo',{method:'POST',headers:{'X-Edit-Version':String(version)},bytes,code})).result;
}
const photo=(index)=>readFile('public/assets/vehicle-'+index+'.webp');
const editsPath=key=>'/listings/'+key+'/edit';
const edit=async (client,key,version,info,photos,step=4)=>client.api(editsPath(key),{version,data:info,photos,step},200,'PUT');
const editRead=async (client,key)=>(await client.go('/api'+editsPath(key))).result;
const submit=async (client,key,version,extra={})=>client.api('/listings/'+key+'/submit',{version,...extra});
function inspect(sql,...args) {
  const db=new DatabaseSync(join(directory,'all4auto.sqlite'),{readOnly:true});
  try{return db.prepare(sql).get(...args);}
  finally{db.close();}
}

test('saved icon collection and site theme apply before the stylesheet on all page layouts',async()=>{
  const client=browser();
  const newStyles=['pagani-atelier','clockwork-gold','platinum-jewel','crystal-night','neon-tachometer'];
  const newerThemes={
    'leather-pearl-rosso':'light','leather-pearl-violet':'light','leather-obsidian':'dark',
    'alcantara-rs':'dark','copper-brushed':'dark','carbon-twill':'dark','titanium-brushed':'dark',
    'leather-crema-cross':'light','leather-bordeaux-double':'dark','alcantara-petrol-piping':'dark',
    'leather-forest-saddle':'dark','leather-graphite-rs':'dark','leather-black-acid':'dark'
  };
  const {result:script,headers}=await client.go('/appearance.js?v=11');
  assert.match(headers.get('content-type'),/javascript/);
  const {result:ultimateScript,headers:ultimateHeaders}=await client.go('/ultimate-visual.js?v=4');
  assert.match(ultimateHeaders.get('content-type'),/javascript/);
  assert.match(ultimateScript,/a4-ultimate-visual-v1/);

  for (const path of ['/?lang=de','/demo/oferta/przyklad-1','/demo/zegarek','/demo/rolki/przyklad-113']) {
    const {result:html}=await client.go(path);
    assert.equal((html.match(/GTM-5QNJH39C/g)||[]).length,1);
    assert.equal((html.match(/window\.dataLayer=window\.dataLayer\|\|\[\]/g)||[]).length,1);
    const iconStyle=html.match(/data-icon-style="([^"]+)"/)[1];
    const iconStyles=html.match(/data-icon-styles="([^"]+)"/)[1];
    const scriptAt=html.indexOf('<script src="/appearance.js?v=11"></script>');
    assert.ok(scriptAt>=0&&scriptAt<html.indexOf('<link rel="stylesheet"'));
    const ultimateAt=html.indexOf('<script src="/ultimate-visual.js?v=4"></script>');
    assert.ok(ultimateAt>scriptAt&&ultimateAt<html.indexOf('<link rel="stylesheet"'));
    assert.equal(iconStyle,'sapphire-braid');
    const styles=iconStyles.split(' ');
    assert.equal(styles.length,100);
    assert.equal(new Set(styles).size,100);
    assert.deepEqual(styles.slice(0,6),
      ['classic','classic-solid','classic-duotone','classic-cobalt','classic-sage','classic-copper']);
    assert.deepEqual(styles.slice(-5),newStyles);

    const themeModes=html.match(/data-theme-modes="([^"]+)"/)[1].replaceAll('&quot;','"');
    const themeMaterials=html.match(/data-theme-materials="([^"]+)"/)[1];
    const themeStitchValues=html.match(/data-theme-stitch-values="([^"]+)"/)[1].replaceAll('&quot;','"');
    const stitchValues=JSON.parse(themeStitchValues);
    assert.deepEqual(stitchValues,{
      thread:['auto','red','violet','yellow','lime','blue','ivory','copper'],
      contrast:['standard','subtle','strong'],
    });
    assert.deepEqual(JSON.parse(themeModes),{
      light:'light',dark:'dark',black:'dark',graphite:'dark',system:'system',
      alcantara:'dark','nappa-black':'dark','leather-cognac':'dark','leather-ivory':'light',...newerThemes
    });
    assert.deepEqual(themeMaterials.split(' '),['alcantara','nappa-black','leather-cognac','leather-ivory',...Object.keys(newerThemes)]);
    if (path==='/?lang=de') {
      assert.match(html,/Schwarzes Nappaleder/);
      assert.match(html,/Weißes Leder · violette Naht/);
      assert.match(html,/<span>Seitenhintergrund<\/span><\/summary>/);
    }
    const preferences=new Map([
      ['a4-icon-style','track-platinum'],['a4-icon-surface','glass'],['a4-theme','leather-ivory'],
      ['a4-dark-palette','nappa-black'],
      ['a4-theme-stitch:leather-ivory:thread','copper'],['a4-theme-stitch:leather-ivory:contrast','subtle'],
    ]);
    const buttonEmbroideryChoices=html.match(/data-button-embroidery-choices="([^"]+)"/)[1];
    const dataset={iconStyle,iconStyles,iconSurface:'none',themeModes,themeMaterials,themeStitchValues,buttonEmbroideryChoices};
    const listeners={}, documentListeners={}, rootListeners={};
    let changeSystemTheme, materialThemeActive;
    const systemTheme={matches:true,addEventListener:(type,callback)=>{changeSystemTheme=callback;}};
    const choices=Object.keys(JSON.parse(themeModes)).map(value=>({value,checked:false,matches:selector=>selector==='[data-theme-choice]'}));
    const stitchControls=Object.entries(stitchValues).flatMap(([field,values])=>values.map(value=>({
      value,checked:false,dataset:{themeStitchChoice:field},matches:selector=>selector==='[data-theme-stitch-choice]'
    })));
    const stitchPanel={hidden:true};
    const pick=control=>{
      control.checked=true;
      documentListeners.change({target:control});
    };
    const pickTheme=value=>pick(choices.find(control=>control.value===value));
    const pickStitch=(field,value)=>pick(stitchControls.find(control=>control.dataset.themeStitchChoice===field&&control.value===value));
    const selectedTheme=()=>choices.find(control=>control.checked)?.value;
    runInNewContext(script,{
      document:{
        documentElement:{
          dataset,
          addEventListener:(type,callback)=>{rootListeners[type]=callback;},
          toggleAttribute:(name,active)=>{assert.equal(name,'data-theme-material');materialThemeActive=active;}
        },
        addEventListener:(type,callback)=>{documentListeners[type]=callback;},
        querySelectorAll:selector=>({
          '[data-theme-choice]':choices,
          '[data-theme-stitch-choice]':stitchControls,
          '[data-theme-stitch-settings]':[stitchPanel],
        })[selector]||[]
      },
      localStorage:{getItem:key=>preferences.get(key)??null,setItem:(key,value)=>preferences.set(key,value),removeItem:key=>preferences.delete(key)},
      window:{matchMedia:()=>systemTheme,addEventListener:(type,callback)=>{listeners[type]=callback;}}
    });
    assert.equal(dataset.iconStyle,'track-platinum');
    assert.equal(dataset.iconSurface,'glass');
    assert.equal(dataset.palette,'leather-ivory');
    assert.equal(dataset.theme,'light');
    assert.equal(selectedTheme(),'leather-ivory');
    assert.equal(materialThemeActive,true);
    assert.equal(stitchPanel.hidden,false);
    assert.equal(dataset.themeThread,'copper');
    assert.equal(dataset.themeStitchContrast,'subtle');
    documentListeners.click({target:{closest:selector=>selector==='[data-theme-toggle]'}});
    assert.equal(dataset.palette,'nappa-black');
    assert.equal(dataset.theme,'dark');
    assert.equal(dataset.themeThread,'auto');
    documentListeners.click({target:{closest:selector=>selector==='[data-theme-toggle]'}});
    assert.equal(dataset.palette,'leather-ivory');

    for (const [value,mode] of Object.entries(newerThemes)) {
      pickTheme(value);
      assert.equal(preferences.get('a4-theme'),value);
      assert.equal(selectedTheme(),value);
      assert.equal(dataset.palette,value);
      assert.equal(dataset.theme,mode);
      assert.equal(materialThemeActive,true);
    }

    pickStitch('thread','violet');
    pickStitch('contrast','strong');
    assert.equal(dataset.themeThread,'violet');
    assert.equal(dataset.themeStitchContrast,'strong');
    pickTheme('leather-graphite-rs');
    pickStitch('thread','red');
    assert.equal(dataset.themeThread,'red');
    assert.equal(dataset.themeStitchContrast,'standard');
    pickTheme('leather-black-acid');
    assert.equal(dataset.themeThread,'violet');
    assert.equal(dataset.themeStitchContrast,'strong');
    const blackThreadKey='a4-theme-stitch:leather-black-acid:thread';
    preferences.set(blackThreadKey,'yellow');
    listeners.storage({key:blackThreadKey});
    assert.equal(dataset.themeThread,'yellow');
    pickStitch('thread','auto');
    assert.equal(preferences.has(blackThreadKey),false);
    assert.equal(dataset.themeStitchContrast,'strong');

    pickTheme('alcantara');
    assert.equal(preferences.get('a4-theme'),'alcantara');
    assert.equal(dataset.palette,'alcantara');
    preferences.set('a4-theme','system');
    listeners.storage({key:'a4-theme'});
    assert.equal(selectedTheme(),'system');
    assert.equal(dataset.palette,'dark');
    systemTheme.matches=false;
    changeSystemTheme();
    assert.equal(dataset.palette,'light');
    assert.equal(materialThemeActive,false);
    assert.equal(stitchPanel.hidden,true);
    assert.equal(dataset.themeThread,undefined);
    assert.equal(dataset.themeStitchContrast,undefined);
    rootListeners['reset-site-theme']();
    assert.equal(preferences.has('a4-theme'),false);
    assert.equal(preferences.has('a4-light-palette'),false);
    assert.equal(preferences.has('a4-dark-palette'),false);
    assert.equal([...preferences.keys()].some(key=>key.startsWith('a4-theme-stitch:')),false);
    assert.equal(selectedTheme(),'light');

    preferences.set('a4-icon-style','classic-garage');
    listeners.pageshow({persisted:true});
    assert.equal(dataset.iconStyle,'classic-garage');
    for (const style of ['classic-sage','classic-copper',...newStyles]) {
      preferences.set('a4-icon-style',style);
      listeners.storage({key:'a4-icon-style'});
      assert.equal(dataset.iconStyle,style);
    }

    preferences.set('a4-icon-style','unknown-style');
    preferences.delete('a4-icon-surface');
    listeners.storage({key:'a4-icon-style'});
    assert.equal(dataset.iconStyle,'sapphire-braid');
    assert.equal(dataset.iconSurface,'none');
  }
  const {result:css}=await client.go('/styles.css?v=bespoke-ambient-1');
  for (const value of Object.keys(newerThemes)) assert.ok(css.includes(`[data-palette=${value}]`),value);
  assert.doesNotMatch(css,/--material-(?:perforation|hole)/);
  for (const style of newStyles) {
    for (const name of [style,style+'-preview']) {
      const path='/assets/collections/'+name+'.webp';
      assert.ok(css.includes(path),path);
      const {result:image,headers}=await client.go(path);
      assert.match(headers.get('content-type'),/image\/webp/);
      assert.equal(image.subarray(8,12).toString(),'WEBP');
    }
  }
});

test('button upholstery presets and independent options keep one complete saved finish',async()=>{
  const client=browser();
  const {result:script}=await client.go('/appearance.js?v=11');
  const {result:html}=await client.go('/');
  const buttonFinishChoices=html.match(/data-button-finish-choices="([^"]+)"/)[1].replaceAll('&quot;','"');
  const buttonFinishPresets=html.match(/data-button-finish-presets="([^"]+)"/)[1].replaceAll('&quot;','"');
  const buttonEmbroideryChoices=html.match(/data-button-embroidery-choices="([^"]+)"/)[1];
  const embroideryStyles=buttonEmbroideryChoices.split(' ');
  assert.deepEqual(embroideryStyles,['satin','cotton','silk','metallic','reflective','plain']);
  const choices=JSON.parse(buttonFinishChoices);
  const presets=JSON.parse(buttonFinishPresets);
  assert.deepEqual(Object.keys(presets),[
    'graphite-gt','track-red','cognac','ivory','racing-green','midnight-navy',
    'steel-gray','aubergine','ice-blue','copper','stock',
    'rr-grace-suite','rr-navy-suite','rr-tan-suite','rr-charles-suite',
    'finish-carbon','finish-brushed-copper','finish-brushed-aluminum','finish-titanium',
    'lambo-verde','lambo-arancio','lambo-giallo','maybach-crystal','maybach-tartufo','maybach-bordeaux',
    'aston-oxford','aston-dark-knight','pagani-forged','pagani-aged-cognac','bugatti-racing-blue'
  ]);
  assert.match(html,/Motyw tapicerki/);
  assert.match(html,/Karbon i metale/);
  const menu=html.split('id="icon-style-dialog"')[1].split('</dialog>')[0];
  assert.match(menu,/<\/details>\s*<\/div>\s*<div class="button-finish-preview-dock"/);
  assert.equal((menu.match(/class="btn primary button-finish-preview-button"/g)||[]).length,1);
  assert.match(menu,/<span class="button-embroidery-label">Dodaj ogłoszenie<\/span>/);
  assert.equal((menu.match(/\bdata-button-embroidery-choice\b/g)||[]).length,6);
  assert.match(menu,/Bespoke Studio — materiały i wykończenia/);
  assert.doesNotMatch(menu,/RGB \/ OLED|Gotowe Zestawy|Advanced Border System|100 zestawów ikon|20 wariantów logo/);
  assert.equal((menu.match(/data-uve-preset="\d+"/g)||[]).length,0);
  for(const field of ['bgMaterial','buttonMaterial','stitchType','oledPureBlack']) {
    assert.ok(menu.includes(`data-uve-field="${field}"`),field);
  }
  assert.equal((menu.match(/data-uve-field="ambientColor"/g)||[]).length,0);
  const bespokeMenu=menu.slice(menu.indexOf('Bespoke Studio'),menu.indexOf('button-finish-preview-dock'));
  assert.doesNotMatch(bespokeMenu,/Ciepły Bursztyn|Czerwień Rosso|Animacja|Ramki LED|Neon/);
  const {result:ambientCss}=await client.go('/styles.css?v=no-led-1');
  assert.doesNotMatch(ambientCss,/data-uve-ambient-enabled=true|uve-ambient-colors/);
  assert.doesNotMatch(menu,/Podświetlenie ogłoszeń|Siła podświetlenia|Kolor podświetlenia/);
  assert.doesNotMatch(menu,/data-uve-action="export"|data-uve-import/);
  assert.match(menu,/class="uve-live-preview"/);
  const ordered=[
    'class="appearance-theme"', 'class="appearance-icons"', 'data-icon-board',
    'data-appearance-icon-group="surface"', 'data-appearance-icon-group="lines"',
    'data-appearance-icon-group="collections"', 'data-appearance-section="buttons"',
    'data-appearance-button-group="upholstery"', 'data-appearance-button-axis="embroidery"', 'data-appearance-button-axis="color"',
    'data-appearance-button-axis="material"', 'data-appearance-button-axis="stitch"',
    'data-appearance-button-axis="thread"', 'data-appearance-button-axis="hardware-metal"',
    'data-appearance-button-axis="hardware-fasteners"', 'data-appearance-button-axis="hardware-piping"',
    'data-appearance-button-axis="hardware-strap"', 'data-appearance-button-axis="hardware-trim"',
    'data-appearance-button-axis="hardware-lettering"', 'data-appearance-button-axis="hardware-plaque"',
    'data-appearance-button-group="account-style"',
    'data-appearance-button-group="account-colors"'
  ];
  assert.ok(ordered.map(section=>menu.indexOf(section)).every((index,i,indices)=>index>=0&&(!i||index>indices[i-1])),
    'appearance menu shows the board before small icon groups and all button settings');
  for (const brand of ['ferrari','porsche','bentley','rolls-royce','lamborghini','maybach','aston-martin','pagani-bugatti']) assert.ok(html.includes('data-button-finish-palette="'+brand+'"'));
  assert.deepEqual(Object.fromEntries(Object.entries(choices).map(([field,values])=>[field,values.length])),
    {color:63,material:18,stitch:7,thread:17});
  assert.doesNotMatch(html,/data-button-finish-choice=/);
  const attributes={color:'buttonColor',material:'buttonMaterial',stitch:'buttonStitch',thread:'buttonThread'};
  const dataset={iconStyle:'classic',iconStyles:'classic',themeModes:'{"light":"light"}',themeMaterials:'',
    themeStitchValues:'{"thread":["auto"],"contrast":["standard"]}',buttonFinishChoices,buttonFinishPresets,buttonEmbroideryChoices};
  let controls=[], fieldControls=[];
  const embroideryControls=embroideryStyles.map(value=>({value,checked:false,
    matches:selector=>selector==='input[data-button-embroidery-choice]'}));
  const documentListeners={}, rootListeners={}, windowListeners={};
  const previousFinish={color:'copper',material:'alcantara',stitch:'double',thread:'ivory'};
  const storage=new Map([['a4-button-finish',JSON.stringify(previousFinish)],['a4-button-embroidery','silk']]);
  const readFinish=()=>Object.fromEntries(Object.entries(attributes).map(([field,attribute])=>[field,dataset[attribute]]));

  runInNewContext(script,{
    document:{
      documentElement:{dataset,toggleAttribute(){},addEventListener:(type,callback)=>{rootListeners[type]=callback;}},
      querySelectorAll:selector=>({
        'input[data-button-finish-preset]':controls,
        'input[data-button-finish-field]':fieldControls,
        'input[data-button-embroidery-choice]':embroideryControls,
      })[selector]||[],
      addEventListener:(type,callback)=>{documentListeners[type]=callback;}
    },
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(type,callback)=>{windowListeners[type]=callback;}}
  });
  assert.deepEqual(readFinish(),previousFinish);
  assert.equal(dataset.buttonEmbroidery,'silk');
  const mockRadio=(value,field)=>{
    const swatch={dataset:{}};
    return {value,checked:false,dataset:{buttonFinishField:field},
      matches:selector=>selector===(field?'input[data-button-finish-field]':'input[data-button-finish-preset]'),
      swatch,parentElement:{hidden:value==='custom',querySelector:()=>swatch},closest:()=>null};
  };
  controls=[...Object.keys(presets),'custom'].map(value=>mockRadio(value));
  fieldControls=Object.entries(choices).flatMap(([field,values])=>values.map(value=>mockRadio(value,field)));
  const radio=value=>controls.find(control=>control.value===value);
  const selected=()=>controls.filter(control=>control.checked).map(control=>control.value);
  const selectedFields=()=>Object.fromEntries(fieldControls.filter(control=>control.checked)
    .map(control=>[control.dataset.buttonFinishField,control.value]));
  documentListeners.DOMContentLoaded();
  assert.deepEqual(selected(),['custom']);
  assert.deepEqual(selectedFields(),previousFinish);
  assert.equal(radio('custom').parentElement.hidden,false);
  assert.equal(radio('custom').swatch.dataset.buttonMaterial,'alcantara');
  for (const control of embroideryControls) {
    control.checked=true;
    documentListeners.change({target:control});
    assert.equal(dataset.buttonEmbroidery,control.value);
    assert.equal(storage.get('a4-button-embroidery'),control.value);
    assert.deepEqual(readFinish(),previousFinish);
  }

  radio('graphite-gt').checked=true;
  documentListeners.change({target:radio('graphite-gt')});
  assert.deepEqual(readFinish(),presets['graphite-gt']);
  assert.deepEqual(JSON.parse(storage.get('a4-button-finish')),presets['graphite-gt']);
  assert.deepEqual(selected(),['graphite-gt']);
  assert.deepEqual(selectedFields(),presets['graphite-gt']);
  assert.equal(dataset.buttonEmbroidery,'plain');
  assert.equal(radio('custom').parentElement.hidden,true);
  const invalid=mockRadio('unknown');
  invalid.checked=true;
  documentListeners.change({target:invalid});
  assert.deepEqual(readFinish(),presets['graphite-gt']);

  const independent={color:'f-crema',material:'alcantara-perforated',stitch:'cross',thread:'navy'};
  const applied={...presets['graphite-gt']};
  for (const [field,value] of Object.entries(independent)) {
    const control=fieldControls.find(option=>option.dataset.buttonFinishField===field&&option.value===value);
    control.checked=true;
    documentListeners.change({target:control});
    applied[field]=value;
    assert.deepEqual(readFinish(),applied);
    assert.deepEqual(selectedFields(),applied);
    assert.deepEqual(JSON.parse(storage.get('a4-button-finish')),applied);
  }
  assert.deepEqual(selected(),['custom']);
  assert.equal(radio('custom').swatch.dataset.buttonMaterial,'alcantara-perforated');
  const invalidField=mockRadio('not-a-shade','color');
  invalidField.checked=true;
  documentListeners.change({target:invalidField});
  assert.deepEqual(readFinish(),independent);

  radio('rr-charles-suite').checked=true;
  documentListeners.change({target:radio('rr-charles-suite')});
  assert.deepEqual(readFinish(),{color:'rr-charles',material:'placed-perforation',stitch:'single',thread:'navy'});
  assert.deepEqual(selected(),['rr-charles-suite']);
  assert.deepEqual(JSON.parse(storage.get('a4-button-finish')),presets['rr-charles-suite']);
  radio('finish-brushed-copper').checked=true;
  documentListeners.change({target:radio('finish-brushed-copper')});
  assert.deepEqual(readFinish(),{color:'copper',material:'brushed-copper',stitch:'none',thread:'silver'});
  assert.deepEqual(selectedFields(),presets['finish-brushed-copper']);

  storage.set('a4-button-finish',JSON.stringify(presets.ivory));
  windowListeners.storage({key:'a4-button-finish'});
  assert.deepEqual(selected(),['ivory']);
  assert.deepEqual(readFinish(),presets.ivory);
  storage.set('a4-button-embroidery','metallic');
  windowListeners.storage({key:'a4-button-embroidery'});
  assert.equal(dataset.buttonEmbroidery,'metallic');
  assert.deepEqual(readFinish(),presets.ivory);
  storage.delete('a4-button-finish');
  rootListeners['reset-button-finish']();
  assert.deepEqual(selected(),['stock']);
  assert.deepEqual(selectedFields(),presets.stock);
  assert.equal(storage.has('a4-button-embroidery'),false);
  assert.equal(dataset.buttonEmbroidery,'satin');
  storage.set('a4-button-finish','invalid JSON');
  storage.set('a4-button-embroidery','invalid');
  windowListeners.pageshow({persisted:true});
  assert.deepEqual(readFinish(),presets.stock);
  assert.equal(dataset.buttonEmbroidery,'satin');

  const {result:css}=await client.go('/styles.css?v=bespoke-ambient-1');
  const proceduralMaterials=new Set(['q-citura','brogued-leather','forged-carbon']);
  for (const material of choices.material.filter(choice=>choice!=='smooth'&&!proceduralMaterials.has(choice))) {
    const path='/assets/buttons/'+material+'.webp';
    assert.ok(css.includes(path),path);
    const {result:image,headers}=await client.go(path);
    assert.match(headers.get('content-type'),/image\/webp/);
    assert.equal(image.subarray(8,12).toString(),'WEBP');
  }
  for (const material of proceduralMaterials) assert.match(css,new RegExp(`data-button-material=${material}`));
});

test('01 · registration, confirmation, sign-in, sign-out, reset and one-time tokens',async()=>{
  seller=browser();
  const email='seller@example.test';
  await seller.api('/auth/register',{email,password,name:'Sprzedawca Test',profile_type:'private',terms:true,role:'admin'});
  confirmToken=await latestToken(email,'verify');
  assert.match((await seller.go('/potwierdz-email?token='+confirmToken)).result,/Potwierdź adres/);
  await seller.api('/auth/login',{email,password},403);
  await seller.api('/auth/verify',{token:confirmToken,password:'incorrect-registration-password'},401);
  await seller.api('/auth/verify',{token:confirmToken,password});
  await seller.api('/auth/verify',{token:confirmToken,password},410);
  await seller.api('/auth/login',{email,password});
  assert.match((await seller.go('/konto')).result,/Sprzedawca Test/);
  assert.equal(inspect('SELECT role FROM users WHERE email=?',email).role,'user');
  await seller.api('/auth/logout',{});
  await seller.go('/konto',{code:303,location:'/zaloguj?dalej=%2Fkonto'});
  await seller.api('/auth/reset-request',{email});
  const token=await latestToken(email,'reset');
  await seller.go('/ustaw-haslo?token='+token);
  await seller.api('/auth/reset',{token,password:newPassword});
  await seller.api('/auth/reset',{token,password:newPassword},410);
  await seller.api('/auth/login',{email,password},401);
  await seller.api('/auth/login',{email,password:newPassword});
});

test('02 · owner activation, role grants and access controls',async()=>{
  admin=await signup(ownerEmail);
  moderator=await signup('moderator@example.test');
  buyer=await signup('buyer@example.test');
  third=await signup('third@example.test');
  dealership=await signup('dealer@example.test','company');
  await admin.go('/administracja',{code:403});
  await seller.go('/moderacja',{code:403});
  await browser().go('/moderacja',{code:403});
  await seller.api('/admin/settings',{name:'Denied',reason:'test'},403);
  await seller.api('/auth/owner',{token:ownerToken},403);
  await admin.api('/auth/owner',{token:'incorrect'},403);
  await admin.api('/auth/owner',{token:ownerToken});
  await admin.api('/auth/owner',{token:ownerToken},409);
  const mod=inspect('SELECT id FROM users WHERE email=?','moderator@example.test');
  await admin.api('/admin/roles/'+mod.id,{role:'moderator',reason:'Uprawnienia testowe'});
  await moderator.go('/moderacja',{code:403});
  await moderator.api('/auth/login',{email:'moderator@example.test',password});
  await moderator.go('/moderacja');
  await moderator.go('/ustawienia');
  await moderator.go('/administracja',{code:403});
  await moderator.api('/admin/settings',{name:'Denied',reason:'test'},403);
  const {result:brandSettings}=await admin.go('/administracja');
  assert.match(brandSettings,/name="home_logo"/);
  assert.match(brandSettings,/name="launch_logo"/);
  const {result:defaultHome}=await buyer.go('/');
  assert.match(defaultHome,/data-header-preset src="[^"]*brand-logos\/07\.webp/);
  await admin.api('/admin/settings',{home_logo:'invalid',reason:'Test logo'},422);
  await admin.api('/admin/settings',{home_logo:'12',launch_logo:'07',reason:'Test logo'});
  const {result:updatedHome}=await buyer.go('/');
  assert.match(updatedHome,/data-header-preset src="[^"]*brand-logos\/12\.webp/);
  const {result:searchWithLogo}=await buyer.go('/szukaj');
  assert.match(searchWithLogo,/data-header-preset src="[^"]*brand-logos\/12\.webp/);
  assert.match(searchWithLogo,/data-personal-logo-choice/);
  assert.match(updatedHome,/launch-badge-preset"><img[^>]+brand-logos\/07\.webp/);
  await buyer.go('/assets/brand-logos/20.webp');
  await admin.api('/admin/settings',{home_logo:'07',launch_logo:'original',reason:'Restore test defaults'});
  await browser().go('/api/contact',{method:'POST',headers:{Origin:'https://external.invalid'},data:{},code:403});
});

test('YouTube submissions stay private until moderated and can be withdrawn',async()=>{
  const guest=browser();
  const video='aBcDeFG12_3';
  const title='Test jazdy z YouTube';
  const payload={title,url:'https://youtu.be/'+video,description:'Krótki opis testu'};
  await guest.api('/youtube-promotions',payload,401);
  await seller.api('/youtube-promotions',{...payload,url:'https://www.youtube.com.example.com/watch?v='+video},422);
  assert.equal((await seller.api('/youtube-promotions',payload)).next,'/?film=zgloszony#filmy-youtube');
  await seller.api('/youtube-promotions',{...payload,url:'https://www.youtube.com/shorts/'+video},409);
  assert.doesNotMatch((await guest.go('/')).result,new RegExp(title));
  assert.match((await moderator.go('/moderacja?sekcja=youtube')).result,new RegExp(title));
  await seller.api('/youtube-promotions/'+video,{action:'approve'},403);
  await moderator.api('/youtube-promotions/'+video,{action:'approve'});
  assert.match((await guest.go('/')).result,new RegExp('youtube.com/watch\\?v='+video));
  assert.doesNotMatch((await guest.go('/demo')).result,new RegExp(title));
  await seller.api('/youtube-promotions/'+video,{action:'remove'});
  assert.doesNotMatch((await guest.go('/')).result,new RegExp(title));
});

test('ChatGPT account sign-in and staff separation',async()=>{
  const guest=browser();
  assert.match((await guest.go('/zaloguj')).result,/class="btn auth-provider"/);
  await guest.go('/logowanie-chatgpt?dalej=%2Freklama',{code:303,location:'/signin-with-chatgpt?return_to=%2Freklama'});
  await guest.go('/',{headers:{'oai-authenticated-user-email':'chatgpt-test@example.test'},code:303,location:'/reklama'});
  assert.match((await guest.go('/reklama')).result,/data-api="\/contact"/);
  assert.equal(guest.jar.has('a4_chatgpt_pending'),false);
  assert.equal(guest.jar.get('a4_chatgpt_session'),'1');
  const settings=(await guest.go('/ustawienia')).result;
  assert.match(settings,/Ustaw hasło przez e-mail/);
  assert.match(settings,/Poproś o zamknięcie konta/);
  const created=inspect('SELECT id,name FROM users WHERE email=?','chatgpt-test@example.test');
  assert.equal(created.name,'Użytkownik');
  await admin.api('/admin/roles/'+created.id,{role:'moderator',reason:'Test'},422);
  await guest.go('/moderacja',{code:403});
  assert.equal((await guest.api('/auth/logout',{})).next,'/signout-with-chatgpt');
  assert.equal(guest.jar.has('a4_chatgpt_session'),false);

  const staff=browser();
  await staff.go('/logowanie-chatgpt',{code:303});
  await staff.go('/',{headers:{'oai-authenticated-user-email':'moderator@example.test'},code:303,location:'/zaloguj?chatgpt=unavailable'});
  assert.equal(staff.jar.has('a4_session'),false);
});

test('03 · draft persistence, refresh, idempotency and private edit protection',async()=>{
  car=await makeDraft(seller);
  let state=await edit(seller,car,0,data,undefined,2);
  assert.equal(state.version,1);
  assert.match((await seller.go('/sprzedaj/'+car)).result,/1.8 Hybrid QA/);
  assert.equal((await editRead(seller,car)).step,2);
  await third.api(editsPath(car),{data:{...data,price:10},version:1},403,'PUT');
  await third.go('/podglad/'+car,{code:403});
  await moderator.go('/moderacja/'+car,{code:404});
  await seller.api(editsPath(car),{data,version:0},409,'PUT');
});

test('04 · three photos, cover, order, deletion, invalid and oversized uploads',async()=>{
  let state=await editRead(seller,car);
  await upload(seller,car,state.version,Buffer.from('not-an-image'),422);
  await upload(seller,car,state.version,Buffer.alloc(13*1024*1024),413);
  assert.equal((await editRead(seller,car)).data.variant,data.variant);
  for (const index of [1,2,3]) state=await upload(seller,car,state.version,await photo(index));
  const [first,second,thirdPhoto]=state.photos;
  assert.equal(state.photos.length,3);
  const photoDetails={[second]:'wheels',[thirdPhoto]:'interior',[first]:'invalid',unowned:'headlights'};
  const reordered=await edit(seller,car,state.version,{...data,photoDetails},[second,thirdPhoto,first],3);
  assert.deepEqual(reordered.photos,[second,thirdPhoto,first]);
  assert.deepEqual(reordered.data.photoDetails,{[second]:'wheels',[thirdPhoto]:'interior'});
  const removed=await edit(seller,car,reordered.version,data,[second,first],5);
  photoIds=removed.photos;
  const refreshed=await editRead(seller,car);
  assert.deepEqual(refreshed.photos,photoIds);
  assert.deepEqual(refreshed.data.photoDetails,{[second]:'wheels'});
  const preview=(await seller.go('/podglad/'+car)).result;
  assert.match(preview,new RegExp('&quot;detail&quot;:&quot;wheels&quot;,&quot;url&quot;:&quot;/media/'+second));
  assert.doesNotMatch(preview,/data-gallery-details="[^"]*&quot;detail&quot;:&quot;interior&quot;/);
  await seller.go('/media/'+second+'/thumb');
  await third.go('/media/'+second+'/thumb',{code:404});
  await moderator.go('/media/'+second,{code:404});
});

test('05 · full preview, moderation submission and public visibility',async()=>{
  const before=(await seller.go('/podglad/'+car)).result;
  assert.match(before,/Pełna specyfikacja/);
  assert.match(before,/1.8 Hybrid QA/);
  assert.match(before,/class="listing-showcase"/);
  assert.match(before,/1 \/ 2/);
  assert.doesNotMatch(before,/data-gallery-autoplay/);
  assert.doesNotMatch(before,/data-photo-stack/);
  assert.match(before,/Opublikuj za darmo — 0 zł/);
  assert.equal((before.match(/name="support"/g)||[]).length,4);
  assert.match(before,/nie wpływa na widoczność ani pozycjonowanie ogłoszenia/);
  const version=(await editRead(seller,car)).version;
  const [result,retry]=await Promise.all([submit(seller,car,version),submit(seller,car,version)]);
  assert.equal(result.status,'published');
  assert.deepEqual(retry,result);
  publicPath='/oferta/'+result.slug;
  assert.doesNotMatch((await moderator.go('/moderacja')).result,/Toyota Corolla/);
  const review=(await moderator.go('/moderacja/'+car)).result;
  assert.match(review,/class="listing-showcase"/);
  assert.match(review,/Opublikowano automatycznie/);
  assert.equal(inspect("SELECT count(*) AS n FROM moderation WHERE listing_id=? AND action='auto_published'",car).n,1);
  assert.equal(inspect("SELECT count(*) AS n FROM notifications WHERE kind='published' AND json_extract(data,'$.listingId')=?",car).n,1);
  assert.match((await seller.go('/moje-ogloszenia?wyslano='+car)).result,/Ogłoszenie jest już opublikowane/);
  const published=(await browser().go(publicPath)).result;
  assert.match(published,/Toyota Corolla/);
  assert.match(published,/class="listing-showcase"/);
  assert.match(published,new RegExp('&quot;detail&quot;:&quot;wheels&quot;,&quot;url&quot;:&quot;/media/'+photoIds[0]));
  assert.doesNotMatch(published,/data-gallery-autoplay/);
  assert.deepEqual([...published.matchAll(/data-stack-photo="(\d+)"/g)].map(match=>match[1]),['0','1']);
  assert.match(published,/data-open-enquiry="contact"/);
  assert.ok(published.includes('href="/zarejestruj?dalej='+encodeURIComponent(publicPath+'?kontakt=wiadomosc')+'"'));
  assert.doesNotMatch(published,/data-api="\/offers\/[^/]+\/message"/);
  assert.match(published,/class="btn showcase-vin-link" href="#sprawdz-vin"/);
  assert.match(published,/class="panel offer-section" id="sprawdz-vin"/);
  const vinSection=published.split('<span>Sprawdź po numerze VIN</span>')[1];
  assert.match(vinSection,/data-copy-vin="ZZZTEST0000000001"/);
  assert.match(vinSection,/href="https:\/\/www\.carvertical\.com\/pl\/historia-pojazdu" target="_blank" rel="noopener noreferrer"/);
  assert.match(vinSection,/<\/details>\s*<\/div><div class="wrap page"><section class="panel seller-panel"/);
  const tvHome=(await browser().go('/tv')).result;
  assert.match(tvHome,/SMART TV/);
  assert.match(tvHome,/Samochody/);
  assert.match(tvHome,/Toyota Corolla/);
  assert.match(tvHome,/tv\.js\?v=2/);
  const tvReels=(await browser().go('/tv?widok=rolki&make=Toyota')).result;
  assert.match(tvReels,/data-tv-reel-feed/);
  assert.match(tvReels,/data-tv-slide/);
  assert.match(tvReels,/data-tv-reel-image/);
  assert.match(tvReels,/data-tv-photo-list=/);
  assert.match(tvReels,/data-tv-list-next/);
  assert.match(tvReels,/data-tv-open/);
  assert.match(tvReels,/Toyota Corolla/);
  const tvDetail=(await browser().go('/tv/oferta/'+result.slug)).result;
  assert.match(tvDetail,/data-gallery-image/);
  assert.match(tvDetail,/Pokaż na telefonie/);
  assert.match(tvDetail,/Zapisz ogłoszenie/);
  assert.match(tvDetail,new RegExp('data-qr-url="http://[^\\"]*'+result.slug+'"'));
  const messagePath='/tv/oferta/'+result.slug+'/wiadomosc';
  const guestMessage=await browser().go(messagePath,{code:303});
  assert.match(guestMessage.headers.get('location'),/\/zaloguj\?dalej=/);
  const tvMessage=(await buyer.go(messagePath)).result;
  assert.match(tvMessage,/data-tv-message/);
  assert.match(tvMessage,/Treść wiadomości/);
  const tvManifest=JSON.parse((await browser().go('/tv/manifest.webmanifest')).result);
  assert.equal(tvManifest.start_url,'/tv');
  assert.equal(tvManifest.scope,'/tv/');
  assert.equal((await browser().go('/api/search?make=Toyota')).result.total,1);
  assert.equal((await browser().go('/media/'+photoIds[0])).headers.get('x-content-type-options'),'nosniff');
});

test('optional support selection publishes without Stripe and payment routes retain authentication and CSRF checks',async()=>{
  const key=await makeDraft(seller);
  let state=await editRead(seller,key);
  state=await upload(seller,key,state.version,await photo(1));
  state=await edit(seller,key,state.version,{...data,vin:'QA-SUPPORT-2026'},state.photos);
  const result=await submit(seller,key,state.version,{support:'v8-club'});
  assert.ok(['published','pending'].includes(result.status));
  assert.equal(result.next,'/wsparcie?ogloszenie='+key+'&pakiet=v8-club');
  const listing=inspect('SELECT status,featured_until FROM listings WHERE id=?',key);
  assert.equal(listing.status,result.status);assert.equal(listing.featured_until,null);
  const page=(await seller.go(result.next)).result;
  assert.match(page,/V8 CLUB BRUMBRUM/);
  assert.match(page,/Wpłaty są jeszcze niedostępne/);
  assert.equal((page.match(/Wpłaty niedostępne/g)||[]).length,4);
  await seller.api('/support/start',{key:'qa-payment',listing:key,package:'v8-club'},503);
  await third.go(result.next,{code:403});
  await browser().api('/support/start',{key:'qa-payment',package:'pit-stop'},401);
  await seller.go('/api/support/start',{method:'POST',data:{key:'qa-payment',package:'pit-stop'},headers:{Origin:'https://other.example.test'},code:403});
  await browser().go('/api/stripe/webhook',{method:'POST',data:{},headers:{Origin:'https://stripe.example.test'},code:503});
  await seller.go('/administracja?sekcja=support',{code:403});
  assert.match((await admin.go('/administracja?sekcja=support')).result,/STRIPE_RESTRICTED_KEY/);
  const pending=(await seller.go('/wsparcie/powrot?session_id=cs_live_forged&success=true')).result;
  assert.match(pending,/Sprawdzamy potwierdzenie płatności/);
  assert.doesNotMatch(pending,/Stripe potwierdził jednorazową wpłatę/);
  await seller.api('/listings/'+key+'/status',{status:'held'});
  await seller.api('/listings/'+key+'/status',{status:'archived'});
});

test('06 · rejection reason, correction, resubmission, active edit and re-review',async()=>{
  let state=await editRead(seller,car);
  state=await edit(seller,car,state.version,{...data,price:65000,description:data.description+' Podaj kod BLIK.'},state.photos);
  assert.equal((await browser().go('/api/search?make=Toyota')).result.offers[0].price,68400);
  await seller.api('/listings/'+car+'/submit',{version:state.version},409);
  assert.equal((await submit(seller,car,state.version,{confirm:true})).status,'pending');
  await browser().go(publicPath,{code:404});
  await browser().go('/media/'+photoIds[0],{code:404});
  assert.match((await moderator.go('/moderacja')).result,/Prośba o kod/);
  await moderator.api('/moderation/'+car,{action:'rejected',reason:'',revision:2},422);
  await moderator.api('/moderation/'+car,{action:'rejected',reason:'Uzupełnij dane testowe.',revision:2});
  assert.match((await seller.go('/moje-ogloszenia')).result,/Uzupełnij dane testowe/);
  assert.match((await seller.go('/powiadomienia')).result,/Uzupełnij dane testowe/);
  state=await editRead(seller,car);
  state=await edit(seller,car,state.version,{...data,description:data.description+' Poprawka.',price:65000,vin:'CHASSIS/74'},state.photos);
  assert.equal((await submit(seller,car,state.version)).status,'published');
  assert.equal((await browser().go('/api/search?make=Toyota')).result.offers[0].price,65000);
  const legacy=(await browser().go(publicPath+'?lang=en')).result;
  assert.match(legacy,/<span>Check by VIN<\/span>.*<code>CHASSIS\/74<\/code>/s);
  assert.doesNotMatch(legacy,/data-copy-vin=/);
  const profile={name:'Sprzedawca Test',profile_type:'private',phone:'+48000000000',show_phone:true,lang:'pl',notify_messages:true,notify_listings:true};
  await seller.api('/profile',profile,200,'PUT');
  await browser().go('/api/offers/'+car+'/phone',{code:404});
  state=await editRead(seller,car);
  state=await edit(seller,car,state.version,{...data,price:65000,contact:'phone'},state.photos);
  assert.equal((await submit(seller,car,state.version,{confirm:true})).status,'published');
  const guest=browser();
  assert.doesNotMatch((await guest.go(publicPath)).result,/48000000000/);
  assert.equal((await guest.go('/api/offers/'+car+'/phone')).result.phone,profile.phone);
  await seller.api('/profile',{...profile,show_phone:false},200,'PUT');
  await guest.go('/api/offers/'+car+'/phone',{code:404});

  state=await editRead(seller,car);
  state=await edit(seller,car,state.version,{...state.data,listingPhone:'123'},state.photos);
  const invalid=await seller.api('/listings/'+car+'/submit',{version:state.version,confirm:true},422);
  assert.ok(invalid.fields.includes('listingPhone'));
  const listingPhone='+48 000 000 001';
  state=await edit(seller,car,state.version,{...state.data,listingPhone},state.photos);
  assert.match((await seller.go('/podglad/'+car)).result,/Zadzwoń · \+48 000 000 001/);
  await guest.go('/api/offers/'+car+'/phone',{code:404});
  assert.equal((await submit(seller,car,state.version,{confirm:true})).status,'published');
  assert.match((await guest.go(publicPath)).result,/href="tel:\+48000000001"/);
  assert.equal((await guest.go('/api/offers/'+car+'/phone')).result.phone,listingPhone);
  assert.equal((await guest.go('/api/search?make=Toyota')).result.offers[0].listingPhone,undefined);
  state=await editRead(seller,car);
  state=await edit(seller,car,state.version,{...state.data,contact:'message',listingPhone:''},state.photos);
  assert.equal((await submit(seller,car,state.version,{confirm:true})).status,'published');
  await guest.go('/api/offers/'+car+'/phone',{code:404});
});

test('07 · combined filters, sorting, pagination, comparison and direct URLs',async()=>{
  const guest=browser();
  const pageNumbers=Array.from({length:Math.ceil(demoListingCount/9)},(_,index)=>index+1);
  const pages=await Promise.all(pageNumbers.map(async page=>(await guest.go('/demo/api/search?sort=price_asc&page='+page)).result));
  const [p1,p2]=pages;
  assert.equal(p1.total,demoListingCount);
  assert.deepEqual(pages.map(page=>page.offers.length),pageNumbers.map(page=>Math.min(9,demoListingCount-(page-1)*9)));
  const offers=pages.flatMap(page=>page.offers);
  assert.equal(new Set(offers.map(offer=>offer.id)).size,demoListingCount);
  assert.equal(new Set(offers.map(offer=>JSON.stringify([offer.make,offer.model,offer.variant]))).size,demoListingCount);
  assert.ok(p1.offers.at(-1).price<=p2.offers[0].price);
  assert.equal((await guest.go('/demo/api/search?type=car')).result.total,48);
  const taycan=(await guest.go('/demo/api/search?type=car&make=Porsche&model=Taycan&fuel=electric')).result;
  assert.equal(taycan.total,1);
  assert.equal(taycan.offers[0].slug,'przyklad-113');
  assert.equal((await guest.go('/api/search?make=Porsche&model=Taycan')).result.total,0);
  assert.equal((await guest.go('/demo/api/search?make=Lamborghini')).result.total,4);
  assert.equal((await guest.go('/demo/api/search?make=Ferrari')).result.total,7);
  assert.equal((await guest.go('/api/search?make=Ferrari')).result.total,0);
  assert.equal((await guest.go('/demo/api/search?type=quad')).result.offers[0].model,'CFORCE 520');
  assert.equal((await guest.go('/api/search?type=quad')).result.total,0);
  const homepage=(await guest.go('/demo')).result;
  const expectedTypes=['car','van','camper','truck','bus','trailer','farm','special','construction',
    'forestry','marine_air','garden','industrial','motorcycle','scooter','quad','utv','kart','snowmobile','other','parts'];
  assert.equal(expectedTypes.length,21);
  assert.deepEqual(new Set(expectedTypes),new Set(Object.keys(vehicleTypes)));
  function linksWithClass(html,className) {
    const links=[];
    for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
      const classes=tag.match(/\sclass="([^"]*)"/)?.[1].split(/\s+/) || [];
      if (!classes.includes(className)) continue;
      const url=tag.match(/\shref="([^"]+)"/)?.[1];
      assert.ok(url,tag);
      links.push({url:url.replaceAll('&amp;','&'),type:tag.match(/\sdata-vehicle-type="([^"]+)"/)?.[1],
        filter:/\sdata-vehicle-filter(?:[\s=>])/.test(tag)});
    }
    return links;
  }
  for (const [path,prefix,html] of [['/','',(await guest.go('/')).result],['/demo','/demo',homepage]]) {
    const form=html.split('<form class="quick-search"')[1].split('</form>')[0];
    assert.ok(form.includes(`action="${prefix}/szukaj"`),path);
    assert.match(form,/aria-controls="filter-advanced"[^>]*>.*Filtry pojazdów/);
    for (const name of ['category','make','model','body','minPrice','maxPrice','minYear','maxYear','fuel','condition','drive','gearbox','damage','minMileage','region','seller','q','minHours','minGrossWeight']) {
      assert.ok(form.includes(`name="${name}"`),`${path} · ${name}`);
    }
    const mainTiles=linksWithClass(html,'catalog-type-tile');
    assert.deepEqual(mainTiles.map(tile=>tile.type),expectedTypes);
    const homeVariants=linksWithClass(html,'category-variant');
    assert.equal(homeVariants.length,190);
    assert.ok([...mainTiles,...homeVariants].every(tile=>tile.filter));
    const homeLinks=new Set([...mainTiles,...homeVariants].map(tile=>tile.url));
    assert.equal(homeLinks.size,expectedTypes.length+homeVariants.length,path);
    assert.match(html,/class="robot-entry-banner"[^>]*>[\s\S]*?<\/a>\s*<\/div><script type="module" src="\/assets\/china-market/);
    assert.ok(html.indexOf('class="robot-entry-banner"')>html.indexOf('data-china-market'));
    for (const anchor of ['odmiany-rekreacyjne','odmiany-transportu','samochody-i-kampery','motocykle-i-rekreacja','transport-i-maszyny']) {
      assert.ok(html.includes(`id="${anchor}"`),anchor);
    }
    const allFilters=new Set();
    const sections=[...html.matchAll(/<section class="catalog-vehicle-section" data-catalog-type="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
    assert.deepEqual(sections.map(([,type])=>type),expectedTypes);
    for (const [,type,block] of sections) {
      const [header]=linksWithClass(block,'catalog-type-tile');
      assert.equal(header.type,type);
      assert.ok(block.indexOf('catalog-type-tile')<block.indexOf(type==='parts'?'category-part-group':'category-variant'),type);
      const {url}=header;
      assert.equal(url,`${prefix}/szukaj?type=${type}`);
      const category=(await guest.go(`${prefix}/kategorie/${type}`)).result;
      assert.match(category,/class="[^"]*\bcatalog-type-body\b/);
      assert.deepEqual(linksWithClass(category,'catalog-back').map(link=>link.url),[(prefix||'/')+'#kategorie']);
      if (type==='car') assert.match(category,/id="samochody-osobowe"/);
      const all=linksWithClass(category,'catalog-all');
      assert.equal(all.length,1,type);
      assert.ok(all[0].filter,type);
      assert.equal(all[0].url,`${prefix}/szukaj?type=${type}`);
      const variants=linksWithClass(category,'category-variant');
      assert.ok(variants.length,type);
      if (type==='parts') {
        const partGroups=linksWithClass(block,'category-part-group');
        assert.equal(partGroups.length,6);
        assert.ok(partGroups.every(link=>link.url.startsWith(`${prefix}/kategorie/parts#`)));
        assert.equal(variants.length,35);
        for (const anchor of ['silnik-naped','nadwozie-szyby','elektronika','hamulce-zawieszenie','felgi-opony','warsztat-pozostale']) {
          assert.ok(category.includes(`id="${anchor}"`),anchor);
        }
      } else assert.deepEqual(linksWithClass(block,'category-variant').map(link=>link.url),variants.map(link=>link.url),type);
      for (const tile of type==='parts'?all:[...all,...variants]) {
        assert.ok(tile.filter,tile.url);
        const searchUrl=new URL(tile.url,base),query=searchUrl.searchParams;
        assert.equal(searchUrl.pathname,prefix+'/szukaj');
        assert.equal(query.get('type'),type);
        if (tile!==all[0]) assert.ok(query.get('body'),tile.url);
        assert.equal(allFilters.has(tile.url),false,tile.url);
        allFilters.add(tile.url);
        if (prefix==='/demo') {
          const matches=(await guest.go('/demo/api/search'+searchUrl.search)).result;
          assert.equal(matches.total,offers.filter(offer=>offer.type===type&&(!query.has('body')||offer.body===query.get('body'))).length,searchUrl.search);
          assert.ok(matches.offers.every(offer=>offer.is_demo&&offer.type===type),searchUrl.search);
          if (query.has('body')) {
            const bodies=query.get('body')==='semi_trailer'?semiTrailerBodies:[query.get('body')];
            assert.ok(matches.offers.every(offer=>bodies.includes(offer.body)),searchUrl.search);
          }
        }
      }
    }
    assert.equal(allFilters.size,homeLinks.size,path);
    assert.deepEqual(homeLinks,allFilters,path);
  }
  for (const prefix of ['', '/demo']) {
    const partSearch=(await guest.go(`${prefix}/szukaj?type=parts&body=rims_17`)).result;
    const form=partSearch.split('<form class="filter-top panel parts-search"')[1].split('</form>')[0];
    assert.match(form,/aria-label="Wyszukiwarka części"/);
    assert.ok(form.includes('name="q"'));
    assert.ok(form.includes('name="body"'));
    assert.ok(form.includes('name="minPrice"')&&form.includes('name="maxPrice"'));
    assert.ok(!form.includes('name="make"')&&!form.includes('name="model"'));
    assert.match(form,/Felgi 17 cali/);
  }
  const result=(await guest.go('/demo/api/search?fuel=hybrid&condition=used&make=Toyota&model=Corolla&minPrice=70000')).result;
  assert.equal(result.total,1);
  assert.equal((await guest.go('/demo/api/search?city=%C5%82%C3%B3d%C5%BA')).result.total,1);
  assert.equal((await guest.go('/demo/api/search?make=Toyota&model=Golf')).result.total,0);
  const sorted=(await guest.go('/demo/api/search?sort=mileage_desc')).result.offers;
  assert.ok(sorted[0].mileage>=sorted[1].mileage);
  const filters='/demo/szukaj?fuel=hybrid&make=Toyota&model=Corolla&sort=year';
  const html=(await guest.go(filters)).result;
  assert.match(html,/Wyniki · 1/);
  assert.match(html,/Usuń filtr/);
  assert.match(html,/powrot=/);
  const keys=p1.offers.slice(0,4).map(x=>x.id);
  const comparison=(await guest.go('/demo/fragment/compare?keys='+keys.join(','))).result;
  assert.match(comparison,/Wyposażenie/);
  assert.equal((comparison.match(/data-remove-compare/g)||[]).length,4);
  const mixedKeys=[taycan.offers[0].id,...keys.filter(key=>key!==taycan.offers[0].id).slice(0,1)];
  const mixed=(await guest.go('/demo/fragment/compare?keys='+mixedKeys.join(','))).result;
  assert.match(mixed,/Cena i sprzedaż/);
  assert.match(mixed,/Pojemność akumulatora/);
  assert.match(mixed,/Deklarowany zasięg/);
  assert.match(mixed,/Pierwszy właściciel/);
  assert.match(mixed,/<th scope="row">ABS<\/th><td>Tak<\/td>/);
  assert.match(mixed,/<th scope="row">Radio DAB<\/th><td>—<\/td>/);
  for (const path of ['/demo','/demo/szukaj','/demo/oferta/przyklad-1','/demo/zaloguj','/demo/ulubione','/porownanie','/dealerzy','/reklama','/kontakt',
    '/pomoc','/regulamin','/prywatnosc','/cookies','/zaloguj','/zarejestruj','/odzyskaj-haslo','/ponow-potwierdzenie','/potwierdz-email','/ustaw-haslo','/manifest.webmanifest','/sitemap.xml']) {
    await guest.go(path);await guest.go(path);
  }
  await guest.go('/missing-test',{code:404});
});

test('vehicle search keeps its count, sort, comparison link and available reel mode in one header',async()=>{
  const client=browser();
  for (const [path,count,comparison] of [
    ['/szukaj?make=missing-toolbar-test',0,'/porownanie'],
    ['/demo/szukaj?type=car&sort=price_asc',48,'/demo/porownanie'],
    ['/demo/szukaj?make=Porsche&model=Taycan&fuel=electric',1,'/demo/porownanie'],
  ]) {
    const {result:html}=await client.go(path);
    const main=html.match(/<main id="main">([\s\S]*?)<\/main>/)[1];
    const header=main.match(/<div class="results-head">([\s\S]*?)<\/div>/)[1];
    assert.ok(header.includes('Wyniki · '+count+'<'));
    assert.match(header,/<select name="sort" data-sort>/);
    assert.ok(header.includes('href="'+comparison+'"'));
    assert.equal(main.split('href="'+comparison+'"').length-1,1);
    assert.equal(header.includes('data-reel-mode'),count>0);
    if (count>0) assert.match(header,/<span data-reel-toolbar hidden><button/);
    if (path.includes('sort=price_asc')) {
      assert.match(header,/<input type="hidden" name="type" value="car">/);
      assert.match(header,/<option value="price_asc" selected>/);
    }
  }
});

test('08 · favorites, re-login and durable second session',async()=>{
  await buyer.api('/favorites',{keys:[car,car],add:true});
  const second=browser();
  await second.api('/auth/login',{email:'buyer@example.test',password});
  assert.deepEqual((await second.go('/api/favorites')).result.keys,[car]);
  await buyer.api('/auth/logout',{});
  await buyer.api('/auth/login',{email:'buyer@example.test',password});
  assert.match((await buyer.go('/ulubione')).result,/Toyota Corolla/);
});

test('09 · buyer message, seller reply, viewing proposal, unread state and third-party denial',async()=>{
  const first=await buyer.api('/offers/'+car+'/message',{key:crypto.randomUUID(),body:'Czy oferta jest aktualna?',proposed_at:new Date(Date.now()+86400000).toISOString()});
  thread=first.thread;
  await buyer.go('/wiadomosci/'+thread);
  assert.ok((await seller.go('/api/badges')).result.messages>=1);
  assert.match((await seller.go('/wiadomosci')).result,/Czy oferta jest aktualna/);
  await third.go('/api/messages/'+thread,{code:404});
  await third.go('/wiadomosci/'+thread,{code:404});
  await third.api('/messages/'+thread,{key:crypto.randomUUID(),body:'Denied'},404);
  await seller.api('/messages/'+thread+'/proposal',{message:first.message,status:'accepted'});
  const key=crypto.randomUUID();
  const reply=await seller.api('/messages/'+thread,{key,body:'Tak, potwierdzam termin.'});
  assert.equal((await seller.api('/messages/'+thread,{key,body:'Tak, potwierdzam termin.'})).message,reply.message);
  const conversation=(await buyer.go('/api/messages/'+thread)).result;
  assert.equal(conversation.items.length,2);
  assert.equal(conversation.items[0].proposal_status,'accepted');
  assert.match((await buyer.go('/wiadomosci/'+thread)).result,/Tak, potwierdzam/);
  await seller.api('/messages/'+thread+'/read',{});
  assert.equal((await seller.go('/api/badges')).result.messages,0);
  await buyer.api('/messages/'+thread+'/block',{blocked:true});
  await seller.api('/messages/'+thread,{key:crypto.randomUUID(),body:'Blocked'},409);
  await buyer.api('/messages/'+thread+'/block',{blocked:false});
});

test('10 · phone opt-in, report handling, sold link and retained conversation',async()=>{
  await browser().go('/api/offers/'+car+'/phone',{code:404});
  const r=await browser().api('/report',{listing:car,kind:'illegal',email:'reporter@example.test',reason:'Zgłoszenie testowe do moderacji.'});
  assert.match((await moderator.go('/moderacja?sekcja=reports')).result,/Zgłoszenie testowe/);
  await moderator.api('/moderation/reports/'+r.id,{reason:'Rozpatrzono test.'});
  await seller.api('/listings/'+car+'/status',{status:'held'});
  await seller.api('/listings/'+car+'/status',{status:'sold'});
  assert.equal((await browser().go('/api/search?make=Toyota')).result.total,0);
  assert.match((await browser().go(publicPath)).result,/Samochód został sprzedany/);
  assert.match((await buyer.go('/wiadomosci/'+thread)).result,/Tak, potwierdzam/);
  await buyer.api('/offers/'+car+'/message',{key:crypto.randomUUID(),body:'Nie można otworzyć nowej rozmowy.'},404);
});

test('11 · dealer CSV mapping, invalid row report, image import and upsert',async()=>{
  const dealerDraft=await makeDraft(dealership);
  const uploaded=await upload(dealership,dealerDraft,0,await photo(4));
  const image='/media/'+uploaded.photos[0];
  const cols=csvFields.map(key=>key==='make'?'producent':key);
  const makeRow=(external,price,photoUrls)=>csvFields.map(key=>{
    const value=key==='external_id'?external:key==='photo_urls'?photoUrls:key==='equipment'?'abs|ac':key==='price'?price:data[key]??'';
    return '"'+String(value).replaceAll('"','""')+'"';
  }).join(';');
  const payload={csv:cols.join(';')+'\n'+makeRow('qa-1',70000,image)+'\n'+makeRow('',50000,'/wrong/image'),filename:'dealer-qa.csv',
    mapping:{make:'producent'},source:'qa-source',rights:true,confirm:true,key:crypto.randomUUID()};
  const template=await dealership.go('/api/dealer/template');
  assert.match(template.result,/external_id;make;model/);
  const preview=await dealership.api('/dealer/preview',payload);
  assert.equal(preview.rows[0].state,'create');
  assert.ok(preview.rows[1].error);
  const result=await dealership.api('/dealer/import',payload);
  assert.equal(result.valid,1);
  const listing=result.rows[0].listingId;
  assert.ok(listing);
  assert.equal(result.rows[0].status,'published');
  await browser().go('/oferta/'+listing);
  assert.equal((await dealership.api('/dealer/import',payload)).id,result.id);
  const again=await dealership.api('/dealer/import',{...payload,key:crypto.randomUUID(),csv:cols.join(';')+'\n'+makeRow('qa-1',73000,'')});
  assert.equal(again.valid,1);
  assert.equal(again.rows[0].listingId,listing);
  assert.equal(again.rows[0].status,'published');
  assert.equal(inspect('SELECT count(*) AS n FROM external_ids WHERE source=?','qa-source').n,1);
  assert.equal(inspect('SELECT price FROM listings WHERE id=?',listing).price,7300000);
  assert.match((await dealership.go('/panel-dealera')).result,/dealer-qa.csv/);
  await seller.go('/panel-dealera',{code:403});
  const uid=inspect("SELECT id FROM users WHERE email='dealer@example.test'").id;
  for (const route of ['/konto','/ustawienia','/panel-dealera','/moje-ogloszenia','/wiadomosci','/powiadomienia','/dealer/'+uid,'/podglad/'+listing]) {
    await dealership.go(route); await dealership.go(route);
  }
  for (const route of ['/moderacja','/moderacja?sekcja=history','/administracja','/administracja?sekcja=contacts']) {
    await admin.go(route);await admin.go(route);
  }
});

test('12 · advertisement enquiry, banner management and English',async()=>{
  const guest=browser();
  const data={kind:'ad',name:'Reklama QA',email:'ads@example.test',body:'Zapytanie testowe o termin i baner.'};
  for (const path of ['/kontakt','/reklama']) {
    const page=(await guest.go(path)).result;
    for (const auth of ['zaloguj','zarejestruj']) assert.ok(page.includes('href="/'+auth+'?dalej='+encodeURIComponent(path)+'"'));
    assert.doesNotMatch(page,/data-api="\/contact"/);
  }
  await guest.api('/contact',data,401);
  await guest.go('/demo/api/contact',{method:'POST',data,code:401});
  assert.match((await guest.go('/demo/reklama')).result,/Wybierz konto demo/);
  const destination='/reklama?lang=pl';
  const returnQuery='dalej='+encodeURIComponent(destination);
  const registration=await guest.api('/auth/register',{email:data.email,password,name:data.name,profile_type:'private',terms:true,next:destination});
  assert.equal(registration.next,'/sprawdz-poczte?'+returnQuery);
  const confirmation=await latestMailLink(data.email,'verify');
  assert.equal(confirmation.searchParams.get('dalej'),destination);
  assert.ok((await guest.go(confirmation.pathname+confirmation.search)).result.includes('name="next" value="'+destination+'"'));
  const verified=await guest.api('/auth/verify',{token:confirmation.searchParams.get('token'),password,next:destination});
  assert.equal(verified.next,'/zaloguj?confirmed=verify&'+returnQuery);
  const signIn=await guest.api('/auth/login',{email:data.email,password,next:destination});
  assert.equal(signIn.next,destination);
  assert.match((await guest.go(signIn.next)).result,/data-api="\/contact"/);
  const contact=await guest.api('/contact',data);
  adId=contact.id;
  assert.equal(inspect('SELECT user_id FROM contacts WHERE id=?',adId).user_id,inspect('SELECT id FROM users WHERE email=?',data.email).id);
  assert.match((await admin.go('/administracja?sekcja=contacts')).result,/Zapytanie testowe o termin/);
  await admin.api('/admin/contacts/'+adId,{reason:'Test obsługi zapytania'});
  assert.ok(inspect('SELECT handled_at FROM contacts WHERE id=?',adId).handled_at);
  const banner={title_pl:'Baner testowy PL',title_en:'English test banner',label_pl:'Zobacz',label_en:'See it',active:true,link:'/reklama',position:0,reason:'Test emisji'};
  const b=await admin.api('/admin/banners',{...banner,advertiser:'Nazwa testowa QA'});
  assert.ok(b.id);
  await admin.api('/admin/banners/'+b.id,banner);
  const home=(await browser().go('/?lang=en')).result;
  assert.match(home,/English test banner/);
  assert.match(home,/<span class="ad-company">Nazwa testowa QA<\/span>/);
  assert.match((await browser().go('/demo/oferta/przyklad-1?lang=en')).result,/Full specifications/);
  assert.match((await browser().go('/missing-test?lang=en',{code:404})).result,/Page not found/);
});

test('selectable languages localize forms, errors and the account across sessions',async()=>{
  const visitor=browser();
  for (const [language,title] of [['cs','Stránka nenalezena'],['sk','Stránka sa nenašla'],['de','Seite nicht gefunden'],['uk','Сторінку не знайдено']]) {
    const response=await visitor.go('/missing-test?lang='+language,{code:404});
    assert.equal(response.headers.get('content-language'),language);
    assert.ok(response.result.includes('<h1>'+title+'</h1>'));
    assert.equal(visitor.jar.get('a4_lang'),language);
    assert.equal((await visitor.go('/zaloguj?lang=invalid')).headers.get('content-language'),language);
    const manifest=JSON.parse((await visitor.go('/manifest.webmanifest')).result);
    assert.equal(manifest.lang,language);
  }
  const email='language-test@example.test';
  await visitor.api('/auth/register',{email,password,name:'Language test',profile_type:'private',terms:true});
  const messages=(await readFile(join(directory,'mailbox.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  const confirmation=messages.findLast(message=>message.to===email);
  assert.equal(confirmation.subject,'Підтвердьте електронну пошту');
  assert.equal(new URL(confirmation.url).searchParams.get('lang'),'uk');
  await visitor.api('/auth/verify',{token:await latestToken(email,'verify'),password});
  await visitor.api('/auth/login',{email,password});
  await visitor.api('/profile',{name:'Language test',profile_type:'private',lang:'cs'},200,'PUT');
  assert.equal(visitor.jar.get('a4_lang'),'cs');
  const fresh=browser();
  await fresh.api('/auth/login',{email,password});
  assert.equal((await fresh.go('/konto')).headers.get('content-language'),'cs');
});

test('13 · demo role sandbox, protected routes, visitor isolation and roles',async()=>{
  const demo=browser();
  const other=browser();
  const access=async actor=>(await demo.go('/demo/api/access',{method:'POST',data:{actor}})).result;
  await access('moderator');
  await demo.go('/demo/moderacja');
  await demo.go('/moderacja',{code:403});
  const workspaceId=inspect("SELECT scope FROM demo_workspaces ORDER BY expires_at DESC LIMIT 1").scope;
  assert.ok(workspaceId.startsWith('demo:'));
  await access('seller');
  await demo.go('/demo/moderacja',{code:403});
  for (const path of ['/demo/konto','/demo/ustawienia']) {
    const account=(await demo.go(path)).result;
    assert.match(account,/<div data-icon-settings><div class="appearance-menu">[\s\S]*?class="appearance-theme"[\s\S]*?class="appearance-icons"[\s\S]*?data-appearance-section="buttons"/);
    assert.doesNotMatch(account,/id="(?:motyw|icon-style-dialog)"/);
    const picker=account.match(/<details class="side-theme-picker"[^>]*>[\s\S]*?<\/details>/)[0];
    assert.match(picker,/aria-label="Tło strony"/);
    assert.match(picker,/name="rail-theme" value="carbon-twill" data-theme-choice/);
    assert.equal((picker.match(/\bdata-theme-choice\b/g)||[]).length,22);
    assert.equal((account.match(/name="inline-icon-theme"[^>]*data-theme-choice/g)||[]).length,22);
    assert.equal((account.match(/\bdata-theme-stitch-choice=/g)||[]).length,11);
  }
  const draft=(await demo.go('/demo/api/listings',{method:'POST',data:{key:crypto.randomUUID()}})).result.id;
  const wizard=(await demo.go('/demo/sprzedaj/'+draft)).result;
  assert.match(wizard,/<a class="btn" href="\/demo\/moje-ogloszenia" data-button-finish-action>/);
  assert.match(wizard,/data-step-back data-button-finish-action/);
  assert.match(wizard,/data-save-draft data-button-finish-action/);
  assert.match(wizard,/data-step-to="1" data-button-finish-action="step" aria-current="step"/);
  await demo.go('/demo/podglad/'+draft);
  await other.go('/demo/podglad/'+draft,{code:303});
  await other.go('/demo/api/access',{method:'POST',data:{actor:'seller'}});
  await other.go('/demo/podglad/'+draft,{code:404});
  await access('admin');
  await demo.go('/demo/administracja');
});

test('14 · data survives server restart without browser storage',async()=>{
  await stop();await start();
  const fresh=browser();
  await fresh.api('/auth/login',{email:'buyer@example.test',password});
  assert.deepEqual((await fresh.go('/api/favorites')).result.keys,[car]);
  assert.match((await fresh.go('/wiadomosci/'+thread)).result,/Tak, potwierdzam/);
  assert.match((await fresh.go(publicPath)).result,/Samochód został sprzedany/);
  assert.equal(serverErrors.length,0,serverErrors.join(''));
});

test('public daily page views are atomic, persistent and exclude demo and non-navigations',async()=>{
  const navigation={
    Accept:'text/html,application/xhtml+xml','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document',
    'User-Agent':'Mozilla/5.0 Firefox/145.0'
  };
  const visit=(path,options={})=>new Promise((resolve,reject)=>{
    const incoming=request(base+path,{...options,headers:{...navigation,...options.headers}},response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>resolve({status:response.statusCode,html:Buffer.concat(chunks).toString()}));
      response.on('error',reject);
    });
    incoming.on('error',reject);
    incoming.end();
  });
  const stats=async suffix=>{
    const {html,status}=await visit('/statystyki'+(suffix||''));
    assert.equal(status,200);
    return html;
  };
  const total=html=>Number(html.match(/data-traffic-metric="total">(\d+)/)[1]);
  assert.equal(total(await stats()),0);
  const visits=await Promise.all(Array.from({length:5},()=>visit('/szukaj?make=Toyota')));
  assert.ok(visits.every(({status})=>status===200));
  assert.match((await visit('/')).html,/<a href="\/statystyki">Statystyki portalu<\/a>/);
  for (const [path,options,status] of [
    ['/demo',{},200],['/api/search',{},200],['/zaloguj',{},200],['/konto',{},303],['/oferta/unknown',{},404],
    ['/szukaj',{method:'HEAD'},200],['/szukaj',{headers:{'Sec-Purpose':'prefetch'}},200],
    ['/szukaj',{headers:{'Sec-Fetch-Mode':'cors'}},200],['/szukaj',{headers:{'User-Agent':'Mozilla/5.0 Googlebot/2.1'}},200]
  ]) assert.equal((await visit(path,options)).status,status,path);
  const html=await stats();
  assert.equal(total(html),6);
  assert.match(html,/data-traffic-metric="today">6</);
  assert.match(html,/data-traffic-metric="week">6</);
  assert.match(await stats('?do=2020-02-29&lang=en'),/<time datetime="2020-02-29">/);
  assert.doesNotMatch(await stats('?do=2020-02-30'),/<time datetime="2020-02-30">|name="do"[^>]*value="2020-02-30"/);
  assert.equal(total(await stats()),6);
  await stop();await start();
  assert.equal(total(await stats()),6);
});

test('banner statistics count live impressions and destination clicks per banner',async()=>{
  const visitor=browser();
  const headers={'User-Agent':'Mozilla/5.0 Firefox/145.0','Sec-Fetch-Site':'same-origin'};
  const send=(banner,event,code=200)=>visitor.go('/api/banner-event',{method:'POST',data:{banner,event},headers,code});
  const home=(await visitor.go('/')).result;
  assert.match(home,/<a href="\/statystyki#statystyki-banerow">Statystyki banerów<\/a>/);
  assert.match(home,/data-banner-id="all4rent-rental"/);
  assert.match(home,/data-banner-id="all4rent-advertise"/);
  assert.match(home,/href="https:\/\/all4rent\.app\/" data-banner-click target="_blank" rel="noopener noreferrer"/);
  const managed=inspect("SELECT id FROM banners WHERE title_pl='Baner testowy PL'").id;
  await Promise.all(Array.from({length:4},()=>send('all4rent-rental','impression')));
  await send('all4rent-rental','click');
  await send('all4rent-advertise','impression');
  await send('jcb-rental','impression');
  await send('jcb-rental','click',422);
  await send('unlisted-banner','impression',422);
  await send('all4rent-rental','swipe',422);
  await send('managed-'+managed,'impression');
  await send('managed-'+managed,'click');
  const click={banner:'all4rent-rental',event:'click'};
  await visitor.go('/demo/api/banner-event',{method:'POST',headers,data:click});
  await visitor.go('/api/banner-event',{method:'POST',data:click,headers:{...headers,'User-Agent':'Mozilla/5.0 Googlebot/2.1'}});
  await visitor.go('/api/banner-event',{method:'POST',data:click,headers:{...headers,'Sec-Fetch-Site':'cross-site',Origin:'https://external.invalid'},code:403});
  for (const query of ['', '?banery=today', '?banery=week&do=2020-02-29']) {
    const html=(await visitor.go('/statystyki'+query)).result;
    assert.match(html,/data-traffic-metric="total">6</);
    assert.match(html,/data-banner-stat="all4rent-rental"><th scope="row">ALL4RENT – wynajem<\/th><td>4<\/td><td>1<\/td>/);
    assert.match(html,/data-banner-stat="all4rent-advertise"><th scope="row">[^<]+<\/th><td>1<\/td><td>0<\/td>/);
    assert.match(html,/data-banner-stat="jcb-rental"><th scope="row">[^<]+<\/th><td>1<\/td><td>0<\/td>/);
    assert.match(html,/<tfoot><tr><th scope="row">Razem<\/th><td>7<\/td><td>2<\/td>/);
    assert.match(html,/Nazwa testowa QA · Baner testowy PL/);
  }
});

test('daily totals use Warsaw midnight, including the summer clock',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  try {
    sqlite.exec(await readFile('drizzle/0003_site_page_views.sql','utf8'));
    sqlite.exec(await readFile('drizzle/0006_banner_statistics.sql','utf8'));
    const db={prepare:sql=>({bind:(...params)=>({
      first:()=>sqlite.prepare(sql).get(...params),run:()=>sqlite.prepare(sql).run(...params),
      all:()=>({results:sqlite.prepare(sql).all(...params)})
    })})};
    await recordPageView(db,new Date('2026-03-28T22:59:00Z'));
    await recordPageView(db,new Date('2026-03-28T23:00:00Z'));
    await recordPageView(db,new Date('2026-03-29T22:00:00Z'));
    const current=await readPageViews(db,'',new Date('2026-03-30T07:00:00Z'));
    assert.deepEqual(current.days.slice(0,4),[
      {day:'2026-03-30',views:1},{day:'2026-03-29',views:1},{day:'2026-03-28',views:1},{day:'2026-03-27',views:null}
    ]);
    assert.equal(current.today,1);
    assert.equal(current.week,3);
    const earlier=await readPageViews(db,'2026-03-28',new Date('2026-03-30T07:00:00Z'));
    assert.equal(earlier.endDay,'2026-03-28');
    assert.equal(earlier.total,3);
    assert.equal(earlier.days[0].views,1);
    await recordBannerEvent(db,'brumbrum','impression',new Date('2026-03-28T22:59:59Z'));
    await recordBannerEvent(db,'brumbrum','click',new Date('2026-03-28T23:00:00Z'));
    sqlite.exec("CREATE TABLE banners (id TEXT, scope TEXT, advertiser TEXT, title_pl TEXT, title_en TEXT)");
    const counts=async (range,day)=>(await readBannerStats(db,range,day)).map(({impressions,clicks})=>[impressions,clicks]);
    assert.deepEqual(await counts('today','2026-03-29'),[[0,1]]);
    assert.deepEqual(await counts('week','2026-03-29'),[[1,1]]);
    assert.deepEqual(await counts('all','2026-04-05'),[[1,1]]);
    assert.deepEqual(await counts('week','2026-04-05'),[]);
  } finally {sqlite.close();}
});

test('demo showcase serves three distinct photos per listing and full-width details',async()=>{
  const guest=browser();
  const covers=new Set();
  const hashes=new Set();
  for (let number=1;number<=demoListingCount;number++) {
    const {result:page}=await guest.go('/demo/oferta/przyklad-'+number);
    assert.match(page,/class="listing-showcase" data-demo-showcase/);
    assert.match(page,/class="detail-main"/);
    const sectionCount=(page.match(/class="panel offer-section"/g)||[]).length;
    assert.ok([6,7].includes(sectionCount));
    if (sectionCount===7) assert.match(page,/<details class="panel offer-section" id="finansowanie"><summary>[\s\S]*?<span>Kalkulator finansowania \/ leasingu<\/span>/);
    assert.match(page,/<span>Sprawdź po numerze VIN<\/span>/);
    assert.doesNotMatch(page,/data-copy-vin=/);
    assert.match(page,/class="panel offer-section"><summary>[^<]*<svg[^>]*>.*?<span>Opis sprzedawcy<\/span>/s);
    assert.match(page,/data-gallery-autoplay/);
    assert.match(page,/>Napisz wiadomość</);
    assert.match(page,/>Umów oględziny</);
    assert.match(page,/>Rolki</);
    const frames=JSON.parse(page.match(/data-gallery="([^"]+)"/)[1].replaceAll('&quot;','"'));
    assert.equal(frames.length,3);
    assert.equal(new Set(frames.map(frame=>frame.url)).size,3);
    covers.add(frames[0].url);
    for (const {url,thumb,wide} of frames) {
      assert.ok(wide&&url.startsWith('/assets/showcase-hd/')&&thumb.startsWith('/assets/showcase/'));
      const {result,headers}=await guest.go(url);
      assert.equal(headers.get('content-type'),'image/webp');
      const {width,height}=cleanImage(result);
      assert.deepEqual([width,height],[1920,1080]);
      hashes.add(await digest(result));
      const preview=cleanImage((await guest.go(thumb)).result);
      assert.deepEqual([preview.width,preview.height],[640,360]);
    }
  }
  assert.equal(covers.size,demoListingCount);
  assert.equal(hashes.size,demoListingCount*3);
});

test('hosted demo photo and thumbnail provisioning validates authorization, format and dimensions',async()=>{
  const guest=browser();
  const path='/api/demo-media/01-front.webp';
  const bytes=await readFile('public/assets/showcase-hd/01-front.webp');
  const headers={'X-Demo-Media-Token':mediaToken};
  await guest.go(path,{method:'PUT',code:404});
  await guest.go(path,{method:'PUT',bytes:await photo(1),headers,code:422});
  await guest.go('/api/demo-media/00-front.webp',{method:'PUT',headers,code:404});
  const {result}=await guest.go(path,{method:'PUT',bytes,headers});
  assert.equal(result.sha256,await digest(bytes));
  assert.deepEqual(await readFile(join(directory,'objects','showcase-hd','01-front')),bytes);
  const thumbnail='/api/demo-media/thumbs/25-rear.webp';
  const preview=await readFile('public/assets/showcase/25-rear.webp');
  await guest.go(thumbnail,{method:'PUT',bytes:preview,code:404});
  await guest.go(thumbnail,{method:'PUT',bytes,headers,code:422});
  const saved=await guest.go(thumbnail,{method:'PUT',bytes:preview,headers});
  assert.equal(saved.result.sha256,await digest(preview));
  assert.deepEqual(await readFile(join(directory,'objects','showcase','25-rear')),preview);
  const expanded='/api/demo-media/'+(demoBaseCount+1)+'-front.webp';
  const expandedPhoto=await readFile('public/assets/showcase-hd/'+(demoBaseCount+1)+'-front.webp');
  const catalogHeaders={'X-Demo-Media-Token':catalogMediaToken};
  await guest.go(expanded,{method:'PUT',bytes:expandedPhoto,headers,code:404});
  await guest.go('/api/demo-media/catalog-ready',{method:'PUT',headers,code:404});
  const expandedSaved=await guest.go(expanded,{method:'PUT',bytes:expandedPhoto,headers:catalogHeaders});
  assert.equal(expandedSaved.result.sha256,await digest(expandedPhoto));
  const notReady=await guest.go('/api/demo-media/catalog-ready',{method:'PUT',headers:catalogHeaders,code:409});
  assert.equal(notReady.result.missing,externalCatalogGalleries.length*6-1);
});

test('15 · listing, moderation and search support passenger bodies, motorcycles, ATVs, trailers and heavy vehicles',async()=>{
  const guest=browser(), vendor=third;
  const shared={condition:'used',damage:'no',year:2022,price:15000,city:'Warszawa',region:'Mazowieckie',description:data.description};
  const examples=[
    {type:'car',make:'Škoda',model:'Octavia',body:'liftback',fuel:'petrol',mileage:36000,power:150,gearbox:'manual',drive:'fwd',photo:'category-body-liftback'},
    {type:'car',make:'Porsche',model:'911',body:'targa',fuel:'petrol',mileage:12500,power:385,gearbox:'auto',drive:'awd',photo:'category-body-targa'},
    {type:'motorcycle',make:'Yamaha',model:'MT-07',body:'naked',fuel:'petrol',mileage:8900,photo:'category-type-motorcycle'},
    {type:'quad',make:'Polaris',model:'Sportsman',body:'atv_utility',fuel:'petrol',hours:124.5,photo:'category-type-quad'},
    {type:'trailer',make:'Debon',model:'Roadster 300',body:'cargo_trailer',grossWeight:1300,axles:1,photo:'category-type-trailer'},
    {type:'trailer',make:'Schmitz',model:'S.CS',body:'semi_trailer',grossWeight:39000,axles:3,photo:'category-body-semi_trailer'},
    {type:'trailer',make:'Nowa Marka',model:'K 42',body:'semi_curtain',grossWeight:38000,axles:3,photo:'category-body-semi_curtain'},
    {type:'farm',make:'Agro',model:'P 4',body:'farm_plough',photo:'category-body-farm_plough'},
    {type:'garden',make:'Husqvarna',model:'LC 247',body:'garden_mower',fuel:'petrol',hours:18,photo:'category-body-farm_mower'},
    {type:'motorcycle',make:'Kayo',model:'TT 140',body:'minibike',fuel:'petrol',hours:34,photo:'category-body-moped'},
    {type:'other',make:'Bajaj',model:'RE',body:'tuk_tuk',fuel:'petrol',hours:260,photo:'category-body-trike'},
    {type:'trailer',make:'Neptun',model:'N7',body:'boat_trailer',grossWeight:750,axles:1,photo:'category-body-boat_trailer'},
    {type:'trailer',make:'Brenderup',model:'1205',body:'other',grossWeight:1000,axles:1,photo:'category-body-other-trailers'},
    {type:'industrial',make:'Genie',model:'GS-1932',body:'scissor_lift',fuel:'electric',hours:420,photo:'category-body-scissor_lift'},
    {type:'truck',make:'MAN',model:'TGX',body:'tractor',fuel:'diesel',mileage:421000,power:510,gearbox:'auto',drive:'rwd',photo:'category-body-tractor'},
    {type:'van',make:'Ford',model:'Transit',body:'van_fridge',fuel:'diesel',mileage:98000,power:150,gearbox:'manual',drive:'fwd',photo:'category-body-van_fridge'},
    {type:'truck',make:'Scania',model:'P 410',body:'truck_hooklift',fuel:'diesel',mileage:235000,power:410,gearbox:'auto',drive:'rwd',photo:'category-body-truck_hooklift'},
    {type:'camper',make:'Hymer',model:'B-Klasse',body:'camper_integrated',fuel:'diesel',mileage:38400,power:150,gearbox:'auto',drive:'fwd',photo:'category-body-camper_integrated'},
    {type:'motorcycle',make:'KTM',model:'690 SMC',body:'supermoto',fuel:'petrol',mileage:9100,photo:'category-body-supermoto'},
    {type:'construction',make:'Liebherr',model:'LTM 1030',body:'crane',fuel:'diesel',hours:2350,photo:'category-type-construction'}
  ];
  const optionsOf=(html,field)=>Array.from(html.match(new RegExp(`<select[^>]* data-filter-${field}[^>]*>(.*?)</select>`,'s'))[1]
    .matchAll(/<option value="([^"]*)"/g),entry=>entry[1]);
  for (const {photo,...vehicle} of examples) {
    const {id:key}=await vendor.api('/listings',{key:crypto.randomUUID()});
    let state=await edit(vendor,key,0,{...shared,...vehicle});
    state=await upload(vendor,key,state.version,await readFile('public/assets/'+photo+'.webp'));
    const submitted=await submit(vendor,key,state.version);
    const query='/api/search?'+new URLSearchParams({type:vehicle.type,body:vehicle.body});
    if (vehicle.type==='car') assert.equal(submitted.status,'published');
    else {
      assert.equal(submitted.status,'pending');
      await guest.go('/oferta/'+submitted.slug,{code:404});
      assert.equal((await guest.go(query)).result.total,0);
      assert.match((await moderator.go('/moderacja/'+key)).result,new RegExp(vehicle.model));
      await moderator.api('/moderation/'+key,{action:'published',revision:1});
    }
    const results=(await guest.go(query)).result;
    assert.equal(results.total,1);
    assert.equal(results.offers[0].type,vehicle.type);
    assert.equal(results.offers[0].model,vehicle.model);
    assert.equal(results.offers[0].is_demo,false);
    assert.match((await guest.go('/oferta/'+submitted.slug)).result,new RegExp(vehicle.model));
  }
  const otherTrailer=(await guest.go('/szukaj?type=trailer&body=other')).result;
  assert.match(otherTrailer,/<strong>Pozostałe przyczepy<\/strong>/);
  const published=(await guest.go('/szukaj?type=construction&make=Liebherr')).result;
  assert.ok(optionsOf(published,'model').includes('LTM 1030'));
  assert.ok(!optionsOf((await guest.go('/szukaj?type=farm')).result,'make').includes('Liebherr'));
  const semis=(await guest.go('/szukaj?category=trailer%3Asemi_trailer&make=Schmitz')).result;
  assert.ok(optionsOf(semis,'make').includes('Schmitz'));
  assert.ok(!optionsOf(semis,'make').includes('Hobby'));
  assert.ok(optionsOf(semis,'model').includes('S.CS'));
  assert.equal((await guest.go('/api/search?category=trailer%3Asemi_trailer')).result.total,2);
  assert.equal((await guest.go('/api/search?type=trailer&body=semi_trailer')).result.total,2);
  assert.equal((await guest.go('/api/search?category=trailer%3Asemi_trailer&body=semi_curtain')).result.total,1);
  assert.ok(optionsOf(semis,'make').includes('Nowa Marka'));
  const plough=(await guest.go('/api/search?type=farm&body=farm_plough')).result.offers[0];
  assert.equal(plough.fuel,'');
  assert.doesNotMatch((await guest.go('/oferta/'+plough.slug)).result,/<dt>(?:Paliwo|Liczba osi)<\/dt>/);
  const atv=(await guest.go('/api/search?type=quad&minHours=124.5&maxHours=125')).result;
  assert.equal(atv.offers[0].hours,124.5);
  assert.equal((await guest.go('/api/search?type=quad&minHours=125')).result.total,0);
  const mower=(await guest.go('/api/search?type=garden&body=garden_mower')).result.offers[0];
  assert.equal(mower.fuel,'petrol');
  assert.equal(mower.model,'LC 247');
  const tukTuk=(await guest.go('/api/search?type=other&body=tuk_tuk')).result.offers[0];
  assert.equal(tukTuk.fuel,'petrol');
  assert.equal(tukTuk.model,'RE');
  const trailer=(await guest.go('/api/search?type=trailer&minGrossWeight=1300&maxGrossWeight=1400')).result;
  assert.equal(trailer.offers[0].grossWeight,1300);
  assert.equal(trailer.offers[0].axles,1);
  assert.equal(trailer.offers[0].fuel,'');
  assert.equal(trailer.offers[0].power,'');
});

test('Concurrent offers with the same VIN leave only one public listing',async()=>{
  const guest=browser();
  const cars=await Promise.all([seller,buyer].map(async (client,index)=>{
    const key=await makeDraft(client);
    const vin=index===0?'WVW ZZZ1KZ6 W123456':'WVWZZZ1KZ6-W123456';
    const state=await edit(client,key,0,{...data,vin,model:'Golf'});
    const photoState=await upload(client,key,state.version,await photo(3+index));
    return {key,client,version:photoState.version};
  }));
  const results=await Promise.all(cars.map(car=>submit(car.client,car.key,car.version)));
  assert.deepEqual(results.map(x=>x.status).sort(),['pending','published']);
  const pending=results.find(x=>x.status==='pending');
  await guest.go('/oferta/'+pending.slug,{code:404});
  assert.equal((await guest.go('/api/search?model=Golf')).result.total,1);
  assert.match((await moderator.go('/moderacja')).result,/Aktywne ogłoszenie ma ten sam numer VIN/);
  const queued=cars.find(x=>x.key===pending.listingId);
  await queued.client.api('/listings/'+queued.key+'/status',{status:'held'});
  await queued.client.api('/listings/'+queued.key+'/status',{status:'sold'},409);
  await guest.go('/oferta/'+pending.slug,{code:404});
});

test('16 · ordered 360° frames and playable video follow listing permissions and revisions',async()=>{
  const guest=browser();
  const key=await makeDraft(seller);
  const details={...data,vin:'',variant:'Materiały testowe QA',description:'Opis testowego pojazdu. '.repeat(12)};
  const send=async (kind,version,bytes,code=200)=>(await seller.go(`/api/listings/${key}/${kind}`,{
    method:'POST',headers:{'X-Edit-Version':String(version)},bytes,code
  })).result;
  const [mp4,webm]=await Promise.all(['mp4','webm'].map(kind=>readFile('test/fixtures/vehicle.'+kind)));
  let state=await edit(seller,key,0,details);
  state=await upload(seller,key,state.version,await photo(1));
  state=await send('spin',state.version,await photo(1));
  const duplicate=await send('spin',state.version,await photo(1));
  assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.version,state.version);
  await seller.api(`/listings/${key}/submit`,{version:state.version},422);
  for (let index=2;index<=8;index++) state=await send('spin',state.version,await photo(index));
  const ordered=[...state.spin].reverse();
  state=await seller.api(editsPath(key),{version:state.version,spin:ordered},200,'PUT');
  assert.deepEqual(state.spin,ordered);
  await seller.api(editsPath(key),{version:state.version,spin:[...ordered,crypto.randomUUID()]},422,'PUT');
  await send('video',state.version,Buffer.from('<html>invalid file</html>'),422);
  await send('video',state.version,Buffer.alloc(24*1024*1024+1),413);
  const beforeVideo=state.version;
  state=await send('video',state.version,mp4);
  await send('video',beforeVideo,webm,409);
  const firstVideo='/wideo/'+state.video;
  assert.match((await seller.go('/sprzedaj/'+key)).result,/listing-reel-editor[\s\S]*?Dodaj rolkę/);
  const firstFrame='/media/'+ordered[0];
  assert.equal((await editRead(seller,key)).video,state.video);
  assert.match((await seller.go('/podglad/'+key)).result,/data-spin-frames/);
  const partial=await seller.go(firstVideo,{headers:{Range:'bytes=9-44'},code:206});
  assert.deepEqual(partial.result,mp4.subarray(9,45));
  assert.equal(partial.headers.get('content-range'),`bytes 9-44/${mp4.length}`);
  assert.equal(partial.headers.get('cache-control'),'private, no-store');
  assert.equal((await seller.go(firstVideo,{method:'HEAD'})).headers.get('content-length'),String(mp4.length));
  await seller.go(firstVideo,{headers:{Range:'bytes=99999999-'},code:416});
  await guest.go(firstVideo,{code:404});
  await third.go(firstVideo,{code:404});
  await moderator.go(firstVideo,{code:404});
  await guest.go(firstFrame,{code:404});
  const pending=await submit(seller,key,state.version);
  assert.equal(pending.status,'pending');
  const path='/oferta/'+pending.slug;
  const reelPath='/rolki/'+pending.slug;
  await guest.go(reelPath,{code:404});
  await guest.go(firstVideo,{code:404});
  assert.match((await moderator.go('/moderacja/'+key)).result,/data-listing-video/);
  assert.match((await moderator.go('/moderacja/'+key)).result,/Ogłoszenie zawiera film do sprawdzenia/);
  await moderator.go(firstVideo);
  await moderator.go(firstFrame);
  await moderator.api('/moderation/'+key,{action:'published',revision:1});
  const listing=(await guest.go(path)).result;
  assert.match(listing,/data-media-tab="spin"/);
  assert.match(listing,/data-media-tab="video"/);
  assert.ok(listing.includes(reelPath));
  assert.ok((await guest.go(reelPath)).result.includes(firstVideo));
  assert.ok((await guest.go('/rolki')).result.includes(firstVideo));
  assert.ok(!(await guest.go('/rolki?typ=firmy')).result.includes(firstVideo));
  assert.match(listing,/Opis sprzedawcy/);
  assert.deepEqual((await guest.go(firstVideo,{headers:{Range:'bytes=-16'},code:206})).result,mp4.subarray(-16));
  await guest.go(firstFrame);
  await guest.go('/demo'+firstVideo,{code:404});

  state=await send('video',(await editRead(seller,key)).version,webm);
  const replacement='/wideo/'+state.video;
  await guest.go(firstVideo);
  await guest.go(replacement,{code:404});
  await submit(seller,key,state.version,{confirm:true});
  await guest.go(firstVideo,{code:404});
  await guest.go(replacement,{code:404});
  await moderator.api('/moderation/'+key,{action:'published',revision:3});
  assert.equal((await guest.go(replacement)).headers.get('content-type'),'video/webm');
  state=await seller.api(editsPath(key),{version:(await editRead(seller,key)).version,video:null,spin:[]},200,'PUT');
  await guest.go(replacement);
  assert.equal((await submit(seller,key,state.version,{confirm:true})).status,'published');
  await guest.go(replacement,{code:404});
  await guest.go(firstFrame,{code:404});
  assert.doesNotMatch((await guest.go(path)).result,/data-media-tab=/);
  assert.equal(inspect('SELECT count(*) AS n FROM listing_videos WHERE listing_id=?',key).n,0);
  assert.equal(serverErrors.length,0,serverErrors.join(''));
});

test('profile images stay private until enabled and become private again when disabled',async()=>{
  const guest=browser();
  const bytes=await photo(1);
  const uploadAsset=async(client,kind)=>(await client.go('/api/asset/'+kind,{method:'POST',bytes})).result.key;
  const profile=(client,body)=>client.api('/profile',body,200,'PUT');
  await guest.go('/api/asset/avatar',{method:'POST',bytes,code:401});
  const sellerProfile={name:'Seller photo test',profile_type:'private'};
  const avatar='/asset/avatar/'+await uploadAsset(seller,'avatar');
  await seller.go(avatar);
  await guest.go(avatar,{code:404});
  assert.ok((await seller.go('/ustawienia')).result.includes(avatar));
  const offerPath=(await guest.go('/api/search?make=Toyota')).result.offers.find(offer=>offer.id===car)?.slug;
  const listing=offerPath?'/oferta/'+offerPath:publicPath;
  assert.ok(!(await guest.go(listing)).result.includes(avatar));
  await profile(seller,{...sellerProfile,show_profile_images:true});
  await guest.go(avatar);
  assert.ok((await guest.go(listing)).result.includes(avatar));
  await profile(seller,{...sellerProfile,show_profile_images:false});
  await guest.go(avatar,{code:404});
  assert.ok(!(await guest.go(listing)).result.includes(avatar));

  const dealerProfile={name:'Dealer photo test',profile_type:'company',company:'Dealer photo test'};
  await profile(dealership,dealerProfile);
  const logo='/asset/company/'+await uploadAsset(dealership,'company');
  const cover='/asset/panorama/'+await uploadAsset(dealership,'panorama');
  for (const path of [logo,cover]) {
    await dealership.go(path);
    await guest.go(path,{code:404});
  }
  await profile(dealership,{...dealerProfile,show_profile_images:true});
  for (const path of [logo,cover]) await guest.go(path);
  await profile(dealership,{...dealerProfile,profile_type:'private'});
  for (const path of [logo,cover]) await guest.go(path,{code:404});
});

test('retired showroom is absent from navigation and its old links resolve in the correct marketplace',async()=>{
  const guest=browser();
  const home=(await guest.go('/')).result;
  const demo=(await guest.go('/demo')).result;
  for (const page of [home,demo]) {
    assert.doesNotMatch(page,/href="(?:\/demo)?\/salon(?:[/?#]|")/);
    assert.match(page,/<form[^>]+quick-search/);
  }
  assert.match(home,/class="text-link hero-demo" href="\/demo\/szukaj"/);
  await guest.go('/salon?next=https://example.test',{code:303,location:'/szukaj'});
  await guest.go('/demo/salon',{code:303,location:'/demo/szukaj'});
  await guest.go('/demo/salon/przyklad-113',{code:303,location:'/demo/oferta/przyklad-113'});
  await guest.go('/salon/przyklad-113',{code:404});
  await guest.go('/demo/salon/pojazd-spoza-katalogu',{code:404});
});

test('company reels upload, play publicly, and can only be removed by their owner',async()=>{
  const guest=browser();
  const company=await signup('reels@example.test','company');
  const otherCompany=await signup('other-reels@example.test','company');
  const uid=inspect("SELECT id FROM users WHERE email='reels@example.test'").id;
  const mp4=await readFile('test/fixtures/vehicle.mp4');
  const caption='Jazda próbna · <Toyota>';
  const listing=await makeDraft(company);
  const photoState=await upload(company,listing,(await editRead(company,listing)).version,await photo(1));
  const offer=await edit(company,listing,photoState.version,{...data,vin:'',listingPhone:'+48 000 000 002'},photoState.photos);
  assert.equal((await submit(company,listing,offer.version,{confirm:true})).status,'published');
  const reelUpload={method:'POST',bytes:mp4,headers:{'X-Reel-Caption':encodeURIComponent(caption),'X-Reel-Listing':listing}};
  await guest.go('/api/reels',{...reelUpload,code:401});
  await seller.go('/api/reels',{...reelUpload,code:403});
  await company.go('/api/reels',{...reelUpload,bytes:Buffer.from('not a video'),code:422});
  assert.match((await company.go('/panel-dealera')).result,/data-reel-upload/);
  await company.go('/api/reels',reelUpload);
  const reel=inspect('SELECT id,caption FROM company_reels WHERE user_id=?',uid);
  assert.equal(reel.caption,caption);
  const path='/rolka/'+reel.id;
  const profile=(await guest.go('/dealer/'+uid)).result;
  assert.ok(profile.includes(path));
  assert.match((await guest.go('/rolki?typ=firmy')).result,/aria-current="page">Firmy/);
  const feed=(await guest.go('/rolki')).result;
  assert.ok(feed.includes(path));
  assert.match(feed,/href="tel:\+48000000002"/);
  assert.match(feed,/Warszawa/);
  assert.ok(!(await guest.go('/demo/rolki')).result.includes(path));
  assert.ok(profile.includes('&lt;Toyota&gt;'));
  const part=await guest.go(path,{headers:{Range:'bytes=0-15'},code:206});
  assert.deepEqual(part.result,mp4.subarray(0,16));
  await otherCompany.api('/reels/'+reel.id+'/remove',{},404);
  await company.api('/reels/'+reel.id+'/remove',{});
  await guest.go(path,{code:404});
});

test('demo photo reels link to the matching listing, photos, and seller',async()=>{
  const guest=browser();
  const home=(await guest.go('/')).result;
  assert.match(home,/<nav class="bottom-nav"[^>]*>[\s\S]*?href="\/rolki"/);
  assert.match(home,/<nav class="side-nav"[^>]*>[\s\S]*?href="\/rolki"/);
  const feed=(await guest.go('/rolki')).result;
  assert.match(feed,/<body class="reels-screen"/);
  assert.match(feed,/data-reels-scroll/);
  assert.equal((feed.match(/data-photo-reel>/g)||[]).length,demoListingCount);
  assert.match((await guest.go('/demo/oferta/przyklad-113')).result,/href="\/demo\/rolki\/przyklad-113"/);
  const reel=(await guest.go('/demo/rolki/przyklad-113')).result;
  assert.match(reel,/<script src="\/appearance.js\?v=11">/);
  assert.match(reel,/data-reels-next data-button-finish-action="icon"/);
  const firstSlide=reel.slice(reel.indexOf('data-photo-reel>')).split('</article>',1)[0];
  assert.match(firstSlide,/<h2>Porsche Taycan<\/h2>/);
  assert.doesNotMatch(firstSlide,/href="tel:/);
  assert.match(firstSlide,/reel-photo-stack" style="--photo-count:3"/);
  assert.match(firstSlide,/Taycan Turbo S w granatowym lakierze/);
  assert.match(firstSlide,/reel-detail-facts/);
  assert.match(firstSlide,/Napisz wiadomość/);
  assert.match(firstSlide,/Umów oględziny/);
  assert.match(firstSlide,/Sprawdź VIN|Zapytaj o VIN/);
  const detailsPanel=firstSlide.slice(firstSlide.indexOf('data-reel-panel="details"'));
  assert.doesNotMatch(detailsPanel,/<img /);
  assert.ok(firstSlide.indexOf('data-reel-panel="photos"')<firstSlide.indexOf('data-reel-panel="media"'));
  assert.ok(firstSlide.indexOf('data-reel-panel="media"')<firstSlide.indexOf('data-reel-panel="details"'));
  assert.match(firstSlide,/Film nie został dodany/);
  const photoStack=firstSlide.slice(firstSlide.indexOf('<div class="reel-photo-stack'),firstSlide.indexOf('</div>',firstSlide.indexOf('<div class="reel-photo-stack')));
  assert.equal((photoStack.match(/<img /g)||[]).length,3);
  assert.doesNotMatch(firstSlide,/reel-detail-hero|data-reel-details-cue/);
  assert.match(firstSlide,/Rok produkcji/);
  assert.match(firstSlide,/Skrzynia biegów/);
  assert.match(reel,/\/assets\/showcase\/113-front\.webp/);
  assert.match(reel,/\/assets\/showcase\/113-rear\.webp/);
  assert.match(reel,/\/assets\/showcase\/113-side\.webp/);
  assert.doesNotMatch(reel,/<video /);
  await guest.go('/demo/rolki/nieznane-auto',{code:404});
});

test('Smart Camera Studio · saves, resumes, retries and replaces scoped gallery and angle captures',async()=>{
  const seller=browser(),other=browser();
  for(const client of [seller,other]) await client.go('/demo/api/access',{method:'POST',data:{actor:'seller'}});
  const {id}= (await seller.go('/demo/api/listings',{method:'POST',data:{key:crypto.randomUUID()}})).result;
  const path='/demo/api/listings/'+id;
  const get=async()=> (await seller.go(path+'/edit')).result;
  const put=async(body,code=200)=> (await seller.go(path+'/edit',{method:'PUT',data:body,code})).result;
  const send=async(version,route,headers,bytes,code=200)=>(await seller.go(path+'/'+route,{method:'POST',
    headers:{'X-Edit-Version':String(version),...headers},bytes,code})).result;
  let state=await get();
  assert.deepEqual(state.smartCamera,{shots:{},skipped:[],spinCount:null,frames:{}});
  await other.go(path+'/edit',{code:404});
  state=await put({data,version:state.version,studioCount:36,studioSkip:{shot:'trunk',skip:true}});
  assert.deepEqual((await get()).smartCamera,{shots:{},skipped:['trunk'],spinCount:36,frames:{}});
  await put({version:state.version,studioCount:13},422);
  const uuid=crypto.randomUUID(),headers={'X-Studio-Shot':'front','X-Studio-Capture-Id':uuid};
  const oldVersion=state.version;
  const first=await photo(1),second=await photo(2);
  await send(oldVersion,'photo',{'X-Studio-Shot':'bad'},first,422);
  await send(oldVersion,'photo',headers,Buffer.from('not a photograph'),422);
  const parallel=await Promise.all([send(oldVersion,'photo',headers,first),send(oldVersion,'photo',headers,first)]);
  assert.equal(parallel[0].version,parallel[1].version);
  state=parallel[0];
  const original=state.smartCamera.shots.front;
  assert.deepEqual(state.photos,[original]);
  assert.equal((await send(oldVersion,'photo',headers,first)).needsRefresh,false);
  state=await put({version:state.version,data:{...data,price:data.price+100,photoDetails:{[original]:'front'}}});
  assert.equal((await send(oldVersion,'photo',headers,first)).needsRefresh,true);
  const revision=state.version;
  await send(revision,'photo',headers,second,409);
  await send(revision,'photo',{'X-Studio-Shot':'front'},second,409);
  state=await send(revision,'photo',{'X-Studio-Shot':'front','X-Studio-Replace':original,'X-Studio-Capture-Id':crypto.randomUUID()},second);
  const replacement=state.photos[0];
  assert.notEqual(original,replacement);
  assert.equal(state.smartCamera.shots.front,replacement);
  assert.deepEqual(state.photoDetails,{[replacement]:'front'});
  state=await put({version:state.version,data:{...data,photoDetails:state.photoDetails}});
  assert.deepEqual(state.data.photoDetails,{[replacement]:'front'});
  assert.deepEqual((await send(oldVersion,'photo',headers,first)).photos,[replacement]);
  await send(state.version,'photo',{'X-Studio-Shot':'rear'},second,422);
  const spin=(angle,extra={})=>({'X-Studio-Frames':'36','X-Studio-Angle':String(angle),...extra});
  await send(state.version,'spin',spin(45),first,422);
  await send(state.version,'spin',spin(180,{'X-Studio-Reuse':replacement}),undefined,422);
  state=await send(state.version,'spin',spin(0,{'X-Studio-Reuse':replacement}),undefined);
  assert.equal(state.smartCamera.frames[0],replacement);
  await put({version:state.version,studioCount:12},409);
  await send(state.version,'spin',{},first,409);
  await seller.go(path+'/submit',{method:'POST',data:{version:state.version},code:422});
  const files=(await readdir('public/assets')).filter(file=>file.startsWith('category-body-')&&file.endsWith('.webp')).sort();
  // Capture around the car in reverse; public projection must still begin at 0°.
  for(let index=35;index>=1;index--) {
    state=await send(state.version,'spin',spin(index*10),await readFile('public/assets/'+files[index]));
  }
  assert.equal(state.spin.length,36);
  assert.deepEqual(state.spin,Array.from({length:36},(_,i)=>state.smartCamera.frames[i*10]));
  const tamper=await put({version:state.version,data:{...data,smartCamera:{shots:{rear:replacement}},cameraReceipts:{}},spin:state.spin.toReversed()});
  assert.deepEqual(tamper.smartCamera,state.smartCamera);
  assert.deepEqual(tamper.spin,state.spin);
  const result=(await seller.go(path+'/submit',{method:'POST',data:{version:tamper.version}})).result;
  assert.ok(['published','pending'].includes(result.status));
  const record=inspect('SELECT * FROM listings WHERE id=?',id);
  const offer=hydrate({prefix:'/demo'},record);
  assert.deepEqual(offer.photos.map(({shot,angle})=>[shot,angle]),[['front',0]]);
  assert.deepEqual(offer.spin.map(({angle})=>angle),Array.from({length:36},(_,i)=>i*10));
  assert.ok(!('cameraReceipts' in offer)&&!('smartCamera' in offer));
});

test('Smart Camera Studio · legacy spins stay manual and deleting media clears only matching progress',async()=>{
  const client=browser();
  await client.go('/demo/api/access',{method:'POST',data:{actor:'seller'}});
  const id=(await client.go('/demo/api/listings',{method:'POST',data:{key:crypto.randomUUID()}})).result.id;
  const path='/demo/api/listings/'+id;
  let state=(await client.go(path+'/edit')).result;
  const send=async(route,headers,bytes,code=200)=>(await client.go(path+'/'+route,{method:'POST',headers:{'X-Edit-Version':String(state.version),...headers},bytes,code})).result;
  const put=async body=>(await client.go(path+'/edit',{method:'PUT',data:{version:state.version,...body}})).result;
  state=await send('photo',{},await photo(1));
  const ordinary=state.photos[0];
  state=await send('spin',{},await photo(2));
  const legacyFrame=state.spin[0];
  await send('spin',{'X-Studio-Frames':'12','X-Studio-Angle':'0'},await photo(3),409);
  state=await send('photo',{'X-Studio-Shot':'damage'},await photo(3));
  assert.deepEqual(state.spin,[legacyFrame]);
  state=await put({photos:[ordinary],spin:[]});
  assert.deepEqual(state.smartCamera,{shots:{},skipped:[],frames:{},spinCount:null});
  state=await send('spin',{'X-Studio-Frames':'24','X-Studio-Angle':'345'},await photo(4));
  assert.equal(state.smartCamera.spinCount,24);
  state=await put({spin:[]});
  assert.equal(state.smartCamera.spinCount,null);
  state=await put({studioCount:12,studioSkip:{shot:'damage',skip:true}});
  state=await send('photo',{'X-Studio-Shot':'damage'},await photo(3));
  assert.deepEqual(state.smartCamera.skipped,[]);
  assert.deepEqual(state.photos,[ordinary,state.smartCamera.shots.damage]);
  const damage=state.smartCamera.shots.damage;
  state=await put({studioSkip:{shot:'trunk',skip:true}});
  state=await send('spin',{},await photo(4));
  assert.deepEqual(state.smartCamera,{shots:{damage},skipped:['trunk'],spinCount:null,frames:{}});
  state=await send('spin',{},await photo(5));
  assert.equal(state.spin.length,2);
});
