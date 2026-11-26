import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { handler } from '../src/app.js';
import { digest } from '../src/core.js';

// Run the production request handler against a migrated, disposable database.
const origin = 'https://camera.example.test';
const root = new URL('../', import.meta.url);

function database(sqlite) {
  function prepare(sql, args = []) {
    const statement = sqlite.prepare(sql);
    return {
      bind: (...values) => prepare(sql, values),
      first: () => statement.get(...args) ?? null,
      all: () => ({results: statement.all(...args)}),
      run: () => ({success: true, meta: {changes: Number(statement.run(...args).changes)}})
    };
  }
  return {prepare, batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }};
}

test('only an owned vehicle draft enables the camera and offers all three studio entries', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  const migrations = (await readdir(new URL('drizzle/', root))).filter(name => name.endsWith('.sql')).sort();
  for (const name of migrations) sqlite.exec(await readFile(new URL('drizzle/' + name, root), 'utf8'));
  const env = {DB: database(sqlite), runtime:'node', APP_MODE:'development', APP_ORIGIN:origin};
  const request = (path, cookie, body) => {
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    if (body) { headers.set('Content-Type','application/json'); headers.set('Origin',origin); }
    return handler(new Request(origin + path, {method:body ? 'POST' : 'GET', headers, body:body && JSON.stringify(body)}), env);
  };
  async function seller() {
    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replaceAll('-', '').repeat(2);
    const now = new Date().toISOString();
    sqlite.prepare('INSERT INTO users (id,scope,email,name,profile_type,verified_at,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id, 'live', id + '@example.test', 'Test', 'private', now, now);
    sqlite.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES(?,?,?)')
      .run(await digest(token), id, new Date(Date.now() + 3600000).toISOString());
    return 'a4_session=' + token;
  }
  const owner = await seller();
  const stranger = await seller();
  async function draft(type) {
    const response = await request('/api/listings', owner, {key:crypto.randomUUID(), type});
    assert.equal(response.status, 200);
    return (await response.json()).next;
  }
  const vehicle = await draft('car');
  const robot = await draft('robot');

  const editor = await request(vehicle, owner);
  assert.equal(editor.status, 200);
  assert.match(editor.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(editor.headers.get('permissions-policy'), /microphone=\(\)/);
  assert.match(editor.headers.get('content-security-policy'), /media-src 'self' blob:/);
  const html = await editor.text();
  for (const mode of ['guided', 'guide', 'spin']) assert.match(html, new RegExp('data-camera-open="' + mode + '"'));
  assert.match(html, /<input type="file" data-photo-input multiple/);

  for (const [path, user, code] of [[vehicle, null, 303], [vehicle, stranger, 403], [robot,owner,200],
    [vehicle.replace('/sprzedaj/', '/podglad/'),owner,200], ['/sprzedaj',owner,200]]) {
    const page = await request(path, user);
    assert.equal(page.status, code, path);
    assert.match(page.headers.get('permissions-policy'), /camera=\(\)/, path);
    assert.doesNotMatch(await page.text(), /data-camera-open="guided"/, path);
  }
});

test('the studio, its ESM dependencies and its stylesheet are reachable via public asset routes', async () => {
  async function asset(path) {
    const type = path.endsWith('.css') ? 'text/css' : 'text/javascript';
    return new Response(await readFile(new URL('public' + path, root)), {headers:{'Content-Type':type}});
  }
  async function get(path, mime) {
    const response = await handler(new Request(origin + path), {runtime:'node'}, asset);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('Content-Type'), mime, path);
    return response.text();
  }
  const main = await get('/smart-camera.js', /javascript/);
  const dependencies = [...main.matchAll(/^import\s.*?\sfrom\s*['"]([^'"]+)['"]/gm)].map(match => match[1]);
  assert.ok(dependencies.length > 0);
  for (const dependency of dependencies) {
    assert.match(dependency, /^\.\//);
    await get(new URL(dependency, origin + '/smart-camera.js').pathname, /javascript/);
  }
  await get('/assets/smart-camera.css', /css/);
});

// Dispatch events into the actual studio. Only the browser DOM and the
// permission/device response are simulated. No physical camera is required.
test('seller studio handles denial, both pickers, capture, backgrounding and a late permission grant', async t => {
  const {openSmartCamera} = await import('../public/smart-camera.js');
  const requests = [];
  const drawn = [];
  const saved = [];
  let resolvePermission;
  const mediaDevices = {getUserMedia(options) {
    requests.push(options);
    if (requests.length === 1) return Promise.reject(new DOMException('Denied','NotAllowedError'));
    return new Promise(resolve => { resolvePermission = resolve; });
  }};
  const nodes = new Map();
  function node() {
    return Object.assign(new EventTarget(), {
      style:{}, dataset:{}, classList:{toggle() {}}, clicks:0, setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
      replaceChildren() {}, append() {}, remove() {}, click() { this.clicks++; },
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector,node());
        return nodes.get(selector);
      },
      querySelectorAll() { return []; },
      showModal() { this.open = true; },
      close() { this.open = false; this.dispatchEvent(new Event('close')); }
    });
  }
  let dialog;
  const doc = Object.assign(new EventTarget(), {
    documentElement:{lang:'pl'}, body:node(), head:node(), hidden:false,
    createElement(tag) {
      if (tag === 'dialog') { dialog = node(); return dialog; }
      if (tag === 'canvas') return {
        getContext:() => ({fillRect(){}, drawImage(source){drawn.push(source);}}),
        toBlob:callback => callback(new Blob(['camera frame'],{type:'image/webp'}))
      };
      return node();
    },
    querySelector() { return null; }
  });
  const win = Object.assign(new EventTarget(), {isSecureContext:true});
  for (const [key,value] of Object.entries({document:doc,window:win,navigator:{mediaDevices}})) {
    const original = Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(() => original ? Object.defineProperty(globalThis,key,original) : delete globalThis[key]);
  }
  const view = openSmartCamera({listingId:'owned-draft',t:pl=>pl,vehicle:{type:'car',body:'sedan'},
    save:async capture => { saved.push(capture); },
    getMedia:async()=>({photos:saved.map(s=>({id:s.captureId,shotKey:s.key})),spin:[]})});
  await nextTurn();
  assert.ok(dialog.open);
  assert.equal(requests.length,0,'the dialog must not prompt for camera access on open');
  const region = name => dialog.querySelector('[data-sc-' + name + ']');
  function click(action) {
    const trigger = {dataset:{scAction:action}};
    const target = {closest:selector => selector === '[data-sc-action]' ? trigger : null};
    const event = new Event('click');
    Object.defineProperty(event,'target',{value:target});
    dialog.dispatchEvent(event);
  }
  click('start');
  await nextTurn();
  assert.equal(requests.length,1);
  assert.equal(requests[0].audio,false);
  assert.equal(requests[0].video.facingMode.ideal,'environment');
  assert.match(region('status').textContent,/Brak dostępu/);
  assert.match(dialog.innerHTML, /<input[^>]+type="file"[^>]+capture="environment"[^>]+data-sc-native/);
  assert.match(dialog.innerHTML, /<input[^>]+type="file"[^>]+data-sc-file/);
  for (const action of ['native','file']) {
    assert.ok(region('actions').innerHTML.includes('data-sc-action="' + action + '"'));
    click(action);
    assert.equal(region(action).clicks,1);
  }
  assert.ok(!region('actions').innerHTML.includes('data-sc-action="capture"'));
  let stopped = 0;
  const track = Object.assign(new EventTarget(), {stop() { stopped++; }});
  const stream = {getTracks:() => [track], getVideoTracks:() => [track]};
  const feed = region('feed');
  Object.assign(feed, {videoWidth:1600, videoHeight:900, play:async()=>{}});
  click('start');
  assert.equal(requests.length,2);
  resolvePermission(stream);
  await nextTurn();
  assert.equal(feed.srcObject,stream);
  assert.ok(region('actions').innerHTML.includes('data-sc-action="capture"'));
  click('capture');
  await nextTurn();
  assert.deepEqual(drawn,[feed],'save only pixels from the video element, excluding guides');
  assert.ok(region('actions').innerHTML.includes('data-sc-action="send"'),'local decoder unavailable: review before saving');
  click('send');
  await nextTurn();
  assert.equal(saved.length,1);
  assert.equal(saved[0].key,'front_left');
  assert.equal(await saved[0].file.text(),'camera frame');
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(stopped,1,'release the camera when backgrounded');
  assert.equal(feed.srcObject,null);
  doc.hidden = false;
  click('start');
  assert.equal(requests.length,3);
  click('close');
  await view;
  resolvePermission(stream);
  await nextTurn();
  assert.equal(stopped,2,'release a stream granted after its dialog closed');
  assert.equal(region('feed').srcObject,null);
});
