import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundledDemoFrames } from '../src/data.js';
import { referenceViews } from '../public/smart-camera-guides.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const output=join(root,'dist');
const publicDir=join(root,'public');
const clientDir=join(output,'client');
const hostingPath=join(root,'.openai','hosting.json');
const hosting=JSON.parse(await readFile(hostingPath,'utf8'));

// Keep large catalog galleries in R2. Static assets include the original ad files.
const r2Directories=new Set(['showcase-hd','showcase'].map(name=>join(publicDir,'assets',name)));
await rm(output,{recursive:true,force:true});
await cp(publicDir,clientDir,{recursive:true,filter:path=>!r2Directories.has(path)});
for (const path of [...bundledDemoFrames.flatMap(({url,thumb})=>[url,thumb]),...Object.values(referenceViews)]) {
  const target=join(clientDir,path);
  await mkdir(dirname(target),{recursive:true});
  await cp(join(publicDir,path),target);
}

const contents=`import { handler,scheduledAutomation } from './src/app.js';
function readAssets(env,origin){
  return async (path,method='GET')=>{
      if (!env.ASSETS) return null;
      const response=await env.ASSETS.fetch(new Request(new URL(path,origin),{method}));
      if (response.status===404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) return response;
      const headers=new Headers(response.headers);
      headers.set('Cache-Control',path.startsWith('/assets/')?'public, max-age=86400':'no-cache');
      return new Response(response.body,{status:response.status,headers});
  };
}
export default {
  scheduled(event,env,execution){
    const origin=env.APP_ORIGIN||env.IMPORT_PUBLIC_ORIGIN;
    execution.waitUntil(scheduledAutomation({...env,IMPORT_PUBLIC_EGRESS:'cloudflare-public'},origin?readAssets(env,origin):undefined));
  },
  fetch(request,env,execution) {
    return handler(request,{...env,SITES_CHATGPT_SIGNIN:'1',IMPORT_PUBLIC_EGRESS:'cloudflare-public'},readAssets(env,new URL(request.url).origin),execution);
  }
};
`;
await build({stdin:{contents,resolveDir:root,sourcefile:'worker-entry.js'},outfile:join(output,'server','index.js'),
  bundle:true,format:'esm',platform:'browser',target:'es2024',legalComments:'none',logLevel:'info'});
await writeFile(join(output,'server','wrangler.json'),JSON.stringify({
  name:'brumbrum-vin',main:'index.js',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat','global_fetch_strictly_public'],triggers:{crons:['* * * * *']},ai:{binding:'AI'},
  assets:{directory:'../client',binding:'ASSETS',run_worker_first:true},
  d1_databases:[{binding:hosting.d1,database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}],
  r2_buckets:[{binding:hosting.r2,bucket_name:'site-creator-r2'}]
},null,2)+'\n');
await mkdir(join(output,'.openai'),{recursive:true});
await cp(hostingPath,join(output,'.openai','hosting.json'));
