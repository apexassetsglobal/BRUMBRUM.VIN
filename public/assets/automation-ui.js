import {featureText,importStatusLabel} from './service-language.js';
const t=(pl,en)=>featureText(document.documentElement.lang,pl,en),prefix=document.body.dataset.prefix||'',api=prefix+'/api/automation/';
async function send(url,body,raw=false,method='POST'){
 const r=await fetch(url,{method,...(method==='GET'?{}:{headers:raw?{}:{'Content-Type':'application/json'},body:raw?body:JSON.stringify(body)})});
 const value=await r.json();if(!r.ok)throw Error(value.error||value.message||t('Nie udało się zapisać.','Could not save.'));return value;
}
const el=(name,value='')=>{const n=document.createElement(name);n.textContent=value;return n;};
function outputToken(container,token,source,endpoint){
 container.replaceChildren();const msg=el('p',t('Skopiuj token teraz. Będzie widoczny tylko raz.','Copy this token now. It is shown only once.'));container.append(msg);
 const code=el('code',token);container.append(code);if(endpoint)container.append(el('p',endpoint));
 const a=el('a',t('Przejdź do moich źródeł','Go to my sources'));a.href=location.pathname+'?source='+encodeURIComponent(source);container.append(el('br'),a);
}
const create=document.querySelector('[data-auto-create]');
if(create){
 const pull=create.querySelector('[data-pull]'),kind=create.elements.kind,update=()=>{const active=['feed','rest','dealer'].includes(kind.value);pull.hidden=!active;for(const c of pull.querySelectorAll('input,select'))c.disabled=!active;create.elements.url.required=active;};kind.onchange=update;update();
 create.onsubmit=async ev=>{ev.preventDefault();const submit=ev.submitter,feedback=create.querySelector('[role=status]');submit.disabled=true;
 try{const v=await send(api+'sources',Object.fromEntries(new FormData(create)));if(v.token){feedback.textContent=t('Źródło zostało utworzone.','Source created.');outputToken(create.querySelector('output'),v.token,v.id,v.endpoint);create.reset();update();}else location.assign(location.pathname+'?source='+v.id);}catch(e){feedback.textContent=e.message;}finally{submit.disabled=false;}};
}
for(const button of document.querySelectorAll('[data-rotate]'))button.onclick=async()=>{
 if(!confirm(t('Zastąpić dotychczasowy token nowym?','Replace the existing token?')))return;const out=button.parentElement.querySelector('output');button.disabled=true;
 try{const v=await send(api+'source/'+button.dataset.rotate+'/rotate',{});outputToken(out,v.token,button.dataset.rotate);}catch(e){out.textContent=e.message;}finally{button.disabled=false;}
};
function mappingUI(container,v){
 container.replaceChildren();const labels=JSON.parse(container.dataset.fields),form=el('form');form.className='stack';
 const heading=el('h3',t('Mapowanie pól','Field mapping')+' · '+v.total+' '+t('ofert','listings'));form.append(heading);
 const groups=[el('div'),el('div')];for(const g of groups)g.className='auto-mapping';
 for(const [field,label] of Object.entries(labels)){
  const wrap=el('label'),hint=el('span',label),sel=el('select');wrap.className='field';sel.name=field;sel.append(new Option('—',''));
  for(const c of v.columns)sel.append(new Option(c,c));sel.value=v.mapping[field]||'';wrap.append(hint,sel);groups[sel.value||field==='external_id'?0:1].append(wrap);
 }
 form.append(groups[0]);if(groups[1].childElementCount){const details=el('details');details.append(el('summary',t('Pozostałe pola','Other fields')),groups[1]);form.append(details);}
 if(v.sample.length){const details=el('details'),pre=el('pre',JSON.stringify(v.sample,null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';details.append(el('summary',t('Podgląd danych źródłowych','Preview source data')),pre);form.append(details);}
 const snap=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=true;snap.className='check';snap.append(cb,el('span',t('Pełny stan magazynu. Brakujące oferty oznacz do sprawdzenia.','Full inventory snapshot. Flag missing listings for review.')));
 const run=el('button',t('Importuj wszystkie oferty','Import all listings'));run.className='btn primary';const status=el('p');status.setAttribute('role','status');form.append(snap,run,status);container.append(form);
 form.onsubmit=async ev=>{ev.preventDefault();run.disabled=true;try{const response=await send(container.dataset.run,{previewId:v.previewId,mapping:Object.fromEntries(new FormData(form)),snapshot:cb.checked});const redirect=new URL(location.href);redirect.searchParams.set('job',response.jobId);location.assign(redirect);}catch(e){status.textContent=e.message;run.disabled=false;}};
}
for(const form of document.querySelectorAll('[data-auto-preview]'))form.onsubmit=async ev=>{
 ev.preventDefault();const btn=ev.submitter,status=form.querySelector('[role=status]'),file=form.elements.file?.files[0],url=new URL(form.dataset.autoPreview,location.origin);btn.disabled=true;status.textContent=t('Odczytywanie źródła…','Reading source…');
 try{if(file){if(file.size>4*1024*1024)throw Error(t('Maksymalny rozmiar pliku to 4 MiB.','The file limit is 4 MiB.'));url.searchParams.set('format',file.name.split('.').pop().toLowerCase());}
 const data=await send(url,file||new Uint8Array(0),true);mappingUI(form.parentElement.querySelector('[data-auto-map]'),data);status.textContent='';}catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
};
for(const d of document.querySelectorAll('[data-auto-job]')){
 const refresh=async()=>{try{const v=await send(api+'job/'+d.dataset.autoJob,undefined,false,'GET'),box=d.querySelector('div');
 d.querySelector('summary').textContent=({queued:t('W kolejce','Queued'),running:t('W toku','Running'),done:t('Zakończono','Completed'),failed:t('Błąd','Failed')})[v.job.state]+' · '+v.job.cursor+'/'+v.job.total;
 box.replaceChildren();if(v.job.report)box.append(el('p',v.job.report));const list=el('ul');for(const item of v.events){const li=el('li',item.line+' · '+item.external_id+' · '+importStatusLabel(item.result,document.documentElement.lang)+' '+item.detail);if(item.listing_id){const a=el('a',t('Sprawdź','Review'));a.href=prefix+'/podglad/'+encodeURIComponent(item.listing_id);li.append(' ',a);}list.append(li);}box.append(list);
 if(d.open&&['queued','running'].includes(v.job.state))setTimeout(()=>{if(d.open)refresh();},4000);
 }catch(e){d.querySelector('div').textContent=e.message;}};
 d.ontoggle=()=>{if(d.open)refresh();};if(new URL(location.href).searchParams.get('job')===d.dataset.autoJob)d.open=true;
}
