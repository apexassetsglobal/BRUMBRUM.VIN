const body=document.body;
const prefix=body.dataset.prefix||'';
const pl=body.dataset.lang==='pl';
const t=(a,b)=>pl?a:b;
const query=(s,inNode=document)=>inNode.querySelector(s);
const all=(s,inNode=document)=>Array.from(inNode.querySelectorAll(s));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback;}catch{return fallback;}};
const labels={robotCategory:t('kategoria','category'),tradeMode:t('rodzaj oferty','offer type'),make:t('producent','manufacturer'),model:t('model','model'),
  stock:t('pula sztuk','unit pool'),price:t('cena sprzedaży','sale price'),rentalPrice:t('stawka najmu','rental rate'),rentalUnit:t('okres najmu','rental period'),
  minimumRental:t('minimalny okres najmu','minimum rental period'),description:t('opis','description'),photos:t('zdjęcia','photos'),currency:t('waluta','currency'),
  city:t('miejscowość','city'),country:t('kraj','country'),condition:t('stan','condition'),listingPhone:t('telefon','phone')};

async function api(path,{method='GET',data,body:payload,headers={}}={}) {
  let response;
  try {
    response=await fetch(prefix+'/api'+path,{method,credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},
      body:data===undefined?payload:JSON.stringify(data)});
  } catch {throw new Error(t('Brak połączenia. Dane nadal są w formularzu.','Connection unavailable. Your data is still in the form.'));}
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.ok)throw new Error((result?.error||t('Nie udało się zapisać. Ponów operację.','Could not save. Try the operation again.'))+
    (result?.fields?.length?' '+result.fields.map(field=>labels[field]||field).join(', ')+'.':''));
  return result;
}

const editor=query('[data-robot-editor]');
if(editor) {
  const listing=editor.dataset.robotEditor;
  const state={version:Number(editor.dataset.version),photos:parse(editor.dataset.photos,[]),spin:parse(editor.dataset.spin,[]),video:editor.dataset.video||null};
  const status=query('[data-robot-status]',editor);
  let queue=Promise.resolve(),busy=false,dirty=false;
  const report=(message,bad=false)=>{status.textContent=message;status.classList.toggle('bad',bad);};
  function setBusy(value) {
    busy=value;
    editor.setAttribute('aria-busy',String(value));
    all('button,input[type=file]',editor).forEach(control=>{control.disabled=value;});
  }
  function enqueue(fn) {
    const task=queue.then(async()=>{
      setBusy(true);
      try {return await fn();}
      finally {setBusy(false);}
    });
    queue=task.catch(error=>report(error.message,true));
    return queue;
  }
  function data() {
    const result=Object.fromEntries(new FormData(editor));
    delete result.action;delete result.videoFile;delete result.spinFiles;
    result.negotiable=Boolean(editor.elements.negotiable.checked);
    return result;
  }
  function accept(result) {
    state.version=result.version;
    if(result.photos)state.photos=result.photos;
    if(result.spin)state.spin=result.spin;
    if(Object.hasOwn(result,'video'))state.video=result.video;
  }
  async function save() {
    report(t('Zapisywanie…','Saving…'));
    const result=await api('/listings/'+listing+'/edit',{method:'PUT',data:{version:state.version,data:data(),photos:state.photos,spin:state.spin,video:state.video,step:1}});
    accept(result);dirty=false;
    report(t('Zapisano na koncie.','Saved to your account.'));
    return result;
  }
  function drawMedia() {
    for(const group of ['photos','spin']) {
      const grid=query(group==='photos'?'[data-robot-photo-grid]':'[data-robot-spin-grid]',editor);
      grid.replaceChildren(...state[group].map((id,index)=>{
        const figure=document.createElement('figure');figure.className='robot-edit-photo';
        const img=document.createElement('img');img.src=prefix+'/media/'+encodeURIComponent(id)+'/thumb';img.alt=t('Zdjęcie ','Photo ')+(index+1);img.loading='lazy';
        const caption=document.createElement('figcaption');caption.textContent=group==='photos'&&index===0?t('Okładka','Cover'):t('Zdjęcie ','Photo ')+(index+1);
        const controls=document.createElement('div');controls.className='robot-photo-actions';
        const makeButton=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=label;b.dataset.robotMediaGroup=group;b.dataset.robotMediaId=id;b.dataset.robotMediaAction=action;return b;};
        if(index>0)controls.append(makeButton(t('Wcześniej','Earlier'),'previous'));
        if(index<state[group].length-1)controls.append(makeButton(t('Później','Later'),'next'));
        controls.append(makeButton(t('Usuń','Remove'),'remove'));
        figure.append(img,caption,controls);return figure;
      }));
    }
    const preview=query('[data-robot-video-preview]',editor);preview.replaceChildren();
    if(state.video){const video=document.createElement('video');video.src=prefix+'/wideo/'+encodeURIComponent(state.video);video.controls=true;video.playsInline=true;video.preload='metadata';preview.append(video);}
    query('[data-robot-video-remove]',editor).hidden=!state.video;
  }
  function toggleMode() {
    const mode=editor.elements.tradeMode.value;
    for(const [selector,on] of [['[data-robot-sale]',mode!=='rent'],['[data-robot-rental]',mode==='rent'||mode==='both']]) {
      for(const container of all(selector,editor)) {
        container.hidden=!on;
        all('input,select',container).forEach(control=>{control.disabled=!on;});
      }
    }
  }
  editor.elements.tradeMode.addEventListener('change',toggleMode);
  editor.addEventListener('input',()=>{dirty=true;});
  editor.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    const action=event.submitter?.value;
    if(action==='preview'&&!editor.reportValidity())return;
    enqueue(async()=>{await save();if(action==='preview')location.assign(prefix+'/roboty/podglad/'+listing);});
  });
  editor.addEventListener('click',event=>{
    const button=event.target.closest('[data-robot-media-action]');
    if(!button||busy)return;
    const {robotMediaGroup:group,robotMediaId:id,robotMediaAction:action}=button.dataset;
    enqueue(async()=>{
      const prior=[...state[group]],index=state[group].indexOf(id);
      if(index<0)return;
      if(action==='remove')state[group].splice(index,1);
      else {const target=action==='previous'?index-1:index+1;if(target<0||target>=state[group].length)return;[state[group][index],state[group][target]]=[state[group][target],state[group][index]];}
      try {await save();drawMedia();}catch(error){state[group]=prior;drawMedia();throw error;}
    });
  });
  async function uploadImages(files,group) {
    await save();
    const max=group==='photos'?30:24;
    for(const [index,file] of files.entries()) {
      if(state[group].length>=max)throw new Error(t('Osiągnięto limit liczby zdjęć.','The photo count limit has been reached.'));
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error(t('Użyj JPEG, PNG lub WebP do 12 MB.','Use JPEG, PNG or WebP up to 12 MB.'));
      report(t('Przesyłanie zdjęcia ','Uploading photo ')+(index+1)+' / '+files.length+'…');
      const result=await api('/listings/'+listing+'/'+(group==='photos'?'photo':'spin'),{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream','X-Edit-Version':String(state.version)}});
      accept(result);drawMedia();
    }
    report(t('Zdjęcia zapisane na koncie.','Photos saved to your account.'));
  }
  for(const [selector,group] of [['[data-robot-photos]','photos'],['[data-robot-spin]','spin']]) {
    query(selector,editor).addEventListener('change',event=>{
      const input=event.target,files=Array.from(input.files||[]);input.value='';
      if(files.length)enqueue(()=>uploadImages(files,group));
    });
  }
  query('[data-robot-video]',editor).addEventListener('change',event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    enqueue(async()=>{
      if(file.size>24*1024*1024)throw new Error(t('Film może mieć do 24 MB.','The video can be up to 24 MB.'));
      await save();report(t('Przesyłanie filmu…','Uploading video…'));
      accept(await api('/listings/'+listing+'/video',{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream','X-Edit-Version':String(state.version)}}));
      drawMedia();report(t('Film zapisany.','Video saved.'));
    });
  });
  query('[data-robot-video-remove]',editor).addEventListener('click',()=>{
    if(busy)return;
    enqueue(async()=>{const prior=state.video;state.video=null;try{await save();drawMedia();}catch(error){state.video=prior;throw error;}});
  });
  window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
  toggleMode();drawMedia();
}

for(const viewer of all('[data-robot-spin-view]')) {
  const frames=parse(viewer.dataset.robotSpinView,[]);
  query('input',viewer).addEventListener('input',event=>{const src=frames[Number(event.target.value)];if(src)query('img',viewer).src=src;});
}

for(const dialog of all('.robot-dialog')) {
  const start=query('[name=startsOn]',dialog),end=query('[name=endsOn]',dialog);
  if(start&&end) {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const leadDays=Math.max(0,Number(dialog.dataset.robotLeadDays)||0);
    const minimumDays=Math.max(1,Number(dialog.dataset.robotRentalDays)||1);
    const dateAfter=(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
    start.min=dateAfter(today,leadDays);
    const syncDates=()=>{
      const selected=start.value>=start.min?start.value:start.min;
      const parsed=Date.parse(selected+'T00:00:00Z');
      if(!Number.isFinite(parsed))return;
      end.min=dateAfter(selected,minimumDays);
    };
    start.addEventListener('input',syncDates);
    syncDates();
  }
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
}
