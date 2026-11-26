import * as L from './services-map-vendor/leaflet.js';

const messages = {
  pl: ['Mapa firm motoryzacyjnych', 'Wybierz lokalizację firmy', 'Powiększ', 'Pomniejsz', 'Podkład uliczny jest niedostępny. Punkty pozostają w swoich lokalizacjach.', 'Ponów', 'Ustaw punkt na środku mapy', 'Wskazano lokalizację', 'Firmy pod tym adresem', 'Pobieranie lokalizacji…', 'Zezwól na lokalizację w przeglądarce lub wpisz ją ręcznie.', 'Nie udało się ustalić lokalizacji. Wpisz ją ręcznie.', 'Upłynął czas pobierania lokalizacji. Ponów próbę.', 'Przeglądarka nie udostępnia lokalizacji. Wpisz ją ręcznie.', 'Lokalizacja została ustawiona.'],
  en: ['Automotive business map', 'Choose the business location', 'Zoom in', 'Zoom out', 'Street tiles are unavailable. Markers still show their actual locations.', 'Retry', 'Set point at map centre', 'Selected location', 'Businesses at this address', 'Finding your location…', 'Allow location in your browser or enter it manually.', 'Your location could not be determined. Enter it manually.', 'The location request timed out. Try again.', 'Your browser does not support location. Enter it manually.', 'Location updated.'],
  cs: ['Mapa autoslužeb', 'Vyberte polohu firmy', 'Přiblížit', 'Oddálit', 'Uliční mapa není dostupná. Body zůstávají na svých místech.', 'Zkusit znovu', 'Umístit bod do středu mapy', 'Vybraná poloha', 'Firmy na této adrese', 'Zjišťování polohy…', 'Povolte zjištění polohy nebo ji zadejte ručně.', 'Polohu se nepodařilo zjistit. Zadejte ji ručně.', 'Čas pro zjištění polohy vypršel. Zkuste to znovu.', 'Prohlížeč neposkytuje polohu. Zadejte ji ručně.', 'Poloha byla nastavena.'],
  sk: ['Mapa autoslužieb', 'Vyberte polohu firmy', 'Priblížiť', 'Oddialiť', 'Uličná mapa nie je dostupná. Body zostávajú na svojich miestach.', 'Skúsiť znova', 'Umiestniť bod do stredu mapy', 'Vybraná poloha', 'Firmy na tejto adrese', 'Zisťovanie polohy…', 'Povoľte zisťovanie polohy alebo ju zadajte ručne.', 'Polohu sa nepodarilo zistiť. Zadajte ju ručne.', 'Čas na zistenie polohy vypršal. Skúste to znova.', 'Prehliadač neposkytuje polohu. Zadajte ju ručne.', 'Poloha bola nastavená.'],
  de: ['Karte der Kfz-Betriebe', 'Standort des Betriebs wählen', 'Vergrößern', 'Verkleinern', 'Die Straßenkarte ist nicht verfügbar. Die Markierungen zeigen weiterhin die tatsächlichen Standorte.', 'Erneut laden', 'Punkt in der Kartenmitte setzen', 'Ausgewählter Standort', 'Betriebe an dieser Adresse', 'Standort wird bestimmt…', 'Erlauben Sie den Standortzugriff oder geben Sie den Standort ein.', 'Der Standort konnte nicht bestimmt werden. Geben Sie ihn manuell ein.', 'Die Standortabfrage hat zu lange gedauert. Bitte erneut versuchen.', 'Ihr Browser stellt keinen Standort bereit. Geben Sie ihn manuell ein.', 'Standort aktualisiert.'],
  uk: ['Мапа автостанцій і сервісів', 'Оберіть розташування компанії', 'Збільшити', 'Зменшити', 'Вулична мапа недоступна. Позначки залишаються на своїх місцях.', 'Спробувати ще', 'Поставити точку в центрі мапи', 'Вибране місце', 'Компанії за цією адресою', 'Визначаємо розташування…', 'Дозвольте доступ до геолокації або введіть координати вручну.', 'Не вдалося визначити місце. Введіть координати вручну.', 'Час очікування вичерпано. Повторіть спробу.', 'Браузер не надає геолокацію. Введіть координати вручну.', 'Розташування оновлено.']
};
const copy = messages[document.documentElement.lang.split('-')[0].toLowerCase()] || messages.pl;
const [resultsLabel, pickerLabel, zoomIn, zoomOut, tilesUnavailable, retryText, setCentre, selectedLabel, businessesLabel, locating, denied, unavailable, timedOut, unsupported, located] = copy;

function make(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function coordinate(value, limit) {
  if (!(typeof value === 'number' || typeof value === 'string' && value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function pair(lat, lon) {
  const y = coordinate(lat, 90);
  const x = coordinate(lon, 180);
  return y === null || x === null ? null : [y, x];
}

function localProfile(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function markerGroups(container) {
  let records;
  try { records = JSON.parse(container.dataset.serviceMarkers || '[]'); } catch { return []; }
  if (!Array.isArray(records)) return [];
  const groups = new Map();
  for (const row of records) {
    if (!row || typeof row !== 'object' || typeof row.name !== 'string' || !row.name.trim()) continue;
    const coords = pair(row.lat ?? row.latitude, row.lon ?? row.lng ?? row.longitude);
    const url = localProfile(row.url);
    if (!coords || !url) continue;
    const key = coords.join(',');
    if (!groups.has(key)) groups.set(key, {coords, profiles: []});
    groups.get(key).profiles.push({name: row.name.trim(), url});
  }
  return [...groups.values()];
}

function nearestLongitude(lon, centre) {
  return lon + 360 * Math.round((centre - lon) / 360);
}

// Find the shortest longitude interval, including locations on either side of the date line.
function longitudeCentre(groups) {
  const values = groups.map(({coords}) => (coords[1] + 360) % 360).sort((a, b) => a - b);
  let gap = -1;
  let west = 0;
  for (let i = 0; i < values.length; i++) {
    const next = i + 1 === values.length ? values[0] + 360 : values[i + 1];
    if (next - values[i] > gap) { gap = next - values[i]; west = next; }
  }
  return ((west + (360 - gap) / 2 + 180) % 360) - 180;
}

function link(profile) {
  const anchor = make('a', '', profile.name);
  anchor.href = profile.url;
  return anchor;
}

function addBusinessPins(map, groups) {
  if (!groups.length) { map.setView([17, 0], 1); return; }
  const initialCentre = longitudeCentre(groups);
  const pins = groups.map(({coords, profiles}) => {
    const multiple = profiles.length > 1;
    const label = multiple ? businessesLabel + ' (' + profiles.length + ')' : profiles[0].name;
    const action = make(multiple ? 'button' : 'a', 'service-map-pin');
    action.setAttribute('aria-label', label);
    action.title = label;
    const icon = make('span', 'service-map-pin-shape');
    icon.setAttribute('aria-hidden', 'true');
    const dot = make('span', 'service-map-pin-dot', multiple ? String(profiles.length) : '');
    icon.append(dot);
    action.append(icon);
    const at = [coords[0], nearestLongitude(coords[1], initialCentre)];
    const marker = L.marker(at, {
      keyboard: false, title: '', alt: '', bubblingMouseEvents: false,
      icon: L.divIcon({className: 'service-map-marker', html: action, iconSize: [44, 44], iconAnchor: [22, 42]})
    }).addTo(map);
    if (multiple) {
      action.type = 'button';
      action.setAttribute('aria-haspopup', 'dialog');
      action.addEventListener('click', event => {
        event.stopPropagation();
        const contents = make('div', 'service-map-businesses');
        contents.append(make('strong', '', businessesLabel));
        for (const profile of profiles) contents.append(link(profile));
        const popup = L.popup({offset: [0, -33], maxWidth: 260}).setLatLng(marker.getLatLng()).setContent(contents).openOn(map);
        popup.getElement()?.setAttribute('aria-label', businessesLabel);
        contents.querySelector('a')?.focus({preventScroll: true});
      });
    } else {
      action.href = profiles[0].url;
    }
    return {marker, coords, at};
  });
  if (pins.length === 1) map.setView(pins[0].at, 13);
  else map.fitBounds(pins.map(pin => pin.at), {padding: [33, 36], maxZoom: 15});
  map.on('moveend', () => {
    const centre = map.getCenter().lng;
    for (const {marker, coords} of pins) {
      const lon = nearestLongitude(coords[1], centre);
      if (marker.getLatLng().lng !== lon) marker.setLatLng([coords[0], lon]);
    }
  });
}

function fields(form) {
  if (!form) return null;
  const lat = form.querySelector('[name="lat"], [name="latitude"]');
  const lon = form.querySelector('[name="lon"], [name="longitude"], [name="lng"]');
  return lat && lon ? {lat, lon} : null;
}

function writeCoords(inputs, coords) {
  inputs.lat.value = coords[0].toFixed(6);
  inputs.lon.value = coords[1].toFixed(6);
  for (const input of [inputs.lat, inputs.lon]) {
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }
}

function statusLine(parent, className) {
  const node = make('span', className);
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  parent.append(node);
  return node;
}

function enablePicker(map, section, toolbar) {
  const inputs = fields(section.closest('form'));
  const point = make('span', 'service-map-picked-shape');
  point.setAttribute('aria-hidden', 'true');
  const chosen = L.marker([0, 0], {interactive: false, keyboard: false, icon: L.divIcon({
    className: 'service-map-picked', iconSize: [22, 22], iconAnchor: [11, 11], html: point
  })});
  if (!inputs) { map.setView([17, 0], 1); return; }
  let writing = false;
  const read = () => pair(inputs.lat.value, inputs.lon.value);
  function show(coords) {
    if (!coords) { chosen.remove(); return; }
    chosen.setLatLng(coords);
    if (!map.hasLayer(chosen)) chosen.addTo(map);
  }
  const initial = read();
  map.setView(initial || [17, 0], initial ? 14 : 1);
  show(initial);
  const centre = make('button', 'service-map-set-centre', setCentre);
  centre.type = 'button';
  toolbar.append(centre);
  const status = statusLine(toolbar, 'service-map-picked-status');
  function choose(location) {
    const {lat, lng} = location.wrap();
    const coords = pair(lat, lng);
    if (!coords) return;
    writing = true;
    writeCoords(inputs, coords);
    writing = false;
    show(coords);
    status.textContent = selectedLabel + ' · ' + coords.map(n => n.toFixed(5)).join(', ');
  }
  map.on('click', event => choose(event.latlng));
  centre.addEventListener('click', () => choose(map.getCenter()));
  const sync = () => {
    if (writing) return;
    const coords = read();
    show(coords);
    if (coords) map.setView(coords, Math.max(13, map.getZoom()), {animate: false});
    status.textContent = '';
  };
  inputs.lat.addEventListener('change', sync);
  inputs.lon.addEventListener('change', sync);
}

let atlasPromise;
function getAtlas() {
  if (!atlasPromise) {
    atlasPromise = fetch(new URL('./services-map-vendor/world-110m.json', import.meta.url))
      .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .catch(error => { atlasPromise = null; throw error; });
  }
  return atlasPromise;
}

function addBaseMaps(map, section, toolbar) {
  const pane = map.createPane('serviceAtlas');
  pane.style.zIndex = '185';
  pane.style.pointerEvents = 'none';
  const localAttribution = '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';
  const tileAttribution = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  map.attributionControl.addAttribution(localAttribution);
  // Separate local, geographic base. Markers, search and the picker do not depend on street tiles.
  getAtlas().then(data => {
    for (const offset of [-360, 0, 360]) {
      L.geoJSON(data, {
        pane: 'serviceAtlas', interactive: false,
        coordsToLatLng: ([lon, lat]) => L.latLng(lat, lon + offset),
        style: {pane: 'serviceAtlas', fillColor: '#e3e8db', color: '#9caf9d', weight: 0.7, fillOpacity: 1, smoothFactor: 1}
      }).addTo(map);
    }
    section.dataset.serviceAtlas = 'loaded';
  }).catch(() => { section.dataset.serviceAtlas = 'unavailable'; });

  const status = statusLine(toolbar, 'service-map-tile-status');
  const retry = make('button', 'service-map-retry', retryText);
  retry.type = 'button';
  retry.hidden = true;
  toolbar.append(retry);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    referrerPolicy: 'origin', attribution: tileAttribution, maxZoom: 19,
    updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 0
  });
  let successes = 0;
  let failures = 0;
  function fallback() {
    if (!map.hasLayer(tiles)) return;
    map.removeLayer(tiles);
    section.dataset.serviceTiles = 'fallback';
    status.textContent = tilesUnavailable;
    retry.hidden = false;
  }
  tiles.on('loading', () => { successes = 0; failures = 0; });
  tiles.on('tileload', () => { successes++; });
  tiles.on('tileerror', () => { failures++; });
  tiles.on('load', () => {
    // Leaflet finishes bookkeeping after its synchronous load event.
    if (failures && !successes) { queueMicrotask(fallback); return; }
    section.dataset.serviceTiles = failures ? 'partial' : 'loaded';
    status.textContent = failures ? tilesUnavailable : '';
    retry.hidden = !failures;
  });
  function loadTiles() {
    if (map.hasLayer(tiles)) map.removeLayer(tiles);
    section.dataset.serviceTiles = 'loading';
    status.textContent = '';
    retry.hidden = true;
    tiles.addTo(map);
    if (navigator.onLine === false) fallback();
  }
  retry.addEventListener('click', loadTiles);
  loadTiles();
}

function mount(section) {
  if (section.dataset.serviceMapReady) return;
  const picker = section.dataset.servicesMap === 'picker';
  const canvas = make('div', 'service-map-canvas');
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', picker ? pickerLabel : resultsLabel);
  const toolbar = make('div', 'service-map-tools');
  section.append(canvas, toolbar);
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(canvas, {
    minZoom: 1, maxZoom: 19, zoomControl: false, scrollWheelZoom: false, preferCanvas: true,
    zoomAnimation: animate, fadeAnimation: animate, markerZoomAnimation: animate
  });
  L.control.zoom({position: 'topleft', zoomInTitle: zoomIn, zoomOutTitle: zoomOut}).addTo(map);
  map.attributionControl.setPrefix(false);
  if (picker) enablePicker(map, section, toolbar);
  else addBusinessPins(map, markerGroups(section));
  addBaseMaps(map, section, toolbar);
  if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({pan: false})).observe(canvas);
  section.dataset.serviceMapReady = 'true';
}

function enableLocation(button) {
  const form = button.closest('form');
  const inputs = fields(form);
  if (!inputs) return;
  let feedback = form.querySelector('[data-service-location-status]');
  if (!feedback) {
    feedback = make('span', 'service-map-location-status');
    feedback.setAttribute('role', 'status');
    button.after(feedback);
  }
  feedback.setAttribute('aria-live', 'polite');
  button.addEventListener('click', event => {
    event.preventDefault();
    if (button.disabled) return;
    if (!navigator.geolocation) { feedback.textContent = unsupported; return; }
    const search = button.dataset.serviceLocate === 'search';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    feedback.textContent = locating;
    function finish(message) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      feedback.textContent = message;
    }
    function failed(error) {
      finish(error?.code === 1 ? denied : error?.code === 3 ? timedOut : unavailable);
    }
    try {
      navigator.geolocation.getCurrentPosition(position => {
        const coords = pair(position.coords.latitude, position.coords.longitude);
        if (!coords) { failed(); return; }
        writeCoords(inputs, coords);
        finish(located);
        if (search) {
          const radius = form.querySelector('[name="radius"], [name="radiusKm"], [name="distance"]');
          if (radius && !radius.value && [...(radius.options || [])].some(option => option.value === '25')) radius.value = '25';
          form.requestSubmit();
        }
      }, failed, {maximumAge: search ? 60000 : 0, enableHighAccuracy: !search, timeout: 12000});
    } catch { failed(); }
  });
}

// Defer online tile requests until the visitor actually opens or scrolls to the map.
const observer = window.IntersectionObserver && new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) { observer.unobserve(entry.target); mount(entry.target); }
  }
});
for (const section of document.querySelectorAll('[data-services-map]')) {
  if (observer) observer.observe(section); else mount(section);
}
for (const button of document.querySelectorAll('[data-service-locate]')) enableLocation(button);
