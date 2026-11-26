import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { detail } from '../src/views-robots.js';
import { robotDefaultData } from '../src/robot-catalog.js';

const script=await readFile(new URL('../public/assets/robots.js',import.meta.url),'utf8');
const after=(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const currentDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const context={t:pl=>pl,lang:'pl',prefix:'',robotics:true,user:{id:'buyer'},url:new URL('https://robot.example.test/roboty/oferta/robot-1'),
  db:{prepare:()=>({bind:()=>({first:async()=>({purchase:2,rental:2})})})}};

async function rentalMarkup(patch={}) {
  const offer={...robotDefaultData,id:'robot-1',slug:'robot-1',user_id:'seller',status:'published',make:'Robot',model:'Calendar',
    photos:[],spin:[],price:1000,tradeMode:'both',rentalPrice:100,rentalUnit:'week',minimumRental:2,leadTime:5,stock:2,...patch};
  const {body}=await detail(context,offer);
  const html=body.match(/<dialog[^>]+data-dialog="robot-rental"[\s\S]+?<\/dialog>/)?.[0];
  assert.ok(html,'public robot offer includes the rental request');
  return {html,settings:attributes(html.match(/<dialog[^>]+>/)[0]),inputs:[...html.matchAll(/<input\b[^>]+>/g)].map(match=>attributes(match[0]))};
}

function calendar(settings,{selectedStart='',selectedEnd=''}={}) {
  const events=new Map();
  const start={min:'',value:selectedStart,addEventListener:(name,callback)=>events.set(name,callback)};
  const end={min:'',value:selectedEnd};
  const dialog={dataset:{robotLeadDays:settings['data-robot-lead-days'],robotRentalDays:settings['data-robot-rental-days']},
    querySelector:selector=>selector==='[name=startsOn]'?start:selector==='[name=endsOn]'?end:null,addEventListener(){}};
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-10-24T23:30:00Z']));}}
  const document={body:{dataset:{prefix:'',lang:'pl'}},querySelector:()=>null,
    querySelectorAll:selector=>selector==='.robot-dialog'?[dialog]:[]};
  runInNewContext(script,{document,Date:FixedDate,Intl});
  return {start,end,chooseStart(value){start.value=value;events.get('input')();}};
}

test('rental form exposes the seller lead time and minimum complete billing periods before scripts run',async()=>{
  for(const [rentalUnit,minimumRental,minimumDays] of [['day',3,3],['week',2,14],['month',2,60]]) {
    const today=currentDay();
    const {settings,inputs}=await rentalMarkup({rentalUnit,minimumRental,leadTime:5});
    assert.equal(settings['data-robot-lead-days'],'5');
    assert.equal(settings['data-robot-rental-days'],String(minimumDays));
    assert.equal(inputs.find(input=>input.name==='startsOn').min,after(today,5));
    assert.equal(inputs.find(input=>input.name==='endsOn').min,after(today,5+minimumDays));
  }
});

test('interactive calendar enforces the same dates after a later start and across a Warsaw daylight-saving change',async()=>{
  const {settings}=await rentalMarkup({leadTime:1,rentalUnit:'week',minimumRental:2});
  const env=calendar(settings,{selectedEnd:'2026-11-30'});
  assert.equal(env.start.min,'2026-10-26');
  assert.equal(env.end.min,'2026-11-09');
  env.chooseStart('2026-10-31');
  assert.equal(env.end.min,'2026-11-14','two full weeks, with an exclusive return date');
  assert.equal(env.end.value,'2026-11-30','a valid chosen return date is preserved');
  env.chooseStart('');
  assert.equal(env.end.min,'2026-11-09','clearing start restores the earliest permitted return');
  env.chooseStart('2026-10-24');
  assert.equal(env.end.min,'2026-11-09','a start before preparation completes cannot loosen return bounds');
});

test('daily and monthly date bounds use calendar days and leave too-short chosen dates invalid',async()=>{
  for(const [rentalUnit,minimumRental,expectedEnd] of [['day',1,'2026-10-26'],['month',2,'2026-12-24']]) {
    const {settings}=await rentalMarkup({leadTime:0,rentalUnit,minimumRental});
    const env=calendar(settings,{selectedStart:'2026-10-25',selectedEnd:'2026-10-25'});
    assert.equal(env.start.min,'2026-10-25');
    assert.equal(env.end.min,expectedEnd);
    assert.ok(env.end.value<env.end.min,'the native date control will reject a shorter rental');
  }
});
