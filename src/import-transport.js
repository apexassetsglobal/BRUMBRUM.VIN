import { AppError, encoder, fail } from './core.js';
import {
  boundedBytes, choosePublicAddress, nodeLookup, nodeRequest, normalizeImportUrl,
  publicAddress, withDeadline, workerLookup
} from './import-transport-network.js';

export { normalizeImportUrl };

const limits = {feed:8*1024*1024, photo:12*1024*1024, distribution:64*1024};
const invalidOptions = () => fail(422, 'Nieprawidłowe ustawienia połączenia.', 'Invalid connection settings.');
const noEgress = () => fail(503, 'Ten serwer nie ma skonfigurowanego bezpiecznego dostępu do źródeł zewnętrznych.', 'Secure external source access is not configured on this server.');
const unsupportedKey = () => fail(503, 'Klucz szyfrowania integracji wymaga konfiguracji.', 'The integration encryption key requires configuration.');
const unreadable = () => fail(409, 'Nie udało się otworzyć zapisanych danych dostępu. Podłącz źródło ponownie.', 'The saved credentials could not be opened. Reconnect the source.');
const decoder = new TextDecoder('utf-8',{fatal:true});

function makeRequest(url, options) {
  const purpose = options.purpose ?? 'feed';
  if (!Object.hasOwn(limits,purpose)) invalidOptions();
  const max = options.maxBytes ?? limits[purpose];
  if (!Number.isSafeInteger(max) || max < 1 || max > limits[purpose]) invalidOptions();
  const headers = new Headers({
    Accept:purpose === 'photo' ? 'image/jpeg, image/png, image/webp, application/octet-stream;q=0.5' :
      purpose === 'feed' ? 'application/json, application/xml, text/xml, text/csv, */*;q=0.5' : 'application/json',
    'Cache-Control':'no-store'
  });
  if (options.token) {
    if (typeof options.token !== 'string' || options.token.length > 8192 || !/^[\x21-\x7e]+$/.test(options.token)) invalidOptions();
    if (options.tokenOrigin !== url.origin) fail(422, 'Klucz API jest przypisany do innej domeny.', 'The API token belongs to a different origin.');
    headers.set('Authorization','Bearer ' + options.token);
  }
  if (purpose !== 'distribution') {
    if (options.json !== undefined || options.idempotencyKey !== undefined) invalidOptions();
    return {purpose,max,method:'GET',headers};
  }
  // The channel registry provides the exact official publication endpoint, independent of owner input.
  if (!options.officialEndpoint || normalizeImportUrl(options.officialEndpoint) !== url.href) {
    fail(422, 'Adres publikacji nie odpowiada wybranemu kanałowi.', 'The publication URL does not match the selected channel.');
  }
  if (!options.json || Array.isArray(options.json) || typeof options.json !== 'object') invalidOptions();
  let payload;
  try { payload = JSON.stringify(options.json); } catch { invalidOptions(); }
  if (typeof payload !== 'string' || payload.length > 1024*1024 || encoder.encode(payload).byteLength > 1024*1024) invalidOptions();
  headers.set('Content-Type','application/json; charset=utf-8');
  if (options.idempotencyKey !== undefined) {
    if (typeof options.idempotencyKey !== 'string' || !/^[a-z0-9._:~-]{1,200}$/i.test(options.idempotencyKey)) invalidOptions();
    headers.set('Idempotency-Key',options.idempotencyKey);
  }
  return {purpose,max,method:'POST',headers,body:payload};
}

// Dependencies are installed by the trusted server/test harness, never read from a request or a binding.
export function createImportTransport({
  lookup = nodeLookup, requestPinned = nodeRequest, fetcher = (...args) => fetch(...args),
  isCloudflare = () => globalThis.navigator?.userAgent === 'Cloudflare-Workers', timeoutMs = 15000
} = {}) {
  const workerDnsByContext = new WeakMap();
  async function edgeAddress(ctx, name, signal) {
    if (publicAddress(name)) return name;
    let cache = workerDnsByContext.get(ctx);
    if (!cache) { cache = new Map(); workerDnsByContext.set(ctx,cache); }
    const cached = cache.get(name);
    if (cached && cached.expires > Date.now()) return cached.address;
    const address = choosePublicAddress(await workerLookup(name,signal,fetcher));
    if (cache.size >= 64) cache.clear();
    cache.set(name,{address,expires:Date.now()+15000});
    return address;
  }
  return async function fetchResource(ctx, raw, options = {}) {
    const url = new URL(normalizeImportUrl(raw));
    for (const origin of [ctx.origin,ctx.env.APP_ORIGIN]) {
      if (origin && new URL(origin).hostname.toLowerCase().replace(/\.$/,'') === url.hostname) invalidOptions();
    }
    const request = makeRequest(url,options);
    const localNode = ctx.env.runtime === 'node';
    if (!localNode && (ctx.env.IMPORT_PUBLIC_EGRESS !== 'cloudflare-public' || !isCloudflare())) noEgress();
    const host = url.hostname.replace(/^\[|\]$/g,'');
    try {
      return await withDeadline(timeoutMs,async signal => {
        let response;
        if (localNode) {
          const address = publicAddress(host) ? host : choosePublicAddress(await lookup(host,signal));
          signal.throwIfAborted();
          response = await requestPinned(url,address,{...request,signal});
        } else {
          await edgeAddress(ctx,host,signal);
          signal.throwIfAborted();
          // Never use a service binding, an incoming Request, cf.resolveOverride or forwarded headers.
          response = await fetcher(url.href,{method:request.method,headers:request.headers,body:request.body,
            credentials:'omit',redirect:'manual',cache:'no-store',signal});
        }
        if (!response.ok || (request.purpose !== 'distribution' && response.status === 206)) {
          void response.body?.cancel().catch(() => {});
          const status = Number(response.status);
          if (status >= 300 && status < 400) fail(422, 'Źródło przekierowuje. Podaj końcowy adres HTTPS.', 'Enter the final HTTPS URL; this source redirects.');
          fail(502, 'Serwer zewnętrzny zwrócił błąd HTTP ' + status + '.', 'The external server returned HTTP ' + status + '.',{remoteStatus:status});
        }
        const bytes = await boundedBytes(response,request.max,localNode);
        const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';',1)[0].trim().toLowerCase();
        return {bytes, contentType, status:response.status};
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      fail(502, 'Nie udało się odebrać prawidłowej odpowiedzi ze źródła.', 'The source did not return a valid response.');
    }
  };
}

export const fetchImportResource = createImportTransport();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function fromBase64(value) {
  return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),char => char.charCodeAt(0));
}
async function encryptionKey(env,context) {
  const raw = env.IMPORT_SECRET_KEY;
  if (typeof raw !== 'string' || !/^[a-zA-Z0-9+/_-]{43}=?$/.test(raw)) unsupportedKey();
  let bytes;
  try { bytes = fromBase64(raw); } catch { unsupportedKey(); }
  if (bytes.length !== 32) unsupportedKey();
  const master = await crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveKey']);
  return await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('brumbrum-credential-keys/v1'),info:context},
    master,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function scope(ownerId, sourceId) {
  if ([ownerId,sourceId].some(value => typeof value !== 'string' || !value || value.length > 240)) invalidOptions();
  return encoder.encode(JSON.stringify(['brumbrum-import',1,ownerId,sourceId]));
}

export async function sealIntegrationSecret(env,ownerId,sourceId,value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 8192 || encoder.encode(value).byteLength > 8192) invalidOptions();
  const additionalData = scope(ownerId,sourceId);
  const key = await encryptionKey(env,additionalData);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},key,encoder.encode(value));
  return 'v1.' + toBase64(iv) + '.' + toBase64(new Uint8Array(ciphertext));
}

export async function openIntegrationSecret(env,ownerId,sourceId,encrypted) {
  if (encrypted === null || encrypted === undefined || encrypted === '') return '';
  if (typeof encrypted !== 'string' || encrypted.length > 11000 || !/^v1\.[\w-]{16}\.[\w-]{23,}$/.test(encrypted)) unreadable();
  const additionalData = scope(ownerId,sourceId);
  const key = await encryptionKey(env,additionalData);
  try {
    const [,ivPart,data] = encrypted.split('.');
    const iv = fromBase64(ivPart), bytes = fromBase64(data);
    if (toBase64(bytes) !== data) unreadable();
    const result = await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData},key,bytes);
    return decoder.decode(result);
  } catch { unreadable(); }
}
