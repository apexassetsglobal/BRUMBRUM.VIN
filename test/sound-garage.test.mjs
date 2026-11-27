import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { soundCatalog, soundEvents } from '../public/assets/sound-catalog.js';
import { createSoundEngine, normalizeSoundSettings as normalizeClient } from '../public/assets/sound-engine.js';
import { normalizeSoundSettings, saveSoundSettings, soundEventsSince, soundSettings } from '../src/sounds.js';

function database(t) {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_marketplace.sql',import.meta.url),'utf8'));
  sqlite.exec(`
    INSERT INTO users(id,scope,email,name,profile_type,created_at) VALUES
      ('seller','live','seller@example.test','Seller','private','2026-01-01T00:00:00.000Z'),
      ('buyer','live','buyer@example.test','Buyer','private','2026-01-01T00:00:00.000Z');
    INSERT INTO listings(id,scope,user_id,client_key,status,price,created_at,updated_at) VALUES
      ('car','live','seller','car-key','published',12500000,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO conversations(id,listing_id,buyer_id,seller_id,created_at,updated_at) VALUES
      ('thread','car','buyer','seller','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO favorites(user_id,listing_id,created_at) VALUES('buyer','car','2026-01-01T00:00:00.000Z');
  `);
  t.after(()=>sqlite.close());
  const prepare=(sql,params=[])=>({
    bind(...values){return prepare(sql,values);},
    async first(){return sqlite.prepare(sql).get(...params)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...params)};},
    async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}};}
  });
  return {sqlite,db:{prepare}};
}

class Parameter {
  setValueAtTime(){} exponentialRampToValueAtTime(){} linearRampToValueAtTime(){} cancelScheduledValues(){} setTargetAtTime(){}
}
class AudioNode {
  constructor(){this.gain=new Parameter();this.frequency=new Parameter();this.detune={value:0};this.stops=0;}
  connect(target){return target;} start(){} stop(){this.stops++;}
}
class FakeAudioContext {
  constructor({blocked=false}={}){this.currentTime=1;this.sampleRate=8000;this.state=blocked?'suspended':'running';this.destination=new AudioNode();this.blocked=blocked;}
  async resume(){if(!this.blocked)this.state='running';}
  createGain(){return new AudioNode();}
  createOscillator(){return new AudioNode();}
  createDynamicsCompressor(){const node=new AudioNode();for(const key of ['threshold','knee','ratio','attack','release'])node[key]={value:0};return node;}
  createBuffer(_channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
  createBufferSource(){return new AudioNode();}
  createBiquadFilter(){const node=new AudioNode();node.frequency={value:0};node.Q={value:0};return node;}
}

test('Sound Garage exposes exactly 60 unique, clearly synthetic variants and eight events',()=>{
  assert.equal(soundCatalog.length,60);
  assert.equal(new Set(soundCatalog.map(item=>item.id)).size,60);
  assert.equal(soundEvents.length,8);
  assert.ok(soundCatalog.every(item=>item.available&&item.source==='synthetic'&&item.profile));
  assert.deepEqual(new Set(soundEvents.map(([key])=>key)),new Set(['appStart','newMessage','sellerReply','listingInquiry','watchedPrice','newOffer','vehicleSold','system']));
});

test('sound settings clamp volume, reject unknown catalog IDs and keep per-event mute',()=>{
  const input={favorites:['aircraft-f16','missing','aircraft-f16'],events:{
    appStart:{soundId:'aircraft-f35',volume:155,muted:true},newMessage:{soundId:'missing',volume:-12,muted:false}
  }};
  for(const normalize of [normalizeClient,normalizeSoundSettings]) {
    const value=normalize(input);
    assert.deepEqual(value.favorites,['aircraft-f16']);
    assert.deepEqual(value.events.appStart,{soundId:'aircraft-f35',volume:100,muted:true});
    assert.equal(value.events.newMessage.volume,0);
    assert.notEqual(value.events.newMessage.soundId,'missing');
    assert.equal(Object.keys(value.events).length,8);
  }
});

test('central sound engine schedules a 3.9 second start, short notification, stops overlap and reports autoplay block',async()=>{
  const timers=[];
  class RunningContext extends FakeAudioContext {constructor(){super();}}
  const engine=createSoundEngine({AudioContext:RunningContext,setTimer:callback=>{timers.push(callback);return timers.length;}});
  const start=await engine.play('brumbrum-signature',{kind:'start',volume:70});
  assert.equal(start.duration,3.9);assert.equal(start.synthetic,true);
  const previous=engine.active;
  const notice=await engine.play('porsche-911-gt3-rs',{kind:'notification',volume:40});
  assert.equal(notice.duration,.88);assert.equal(engine.active.soundId,'porsche-911-gt3-rs');
  timers.splice(0).forEach(callback=>callback());
  assert.ok(previous.nodes.every(node=>node.stops>0));
  class BlockedContext extends FakeAudioContext {constructor(){super({blocked:true});}}
  const blocked=createSoundEngine({AudioContext:BlockedContext,setTimer:()=>0});
  await assert.rejects(blocked.play('brumbrum-signature'),/autoplay-blocked/);
});

test('logged-in sound settings persist in the existing settings table and event polling is role-aware',async t=>{
  const {sqlite,db}=database(t);
  const base={db,scope:'live',user:{id:'seller'},url:new URL('https://example.test/api/sound-events?after=2026-01-01T00:00:00.000Z')};
  const saved=await saveSoundSettings(base,{settings:{favorites:['aircraft-f16'],events:{appStart:{soundId:'aircraft-f16',volume:33,muted:true}}}});
  assert.deepEqual(saved.settings.events.appStart,{soundId:'aircraft-f16',volume:33,muted:true});
  assert.deepEqual((await soundSettings(base)).settings,saved.settings);
  sqlite.exec(`
    INSERT INTO notifications(id,user_id,kind,data,created_at) VALUES
      ('n1','seller','message','{"thread":"thread"}','2026-02-01T10:00:00.000Z'),
      ('n2','seller','sold','{"listingId":"car"}','2026-02-01T10:00:01.000Z'),
      ('n3','buyer','message','{"thread":"thread"}','2026-02-01T10:00:02.000Z');
  `);
  const seller=await soundEventsSince(base);
  assert.deepEqual(seller.events.map(item=>item.type),['listingInquiry','vehicleSold']);
  const buyer=await soundEventsSince({...base,user:{id:'buyer'}});
  assert.deepEqual(buyer.events.map(item=>item.type),['sellerReply']);
  assert.deepEqual(buyer.favoritePrices,{car:12500000});
});

test('PWA icon files have exact dimensions, transparent standard masters and opaque maskable variants',async()=>{
  const dimensions=buffer=>({width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),colorType:buffer[25]});
  for(const size of [192,512,1024]) {
    const regularBuffer=await readFile(new URL(`../public/assets/icon-${size}.png`,import.meta.url));
    const maskableBuffer=await readFile(new URL(`../public/assets/icon-maskable-${size}.png`,import.meta.url));
    const regular=dimensions(regularBuffer);
    const maskable=dimensions(maskableBuffer);
    assert.deepEqual([regular.width,regular.height],[size,size]);
    assert.deepEqual([maskable.width,maskable.height],[size,size]);
    assert.ok(regular.colorType===6||(regular.colorType===3&&regularBuffer.includes(Buffer.from('tRNS'))));
    assert.ok((maskable.colorType===2||maskable.colorType===3)&&!maskableBuffer.includes(Buffer.from('tRNS')));
  }
});

test('synthetic sound module is disabled while app icons remain available',async()=>{
  const [ui,account,app,garage,launch]=await Promise.all([
    readFile(new URL('../src/ui.js',import.meta.url),'utf8'),readFile(new URL('../src/views-account.js',import.meta.url),'utf8'),
    readFile(new URL('../src/app.js',import.meta.url),'utf8'),readFile(new URL('../public/assets/sound-garage.js',import.meta.url),'utf8'),
    readFile(new URL('../public/assets/launch-screen.css',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(ui,/<script type="module" src="\/assets\/sound-garage\.js/);assert.match(ui,/data-engine-start hidden/);
  assert.doesNotMatch(account,/notifications\+sounds\+contact/);
  assert.match(app,/icon-maskable-/);assert.match(app,/purpose:'maskable'/);assert.match(app,/purpose:'any'/);
  assert.match(garage,/\(async\(\)=>\{/);assert.match(garage,/sound-start-required/);assert.match(garage,/sessionStartKey/);
  assert.match(launch,/\.sound-start-required \.launch-screen/);
});
