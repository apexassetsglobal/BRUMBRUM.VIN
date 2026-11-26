(() => {
  const storageKey = 'brumbrum-header-logo';
  const header = document.querySelector('[data-header-logo]');
  if (!header) return;
  const original = header.querySelector('[data-header-original]');
  const preset = header.querySelector('[data-header-preset]');
  const controls = document.querySelectorAll('[data-personal-logo-choice]');
  const isPreset = value => /^(0[1-9]|1[0-9]|20)$/.test(value);
  let choice = 'default';

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
    if (event.key === storageKey || event.key === null) restore();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) restore();
  });
  restore();
})();
