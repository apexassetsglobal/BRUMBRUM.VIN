import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AppError } from '../src/core.js';
import { createImportTransport, normalizeImportUrl, openIntegrationSecret, sealIntegrationSecret } from '../src/import-transport.js';
import { choosePublicAddress, publicAddress } from '../src/import-transport-network.js';

const ctx = {env:{runtime:'node'},origin:'https://brumbrum.vin'};
const source = 'https://feed.example.com/inventory';
const api = 'https://publisher.example.com/v1/listings';
const status = code => error => error instanceof AppError && error.status === code;
const asText = bytes => new TextDecoder().decode(bytes);

test('only canonical public HTTPS destinations on port 443 are accepted', () => {
  assert.equal(normalizeImportUrl('https://FEED.example.com.:443/a?version=2'),'https://feed.example.com/a?version=2');
  assert.equal(normalizeImportUrl('https://8.8.8.8/a'),'https://8.8.8.8/a');
  assert.equal(normalizeImportUrl('https://[2606:4700:4700::1111]/'),'https://[2606:4700:4700::1111]/');
  for (const value of [
    'http://feed.example.com','https://feed.example.com:8443','https://feed.example.com/a#',
    'https://user:pass@feed.example.com','https://@feed.example.com','https://feed.example.com\\other',
    'https://feed.example.com/\na','https://localhost','https://share.local','https://metadata.google.internal',
    'https://127.1','https://2130706433','https://[::ffff:127.0.0.1]','https://100.64.5.8',
    'https://169.254.169.254','https://168.63.129.16','https://[fd00::1]','https://[2001:db8::1]','ftp://test.example.com'
  ]) assert.throws(() => normalizeImportUrl(value),status(422));
});

test('public address selection rejects a mixed or reserved DNS reply', () => {
  for (const ip of ['10.0.0.1','172.31.1.1','192.168.1.1','224.0.0.7','0.0.0.0','198.18.1.2','192.0.2.10',
    '198.51.100.2','203.0.113.2','::1','::','ff02::1','64:ff9b::808:808','2002::1','3fff:c::1','::ffff:8.8.8.8',
    '2606:4700::1%net','foo','8.8.8.999']) {
    assert.equal(publicAddress(ip),false,ip);
    assert.throws(() => choosePublicAddress(['8.8.8.8',ip]),status(422),ip);
  }
  assert.equal(choosePublicAddress(['2606:4700:4700::1111','8.8.8.8']),'8.8.8.8');
  assert.throws(() => choosePublicAddress([]),status(502));
});

test('a pinned request never looks up the name again in the application path', async () => {
  let calls = 0, lookups = 0;
  const transport = createImportTransport({
    lookup:async () => ++lookups === 1 ? ['8.8.8.8'] : ['127.0.0.1'],
    requestPinned:async (url,address,request) => {
      calls++;
      assert.equal(url.href,source); assert.equal(address,'8.8.8.8'); assert.equal(request.method,'GET');
      assert.equal(request.headers.get('Cookie'),null); assert.equal(request.headers.get('Authorization'),'Bearer sample-token');
      return new Response('{"cars":[]}',{headers:{'Content-Type':'application/json; charset=UTF-8'}});
    }
  });
  const result = await transport(ctx,source,{token:'sample-token',tokenOrigin:new URL(source).origin});
  assert.equal(asText(result.bytes),'{"cars":[]}'); assert.equal(result.contentType,'application/json');
  assert.equal(result.status,200);
  await assert.rejects(transport(ctx,source),status(422));
  assert.equal(calls,1); assert.equal(lookups,2);
});

test('redirects, including same-origin ones, do not transfer a token or trigger another request', async () => {
  let calls = 0;
  const transport = createImportTransport({lookup:async()=>['8.8.8.8'],requestPinned:async () => {
    calls++; return Response.redirect('https://relay.example.com/end',307);
  }});
  await assert.rejects(transport(ctx,source,{token:'s',tokenOrigin:new URL(source).origin}),status(422));
  await assert.rejects(transport(ctx,source,{token:'s',tokenOrigin:'https://different.example.com'}),status(422));
  await assert.rejects(transport(ctx,ctx.origin+'/api/private'),status(422));
  assert.equal(calls,1);
});

test('only a configured exact distribution URL accepts a JSON POST; errors contain only the upstream status', async () => {
  const captured = [];
  let remote = 202;
  const transport = createImportTransport({lookup:async()=>['8.8.8.8'],requestPinned:async (url,address,req) => {
    captured.push({url:url.href,req}); return new Response('private upstream echo',{status:remote});
  }});
  const config = {purpose:'distribution',officialEndpoint:api,token:'sample-token',tokenOrigin:new URL(api).origin,json:{id:'my-car'},idempotencyKey:'account.job-1'};
  assert.equal((await transport(ctx,api,config)).status,202);
  assert.equal(captured[0].req.method,'POST');
  assert.deepEqual(JSON.parse(captured[0].req.body),config.json);
  assert.equal(captured[0].req.headers.get('Idempotency-Key'),'account.job-1');
  for (const alt of [api+'/other',api+'?channel=other',source]) await assert.rejects(transport(ctx,alt,config),status(422));
  await assert.rejects(transport(ctx,api,{...config,officialEndpoint:undefined}),status(422));
  await assert.rejects(transport(ctx,api,{...config,purpose:'photo'}),status(422));
  assert.equal(captured.length,1);
  remote = 403;
  await assert.rejects(transport(ctx,api,config),error => status(502)(error) && error.details.remoteStatus === 403 &&
    !String(error).includes('sample-token') && !String(error).includes('private upstream'));
});

test('declared, chunked and compressed responses are bounded; partial feeds are refused', async () => {
  let reply;
  const transport = createImportTransport({lookup:async()=>['8.8.8.8'],requestPinned:async()=>reply()});
  reply = () => new Response('a',{headers:{'Content-Length':'99999'}});
  await assert.rejects(transport(ctx,source,{maxBytes:50}),status(413));
  let cancelled = false;
  reply = () => new Response(new ReadableStream({pull(writer){writer.enqueue(new Uint8Array(30));},cancel(){cancelled=true;}}));
  await assert.rejects(transport(ctx,source,{maxBytes:50}),status(413)); assert.equal(cancelled,true);
  reply = () => new Response(gzipSync('x'.repeat(1000)),{headers:{'Content-Encoding':'gzip'}});
  await assert.rejects(transport(ctx,source,{maxBytes:100}),status(413));
  reply = () => new Response(gzipSync('sample'),{headers:{'Content-Encoding':'gzip'}});
  assert.equal(asText((await transport(ctx,source)).bytes),'sample');
  reply = () => new Response('part',{status:206});
  await assert.rejects(transport(ctx,source),status(502));
  await assert.rejects(transport(ctx,source,{maxBytes:1024**3}),status(422));
});

test('deadline covers slow DNS as well as a response stalled after its headers', async () => {
  const timeout = {timeoutMs:25};
  let fetched = false;
  const dns = createImportTransport({...timeout,lookup:async()=>new Promise(()=>{}),requestPinned:async()=>{fetched=true;}});
  await assert.rejects(dns(ctx,source),status(504)); assert.equal(fetched,false);
  let aborted = false;
  const body = createImportTransport({...timeout,lookup:async()=>['8.8.8.8'],requestPinned:async (url,ip,req) =>
    new Response(new ReadableStream({start(writer){
      writer.enqueue(new Uint8Array([42]));
      req.signal.addEventListener('abort',()=>{aborted=true; writer.error(req.signal.reason);},{once:true});
    }}))});
  await assert.rejects(body(ctx,source),status(504)); assert.equal(aborted,true);
});

test('Worker uses public egress only, validates A+AAAA, omits credentials on DNS, and keeps original-origin scope', async () => {
  const edge = {env:{IMPORT_PUBLIC_EGRESS:'cloudflare-public'},origin:ctx.origin};
  const dnsRequests = [], targetRequests = [];
  let blocked = false;
  const fetcher = async (raw,init) => {
    const url = new URL(raw);
    if (url.hostname === 'cloudflare-dns.com') {
      dnsRequests.push(init);
      assert.equal(new Headers(init.headers).has('Authorization'),false);
      assert.equal(init.redirect,'manual'); assert.equal(init.credentials,'omit');
      const a = url.searchParams.get('type') === 'A';
      return Response.json({Status:0,Answer:a ? [{type:1,data:'8.8.8.8'}] : [{type:28,data:blocked ? '::1' : '2606:4700:4700::1111'}]});
    }
    targetRequests.push(init); return new Response('photo');
  };
  const transport = createImportTransport({isCloudflare:()=>true,fetcher});
  await assert.rejects(transport({env:{},origin:ctx.origin},source),status(503));
  await assert.rejects(createImportTransport({isCloudflare:()=>false,fetcher})(edge,source),status(503));
  assert.equal(dnsRequests.length,0);
  const result = await transport(edge,source,{purpose:'photo',token:'auth',tokenOrigin:new URL(source).origin});
  assert.equal(asText(result.bytes),'photo');
  assert.equal(targetRequests[0].headers.get('Authorization'),'Bearer auth');
  assert.equal(targetRequests[0].credentials,'omit'); assert.equal(targetRequests[0].redirect,'manual');
  await transport(edge,source+'?frame=2');
  assert.equal(dnsRequests.length,2);
  blocked = true;
  await assert.rejects(transport({...edge},source),status(422));
  assert.equal(targetRequests.length,2);
});

test('secrets use random authenticated ciphertext bound to the owner, source and configured key', async () => {
  const env = {IMPORT_SECRET_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')};
  const token = 'example-credential';
  const first = await sealIntegrationSecret(env,'user-a','source-a',token);
  const second = await sealIntegrationSecret(env,'user-a','source-a',token);
  assert.notEqual(first,second); assert.ok(!first.includes(token));
  assert.equal(await openIntegrationSecret(env,'user-a','source-a',first),token);
  const [version,iv,ciphertext] = first.split('.');
  const tampered = [version,iv,(ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)].join('.');
  for (const [owner,sourceId,value] of [['user-b','source-a',first],['user-a','source-b',first],['user-a','source-a',tampered]]) {
    await assert.rejects(openIntegrationSecret(env,owner,sourceId,value),status(409));
  }
  const wrong = {IMPORT_SECRET_KEY:Buffer.alloc(32,17).toString('base64url')};
  await assert.rejects(openIntegrationSecret(wrong,'user-a','source-a',first),status(409));
  await assert.rejects(sealIntegrationSecret({},'user','source',token),status(503));
  assert.equal(await sealIntegrationSecret({},'user','source',''),'');
  assert.equal(await openIntegrationSecret({},'user','source',null),'');
});

test('Node HTTPS preserves Host, SNI and certificate checks with a pinned numeric destination', async t => {
  const dir = await mkdtemp(join(process.cwd(),'var-test-import-tls-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=feed.example.com',
    '-addext','subjectAltName=DNS:feed.example.com','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem')],{stdio:'ignore'});
  const [key,cert] = await Promise.all([readFile(join(dir,'key.pem')),readFile(join(dir,'cert.pem'))]);
  const observations = [];
  const server = https.createServer({key,cert},(req,res) => {
    observations.push({host:req.headers.host,sni:req.socket.servername,auth:req.headers.authorization});
    res.setHeader('Content-Type','text/csv'); res.end('external_id,make\nA,Ford');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(() => new Promise(resolve=>{server.close(resolve); server.closeAllConnections();}));
  const original = https.request;
  // Only this test process redirects the physical socket onto the controlled local TLS fixture.
  // Certificate verification, SNI, Host headers, request streaming and HTTP parsing stay enabled.
  t.mock.method(https,'request',(options,callback) => {
    assert.equal(options.hostname,'8.8.8.8'); assert.equal(options.port,443); assert.equal(options.rejectUnauthorized,true);
    return original({...options,hostname:'127.0.0.1',port:server.address().port,ca:cert},callback);
  });
  const transport = createImportTransport({lookup:async()=>['8.8.8.8']});
  const result = await transport(ctx,source,{token:'fixture',tokenOrigin:new URL(source).origin});
  assert.equal(result.contentType,'text/csv'); assert.match(asText(result.bytes),/A,Ford/);
  assert.deepEqual(observations,[{host:'feed.example.com',sni:'feed.example.com',auth:'Bearer fixture'}]);
  await assert.rejects(transport(ctx,'https://different.example.com/inventory'),status(502));
  assert.equal(observations.length,1);
});
