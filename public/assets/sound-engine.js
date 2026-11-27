import { defaultSoundSettings, soundById, soundCatalog, soundEvents } from './sound-catalog.js?v=1';

const soundIds=new Set(soundCatalog.map(item=>item.id));

export function normalizeSoundSettings(value) {
  const defaults=defaultSoundSettings();
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const favorites=Array.isArray(source.favorites)
    ? [...new Set(source.favorites.filter(id=>soundIds.has(id)))].slice(0,soundCatalog.length)
    : defaults.favorites;
  const events={};
  for(const [key] of soundEvents) {
    const fallback=defaults.events[key];
    const selected=source.events?.[key];
    events[key]={
      soundId:soundIds.has(selected?.soundId)?selected.soundId:fallback.soundId,
      volume:Number.isFinite(Number(selected?.volume))?Math.max(0,Math.min(100,Math.round(Number(selected.volume)))):fallback.volume,
      muted:selected&&Object.hasOwn(selected,'muted')?Boolean(selected.muted):fallback.muted
    };
  }
  return {version:1,favorites,events};
}

const profileBase=profile=>{
  const table={
    signature:[92,4,.46],
    'v12-high':[132,12,.22],'v12-raw':[108,12,.34],'v12-turbo':[98,12,.31],'hybrid-v12':[142,12,.18],
    'v10-high':[154,10,.2],'v10-mid':[126,10,.28],'v10-deep':[92,10,.4],'v10-raw':[118,10,.36],'v10-turbo':[108,10,.3],'v10-race':[188,10,.18],
    'v8-high':[126,8,.25],'v8-deep':[72,8,.5],'v8-raw':[88,8,.45],'v8-turbo':[96,8,.36],'v8-race':[166,8,.2],'hybrid-v8':[138,8,.2],
    'flat6-high':[148,6,.22],'flat6-turbo':[112,6,.32],'flat6-race':[164,6,.2],
    'i6-turbo':[104,6,.34],'i6-raw':[116,6,.32],'v6-turbo':[98,6,.36],
    'i5-turbo':[108,5,.34],'i4-turbo':[96,4,.4],'flat4-turbo':[82,4,.48],rotary:[176,3,.18],
    w16:[76,16,.4],'w16-turbo':[76,16,.4],
    'bike-v4':[188,4,.18],'bike-supercharged':[210,4,.16],'bike-i4':[198,4,.17],
    jet:[56,18,.64],'jet-heavy':[48,22,.72]
  };
  return table[profile]||[104,8,.34];
};

const seedFor=value=>Array.from(value).reduce((sum,char)=>(sum*33+char.codePointAt(0))>>>0,5381);

export function createSoundEngine({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,setTimer=globalThis.setTimeout}={}) {
  let context=null;
  let active=null;
  const stop=()=>{
    if(!active)return;
    const {gain,nodes}=active;
    const at=context?.currentTime||0;
    try {gain.gain.cancelScheduledValues(at);gain.gain.setTargetAtTime(.0001,at,.025);}catch{}
    setTimer(()=>nodes.forEach(node=>{try{node.stop();}catch{}}),90);
    active=null;
  };
  const ensure=async()=>{
    if(!AudioContext)throw new Error('audio-unavailable');
    context??=new AudioContext({latencyHint:'interactive'});
    if(context.state!=='running')await context.resume();
    if(context.state!=='running')throw new Error('autoplay-blocked');
    return context;
  };
  const play=async(soundId,{kind='notification',volume=50}={})=>{
    const item=soundById.get(soundId);
    if(!item?.available)throw new Error('sound-unavailable');
    const audio=await ensure();
    stop();
    const start=audio.currentTime+.018;
    const duration=kind==='start'?3.9:kind==='preview'?3.25:.88;
    const [base,cylinders,roughness]=profileBase(item.profile);
    const variation=(seedFor(item.id)%19-9)/100;
    const master=audio.createGain();
    const compressor=audio.createDynamicsCompressor();
    compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=7;compressor.attack.value=.004;compressor.release.value=.16;
    master.gain.setValueAtTime(.0001,start);
    master.gain.exponentialRampToValueAtTime(Math.max(.0001,Math.min(1,volume/100)*.72),start+.055);
    master.gain.setValueAtTime(Math.max(.0001,Math.min(1,volume/100)*.72),start+duration-.32);
    master.gain.exponentialRampToValueAtTime(.0001,start+duration);
    master.connect(compressor).connect(audio.destination);
    const nodes=[];
    const tone=(ratio,type='sawtooth',level=.2,detune=0)=>{
      const oscillator=audio.createOscillator();
      const gain=audio.createGain();
      const idle=base*ratio*(1+variation);
      const peak=idle*(kind==='notification'?2.1:4.2);
      oscillator.type=type;oscillator.detune.value=detune;
      oscillator.frequency.setValueAtTime(Math.max(35,idle*.46),start);
      oscillator.frequency.exponentialRampToValueAtTime(idle,start+(kind==='notification'?.08:.52));
      oscillator.frequency.exponentialRampToValueAtTime(peak,start+duration*.58);
      oscillator.frequency.exponentialRampToValueAtTime(idle*1.18,start+duration*.88);
      gain.gain.setValueAtTime(level,start);
      gain.gain.linearRampToValueAtTime(level*(1.15+roughness),start+duration*.55);
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(gain).connect(master);oscillator.start(start);oscillator.stop(start+duration+.04);nodes.push(oscillator);
    };
    tone(1,'sawtooth',.19,0);tone(2,'square',.055,cylinders*1.7);tone(.5,'triangle',.24,-cylinders);
    if(item.profile.startsWith('jet'))tone(.24,'sawtooth',.2,-18);
    const noiseLength=Math.max(1,Math.ceil(audio.sampleRate*duration));
    const noiseBuffer=audio.createBuffer(1,noiseLength,audio.sampleRate);
    const noiseData=noiseBuffer.getChannelData(0);
    let seed=seedFor(item.id);
    for(let i=0;i<noiseData.length;i++){seed=(seed*1664525+1013904223)>>>0;noiseData[i]=((seed/4294967296)*2-1);}
    const noise=audio.createBufferSource();
    const filter=audio.createBiquadFilter();
    const noiseGain=audio.createGain();
    noise.buffer=noiseBuffer;filter.type=item.profile.startsWith('jet')?'lowpass':'bandpass';filter.frequency.value=item.profile.startsWith('jet')?950:220+base*2;filter.Q.value=.7;
    noiseGain.gain.setValueAtTime(kind==='notification'?.035:.16,start);
    if(kind!=='notification')noiseGain.gain.exponentialRampToValueAtTime(.028+roughness*.08,start+.62);
    noiseGain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    noise.connect(filter).connect(noiseGain).connect(master);noise.start(start);noise.stop(start+duration+.04);nodes.push(noise);
    active={gain:master,nodes,soundId,kind};
    setTimer(()=>{if(active?.gain===master)active=null;},(duration+.12)*1000);
    return {soundId,duration,synthetic:true};
  };
  const menuTone=async(volume=.3)=>{
    const audio=await ensure();stop();
    const at=audio.currentTime;
    const oscillator=audio.createOscillator();const gain=audio.createGain();
    oscillator.type='triangle';oscillator.frequency.setValueAtTime(850,at);oscillator.frequency.exponentialRampToValueAtTime(440,at+.045);
    gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.035*volume,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.055);
    oscillator.connect(gain).connect(audio.destination);oscillator.start(at);oscillator.stop(at+.06);
    active={gain,nodes:[oscillator],soundId:'menu',kind:'menu'};
    setTimer(()=>{if(active?.gain===gain)active=null;},80);
  };
  return {play,stop,menuTone,get active(){return active;},get state(){return context?.state||'closed';}};
}
