import { AppError, fail } from './core.js';

const denyHost = () => fail(422, 'Wybierz publiczny adres HTTPS źródła.', 'Choose a public HTTPS source URL.');
const networkError = () => fail(502, 'Nie udało się połączyć z serwerem źródłowym.', 'The source server could not be reached.');
const tooLarge = () => fail(413, 'Odpowiedź źródła przekracza limit rozmiaru.', 'The source response exceeds the size limit.');
const timedOut = () => new AppError(504, 'Upłynął czas na pobranie danych.', 'The source request timed out.');
const neverPublic = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home', '.arpa', '.onion', '.test', '.invalid', '.example'];
const localPortals = new Set(['metadata.google.internal','metadata.azure.internal','metadata.goog','instance-data.ec2.internal','kubernetes.default.svc']);

export function publicAddress(address) {
  if (typeof address !== 'string') return false;
  if (address.includes(':')) {
    if (!/^[a-f\d:]+$/i.test(address)) return false;
    let normalized;
    try { normalized = new URL('https://[' + address + ']/').hostname.slice(1,-1); } catch { return false; }
    const [first, second = '', third = ''] = normalized.split(':');
    const a = parseInt(first,16), b = parseInt(second || '0',16), c = parseInt(third || '0',16);
    // Global unicast only, excluding special protocol, transition and documentation allocations.
    return (a & 0xe000) === 0x2000 && !(a === 0x2001 && (b < 0x200 || b === 0xdb8)) &&
      a !== 0x2002 && !(a === 0x2620 && b === 0x4f && c === 0x8000) &&
      !(a === 0x3fff && b < 0x1000);
  }
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(address)) return false;
  const [a,b,c,d] = address.split('.').map(Number);
  if (Math.max(a,b,c,d) > 255) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 192 && (b === 168 || ((b === 0 && (c === 0 || c === 2)) || (b === 31 && c === 196) ||
      (b === 52 && c === 193) || (b === 88 && c === 99) || (b === 175 && c === 48)))) ||
    (a === 203 && b === 0 && c === 113) || address === '168.63.129.16');
}

export function normalizeImportUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || !/^https:\/\//i.test(raw) || /[\x00-\x20\x7f\\#]/.test(raw)) denyHost();
  let url;
  try { url = new URL(raw); } catch { denyHost(); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || raw.slice(8).split(/[/?]/,1)[0].includes('@')) denyHost();
  const host = url.hostname.replace(/\.$/, '');
  if (host.startsWith('[') || /^\d+(?:\.\d+)*$/.test(host)) {
    if (!publicAddress(host.replace(/^\[|\]$/g,''))) denyHost();
  } else if (host.length > 253 || !host.includes('.') || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    neverPublic.some(suffix => host.endsWith(suffix)) || localPortals.has(host)) denyHost();
  url.hostname = host;
  return url.href;
}

// Covers DNS, TLS negotiation and the complete transfer, including a stalled last chunk.
export async function withDeadline(milliseconds, action) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { const error = timedOut(); controller.abort(error); reject(error); }, milliseconds);
  });
  try { return await Promise.race([action(controller.signal),deadline]); }
  finally { clearTimeout(timer); controller.abort(); }
}

function limitStream(max) {
  let bytes = 0;
  return new TransformStream({
    transform(chunk, writer) {
      bytes += chunk.byteLength;
      if (bytes > max) tooLarge();
      writer.enqueue(chunk);
    }
  });
}

export async function boundedBytes(response, max, encoded = false) {
  const rawLength = response.headers.get('content-length');
  const stream = response.body;
  let reader;
  try {
    if (rawLength !== null && (!/^\d+$/.test(rawLength) || Number(rawLength) > max)) tooLarge();
    if (!stream) return new Uint8Array();
    const coding = (response.headers.get('content-encoding') || 'identity').toLowerCase().trim();
    let body = stream;
    if (encoded && coding !== 'identity') {
      const algorithm = {gzip:'gzip', deflate:'deflate', br:'brotli'}[coding];
      if (!algorithm) networkError();
      body = body.pipeThrough(limitStream(max)).pipeThrough(new DecompressionStream(algorithm));
    }
    reader = body.getReader();
    let bytes = 0;
    const chunks = [];
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      bytes += value.byteLength;
      if (bytes > max) tooLarge();
      chunks.push(value);
    }
    const result = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (error) {
    if (reader) void reader.cancel().catch(() => {});
    else if (stream && !stream.locked) void stream.cancel().catch(() => {});
    throw error;
  } finally { reader?.releaseLock(); }
}

const runtimeModule = name => import(name);
export async function nodeLookup(host) {
  const {lookup} = await runtimeModule('node:dns/promises');
  return (await lookup(host,{all:true,verbatim:true})).map(item => item.address);
}

export async function nodeRequest(url, address, request) {
  if (!publicAddress(address)) denyHost();
  const [{default:https}, {Readable}] = await Promise.all([runtimeModule('node:https'),runtimeModule('node:stream')]);
  const name = url.hostname.replace(/^\[|\]$/g,'');
  return await new Promise((resolve,reject) => {
    // Numeric hostname pins the connection. HTTP Host and TLS verification retain the original identity.
    const call = https.request({
      protocol:'https:', hostname:address, port:443, path:url.pathname + url.search,
      servername:publicAddress(name) ? '' : name, rejectUnauthorized:true, minVersion:'TLSv1.2',
      agent:false, autoSelectFamily:false, method:request.method, signal:request.signal, maxHeaderSize:16384,
      headers:{...Object.fromEntries(request.headers), host:url.host, 'accept-encoding':'identity'}
    }, incoming => {
      const headers = new Headers();
      for (const key of ['content-type','content-encoding','content-length']) {
        if (typeof incoming.headers[key] === 'string') headers.set(key,incoming.headers[key]);
      }
      const status = incoming.statusCode;
      if (status < 200 || status > 599) { incoming.destroy(); reject(new Error('Invalid HTTP status')); return; }
      const noBody = [204,205,304].includes(status);
      if (noBody) incoming.resume();
      resolve(new Response(noBody ? null : Readable.toWeb(incoming),{headers,status}));
    });
    call.once('error',reject);
    call.end(request.body);
  });
}

export async function workerLookup(host, signal, fetcher) {
  // This preflight rejects mixed public/private records. The Worker public network enforces the
  // connection-time restriction independently; a DNS preflight by itself cannot prevent rebinding.
  const addresses = await Promise.all(['A','AAAA'].map(async type => {
    const resolver = new URL('https://cloudflare-dns.com/dns-query');
    resolver.search = new URLSearchParams({name:host,type}).toString();
    const response = await fetcher(resolver.href,{headers:{Accept:'application/dns-json'},redirect:'manual',signal,cache:'no-store',credentials:'omit'});
    if (!response.ok) { void response.body?.cancel().catch(() => {}); networkError(); }
    const packet = JSON.parse(new TextDecoder().decode(await boundedBytes(response,32768)));
    if (packet.Status !== 0 || packet.TC) networkError();
    return (packet.Answer ?? []).filter(item => item.type === 1 || item.type === 28).map(item => item.data);
  }));
  return addresses.flat();
}

export function choosePublicAddress(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > 128) networkError();
  if (addresses.some(address => !publicAddress(address))) denyHost();
  // Prefer IPv4 on Node deployments that publish AAAA records but have no outgoing IPv6 route.
  return addresses.find(address => !address.includes(':')) || addresses[0];
}
