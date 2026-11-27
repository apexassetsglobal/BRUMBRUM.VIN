(() => {
  const root = document.documentElement;
  const defaultSurface = 'leather-classic';
  const storageKey = 'a4-launch-surface';
  const available = new Set(JSON.parse(root.dataset.launchSurfaces || '[]'));
  const options = '[data-launch-surface-option]';
  let selected = defaultSurface;

  function apply(surface) {
    selected = available.has(surface) ? surface : defaultSurface;
    const image = selected === defaultSurface ? '/assets/launch-leather.webp' : '/assets/launch/' + selected + '.webp';
    root.dataset.launchSurface = selected;
    root.style.setProperty('--launch-surface-image', 'url("' + image + '")');
  }

  function restore() {
    let saved;
    try { saved = localStorage.getItem(storageKey); } catch {}
    apply(saved);
  }

  // Restore the surface before the browser paints the real launch screen.
  restore();
  if (document.currentScript?.hasAttribute('data-launch-home')) {
    const url = new URL(location.href);
    const launch = url.searchParams.get('launch') === '1';
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const initialNavigation = !document.referrer && performance.getEntriesByType('navigation')[0]?.type === 'navigate';
    if (launch) {
      url.searchParams.delete('launch');
      history.replaceState(history.state, '', url);
    }
    if (launch || (standalone && initialNavigation)) root.classList.add('app-launch');
  }

  function syncOptions() {
    for (const input of document.querySelectorAll(options)) input.checked = input.value === selected;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncOptions, {once:true});
  else syncOptions();

  document.addEventListener('change', event => {
    const input = event.target;
    if (!input.matches(options) || !input.checked || !available.has(input.value)) return;
    apply(input.value);
    syncOptions();
    try { localStorage.setItem(storageKey, selected); } catch {}
  });

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-launch-preview-open]');
    if (opener) {
      const dialog = document.querySelector('[data-launch-preview]');
      if (dialog && !dialog.open) dialog.showModal();
    } else if (event.target.closest('[data-launch-preview-close]')) {
      event.target.closest('dialog')?.close();
    }
  });

  function refresh() {
    restore();
    syncOptions();
  }
  root.addEventListener('reset-site-theme', () => {
    try { localStorage.removeItem(storageKey); } catch {}
    apply(defaultSurface);
    syncOptions();
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) refresh();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) refresh();
  });
})();
