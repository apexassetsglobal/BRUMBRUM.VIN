(() => {
  const url = new URL(location.href);
  const launch = url.searchParams.get('launch') === '1';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const initialNavigation = !document.referrer && performance.getEntriesByType('navigation')[0]?.type === 'navigate';
  if (launch) {
    url.searchParams.delete('launch');
    history.replaceState(history.state, '', url);
  }
  if (launch || (standalone && initialNavigation)) {
    document.documentElement.classList.add('app-launch');
  }
})();
