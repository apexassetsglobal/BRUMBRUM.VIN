import { after, changes, cookie, digest, emailOf, encoder, fail, forbidden, hex, id, isEmail, now, random, rate, requireUser, row, run, stmt, text, truth, withAuthReturn } from './core.js';
import { activateDemo } from './data.js';
import { languageCode, translator } from './i18n.js';

const days = 86400000;
const sessionName = ctx => ctx.demo ? 'a4_demo' : 'a4_session';
const iterations = 100000;

async function passwordHash(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:rounds,hash:'SHA-256'},key,256);
  return hex(new Uint8Array(bits));
}
const passwordOK = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const same = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i=0; i<a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};
async function makePassword(value) {
  if (!passwordOK(value)) fail(422,'Hasło musi mieć od 12 do 128 znaków.','The password must be 12–128 characters long.');
  const salt = random(16);
  return [iterations,salt,await passwordHash(value,salt,iterations)].join('$');
}
async function checkPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const [rounds,salt,hash] = (stored || '').split('$');
  const calculated = await passwordHash(value,salt || 'unregistered-account',Number(rounds) || iterations);
  return same(hash || '0'.repeat(64),calculated) && Boolean(hash);
}

export async function sessionUser(ctx, token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  return row(ctx.db,`SELECT u.id,u.scope,u.email,u.name,u.profile_type,u.role,u.verified_at,u.phone,u.show_phone,u.city,u.bio,u.lang,u.notify_messages,u.notify_listings,
    u.avatar_key,u.panorama_key,u.show_profile_images,c.logo_key
    FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN companies c ON c.user_id=u.id WHERE s.token=? AND s.expires_at>? AND u.scope=? AND u.deleted_at IS NULL AND u.verified_at IS NOT NULL`,
    await digest(token),now(),ctx.scope);
}

async function session(ctx, userId, passwordRequiredForStaff = false) {
  const value = random();
  const result=await run(ctx.db,`INSERT INTO sessions(token,user_id,expires_at)
    SELECT ?,id,? FROM users WHERE id=? AND deleted_at IS NULL AND (?=0 OR role='user')`,
    await digest(value),after(14*days),userId,Number(passwordRequiredForStaff));
  if (!changes(result)) forbidden();
  return cookie(ctx,sessionName(ctx),value,14*86400);
}

export async function chatGPTLogin(ctx, email, fullName) {
  if (!isEmail(email)) forbidden();
  await rate(ctx,'chatgpt-login',25,900);
  const at=now();
  await run(ctx.db,`INSERT INTO users(id,scope,email,name,profile_type,verified_at,created_at,lang)
    VALUES(?,'live',?,?,'private',?,?,?) ON CONFLICT(scope,email) DO NOTHING`,
    id(),email,text(fullName,80)||ctx.t('Użytkownik','User'),at,at,ctx.lang);
  const user=await row(ctx.db,"SELECT id,role,verified_at FROM users WHERE scope='live' AND email=? AND deleted_at IS NULL",email);
  if (!user?.verified_at || user.role!=='user') {
    fail(403,'Zaloguj się do istniejącego konta e-mailem i hasłem.','Sign in to your existing account with email and password.');
  }
  if (ctx.cookies.a4_session) await logout(ctx);
  return session(ctx,user.id,true);
}

export async function logout(ctx) {
  const token = ctx.cookies[sessionName(ctx)];
  if (token && /^[a-f0-9]{64}$/.test(token)) await run(ctx.db,'DELETE FROM sessions WHERE token=?',await digest(token));
  return cookie(ctx,sessionName(ctx),'',0);
}

export function mailReady(ctx) {
  return Boolean(ctx.env.localMail || (ctx.env.MAIL_API_KEY && ctx.env.MAIL_FROM && ctx.env.APP_ORIGIN?.startsWith('https://')));
}

async function deliver(ctx, to, purpose, lang, token, next) {
  const root = ctx.env.APP_ORIGIN || ctx.origin;
  const path = (purpose === 'verify' ? '/potwierdz-email' : '/ustaw-haslo') + '?token=' + token + '&lang=' + lang;
  const url = root + withAuthReturn(path,next);
  const t=translator(lang);
  const subject=purpose==='verify'?t('Potwierdź adres e-mail','Confirm your email'):t('Ustaw nowe hasło','Reset your password');
  if (ctx.env.localMail) return ctx.env.localMail({to,subject,url,purpose});
  let response;
  try {
    response = await fetch('https://api.resend.com/emails',{
      method:'POST', headers:{Authorization:'Bearer '+ctx.env.MAIL_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:ctx.env.MAIL_FROM,to:[to],subject:subject+' · '+ctx.brand.name,text:subject+'\n\n'+url}),
      signal:AbortSignal.timeout(12000)
    });
  } catch { /* surfaced as a delivery failure without logging sensitive data */ }
  if (!response?.ok) fail(503,'Usługa poczty jest chwilowo niedostępna. Ponów próbę.','The mail service is temporarily unavailable. Try again.');
}

function requireMail(ctx) {
  if (!mailReady(ctx)) fail(503,'Poczta kont jest nieaktywna. Przeglądaj katalog lub wejdź do demo.','Account email is unavailable. Browse the catalog or open the demo.');
}

async function sendToken(ctx, account, purpose, next) {
  const token = random();
  await run(ctx.db,'INSERT INTO auth_tokens(token,user_id,purpose,expires_at) VALUES(?,?,?,?)',await digest(token),account.id,purpose,after(purpose === 'verify' ? days : 3600000));
  await deliver(ctx,account.email,purpose,ctx.lang,token,next);
}

export async function register(ctx, body) {
  if (ctx.demo) forbidden();
  requireMail(ctx);
  await rate(ctx,'register',12,3600);
  const email = emailOf(body.email);
  const name = text(body.name,80);
  if (!isEmail(email) || name.length < 2 || !['private','company'].includes(body.profile_type) || !truth(body.terms)) {
    fail(422,'Uzupełnij nazwę, e-mail, rodzaj konta i akceptację regulaminu.','Enter a name, email, account type and acceptance of the terms.');
  }
  await rate(ctx,'register-email',4,3600,email);
  const password = await makePassword(body.password);
  await run(ctx.db,`INSERT INTO users(id,scope,email,password,name,profile_type,created_at,lang) VALUES(?,'live',?,?,?,?,?,?)
    ON CONFLICT(scope,email) DO UPDATE SET password=excluded.password,name=excluded.name,profile_type=excluded.profile_type,lang=excluded.lang
    WHERE users.verified_at IS NULL AND users.deleted_at IS NULL`,id(),email,password,name,body.profile_type,now(),ctx.lang);
  const account = await row(ctx.db,"SELECT id,email,verified_at FROM users WHERE scope='live' AND email=? AND deleted_at IS NULL",email);
  if (account && !account.verified_at) await sendToken(ctx,account,'verify',body.next);
}

export async function requestToken(ctx, body, purpose) {
  if (ctx.demo) forbidden();
  requireMail(ctx);
  await rate(ctx,purpose+'-ip',16,3600);
  const email = emailOf(body.email);
  if (!isEmail(email)) return;
  await rate(ctx,purpose+'-email',4,3600,email);
  const account = await row(ctx.db,"SELECT id,email,verified_at FROM users WHERE scope='live' AND email=? AND deleted_at IS NULL",email);
  if (account && Boolean(account.verified_at) === (purpose === 'reset')) await sendToken(ctx,account,purpose,body.next);
}

export async function redeem(ctx, body, purpose) {
  if (ctx.demo) forbidden();
  await rate(ctx,'redeem',25,900);
  const key = /^[a-f0-9]{64}$/.test(body.token || '') ? await digest(body.token) : '';
  const record = await row(ctx.db,`SELECT a.user_id,u.password FROM auth_tokens a JOIN users u ON u.id=a.user_id
    WHERE a.token=? AND a.purpose=? AND a.expires_at>? AND u.scope='live' AND u.deleted_at IS NULL`,key,purpose,now());
  if (!record) fail(410,'Link wygasł lub został już użyty. Poproś o nowy.','This link expired or was already used. Request a new one.');
  if (purpose==='verify' && !await checkPassword(body.password,record.password)) {
    fail(401,'Podaj hasło ustawione podczas rejestracji.','Enter the password you set during registration.');
  }
  const db = ctx.db;
  const at = now();
  const gate = `EXISTS (SELECT 1 FROM auth_tokens WHERE token=? AND purpose=? AND expires_at>?)`;
  const update = purpose === 'verify'
    ? stmt(db,`UPDATE users SET verified_at=? WHERE id=? AND verified_at IS NULL AND password=? AND ${gate}`,at,record.user_id,record.password,key,purpose,at)
    : stmt(db,`UPDATE users SET password=? WHERE id=? AND verified_at IS NOT NULL AND ${gate}`,await makePassword(body.password),record.user_id,key,purpose,at);
  const statements = [update];
  if (purpose === 'reset') statements.push(stmt(db,`DELETE FROM sessions WHERE user_id=? AND ${gate}`,record.user_id,key,purpose,at));
  if (purpose==='verify') statements.push(stmt(db,`DELETE FROM auth_tokens WHERE user_id=? AND purpose=? AND changes()=1`,record.user_id,purpose));
  else statements.push(stmt(db,`DELETE FROM auth_tokens WHERE user_id=? AND purpose=? AND ${gate}`,record.user_id,purpose,key,purpose,at));
  const result = await db.batch(statements);
  if (!changes(result[0])) fail(410,'Link wygasł lub został już użyty.','This link expired or was already used.');
}

export async function login(ctx, body) {
  if (ctx.demo) forbidden();
  const email = emailOf(body.email);
  await rate(ctx,'login-ip',40,900);
  await rate(ctx,'login-email',12,900,email);
  const user = await row(ctx.db,"SELECT id,password,verified_at FROM users WHERE scope='live' AND email=? AND deleted_at IS NULL",email);
  if (!await checkPassword(body.password,user?.password)) fail(401,'Nieprawidłowy e-mail lub hasło.','Incorrect email or password.');
  if (!user?.verified_at) fail(403,'Potwierdź adres e-mail przed zalogowaniem.','Confirm your email before signing in.');
  if (ctx.cookies.a4_session) await logout(ctx);
  return session(ctx,user.id);
}

export async function demoSession(ctx, body) {
  if (!ctx.demo) forbidden();
  await rate(ctx,'demo',40,3600,ctx.ip);
  const old = ctx.scope === 'demo:seed' ? null : ctx.cookies.a4_workspace;
  const token = old || random();
  const {scope,userId} = await activateDemo(ctx,text(body.actor,20),await digest(token));
  await logout(ctx);
  const headers = new Headers();
  headers.append('Set-Cookie',cookie(ctx,'a4_workspace',token,2*86400));
  headers.append('Set-Cookie',await session({...ctx,scope},userId));
  return headers;
}

export async function updateProfile(ctx, body) {
  const user = requireUser(ctx);
  const name = text(body.name,80);
  const type = text(body.profile_type,15);
  const phone = text(body.phone,30);
  const company = text(body.company,100);
  const language=languageCode(body.lang)||ctx.lang;
  if (name.length<2 || !['private','company'].includes(type)) fail(422,'Sprawdź nazwę i rodzaj profilu.','Check your display name and profile type.');
  if (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) fail(422,'Wpisz prawidłowy numer telefonu.','Enter a valid phone number.');
  if (truth(body.show_phone) && !phone) fail(422,'Podaj numer, który ma być widoczny.','Enter the phone number you want to show.');
  if (type === 'company' && !company) fail(422,'Podaj nazwę firmy.','Enter a business name.');
  const db = ctx.db;
  const profile = stmt(db,`UPDATE users SET name=?,profile_type=?,phone=?,show_phone=?,city=?,bio=?,lang=?,notify_messages=?,notify_listings=?,show_profile_images=COALESCE(?,show_profile_images) WHERE id=?`,
    name,type,phone,+truth(body.show_phone),text(body.city,90),text(body.bio,1500),language,+truth(body.notify_messages),+truth(body.notify_listings),
    Object.hasOwn(body,'show_profile_images')?+truth(body.show_profile_images):null,user.id);
  const statements = [profile];
  if (type === 'company') statements.push(stmt(db,`INSERT INTO companies(user_id,name,description,address,hours) VALUES(?,?,?,?,?) ON CONFLICT(user_id)
    DO UPDATE SET name=excluded.name,description=excluded.description,address=excluded.address,hours=excluded.hours`,user.id,company,text(body.description,2400),text(body.address,250),text(body.hours,200)));
  await db.batch(statements);
  return language;
}

export async function changePassword(ctx, body) {
  const user = requireUser(ctx);
  if (ctx.demo) forbidden();
  await rate(ctx,'password',10,900);
  const account = await row(ctx.db,'SELECT password FROM users WHERE id=?',user.id);
  if (!await checkPassword(body.current,account?.password)) fail(401,'Aktualne hasło jest nieprawidłowe.','The current password is incorrect.');
  await ctx.db.batch([
    stmt(ctx.db,'UPDATE users SET password=? WHERE id=?',await makePassword(body.password),user.id),
    stmt(ctx.db,'DELETE FROM sessions WHERE user_id=? AND token<>?',user.id,await digest(ctx.cookies.a4_session)),
    stmt(ctx.db,'DELETE FROM auth_tokens WHERE user_id=?',user.id)
  ]);
}

export async function removeAccount(ctx, body) {
  const user = requireUser(ctx);
  if (ctx.demo || user.role !== 'user') forbidden();
  await rate(ctx,'delete-account',6,900);
  const account = await row(ctx.db,'SELECT password FROM users WHERE id=?',user.id);
  if (!truth(body.confirm) || !await checkPassword(body.password,account?.password)) fail(422,'Potwierdź usunięcie i podaj aktualne hasło.','Confirm deletion and enter your current password.');
  const db = ctx.db;
  const at = now();
  await db.batch([
    stmt(db,`UPDATE users SET email=?,name='–',password='',deleted_at=?,show_phone=0,phone='',city='',bio='',avatar_key=NULL,panorama_key=NULL,show_profile_images=0 WHERE id=?`,user.id+'@deleted.invalid',at,user.id),
    stmt(db,"UPDATE listings SET status='archived',updated_at=?,revision=revision+1 WHERE user_id=?",at,user.id),
    ...['sessions','auth_tokens','favorites','companies','notifications'].map(table => stmt(db,`DELETE FROM ${table} WHERE user_id=?`,user.id)),
    stmt(db,'DELETE FROM listing_edits WHERE listing_id IN (SELECT id FROM listings WHERE user_id=?)',user.id)
  ]);
  return cookie(ctx,sessionName(ctx),'',0);
}

export async function bootstrapOwner(ctx, body) {
  const user = requireUser(ctx);
  const owner = emailOf(ctx.env.OWNER_EMAIL || '{{BRUMBRUM_SOURCE_RESTORE_OWNER_EMAIL_776E2D9C}}');
  const secret = ctx.env.OWNER_SETUP_TOKEN || '';
  if (ctx.demo || !user.verified_at || user.email !== owner || secret.length < 32) forbidden();
  await rate(ctx,'owner-claim',5,3600);
  if (!same(await digest(text(body.token,300)),await digest(secret))) forbidden();
  const decision = id();
  const db = ctx.db;
  const at = now();
  const result = await db.batch([
    stmt(db,"UPDATE users SET role='admin' WHERE id=? AND NOT EXISTS (SELECT 1 FROM users WHERE scope='live' AND role='admin' AND deleted_at IS NULL)",user.id),
    stmt(db,`INSERT INTO audit(id,scope,actor_id,action,target,reason,created_at) SELECT ?,'live',?,'bootstrap_admin',?,'verified_owner',? WHERE changes()=1`,
      decision,user.id,user.id,at)
  ]);
  if (!changes(result[0])) fail(409,'Administrator został już skonfigurowany.','An administrator has already been configured.');
}
