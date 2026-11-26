const normalize=value=>value.trim().toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu,'').replaceAll('ł','l');

export function searchCombobox(select,labels) {
  const label=select.closest('label');
  const wrapper=document.createElement('span');
  wrapper.className='search-combobox';
  const input=document.createElement('input');
  input.id='search-combobox-'+select.name;
  input.type='text';
  input.autocomplete='off';
  input.spellcheck=false;
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');

  const popup=document.createElement('span');
  popup.className='search-suggestions';
  popup.hidden=true;
  const list=document.createElement('span');
  list.id=input.id+'-list';
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label',label.firstElementChild.textContent);
  input.setAttribute('aria-controls',list.id);
  const status=document.createElement('span');
  status.className='search-suggestions-status';
  status.setAttribute('role','status');
  popup.append(list,status);
  wrapper.append(input,popup);
  select.after(wrapper);
  select.hidden=true;
  label.htmlFor=input.id;

  let matches=[],active=-1,edited=false;
  function close() {
    popup.hidden=true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    active=-1;
  }
  function sync() {
    input.disabled=select.disabled;
    input.placeholder=select.options[0]?.textContent||'';
    input.value=select.value;
    edited=false;
    close();
  }
  function commit(value) {
    const changed=select.value!==value;
    select.value=value;
    sync();
    if (changed) select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function show() {
    const query=normalize(input.value);
    matches=[...select.options].filter(option=>query
      ? option.value&&normalize(option.value).startsWith(query)
      : true);
    list.replaceChildren(...matches.map((option,index)=>{
      const row=document.createElement('span');
      row.id=list.id+'-'+index;
      row.dataset.option=String(index);
      row.setAttribute('role','option');
      row.setAttribute('aria-selected',String(select.value===option.value));
      row.textContent=option.textContent;
      return row;
    }));
    status.textContent=matches.length?'':labels.noResults;
    active=-1;
    popup.scrollTop=0;
    popup.hidden=false;
    input.setAttribute('aria-expanded','true');
    input.removeAttribute('aria-activedescendant');
  }
  function point(index) {
    if (!matches.length) return;
    active=Math.max(0,Math.min(matches.length-1,index));
    const row=list.children[active];
    for (const option of list.children) option.setAttribute('aria-selected',String(option===row));
    input.setAttribute('aria-activedescendant',row.id);
    row.scrollIntoView({block:'nearest'});
  }

  input.addEventListener('focus',show);
  input.addEventListener('click',()=>{if (popup.hidden) show();});
  input.addEventListener('input',()=>{
    if (!input.value.trim()) commit('');
    edited=true;
    show();
  });
  input.addEventListener('blur',()=>{
    if (edited&&input.value.trim()) {
      const exact=matches.find(option=>normalize(option.value)===normalize(input.value));
      if (exact||matches.length===1) {commit((exact||matches[0]).value);return;}
    }
    sync();
  });
  input.addEventListener('keydown',event=>{
    if (event.isComposing) return;
    if (event.key==='ArrowDown'||event.key==='ArrowUp') {
      event.preventDefault();
      if (popup.hidden) show();
      point(active===-1&&event.key==='ArrowUp'?matches.length-1:active+(event.key==='ArrowDown'?1:-1));
    } else if (event.key==='Escape'&&!popup.hidden) {
      event.preventDefault();
      sync();
    } else if (event.key==='Enter'&&!popup.hidden&&(active>=0||edited)) {
      event.preventDefault();
      const option=matches[active]||matches.find(option=>normalize(option.value)===normalize(input.value))||
        (matches.length===1?matches[0]:null);
      if (option) commit(option.value);
    }
  });
  list.addEventListener('pointerdown',event=>{
    if (event.target.closest('[data-option]')) event.preventDefault();
  });
  list.addEventListener('click',event=>{
    const option=event.target.closest('[data-option]');
    if (!option) return;
    event.preventDefault();
    commit(matches[Number(option.dataset.option)].value);
  });
  sync();
  return sync;
}
