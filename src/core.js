export const now = () => new Date().toISOString();
export const after = ms => new Date(Date.now() + ms).toISOString();
export const id = () => crypto.randomUUID();
export const random = (size = 32) => hex(crypto.getRandomValues(new Uint8Array(size)));
export const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
export const encoder = new TextEncoder();
export const digest = async input => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof input === 'string' ? encoder.encode(input) : input)));
export const parse = (value, fallback = {}) => {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
};
export const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const truth = value => value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
export const numeric = (value, min = 0, max = 1e9) => {
  if (value === '' || value == null || !/^-?\d+(\.\d+)?$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
export const integer = (value, min, max) => {
  const n = numeric(value, min, max);
  return Number.isInteger(n) ? n : null;
};
export const slugify = value => String(value).toLowerCase().replaceAll('ł','l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,76);
export const isId = value => /^[a-z0-9][a-z0-9_-]{2,90}$/i.test(String(value));
export const emailOf = value => text(value, 254).toLowerCase();
export const isEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value);
export const isStaff = user => user?.role === 'moderator' || user?.role === 'admin';
export const placeholders = items => items.map(() => '?').join(',');
export const cleanReturn = (value, fallback = '/') => typeof value==='string' && /^\/(?![/\\])[^\\\x00-\x20]*$/.test(value) ? value.slice(0, 1500) : fallback;
export function withAuthReturn(path, value) {
  const next=cleanReturn(value,'');
  return next?path+(path.includes('?')?'&':'?')+'dalej='+encodeURIComponent(next):path;
}

export class AppError extends Error {
  constructor(status, pl, en, details = {}) {
    super(en);
    this.status = status;
    this.pl = pl;
    this.en = en;
    this.details = details;
  }
}
export const fail = (status, pl, en, details) => { throw new AppError(status, pl, en, details); };
export const missing = () => fail(404, 'Nie znaleziono tej strony.', 'This page could not be found.');
export const forbidden = () => fail(403, 'Brak dostępu.', 'Access denied.');
export const invalid = () => fail(422, 'Sprawdź wprowadzone dane.', 'Check the information you entered.');
export const conflict = () => fail(409, 'Dane zmieniły się w innej sesji. Odśwież stronę i ponów operację.', 'The data changed in another session. Reload and try again.');
export const requireUser = ctx => {
  if (!ctx.user) fail(401, 'Zaloguj się, aby kontynuować.', 'Sign in to continue.');
  return ctx.user;
};
export const requireStaff = ctx => { if (!isStaff(requireUser(ctx))) forbidden(); return ctx.user; };
export const requireAdmin = ctx => { if (requireUser(ctx).role !== 'admin') forbidden(); return ctx.user; };
export const row = async (db, sql, ...params) => db.prepare(sql).bind(...params).first();
export const rows = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results;
export const run = async (db, sql, ...params) => db.prepare(sql).bind(...params).run();
export const stmt = (db, sql, ...params) => db.prepare(sql).bind(...params);
export const changes = result => result?.meta?.changes ?? 0;
export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export const redirect = (path, headers = {}) => new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store', ...headers } });

export async function limitedBody(request, max) {
  const length = Number(request.headers.get('Content-Length'));
  if (length > max) fail(413, 'Przekroczono limit rozmiaru.', 'Size limit exceeded.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    count += value.length;
    if (count > max) {
      await reader.cancel();
      fail(413, 'Przekroczono limit rozmiaru.', 'Size limit exceeded.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function input(ctx, max = 65536) {
  const bytes = await limitedBody(ctx.req, max);
  try {
    const raw = new TextDecoder().decode(bytes);
    const type = ctx.req.headers.get('Content-Type') ?? '';
    if (type.startsWith('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
    if (type.startsWith('application/json')) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    }
  } catch { /* malformed input */ }
  invalid();
}

export function assertSameOrigin(ctx) {
  const origin = ctx.req.headers.get('Origin');
  const fetchSite = ctx.req.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== ctx.origin) || ['cross-site','same-site'].includes(fetchSite)) forbidden();
  if (!origin && fetchSite && fetchSite !== 'same-origin') forbidden();
}

export async function rate(ctx, bucket, limit, seconds = 600, identity = ctx.user?.id || ctx.ip) {
  const key = await digest(bucket + ':' + identity);
  const window = Math.floor(Date.now() / 1000 / seconds);
  const current = await row(ctx.db, `INSERT INTO rate_limits(key,window,count) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count`,
    key, window);
  if (current.count > limit) fail(429, 'Za dużo prób. Wróć za chwilę.', 'Too many attempts. Please try again later.');
}

export const cookie = (ctx, name, value, maxAge) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${ctx.origin.startsWith('https:') ? '; Secure' : ''}`;
export const cookies = req => Object.fromEntries((req.headers.get('Cookie') ?? '').split(';').filter(x => x.includes('=')).map(x => {
  const index = x.indexOf('=');
  return [x.slice(0,index).trim(), x.slice(index + 1).trim()];
}));
export function safeLink(value) {
  const local = cleanReturn(value, '');
  if (local) return local;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* invalid URL */ }
  return '';
}
