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
  const paletteKeys = {light:'a4-light-palette', dark:'a4-dark-palette'};
  const themeToggles = '[data-theme-toggle]';
  const themeChoices = '[data-theme-choice]';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const defaultStyle = dataset.iconStyle;
  const styles = dataset.iconStyles.split(' ');
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
  restoreIconAppearance();
  if (buttonPresets && buttonChoices) restoreButtonFinish();
  paintButtonEmbroidery();
  restoreButtonHardware();
  document.addEventListener('DOMContentLoaded', () => {
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
      for (const key of [themeKey, ...Object.values(paletteKeys)]) localStorage.removeItem(key);
      for (const palette of themeMaterials) {
        for (const field of Object.keys(themeStitchValues)) localStorage.removeItem(stitchKey(palette, field));
      }
    } catch {}
    applyTheme('light');
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
    if (event.key === null || event.key === themeKey) applyTheme();
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
      applyTheme();
      paintButtonEmbroidery();
      restoreButtonHardware();
      restoreIconAppearance();
      if (buttonPresets && buttonChoices) restoreButtonFinish();
    }
  });
})();
