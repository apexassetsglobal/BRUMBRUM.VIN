import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { open, mkdir, readFile, readdir, unlink, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { handler,scheduledAutomation } from './src/app.js';

const root=dirname(fileURLToPath(import.meta.url));
const env={...process.env};
const mode=env.APP_MODE || 'development';
const directory=resolve(env.DATA_DIR || join(root,'var'));
mkdirSync(directory,{recursive:true,mode:0o700});
const db=new DatabaseSync(join(directory,'all4auto.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
for (const filename of readdirSync(join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort()) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(filename)) {
      db.exec(readFileSync(join(root,'drizzle',filename),'utf8'));
      db.prepare('INSERT INTO schema_migrations(name,applied_at) VALUES(?,?)').run(filename,new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function statement(sql,values) {
  return {
    bind:(...params)=>statement(sql,params),
    first:async()=>db.prepare(sql).get(...values)??null,
    all:async()=>({results:db.prepare(sql).all(...values)}),
    run:async()=>execute(),
    execute
  };
  function execute() {
    const result=db.prepare(sql).run(...values);
    return {success:true,meta:{changes:Number(result.changes)}};
  }
}
env.DB={
  prepare:sql=>statement(sql,[]),
  batch:async statements=>{
    db.exec('BEGIN IMMEDIATE');
    try {
      const result=statements.map(s=>s.execute());
      db.exec('COMMIT');
      return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
};

const objectPath=key=>{
  if (!/^[a-z0-9][a-z0-9/-]*$/i.test(key)) throw new Error('invalid_object_key');
  return join(directory,'objects',key);
};
env.BUCKET={
  async put(key,bytes,options) {
    const path=objectPath(key);
    await mkdir(dirname(path),{recursive:true,mode:0o700});
    const temporary=path+'.'+crypto.randomUUID()+'.tmp';
    const info=path+'.type';
    const typeTemporary=temporary+'.type';
    await writeFile(temporary,bytes,{mode:0o600});
    await writeFile(typeTemporary,options.httpMetadata.contentType,{mode:0o600});
    await rename(typeTemporary,info);
    await rename(temporary,path);
  },
  async get(key,{range}={}) {
    const path=objectPath(key);
    try {
      const type=await readFile(path+'.type','utf8');
      const file=await open(path,'r');
      const bounds=range?{start:range.offset,end:range.offset+range.length-1}:undefined;
      return {body:Readable.toWeb(file.createReadStream(bounds)),httpMetadata:{contentType:type}};
    } catch (error) { if (error.code==='ENOENT') return null; throw error; }
  },
  async list({prefix,limit=1000,cursor='0'}) {
    const path=objectPath(prefix.replace(/\/$/,''));
    let files;
    try {
      files=await readdir(path,{withFileTypes:true});
    } catch (error) {
      if (error.code==='ENOENT') return {objects:[],truncated:false};
      throw error;
    }
    const names=files.filter(file=>file.isFile()&&/^[a-z0-9-]+$/i.test(file.name)).map(file=>file.name).sort();
    const offset=Number(cursor);
    const end=offset+limit;
    return {objects:names.slice(offset,end).map(name=>({key:prefix+name})),truncated:end<names.length,cursor:String(end)};
  },
  async delete(key) {
    for (const path of [objectPath(key),objectPath(key)+'.type']) {
      try {await unlink(path);} catch (error) {if(error.code!=='ENOENT')throw error;}
    }
  }
};
if (mode==='development' && !env.MAIL_API_KEY) {
  env.localMail=async message=>{
    appendFileSync(join(directory,'mailbox.jsonl'),JSON.stringify({...message,at:new Date().toISOString()})+'\n',{mode:0o600});
  };
}
if (mode==='production') {
  const origin = env.APP_ORIGIN && new URL(env.APP_ORIGIN);
  if (!origin || origin.protocol!=='https:' || origin.origin!==env.APP_ORIGIN) throw new Error('APP_ORIGIN must be an exact HTTPS origin.');
}
env.runtime='node';
const mediaTypes={'.wasm':'application/wasm','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.html':'text/html; charset=utf-8'};
const asset=async path=>{
  if (!/^\/[a-zA-Z0-9/_.-]+$/.test(path) || path.includes('..')) return null;
  try {
    const bytes=await readFile(join(root,'public',path));
    return new Response(bytes,{headers:{'Content-Type':mediaTypes[extname(path)]||'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache'}});
  } catch (error) {if(error.code==='ENOENT'||error.code==='EISDIR')return null;throw error;}
};
const {values:listenOptions}=parseArgs({options:{host:{type:'string'},port:{type:'string'}},strict:false});
const host=listenOptions.host || env.HOST || '127.0.0.1';
const port=Number(listenOptions.port || env.PORT || 3000);
const server=createServer(async (incoming,outgoing)=>{
  try {
    const headers=new Headers(incoming.headers);
    headers.delete('x-a4-peer');
    headers.set('x-a4-peer',incoming.socket.remoteAddress||'local');
    const origin=env.APP_ORIGIN || 'http://'+incoming.headers.host;
    const requestUrl=new URL(incoming.url,origin);
    if (['GET','HEAD'].includes(incoming.method) && ['/roboty-app','/roboty-app/','/roboty-app/index.html'].includes(requestUrl.pathname)) {
      const bytes=await readFile(join(root,'roboty-app','index.html'));
      outgoing.setHeader('Content-Type','text/html; charset=utf-8');
      outgoing.setHeader('Cache-Control','no-cache');
      outgoing.writeHead(200);
      if (incoming.method==='HEAD') outgoing.end();
      else outgoing.end(bytes);
      return;
    }
    const request=new Request(requestUrl,{
      method:incoming.method,headers,
      ...(['GET','HEAD'].includes(incoming.method)?{}:{body:Readable.toWeb(incoming),duplex:'half'})
    });
    const result=await handler(request,env,asset);
    for (const [name,value] of result.headers) if(name!=='set-cookie')outgoing.setHeader(name,value);
    const cookieHeaders=result.headers.getSetCookie();
    if(cookieHeaders.length)outgoing.setHeader('Set-Cookie',cookieHeaders);
    outgoing.writeHead(result.status);
    if (result.body && incoming.method!=='HEAD') await pipeline(Readable.fromWeb(result.body),outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    outgoing.end('Internal server error');
  }
});
server.listen(port,host,()=>console.log('ALL4AUTO '+mode+' · http://'+host+':'+server.address().port));

let processingImports=false;
const processDueImports=async()=>{
  if(processingImports)return;
  processingImports=true;
  try{await scheduledAutomation(env,asset);}catch(error){console.error('automation_tick_failed',error.name);}finally{processingImports=false;}
};
setInterval(processDueImports,Math.max(500,Number(env.IMPORT_TICK_MS)||10000)).unref();
