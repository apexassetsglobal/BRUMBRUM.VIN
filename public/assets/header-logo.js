(() => {
  const storageKey = 'brumbrum-header-logo';
  const header = document.querySelector('[data-header-logo]');
  if (!header) return;
  const original = header.querySelector('[data-header-original]');
  const preset = header.querySelector('[data-header-preset]');
  const controls = document.querySelectorAll('[data-personal-logo-choice]');
  const isPreset = value => /^(0[1-9]|[1-5][0-9]|60)$/.test(value);
  let choice = 'default';
  const ledChoices = document.querySelectorAll('[data-logo-led-choice]');
  const ledColors = {off:'transparent',red:'#ff003c',blue:'#164bff',violet:'#bb00ff',cyan:'#00f5ff',green:'#39ff14',gold:'#fff000',white:'#f5ffff'};
  const ledKey = 'brumbrum-logo-led';
  let led = 'off';
  function paintLed() {
    header.style.setProperty('--logo-led',ledColors[led]);
    header.dataset.logoLed = led;
    for (const control of ledChoices) control.checked = control.value === led;
  }
  for (const control of ledChoices) control.addEventListener('change',()=>{
    if (!control.checked || !Object.hasOwn(ledColors,control.value)) return;
    led=control.value;
    try { localStorage.setItem(ledKey,led); } catch {}
    paintLed();
  });

  function paint() {
    const variant = choice === 'default' ? header.dataset.headerLogo : choice;
    if (isPreset(variant)) preset.src = '/assets/brand-logos/' + variant + '.webp';
    preset.hidden = !isPreset(variant);
    original.hidden = !preset.hidden;
    for (const control of controls) control.checked = control.value === choice;
  }

  function restore() {
    try {
      const value = localStorage.getItem(storageKey);
      choice = isPreset(value) || value === 'original' ? value : 'default';
    } catch {}
    try {
      const value=localStorage.getItem(ledKey);
      led=Object.hasOwn(ledColors,value)?value:'off';
    } catch {}
    paintLed();
    paint();
  }

  for (const control of controls) control.addEventListener('change', () => {
    if (!control.checked) return;
    const value = control.value;
    if (value !== 'default' && value !== 'original' && !isPreset(value)) return;
    choice = value;
    try {
      if (choice === 'default') localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, choice);
    } catch {}
    paint();
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === ledKey || event.key === null) restore();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) restore();
  });
  restore();
})();
