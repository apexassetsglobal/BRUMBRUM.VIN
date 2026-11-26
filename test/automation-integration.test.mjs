import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { automationApi, automationTick } from '../src/automation.js';
import { handler } from '../src/app.js';
import { digest } from '../src/core.js';
import { translator } from '../src/i18n.js';
import { cleanImage } from '../src/images.js';

const root = fileURLToPath(new URL('../',import.meta.url));
const password = 'test-automation-account-only';
const ownerEmail = 'import-admin@example.test';
const ownerToken = 'owner-fixture-' + crypto.randomUUID();
const sourceOrigin = 'https://inventory.example.com';
const photoOrigin = 'https://images.example.com';
const publishOrigin = 'https://publish.example.com';
const officialUrl = publishOrigin + '/inventory/accepted-v1';
const feeds = new Map();
const mutableImages = new Map();
const outbound = [];
let receipt = {status:'accepted',reference:'qa-receipt'};
let folder, remote, server, base, db, owner, second, admin, photo, childErrors = '';

function vehicle(externalId, extra = {}) {
  return {external_id:externalId,make:'Toyota',model:'Corolla',variant:'QA Hybrid',type:'car',body:'wagon',fuel:'hybrid',
    gearbox:'auto',drive:'fwd',condition:'used',damage:'no',year:2021,mileage:54000,power:122,powerUnit:'KM',
    price:68400,currency:'PLN',city:'Warszawa',region:'Mazowieckie',engine:1798,equipment:['abs','carplay'],
    description:'Pojazd kontrolny do lokalnego testu integracji.',country:'Polska',photo_urls:[photoOrigin+'/corolla.webp'],...extra};
}

// Redirect only these reserved example.com test hostnames onto a loopback TLS fixture.
// The public-transport implementation stays active, including Host/SNI and certificate validation.
const fixtureLoader = `
import dns from 'node:dns/promises';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
const names = new Set(['inventory.example.com','images.example.com','publish.example.com']);
dns.lookup = async (name,opts) => {
  if (!names.has(name)) throw Error('Unexpected DNS query in isolated integration test: '+name);
  const address={address:'93.184.216.34',family:4};
  return opts?.all ? [address] : address;
};
const actualRequest = https.request;
https.request = (options,callback) => {
  if (!names.has(options.servername) || options.hostname !== '93.184.216.34' || options.rejectUnauthorized !== true) {
    throw Error('Unexpected socket destination in isolated integration test');
  }
  return actualRequest({...options,hostname:'127.0.0.1',port:Number(process.env.FIXTURE_PORT)},callback);
};
syncBuiltinESMExports();
globalThis.fetch = async () => { throw Error('External fetch is disabled in this integration fixture'); };
`;

async function startRemote() {
  const certPath = join(folder,'cert.pem'), keyPath = join(folder,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=inventory.example.com',
    '-addext','subjectAltName=DNS:inventory.example.com,DNS:images.example.com,DNS:publish.example.com',
    '-keyout',keyPath,'-out',certPath],{stdio:'ignore'});
  photo = await readFile(join(root,'public/assets/vehicle-1.webp'));
  remote = createServer({key:await readFile(keyPath),cert:await readFile(certPath)},async (req,res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const path = new URL(req.url,'https://'+req.headers.host);
    outbound.push({host:path.host,path:path.pathname,method:req.method,auth:req.headers.authorization,
      body:Buffer.concat(chunks).toString(),idempotency:req.headers['idempotency-key']});
    if (path.origin === photoOrigin && (path.pathname === '/corolla.webp' || mutableImages.has(path.pathname))) {
      res.writeHead(200,{'Content-Type':'image/webp'}); res.end(mutableImages.get(path.pathname)??photo); return;
    }
    if (path.origin === sourceOrigin && feeds.has(path.pathname)) {
      const body=feeds.get(path.pathname);
      res.writeHead(body.failureStatus??200,{'Content-Type':'application/json'}); res.end(JSON.stringify(body)); return;
    }
    if (path.href === officialUrl && req.method === 'POST') {
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(receipt)); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve,reject)=>{remote.once('error',reject);remote.listen(0,'127.0.0.1',resolve);});
  return certPath;
}

function session() {
  const cookies = new Map();
  return {
    async call(path,{method='GET',data,bytes,headers={}}={}) {
      const outgoing = new Headers(headers);
      if (cookies.size) outgoing.set('Cookie',[...cookies].map(([key,value])=>key+'='+value).join('; '));
      if (method !== 'GET') outgoing.set('Origin',base);
      const init = {method,headers:outgoing,redirect:'manual'};
      if (data !== undefined) {outgoing.set('Content-Type','application/json');init.body=JSON.stringify(data);}
      if (bytes !== undefined) init.body=bytes;
      const response = await fetch(base+path,init);
      for (const cookie of response.headers.getSetCookie()) {
        const [name,value] = cookie.split(';',1)[0].split('=');
        if (value) cookies.set(name,value); else cookies.delete(name);
      }
      const content = await response.text();
      return {status:response.status,data:response.headers.get('Content-Type')?.includes('json') ? JSON.parse(content) : content};
    }
  };
}
async function ok(client,path,options={}) {
  const response = await client.call(path,options);
  assert.ok(response.status>=200 && response.status<300,path+' returned '+response.status+' '+JSON.stringify(response.data).slice(0,360));
  return response.data;
}
async function register(name) {
  const client=session(), email=name+'@example.test';
  await ok(client,'/api/auth/register',{method:'POST',data:{email,password,name,profile_type:'private',terms:true}});
  const messages=(await readFile(join(folder,'mailbox.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  const link=messages.findLast(item=>item.to===email && item.purpose==='verify');
  assert.ok(link);
  await ok(client,'/api/auth/verify',{method:'POST',data:{password,token:new URL(link.url).searchParams.get('token')}});
  await ok(client,'/api/auth/login',{method:'POST',data:{email,password}});
  return client;
}

async function until(check,message,timeout=7000) {
  const deadline=Date.now()+timeout;
  while (Date.now()<deadline) {
    const result=await check();
    if (result) return result;
    await sleep(50);
  }
  assert.fail(message+' '+childErrors.slice(-500));
}
const one=(sql,...bind)=>db.prepare(sql).get(...bind);
const all=(sql,...bind)=>db.prepare(sql).all(...bind);
const write=(sql,...bind)=>db.prepare(sql).run(...bind);

before(async () => {
  folder=await mkdtemp(join(root,'var-test-automation-'));
  const cert=await startRemote();
  const originFixtures={FIXTURE_PORT:String(remote.address().port),NODE_EXTRA_CA_CERTS:cert};
  server=spawn(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(fixtureLoader).toString('base64'),'server.mjs'],{
    cwd:root,env:{...process.env,...originFixtures,APP_MODE:'development',APP_ORIGIN:'',HOST:'127.0.0.1',PORT:'0',
      DATA_DIR:folder,OWNER_EMAIL:ownerEmail,OWNER_SETUP_TOKEN:ownerToken,MAIL_API_KEY:'',MAIL_FROM:'',
      IMPORT_SECRET_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
      IMPORT_TICK_MS:'500',
      IMPORT_CHANNELS:JSON.stringify([{id:'fixture-dealer',name:'Kontrolowany odbiorca QA',endpoint:officialUrl,protocol:'receipt-v1'}])},stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',chunk=>{childErrors=(childErrors+String(chunk)).slice(-3000);});
  const [first] = await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error('Startup '+code+' '+childErrors);})]);
  base = String(first).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]; assert.ok(base);
  db=new DatabaseSync(join(folder,'all4auto.sqlite'));
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  owner=await register('import-owner'); second=await register('import-second'); admin=await register('import-admin');
  await ok(admin,'/api/auth/owner',{method:'POST',data:{token:ownerToken}});
});
after(async () => {
  db?.close();
  if (server?.exitCode===null) {server.kill();await once(server,'exit');}
  if (remote?.listening) await new Promise(resolve=>{remote.close(resolve); remote.closeAllConnections();});
  if (folder) await rm(folder,{recursive:true,force:true});
});

const anon=session();
const standardPolicy={imports:1,publish:1,sync:1,paused:0};
const configure=(changes={})=>ok(admin,'/api/automation/admin/policy',{method:'POST',data:{...standardPolicy,...changes}});
const addSource=(client,name,extra={})=>ok(client,'/api/automation/sources',{method:'POST',
  data:{kind:'push',name,autopublish:true,rights:true,...extra}});
const push=(source,offers,token=source.token)=>anon.call('/api/automation/push/'+source.id,{method:'POST',data:{offers},
  headers:{Authorization:'Bearer '+token}});
const item=(sourceId,externalId)=>one('SELECT i.*,l.status AS listing_status,l.user_id,l.price,l.currency FROM auto_items i LEFT JOIN listings l ON l.id=i.listing_id WHERE i.source_id=? AND i.external_id=?',sourceId,externalId);
async function complete(sourceId,jobId) {
  return until(()=>one('SELECT * FROM auto_jobs WHERE id=? AND source_id=? AND finished_at IS NOT NULL',jobId,sourceId),
    'Server did not finish job '+jobId,12000);
}
async function pushAndWait(source,offers) {
  const reply=await push(source,offers);
  assert.ok([200,201,202].includes(reply.status),'Push failed '+reply.status+' '+JSON.stringify(reply.data).slice(0,240));
  assert.ok(reply.data.jobId);
  const job=await complete(source.id,reply.data.jobId);
  assert.ok(all('SELECT * FROM auto_events WHERE job_id=?',job.id).length>0,'Missing job events: '+JSON.stringify(job));
  return job;
}
const unavailable=status=>[400,401,403,404,409,422,423,503].includes(status);

const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function workbook(columns,row) {
  const zip=new ZipWriter(new Uint8ArrayWriter(),{level:0});
  const sheetNamespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rels='http://schemas.openxmlformats.org/package/2006/relationships';
  function cells(values,index) {
    return '<row r="'+index+'">'+values.map((value,c)=>{
      const letters=c<26?String.fromCharCode(65+c):'A'+String.fromCharCode(65+c-26);
      return '<c r="'+letters+index+'" t="inlineStr"><is><t>'+escapeXml(value)+'</t></is></c>';
    }).join('')+'</row>';
  }
  const parts={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="'+rels+'"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="'+sheetNamespace+'" xmlns:r="'+rel+'"><sheets><sheet name="Inventory" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="'+rels+'"><Relationship Id="rId1" Type="'+rel+'/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="'+sheetNamespace+'"><sheetData>'+cells(columns,1)+cells(row,2)+'</sheetData></worksheet>'
  };
  for(const [name,xml] of Object.entries(parts))await zip.add(name,new TextReader(xml));
  return zip.close();
}

test('raw CSV, XLSX, JSON and XML previews feed real queued publications; a private preview and custom map cannot be reused across accounts',async()=>{
  const source=await addSource(owner,'Uploaded inventory',{kind:'file'}), other=await addSource(second,'Different files',{kind:'file'});
  for(const format of ['csv','xlsx','json','xml']){
    const external='UP-'+format.toUpperCase();
    const record=vehicle(external);
    const flat=Object.fromEntries(Object.entries(record).map(([k,v])=>[k,Array.isArray(v)?v.join('|'):v]));
    let mapping={},raw;
    if(format==='csv'){
      flat.KodPlacowy=flat.external_id; delete flat.external_id;
      flat.ProducentPlacowy=flat.make; delete flat.make;
      mapping={external_id:'KodPlacowy',make:'ProducentPlacowy'};
      const csv=v=>'"'+String(v).replaceAll('"','""')+'"';
      raw=Object.keys(flat).map(csv).join(';')+'\r\n'+Object.values(flat).map(csv).join(';');
    }else if(format==='xlsx')raw=await workbook(Object.keys(flat),Object.values(flat));
    else if(format==='xml')raw='<offers><offer>'+Object.entries(flat).map(([k,v])=>'<'+k+'>'+escapeXml(v)+'</'+k+'>').join('')+'</offer></offers>';
    else raw=JSON.stringify({offers:[record]});
    const preview=await ok(owner,'/api/automation/source/'+source.id+'/preview?format='+format,{method:'POST',bytes:raw,
      headers:{'Content-Type':'application/octet-stream'}});
    assert.ok(preview.previewId); assert.ok(preview.columns.length); assert.equal(preview.total,1);
    const submission={previewId:preview.previewId,mapping:{...preview.mapping,...mapping},snapshot:false};
    if(format==='csv'){
      const denied=await second.call('/api/automation/source/'+other.id+'/run',{method:'POST',data:submission});
      assert.ok(unavailable(denied.status));
    }
    const job=await ok(owner,'/api/automation/source/'+source.id+'/run',{method:'POST',data:submission});
    await complete(source.id,job.jobId);
    const retry=await ok(owner,'/api/automation/source/'+source.id+'/run',{method:'POST',data:submission});
    assert.equal(retry.jobId,job.jobId);
    const imported=item(source.id,external);
    assert.equal(imported?.listing_status,'published',format+' '+JSON.stringify(imported));
    assert.equal(imported.price,6840000);
  }
});

test('new private account can publish complete API records for free; an incomplete record stays private',async()=>{
  const source=await addSource(owner,'Private-owner stock');
  assert.ok(source.id && source.token);
  const job=await pushAndWait(source,[vehicle('QA-101'),vehicle('QA-incomplete',{model:'',description:''})]);
  const imported=item(source.id,'QA-101'), incomplete=item(source.id,'QA-incomplete');
  assert.equal(imported.listing_status,'published',JSON.stringify(imported));
  assert.equal(imported.price,6840000); assert.equal(imported.currency,'PLN');
  assert.equal(imported.user_id,one('SELECT id FROM users WHERE email=?','import-owner@example.test').id);
  assert.equal(incomplete.listing_status,'draft'); assert.equal(incomplete.result,'incomplete');
  assert.ok(incomplete.detail.length);
  assert.equal(one('SELECT COUNT(*) n FROM photos WHERE listing_id=?',imported.listing_id).n,1);
  const search=await ok(anon,'/api/search?make=Toyota');
  assert.ok(search.offers.some(listing=>listing.id===imported.listing_id));
  assert.ok(!search.offers.some(listing=>listing.id===incomplete.listing_id));
  const progress=await ok(anon,'/api/automation/push/'+source.id+'/jobs/'+job.id,{headers:{Authorization:'Bearer '+source.token}});
  assert.ok(!JSON.stringify(progress).includes(source.token));
  const row=one('SELECT push_hash FROM auto_sources WHERE id=?',source.id);
  assert.ok(row.push_hash && row.push_hash!==source.token);

  const before=one('SELECT revision FROM listings WHERE id=?',imported.listing_id).revision;
  const repeated=await pushAndWait(source,[vehicle('QA-101')]);
  assert.equal(one('SELECT result FROM auto_events WHERE job_id=? AND external_id=?',repeated.id,'QA-101').result,'unchanged');
  assert.equal(one('SELECT revision FROM listings WHERE id=?',imported.listing_id).revision,before);
  await pushAndWait(source,[vehicle('QA-101',{price:66000,currency:'EUR',mileage:54123})]);
  const updated=one('SELECT * FROM listings WHERE id=?',imported.listing_id);
  assert.equal(updated.price,6600000); assert.equal(updated.mileage,54123); assert.equal(updated.currency,'EUR');
  assert.equal(one('SELECT COUNT(*) n FROM photos WHERE listing_id=?',imported.listing_id).n,1);
  assert.equal(one('SELECT COUNT(*) n FROM auto_items WHERE source_id=? AND external_id=?',source.id,'QA-101').n,1);
  await pushAndWait(source,[vehicle('QA-101',{model:'',price:1})]);
  const needsReview=item(source.id,'QA-101');
  assert.equal(needsReview.result,'review'); assert.equal(needsReview.listing_status,'published');
  assert.equal(needsReview.price,6600000);
  await pushAndWait(source,[vehicle('QA-101',{availability:'sold'})]);
  assert.equal(item(source.id,'QA-101').listing_status,'sold');
  const soldSearch=await ok(anon,'/api/search?make=Toyota');
  assert.ok(!soldSearch.offers.some(listing=>listing.id===imported.listing_id));
});

test('same external ID may belong to different owners; their API keys, jobs and listing edits are isolated',async()=>{
  const firstSource=await addSource(owner,'Separate inventory'), otherSource=await addSource(second,'Separate inventory');
  const firstJob=await pushAndWait(firstSource,[vehicle('SHARED-ID',{price:1000})]);
  await pushAndWait(otherSource,[vehicle('SHARED-ID',{price:2000})]);
  const a=item(firstSource.id,'SHARED-ID'), b=item(otherSource.id,'SHARED-ID');
  assert.notEqual(a.listing_id,b.listing_id); assert.notEqual(a.user_id,b.user_id);
  assert.equal(a.price,100000); assert.equal(b.price,200000);
  const foreignJob=await anon.call('/api/automation/push/'+firstSource.id+'/jobs/'+firstJob.id,{headers:{Authorization:'Bearer '+otherSource.token}});
  assert.ok(unavailable(foreignJob.status));
  const ownJob=await ok(owner,'/api/automation/job/'+firstJob.id);
  assert.equal(ownJob.job.id,firstJob.id); assert.ok(ownJob.events.length);
  assert.ok(unavailable((await second.call('/api/automation/job/'+firstJob.id)).status));
  assert.ok(unavailable((await second.call('/api/automation/source/'+firstSource.id+'/settings',{method:'POST',data:{interval:0,autopublish:false}})).status));
  assert.ok(unavailable((await push(firstSource,[vehicle('NEW-ILLEGAL')],otherSource.token)).status));
  assert.ok(unavailable((await second.call('/api/listings/'+a.listing_id+'/edit')).status));
  assert.equal(item(firstSource.id,'NEW-ILLEGAL'),undefined);
  assert.ok(unavailable((await owner.call('/api/automation/admin/policy',{method:'POST',data:{...standardPolicy,paused:1}})).status));
});

test('a feed update cannot republish a car held by a moderator',async()=>{
  const source=await addSource(owner,'Moderated updates');
  await pushAndWait(source,[vehicle('MANUAL-HOLD')]);
  const listing=item(source.id,'MANUAL-HOLD');
  const revision=one('SELECT revision FROM listings WHERE id=?',listing.listing_id).revision;
  await ok(admin,'/api/moderation/'+listing.listing_id,{method:'POST',data:{action:'held',reason:'Kontrola oferty przez moderatora.',revision}});
  await pushAndWait(source,[vehicle('MANUAL-HOLD',{price:72200})]);
  const record=one('SELECT status,price,rejection FROM listings WHERE id=?',listing.listing_id);
  assert.equal(record.status,'held'); assert.equal(record.price,6840000); assert.match(record.rejection,/moderator/);
  assert.ok(!(await ok(anon,'/api/search?make=Toyota')).offers.some(offer=>offer.id===listing.listing_id));
});

test('global import, publication, suspension and pause controls preserve public listings',async()=>{
  const source=await addSource(second,'Administrative switches');
  const sharedVin='WVWZZZ1KZBW000001';
  await pushAndWait(source,[vehicle('BEFORE-PAUSE',{vin:sharedVin}),vehicle('SAME-VIN',{vin:sharedVin})]);
  const initial=item(source.id,'BEFORE-PAUSE');
  assert.equal(initial.listing_status,'published');
  const moderated=item(source.id,'SAME-VIN');
  assert.equal(moderated.listing_status,'pending');
  const approval={action:'published',revision:one('SELECT revision FROM listings WHERE id=?',moderated.listing_id).revision};
  try {
    for (const change of [{imports:0},{paused:1}]) {
      await configure(change);
      const old=one('SELECT COUNT(*) n FROM auto_jobs WHERE source_id=?',source.id).n;
      const blocked=await push(source,[vehicle('SHOULD-STAY-ABSENT')]);
      assert.ok(unavailable(blocked.status),'Expected refusal while globally disabled, got '+blocked.status);
      assert.equal(one('SELECT COUNT(*) n FROM auto_jobs WHERE source_id=?',source.id).n,old);
      assert.equal(item(source.id,'BEFORE-PAUSE').listing_status,'published');
      if(change.paused){
        const gate=await admin.call('/api/moderation/'+moderated.listing_id,{method:'POST',data:approval});
        assert.equal(gate.status,409,'Master pause must interrupt moderator publication');
        assert.equal(item(source.id,'SAME-VIN').listing_status,'pending');
      }
    }
    await configure({publish:0});
    await pushAndWait(source,[vehicle('DRAFT-ONLY')]);
    assert.equal(item(source.id,'DRAFT-ONLY').listing_status,'draft');
    await configure();
    await ok(admin,'/api/moderation/'+moderated.listing_id,{method:'POST',data:approval});
    await pushAndWait(source,[vehicle('DRAFT-ONLY')]);
    assert.equal(item(source.id,'DRAFT-ONLY').listing_status,'published');
    await ok(admin,'/api/automation/admin/suspend',{method:'POST',data:{owner_id:initial.user_id,enabled:0}});
    assert.ok(unavailable((await push(source,[vehicle('SUSPENDED')])).status));
    assert.ok(unavailable((await second.call('/api/automation/sources',{method:'POST',
      data:{name:'New while suspended',kind:'push',autopublish:true,rights:true}})).status));
    assert.equal(item(source.id,'BEFORE-PAUSE').listing_status,'published');
  } finally {
    await configure();
    await ok(admin,'/api/automation/admin/suspend',{method:'POST',data:{owner_id:initial.user_id,enabled:1}});
  }
});

test('only authorized dispatchers can wake the global queue over HTTP',async()=>{
  const post={method:'POST'};
  assert.equal((await session().call('/api/automation/tick',post)).status,403);
  assert.equal((await second.call('/api/automation/tick',post)).status,403);
  const response=await ok(admin,'/api/automation/tick',post);
  assert.equal(typeof response.backlog,'boolean');
  assert.ok(response.checkedAt);
});

test('server timer fetches authenticated feeds without a client; missing records are flagged and photos never receive the feed token',async()=>{
  const path='/timer', fixtureToken='read-inventory-fixture';
  feeds.set(path,[vehicle('TIMER-1',{price:34500}),vehicle('TIMER-2')]);
  const source=await addSource(owner,'Unattended catalog',{kind:'feed',interval:1,url:sourceOrigin+path,format:'json',token:fixtureToken});
  const due=()=>{
    write("UPDATE auto_sources SET next_at='2001-01-01T00:00:00.000Z' WHERE id=?",source.id);
    write("UPDATE auto_clock SET next_at='2001-01-01T00:00:00.000Z'");
  };
  due();
  // All waiting after the test backdates a due timestamp observes local DB state only.
  await until(()=>item(source.id,'TIMER-2')?.listing_status==='published','Timer never imported the first snapshot',14000);
  const original=item(source.id,'TIMER-2');
  const requests=outbound.filter(call=>call.host==='inventory.example.com' && call.path===path);
  assert.ok(requests.length); assert.equal(requests[0].auth,'Bearer '+fixtureToken);
  assert.ok(outbound.filter(call=>call.host==='images.example.com').every(call=>call.auth===undefined));
  assert.ok(!one('SELECT credential FROM auto_sources WHERE id=?',source.id).credential.includes(fixtureToken));
  await until(()=>!one("SELECT id FROM auto_jobs WHERE source_id=? AND state IN ('queued','running')",source.id),'Initial snapshot job did not finish');
  feeds.set(path,{failureStatus:503});
  const completedBefore=one('SELECT COUNT(*) AS n FROM auto_jobs WHERE source_id=? AND finished_at IS NOT NULL',source.id).n;
  due();
  await until(()=>one('SELECT COUNT(*) AS n FROM auto_jobs WHERE source_id=? AND finished_at IS NOT NULL',source.id).n>completedBefore,
    'Failed remote HTTP response was not recorded by the timer',14000);
  assert.equal(item(source.id,'TIMER-2').missing,0);
  assert.equal(item(source.id,'TIMER-2').listing_status,'published');
  feeds.set(path,[vehicle('TIMER-1',{price:30000})]);
  const attemptsBeforePause=outbound.filter(call=>call.host==='inventory.example.com' && call.path===path).length;
  await configure({sync:0}); due();
  await sleep(1100);
  assert.equal(outbound.filter(call=>call.host==='inventory.example.com' && call.path===path).length,attemptsBeforePause);
  assert.equal(item(source.id,'TIMER-2').missing,0);
  await configure(); due();
  await until(()=>item(source.id,'TIMER-2')?.missing===1,'Disappeared offer was not flagged for review',14000);
  assert.equal(item(source.id,'TIMER-1').price,3000000);
  assert.equal(item(source.id,'TIMER-2').listing_id,original.listing_id);
  assert.ok(one('SELECT id FROM listings WHERE id=?',original.listing_id));
  assert.equal(one('SELECT COUNT(*) n FROM auto_items WHERE source_id=?',source.id).n,2);
});

test('delivery needs configured opt-in, records receiver acceptance or refusal, and sends only that owner’s revisions',async()=>{
  const publisher=await register('import-publisher');
  const source=await addSource(publisher,'Distribution test'), foreign=await addSource(second,'No distribution');
  const config={channel:'fixture-dealer',token:'publisher-fixture',enabled:true,rights:true};
  const count=()=>outbound.filter(call=>call.host==='publish.example.com').length;
  assert.ok(unavailable((await publisher.call('/api/automation/channels',{method:'POST',data:{...config,channel:'undocumented-website'}})).status));
  await pushAndWait(source,[vehicle('PUBLISH-1')]);
  assert.equal(count(),0);
  await ok(publisher,'/api/automation/channels',{method:'POST',data:config});
  const ownedId=item(source.id,'PUBLISH-1').listing_id;
  receipt={status:'accepted',reference:'QA-acknowledged'};
  await pushAndWait(source,[vehicle('PUBLISH-1',{price:58000})]);
  const acceptedRevision=one('SELECT revision FROM listings WHERE id=?',ownedId).revision;
  await until(()=>one("SELECT id FROM auto_deliveries WHERE listing_id=? AND revision=? AND state='accepted'",ownedId,acceptedRevision),'Missing receiver acceptance',14000);
  await pushAndWait(foreign,[vehicle('PRIVATE-FOREIGN')]);
  const foreignId=item(foreign.id,'PRIVATE-FOREIGN').listing_id;
  receipt={status:'rejected',reference:'QA-declined'};
  await pushAndWait(source,[vehicle('PUBLISH-1',{price:59000})]);
  const rejectedRevision=one('SELECT revision FROM listings WHERE id=?',ownedId).revision;
  await until(()=>one("SELECT id FROM auto_deliveries WHERE listing_id=? AND revision=? AND state='rejected'",ownedId,rejectedRevision),'Receiver refusal did not reach local status',14000);
  const calls=outbound.filter(call=>call.host==='publish.example.com');
  assert.ok(calls.length>=2 && calls.every(call=>call.method==='POST' && call.auth==='Bearer '+config.token && call.idempotency));
  assert.ok(calls.some(call=>call.body.includes(ownedId)) && calls.every(call=>!call.body.includes(foreignId)));
  assert.equal(one('SELECT COUNT(*) n FROM auto_deliveries WHERE listing_id=?',foreignId).n,0);
  const notices=all("SELECT data FROM notifications WHERE user_id=? AND kind='import_distribution'",item(source.id,'PUBLISH-1').user_id);
  assert.ok(notices.some(notice=>JSON.parse(notice.data).listingId===ownedId));
  await ok(publisher,'/api/automation/channels',{method:'POST',data:{...config,enabled:false}});
  const stopped=count();
  await pushAndWait(source,[vehicle('PUBLISH-1',{price:57000})]);
  await sleep(650); assert.equal(count(),stopped);
});

test('a scheduled sync replaces the cover when bytes change at the same URL; identical bytes preserve the ID and revision',async()=>{
  const feedPath='/mutable-photo', imagePath='/same-address.webp', externalId='SAME-PHOTO-URL';
  const original=await readFile(join(root,'public/assets/vehicle-1.webp'));
  const replacement=await readFile(join(root,'public/assets/vehicle-2.webp'));
  const oldDigest=await digest(cleanImage(original).bytes), newDigest=await digest(cleanImage(replacement).bytes);
  assert.notEqual(oldDigest,newDigest);
  mutableImages.set(imagePath,original);
  feeds.set(feedPath,[vehicle(externalId,{photo_urls:[photoOrigin+imagePath]})]);
  const source=await addSource(owner,'Changing cover fixture',{kind:'feed',url:sourceOrigin+feedPath,format:'json',interval:1});
  const latest=()=>one("SELECT * FROM auto_jobs WHERE source_id=? AND kind='sync' AND finished_at IS NOT NULL ORDER BY created_at DESC LIMIT 1",source.id);
  const first=await until(latest,'The timer did not import the original cover');
  const listing=item(source.id,externalId);
  assert.equal(listing.listing_status,'published');
  const state=()=>one('SELECT revision,photo_ids FROM listings WHERE id=?',listing.listing_id);
  async function publicCover(expected){
    const {offers}=await ok(anon,'/api/compare?keys='+listing.listing_id);
    assert.equal(offers.length,1); assert.equal(offers[0].photos.length,1);
    assert.equal(offers[0].cover,offers[0].photos[0].thumb);
    const response=await fetch(base+offers[0].cover);
    assert.equal(response.status,200);
    assert.equal(await digest(new Uint8Array(await response.arrayBuffer())),expected);
    return offers[0].cover;
  }
  async function reschedule(previous){
    write("UPDATE auto_sources SET next_at='2001-01-01T00:00:00.000Z' WHERE id=?",source.id);
    return until(()=>{const current=latest();return current && current.id!==previous.id && current;},'The next unattended snapshot did not finish');
  }
  const before=state(), oldUrl=await publicCover(oldDigest);
  mutableImages.set(imagePath,replacement);
  const secondJob=await reschedule(first);
  const updated=state(), newUrl=await publicCover(newDigest);
  assert.notEqual(newUrl,oldUrl); assert.equal(updated.revision,before.revision+1);
  assert.equal(item(source.id,externalId).listing_id,listing.listing_id);
  const count=()=>one('SELECT COUNT(*) AS n FROM photos WHERE listing_id=?',listing.listing_id).n;
  const stored=count();
  const third=await reschedule(secondJob);
  assert.deepEqual(state(),updated); assert.equal(count(),stored);
  assert.equal(await publicCover(newDigest),newUrl);
  assert.equal(one('SELECT result FROM auto_events WHERE job_id=? AND external_id=?',third.id,externalId).result,'unchanged');
  assert.equal(one('SELECT COUNT(*) AS n FROM auto_items WHERE source_id=?',source.id).n,1);
  assert.equal(outbound.filter(call=>call.host==='images.example.com' && call.path===imagePath).length,3);
});

async function workerFixture(t,frames) {
  const sqlite=new DatabaseSync(':memory:');
  t.after(()=>sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  const migrations=(await readdir(join(root,'drizzle'))).filter(name=>name.endsWith('.sql')).sort();
  for(const name of migrations)sqlite.exec(await readFile(join(root,'drizzle',name),'utf8'));
  const user={id:'worker-test-owner',role:'user',scope:'live',lang:'pl',verified_at:new Date().toISOString()};
  sqlite.prepare('INSERT INTO users(id,scope,email,name,role,profile_type,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(user.id,'live','worker-media@example.test','Kontrolna galeria','user','private',user.verified_at,user.verified_at);
  const statement=(sql,values=[])=>({
    bind:(...bound)=>statement(sql,bound),
    first:async()=>sqlite.prepare(sql).get(...values)??null,
    all:async()=>({results:sqlite.prepare(sql).all(...values)}),
    run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}})
  });
  const db={prepare:statement,async batch(statements){
    sqlite.exec('BEGIN IMMEDIATE');
    try{const results=[];for(const query of statements)results.push(await query.run());sqlite.exec('COMMIT');return results;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  const objects=new Map(),calls=[];
  const env={DB:db,BUCKET:{
    async put(key,body,{httpMetadata}){objects.set(key,{bytes:await new Response(body).arrayBuffer(),httpMetadata});},
    async get(key){const value=objects.get(key);return value?{body:new Response(value.bytes).body,httpMetadata:value.httpMetadata}:null;},
    async delete(key){objects.delete(key);}
  }};
  const origin='https://brumbrum.example.com';
  function context(req=new Request(origin)) {
    const url=new URL(req.url);
    return {req,env,db,url,origin,scope:'live',demo:false,prefix:'',path:url.pathname,lang:'pl',user,t:translator('pl'),ip:'local-fixture',
      async transport(_ctx,destination,{purpose}){
        assert.equal(purpose,'photo');assert.ok(frames.has(destination));calls.push(destination);
        return {bytes:frames.get(destination),contentType:'image/webp',status:200};
      }};
  }
  async function post(parts,data,headers={}){
    const req=new Request(origin+'/api/automation/'+parts.join('/'),{method:'POST',
      headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
    const response=await automationApi(context(req),parts);
    assert.ok(response.ok); return response.json();
  }
  return {env,context,calls,post,origin,row:(sql,...values)=>sqlite.prepare(sql).get(...values)};
}

test('fresh Worker contexts resume one seven-image gallery in slices of 3, 3 and 1 and publish all seven readable original frames',async t=>{
  const urls=Array.from({length:7},(_,i)=>photoOrigin+'/gallery/'+(i+1)+'.webp');
  const frames=new Map(await Promise.all(urls.map(async(url,i)=>[url,await readFile(join(root,'public/assets/vehicle-'+(i+1)+'.webp'))])));
  const hashes=await Promise.all([...frames.values()].map(bytes=>digest(cleanImage(bytes).bytes)));
  assert.equal(new Set(hashes).size,7);
  const f=await workerFixture(t,frames);
  const source=await f.post(['sources'],{name:'Worker gallery',kind:'push',rights:true,autopublish:true});
  const {jobId}=await f.post(['push',source.id],{offers:[vehicle('SEVEN-FRAMES',{photo_urls:urls})]},{Authorization:'Bearer '+source.token});
  const job=()=>f.row('SELECT * FROM auto_jobs WHERE id=?',jobId);
  const checkpoints=()=>f.row('SELECT COUNT(*) AS n FROM auto_photo_steps WHERE job_id=?',jobId).n;
  for(const processed of [3,6]){
    await automationTick(f.context(),{force:true,sourceId:source.id});
    assert.equal(job().cursor,0);assert.equal(job().finished_at,null);
    assert.equal(checkpoints(),processed);assert.deepEqual(f.calls,urls.slice(0,processed));
    assert.equal(f.row("SELECT COUNT(*) AS n FROM listings WHERE status='published'").n,0);
  }
  await automationTick(f.context(),{force:true,sourceId:source.id});
  assert.equal(job().state,'done');assert.equal(job().cursor,1);assert.equal(job().errors,0);assert.equal(checkpoints(),0);
  assert.deepEqual(f.calls,urls);
  const car=f.row("SELECT id,slug,revision,photo_ids FROM listings WHERE status='published'");
  assert.ok(car);assert.equal(car.revision,1);
  const ids=JSON.parse(car.photo_ids);
  assert.equal(ids.length,7);assert.equal(new Set(ids).size,7);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM photos WHERE listing_id=?',car.id).n,7);
  const page=await handler(new Request(f.origin+'/oferta/'+car.slug),f.env);
  assert.equal(page.status,200);const html=await page.text();
  const thumbnailButtons=[...html.matchAll(/<button\b[^>]*\bdata-thumb="(\d+)"[^>]*>\s*<img src="([^"]+)"/g)]
    .map(match=>({index:Number(match[1]),src:match[2]}));
  assert.deepEqual(thumbnailButtons,ids.map((id,index)=>({index,src:'/media/'+id+'/thumb'})));
  const compare=await handler(new Request(f.origin+'/api/compare?keys='+car.id),f.env);
  assert.equal(compare.status,200);const {offers}=await compare.json();
  assert.equal(offers.length,1);assert.deepEqual(offers[0].photos.map(frame=>frame.key),ids);
  assert.equal(offers[0].cover,offers[0].photos[0].thumb);
  for(const [i,frame] of offers[0].photos.entries()){
    assert.ok(html.includes(frame.url),'Missing image in the public listing: '+frame.key);
    const image=await handler(new Request(f.origin+frame.url),f.env);
    assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');
    assert.equal(await digest(new Uint8Array(await image.arrayBuffer())),hashes[i]);
  }
});
