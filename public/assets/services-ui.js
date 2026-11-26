import {localBusinessDraft} from './service-copy.js';
import {featureText} from './service-language.js';
const t=(pl,en)=>featureText(document.documentElement.lang,pl,en);
async function post(url,data,raw=false){
 const r=await fetch(url,{method:'POST',headers:raw?{}:{'Content-Type':'application/json'},body:raw?data:JSON.stringify(data)});
 const v=await r.json();if(!r.ok)throw Error(v.error||v.message||t('Nie udało się zapisać.','Could not save.'));return v;
}
function makeButton(label,fn){
 const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.onclick=fn;return b;
}
async function compress(file){
 if(file.size>12*1024*1024)throw Error(t('Zdjęcie przekracza 12 MB.','Image exceeds 12 MB.'));
 const bitmap=await createImageBitmap(file);try{
  const scale=Math.min(1,2600/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));
  c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/webp',.87));return blob&&(scale<1||blob.size<file.size)?blob:file;
 }finally{bitmap.close();}
}
const edit=document.querySelector('[data-svc-edit]');
if(edit){
 const status=edit.querySelector('[role=status]'),ai=edit.querySelector('[data-ai-controls]'),cloud=ai.dataset.cloud==='1',url=edit.dataset.svcEdit.replace(/\/save$/,'/ai');
 const suggest=edit.querySelector('[data-ai-action=categories]');
 suggest.onclick=async()=>{try{const result=await post(url,{action:'categories',description:edit.elements.description.value});for(const box of edit.querySelectorAll('[data-svc-category]'))if(result.categories.includes(box.value))box.checked=true;
 status.textContent=result.categories.length?t('Sprawdź proponowane kategorie przed zapisaniem.','Review the suggested categories before saving.'):t('Wybierz kategorie ręcznie.','Choose categories manually.');
 }catch(e){status.textContent=e.message;}};
 function offerProposal(value,dest){
  const dialog=document.createElement('dialog');dialog.className='modal';const h=document.createElement('h2');h.textContent=t('Sprawdź propozycję','Review the proposal');
  const textarea=document.createElement('textarea');textarea.rows=9;textarea.value=value;textarea.setAttribute('aria-label',h.textContent);
  const accept=makeButton(t('Zastosuj do formularza','Apply to form'),()=>{dest.value=textarea.value;dest.dispatchEvent(new Event('input',{bubbles:true}));dialog.close();});
  const cancel=makeButton(t('Odrzuć','Discard'),()=>dialog.close());dialog.append(h,textarea,accept,cancel);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
 }
 async function deviceTranslation(src,from,to){
  const {offlineTranslationPlan,translateServiceOnDevice}=await import('./service-offline-ai.js');
  const plan=await offlineTranslationPlan(from,to);
  if(!plan.available)throw Error(t('Model AI jest niedostępny na tym urządzeniu.','AI is unavailable on this device.'));
  if(plan.downloadBytes>0){
   const mb=Math.ceil(plan.downloadBytes/(1024*1024));
   const accepted=confirm(t('Pobrać model tłumaczenia na urządzenie?','Download the translation model to this device?')+' '+mb+' MiB. '+t('Tekst pozostanie na tym urządzeniu.','The text stays on this device.'));
   if(!accepted){status.textContent='';return '';}
  }
  const abort=new AbortController(),stop=makeButton(t('Anuluj tłumaczenie','Cancel translation'),()=>abort.abort());
  const line=document.createElement('span');status.replaceChildren(line,document.createTextNode(' '),stop);
  try{return (await translateServiceOnDevice({text:src,from,to,allowDownload:plan.downloadBytes > 0,signal:abort.signal,onProgress:p=>{line.textContent=(p.stage==='translating'?t('Tłumaczenie na urządzeniu…','Translating on device…'):t('Wczytywanie modelu…','Loading model…'))+' '+p.pair;}})).text;}
  finally{stop.remove();}
 }
 async function generate(action){
  const src=edit.elements.description.value.trim(),lang=edit.elements.language.value,target=action==='translation'?ai.querySelector('select').value:lang;
  if(src.length<10){status.textContent=t('Wpisz opis działalności.','Enter a business description.');return;}
  if(action==='translation'&&lang===target){status.textContent=t('Wybierz inny język.','Choose another language.');return;}
  if(ai.dataset.busy)return;ai.dataset.busy='1';status.textContent=t('Przygotowywanie propozycji…','Preparing your proposal…');
  let value='',model;
  try{
   try{
    if(action==='translation'&&window.Translator&&await Translator.availability({sourceLanguage:lang,targetLanguage:target})==='available'){
     model=await Translator.create({sourceLanguage:lang,targetLanguage:target});value=await model.translate(src);
    }else if(action==='description'&&window.Writer&&await Writer.availability({outputLanguage:target})!=='unavailable'){
     model=await Writer.create({outputLanguage:target,tone:'neutral',length:'short',format:'plain-text'});value=await model.write(src,{context:'Write a short automotive service business profile. Use only the supplied facts.'});
    }
   }catch{}finally{model?.destroy();}
   if(!value&&action==='translation'&&window.Worker&&window.WebAssembly&&window.crypto?.subtle){
    value=await deviceTranslation(src,lang,target);if(!value)return;
   }
   if(!value&&cloud)value=(await post(url,{action,description:src,target})).proposal;
   if(!value)throw Error(t('Model AI jest niedostępny na tym urządzeniu.','AI is unavailable on this device.'));
   offerProposal(value,action==='description'?edit.elements.description:edit.elements['translation_'+target]);status.textContent='';
  }catch(e){status.textContent=e.name==='AbortError'?t('Anulowano.','Cancelled.'):e.message;}finally{delete ai.dataset.busy;}
 }
 const fromFacts=()=>{const fields=edit.elements;const categories=[...edit.querySelectorAll('[data-svc-category]:checked')].map(n=>n.parentElement.textContent.trim());if(fields.description.value.trim().length<10){status.textContent=t('Wpisz opis działalności.','Enter a business description.');return;}offerProposal(localBusinessDraft(fields.description.value,fields.name.value,fields.city.value,categories),fields.description);};
 ai.append(makeButton(t('Ułóż opis z podanych faktów','Draft from supplied facts'),fromFacts));
 if(cloud||window.Writer)ai.append(makeButton(t('Przygotuj opis z AI','Draft with AI'),()=>generate('description')));
 if(cloud||window.Translator||(window.Worker&&window.WebAssembly&&window.crypto?.subtle)){const select=document.createElement('select');select.setAttribute('aria-label',t('Język tłumaczenia','Translation language'));for(const opt of edit.elements.language.options)select.append(opt.cloneNode(true));select.value=edit.elements.language.value==='en'?'pl':'en';ai.append(select,makeButton(t('Przetłumacz z AI','Translate with AI'),()=>generate('translation')));}

 edit.onsubmit=async ev=>{ev.preventDefault();if(edit.dataset.busy)return;edit.dataset.busy='1';const data=Object.fromEntries(new FormData(edit,ev.submitter));data.categories=[...edit.querySelectorAll('[data-svc-category]:checked')].map(n=>n.value);
 try{const r=await post(edit.dataset.svcEdit,data);location.assign(r.next);}catch(e){status.textContent=e.message;}finally{delete edit.dataset.busy;}};
}
const uploader=document.querySelector('[data-svc-upload]');
if(uploader)uploader.onsubmit=async event=>{
 event.preventDefault();const status=uploader.querySelector('[role=status]'),files=[...uploader.elements.file.files],kind=uploader.elements.kind.value,pair=uploader.elements.pair.value;
 if(!files.length||uploader.dataset.busy)return;uploader.dataset.busy='1';let done=0;
 try{for(const file of files){status.textContent=(done+1)+' / '+files.length;const body=kind==='video'?file:await compress(file);
 const r=await post(uploader.dataset.svcUpload+'?'+new URLSearchParams({kind,pair}),body,true);if(edit)edit.elements.revision.value=r.revision;done++;}
 status.textContent=t('Dodano materiały.','Media uploaded.');uploader.reset();
 // Keep unsaved profile fields when the owner is still editing alongside the gallery.
 if(!document.documentElement.hasAttribute('data-service-dirty'))location.reload();
 else{const a=document.createElement('a');a.href=location.href;a.textContent=t('Odśwież galerię po zapisaniu opisu.','Refresh the gallery after saving your description.');status.append(' ',a);}
 }catch(e){status.textContent=(done?done+'/'+files.length+' · ':'')+e.message;}finally{delete uploader.dataset.busy;}
};
edit?.addEventListener('input',()=>document.documentElement.setAttribute('data-service-dirty',''));
