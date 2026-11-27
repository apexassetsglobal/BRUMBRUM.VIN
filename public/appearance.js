(() => {
  const root = document.documentElement;
  const {dataset} = root;
  const themeModes = JSON.parse(dataset.themeModes);
  const themeMaterials = dataset.themeMaterials.split(' ');
  const themeStitchValues = JSON.parse(dataset.themeStitchValues);
  const stitchAttributes = {thread:'themeThread', contrast:'themeStitchContrast'};
  const stitchPrefix = 'a4-theme-stitch:';
  const stitchKey = (palette, field) => stitchPrefix + palette + ':' + field;
  const stitchChoices = '[data-theme-stitch-choice]';
  const temporaryStitches = new Map();
  const themeKey = 'a4-theme';
  const photoRevealKey = 'a4-photo-reveal-effect';
  const photoRevealChoices = 'input[data-photo-reveal-choice]';
  const paletteKeys = {light:'a4-light-palette', dark:'a4-dark-palette'};
  const themeToggles = '[data-theme-toggle]';
  const themeChoices = '[data-theme-choice]';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const defaultStyle = dataset.iconStyle;
  const styles = dataset.iconStyles.split(' ');
  const iconSizeKey = 'a4-icon-sizes-v1';
  const iconSizeDevices = ['phone','tablet','desktop'];
  let iconSizes = {phone:100,tablet:100,desktop:100};
  function paintIconSizes(values) {
    for (const device of iconSizeDevices) {
      const number = Number(values?.[device]);
      iconSizes[device] = Number.isFinite(number) && number >= 80 && number <= 130 ? number : 100;
      root.style.setProperty('--icon-size-'+device, String(iconSizes[device]/100));
      for (const control of document.querySelectorAll('[data-icon-size="'+device+'"]')) control.value=String(iconSizes[device]);
      for (const output of document.querySelectorAll('[data-icon-size-output="'+device+'"]')) output.textContent=iconSizes[device]+'%';
    }
  }
  function restoreIconSizes() {
    let stored; try { stored=JSON.parse(localStorage.getItem(iconSizeKey)); } catch {}
    paintIconSizes(stored);
  }
  restoreIconSizes();
  document.addEventListener('input', event=>{
    const control=event.target;
    const device=control?.dataset?.iconSize;
    if (!iconSizeDevices.includes(device)) return;
    const next=Number(control.value);
    if (!Number.isFinite(next) || next < 80 || next > 130) return;
    paintIconSizes({...iconSizes,[device]:next});
    try { localStorage.setItem(iconSizeKey,JSON.stringify(iconSizes)); } catch {}
  });
  const buttonFinishKey = 'a4-button-finish';
  const buttonPresets = dataset.buttonFinishPresets ? JSON.parse(dataset.buttonFinishPresets) : null;
  const buttonChoices = dataset.buttonFinishChoices ? JSON.parse(dataset.buttonFinishChoices) : null;
  const buttonAttributes = {color:'buttonColor', material:'buttonMaterial', stitch:'buttonStitch', thread:'buttonThread'};
  const buttonPresetSelector = 'input[data-button-finish-preset]';
  const buttonFieldSelector = 'input[data-button-finish-field]';
  const embroideryKey = 'a4-button-embroidery';
  const embroideryChoices = dataset.buttonEmbroideryChoices.split(' ');
  const embroiderySelector = 'input[data-button-embroidery-choice]';
  const buttonHardwareKey = 'a4-button-hardware';
  const buttonHardwareChoices = dataset.buttonHardwareChoices ? JSON.parse(dataset.buttonHardwareChoices) : null;
  const defaultButtonHardware = dataset.buttonHardware ? JSON.parse(dataset.buttonHardware) : null;
  const hardwareSelector = 'input[data-button-hardware-field]';

  function readPreference(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function paintPhotoReveal(value = readPreference(photoRevealKey)) {
    dataset.photoRevealEffect = value === 'scatter' ? 'scatter' : 'classic';
    for (const control of document.querySelectorAll(photoRevealChoices)) {
      control.checked = control.value === dataset.photoRevealEffect;
    }
  }

  function paintThemeStitch() {
    const palette = dataset.palette;
    const isMaterial = themeMaterials.includes(palette);
    for (const [field, options] of Object.entries(themeStitchValues)) {
      const attribute = stitchAttributes[field];
      if (isMaterial) {
        const key = stitchKey(palette, field);
        const value = temporaryStitches.get(key) ?? readPreference(key);
        dataset[attribute] = options.includes(value) ? value : options[0];
      } else {
        delete dataset[attribute];
      }
    }
    for (const form of document.querySelectorAll('[data-theme-stitch-settings]')) form.hidden = !isMaterial;
    for (const control of document.querySelectorAll(stitchChoices)) {
      control.checked = control.value === dataset[stitchAttributes[control.dataset.themeStitchChoice]];
    }
  }

  function selectThemeStitch(control) {
    const field = control.dataset.themeStitchChoice;
    const value = control.value;
    if (!themeMaterials.includes(dataset.palette) || !Object.hasOwn(themeStitchValues, field) ||
        !themeStitchValues[field].includes(value)) return;
    const key = stitchKey(dataset.palette, field);
    try {
      if (value === themeStitchValues[field][0]) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      temporaryStitches.delete(key);
    } catch {
      temporaryStitches.set(key, value);
    }
    paintThemeStitch();
  }

  function applyTheme(value = readPreference(themeKey)) {
    if (dataset.market === 'robotics') value = 'light';
    const preference = Object.hasOwn(themeModes, value) ? value : 'light';
    const palette = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    dataset.theme = themeModes[palette];
    dataset.palette = palette;
    root.toggleAttribute('data-theme-material', themeMaterials.includes(palette));
    for (const toggle of document.querySelectorAll(themeToggles)) toggle.setAttribute('aria-pressed', String(dataset.theme === 'dark'));
    for (const control of document.querySelectorAll(themeChoices)) control.checked = control.value === preference;
    paintThemeStitch();
  }

  function selectTheme(value) {
    const mode = themeModes[value];
    try {
      localStorage.setItem(themeKey, value);
      if (mode !== 'system') localStorage.setItem(paletteKeys[mode], value);
    } catch {}
    applyTheme(value);
  }

  function restoreIconAppearance() {
    let style, surface;
    try {
      style = localStorage.getItem('a4-icon-style');
      surface = localStorage.getItem('a4-icon-surface');
    } catch {}
    dataset.iconStyle = styles.includes(style) ? style : defaultStyle;
    dataset.iconSurface = ['glass','dark'].includes(surface) ? surface : 'none';
  }

  function syncButtonFinishControls() {
    const matched = Object.keys(buttonPresets).find(preset=>
      Object.entries(buttonAttributes).every(([field,attribute])=>buttonPresets[preset][field]===dataset[attribute]));
    const selected = matched ?? 'custom';
    for (const control of document.querySelectorAll(buttonPresetSelector)) {
      control.checked = control.value === selected;
      if (control.value === 'custom') {
        const card = control.parentElement;
        card.hidden = selected !== 'custom';
        if (!card.hidden) {
          const swatch = card.querySelector('.button-finish-swatch');
          for (const attribute of Object.values(buttonAttributes)) swatch.dataset[attribute] = dataset[attribute];
        }
      }
    }
    for (const control of document.querySelectorAll(buttonFieldSelector)) {
      control.checked = control.value === dataset[buttonAttributes[control.dataset.buttonFinishField]];
    }
  }

  function paintButtonFinish(preferences) {
    for (const [field, options] of Object.entries(buttonChoices)) {
      const selected = preferences?.[field];
      dataset[buttonAttributes[field]] = options.includes(selected) ? selected : buttonPresets.stock[field];
    }
    syncButtonFinishControls();
  }

  function restoreButtonFinish() {
    let preferences;
    try { preferences = JSON.parse(localStorage.getItem(buttonFinishKey)); } catch {}
    paintButtonFinish(preferences);
  }

  function paintButtonEmbroidery(value = readPreference(embroideryKey)) {
    dataset.buttonEmbroidery = embroideryChoices.includes(value) ? value : embroideryChoices[0];
    for (const control of document.querySelectorAll(embroiderySelector)) {
      control.checked = control.value === dataset.buttonEmbroidery;
    }
  }

  function paintButtonHardware(preferences) {
    if (!buttonHardwareChoices || !defaultButtonHardware) return;
    for (const [field,choices] of Object.entries(buttonHardwareChoices)) {
      const value=choices.includes(preferences?.[field])?preferences[field]:defaultButtonHardware[field];
      dataset['buttonHardware'+field[0].toUpperCase()+field.slice(1)]=value;
      for (const control of document.querySelectorAll(`${hardwareSelector}[data-button-hardware-field="${field}"]`)) control.checked=control.value===value;
    }
  }

  function restoreButtonHardware() {
    let preferences;
    try { preferences=JSON.parse(localStorage.getItem(buttonHardwareKey)); } catch {}
    paintButtonHardware(preferences);
  }

  applyTheme();
  paintPhotoReveal();
  restoreIconAppearance();
  if (buttonPresets && buttonChoices) restoreButtonFinish();
  paintButtonEmbroidery();
  restoreButtonHardware();
  document.addEventListener('DOMContentLoaded', () => {
    paintIconSizes(iconSizes);
    paintPhotoReveal(dataset.photoRevealEffect);
    applyTheme();
    paintButtonEmbroidery();
    restoreButtonHardware();
    if (buttonPresets && buttonChoices) {
      syncButtonFinishControls();
      for (const group of document.querySelectorAll('[data-button-finish-palette],[data-button-finish-preset-group]')) {
        if (group.querySelector('input:checked')) group.open = true;
      }
    }
  }, {once:true});
  systemTheme.addEventListener('change', () => {
    if (readPreference(themeKey) === 'system') applyTheme('system');
  });
  document.addEventListener('click', event => {
    if (!event.target.closest?.(themeToggles)) return;
    try { localStorage.setItem(paletteKeys[dataset.theme], dataset.palette); } catch {}
    const nextMode = dataset.theme === 'dark' ? 'light' : 'dark';
    const preferred = readPreference(paletteKeys[nextMode]);
    selectTheme(themeModes[preferred] === nextMode ? preferred : nextMode);
  });
  root.addEventListener('reset-site-theme', () => {
    temporaryStitches.clear();
    try {
      for (const key of [themeKey, photoRevealKey, ...Object.values(paletteKeys)]) localStorage.removeItem(key);
      for (const palette of themeMaterials) {
        for (const field of Object.keys(themeStitchValues)) localStorage.removeItem(stitchKey(palette, field));
      }
    } catch {}
    applyTheme('light');
    paintPhotoReveal('classic');
  });
  root.addEventListener('reset-button-finish', () => {
    if (buttonPresets && buttonChoices) paintButtonFinish(null);
    try { localStorage.removeItem(embroideryKey); } catch {}
    paintButtonEmbroidery(null);
    try { localStorage.removeItem(buttonHardwareKey); } catch {}
    paintButtonHardware(null);
  });
  document.addEventListener('change', event => {
    const control = event.target;
    if (!control.checked) return;
    if (control.matches(themeChoices) && Object.hasOwn(themeModes, control.value)) {
      selectTheme(control.value);
      return;
    }
    if (control.matches(photoRevealChoices)) {
      if (control.value !== 'classic' && control.value !== 'scatter') return;
      try { localStorage.setItem(photoRevealKey, control.value); } catch {}
      paintPhotoReveal(control.value);
      return;
    }
    if (control.matches(stitchChoices)) {
      selectThemeStitch(control);
      return;
    }
    if (control.matches(embroiderySelector)) {
      if (!embroideryChoices.includes(control.value)) return;
      try { localStorage.setItem(embroideryKey, control.value); } catch {}
      paintButtonEmbroidery(control.value);
      return;
    }
    if (control.matches(hardwareSelector)) {
      const field=control.dataset.buttonHardwareField;
      if (!buttonHardwareChoices?.[field]?.includes(control.value)) return;
      const preferences=Object.fromEntries(Object.keys(buttonHardwareChoices).map(name=>{
        const attr='buttonHardware'+name[0].toUpperCase()+name.slice(1);
        return [name,dataset[attr]];
      }));
      preferences[field]=control.value;
      try { localStorage.setItem(buttonHardwareKey,JSON.stringify(preferences)); } catch {}
      paintButtonHardware(preferences);
      return;
    }
    if (buttonPresets && buttonChoices) {
      let preferences;
      if (control.matches(buttonPresetSelector) && Object.hasOwn(buttonPresets, control.value)) {
        preferences = buttonPresets[control.value];
      } else if (control.matches(buttonFieldSelector)) {
        const field = control.dataset.buttonFinishField;
        if (!Object.hasOwn(buttonChoices,field) || !buttonChoices[field].includes(control.value)) return;
        preferences = Object.fromEntries(Object.entries(buttonAttributes).map(([name,attribute])=>[name,dataset[attribute]]));
        preferences[field] = control.value;
      } else {
        return;
      }
      try { localStorage.setItem(buttonFinishKey, JSON.stringify(preferences)); } catch {}
      paintButtonFinish(preferences);
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === iconSizeKey) restoreIconSizes();
    if (event.key === null || event.key === themeKey) applyTheme();
    if (event.key === null || event.key === photoRevealKey) paintPhotoReveal();
    if (event.key === null || event.key === embroideryKey) paintButtonEmbroidery();
    if (event.key === null || event.key === buttonHardwareKey) restoreButtonHardware();
    if (event.key?.startsWith(stitchPrefix)) paintThemeStitch();
    if (event.key === null || event.key === 'a4-icon-style' || event.key === 'a4-icon-surface') {
      restoreIconAppearance();
    }
    if (buttonPresets && buttonChoices && (event.key === null || event.key === buttonFinishKey)) restoreButtonFinish();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      restoreIconSizes();
      paintPhotoReveal();
      applyTheme();
      paintButtonEmbroidery();
      restoreButtonHardware();
      restoreIconAppearance();
      if (buttonPresets && buttonChoices) restoreButtonFinish();
    }
  });
})();
