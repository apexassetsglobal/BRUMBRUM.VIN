import { ZipReader, Uint8ArrayReader } from '@zip.js/zip.js/lib/zip-core-native.js';
import { SaxesParser } from 'saxes';
import { AppError, fail } from './core.js';

export const importLimits = Object.freeze({
  maxBytes: 4 * 1024 * 1024, maxRows: 1000, maxColumns: 100, maxCellLength: 32000,
  maxArchiveBytes: 16 * 1024 * 1024, maxEntryBytes: 8 * 1024 * 1024, maxEntries: 256,
  maxResultChars: 4 * 1024 * 1024
});
const limited = () => fail(413, 'Plik przekracza limit rozmiaru lub złożoności importu.', 'The file exceeds an import size or complexity limit.');
const bad = () => fail(422, 'Nieprawidłowa struktura lub kodowanie pliku.', 'The file structure or encoding is invalid.');
const headersError = () => fail(422, 'Nagłówki kolumn muszą być unikalne i niepuste.', 'Column headers must be unique and nonempty.');
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const dict = () => Object.create(null);
const norm = value => String(value).toLowerCase().replaceAll('ł', 'l').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const alias = {
  external_id: ['source_id','externalId','dealer_id','stock_id','stockNumber','listing_id','offer_id','id zewnętrzne','id oferty','identyfikator','id'],
  make: ['marka','brand','manufacturer','producent','make.name','brand.name','vehicle.make.name','vehicle.brand.name'],
  model: ['model pojazdu','car model','model.name','vehicle.model.name'],
  variant: ['wersja','wersja modelu','trim','version','derivative'], type: ['rodzaj pojazdu','typ pojazdu','typ','vehicle type','vehicle category','pojazd.typ','kategoria'],
  body: ['nadwozie','typ nadwozia','odmiana','body type','body style'], fuel: ['paliwo','rodzaj paliwa','fuel type'],
  gearbox: ['skrzynia','skrzynia biegów','transmission'], drive: ['napęd','drivetrain','drive type'],
  condition: ['stan','stan pojazdu'], damage: ['uszkodzony','damaged','uszkodzenia'],
  year: ['rok','rocznik','rok produkcji','production year','model year'], mileage: ['przebieg','przebieg km','kilometry','odometer','odometer value','mileage km'],
  power: ['moc','moc silnika','horsepower','power value'], powerUnit: ['jednostka mocy','power unit'],
  price: ['cena','cena brutto','gross price','price.amount','price.value','price.gross','cena.wartość','amount'],
  currency: ['waluta','waluta ceny','currency code','price.currency','price.currencyCode','cena.waluta'],
  netPrice: ['cena netto','net price'], city: ['miasto','miejscowość','town','locality'],
  region: ['województwo','province','state','county'], country: ['kraj','kraj ogłoszenia','country code'],
  engine: ['pojemność','pojemność silnika','engine capacity','engine size','engine displacement','displacement'],
  doors: ['drzwi','liczba drzwi'], seats: ['miejsca','liczba miejsc'], color: ['kolor','colour'],
  countryOrigin: ['kraj pochodzenia','origin country'], registered: ['data pierwszej rejestracji','pierwsza rejestracja','first registration','registration date'],
  vin: ['nr vin','numer vin','vehicle identification number','chassis number'],
  service: ['serwis','serwisowany','service history'], firstOwner: ['pierwszy właściciel','one owner'],
  accidentFree: ['bezwypadkowy','accident free'], negotiable: ['do negocjacji','negocjowalna','negotiable price'],
  equipment: ['wyposażenie','features','options','extras','accessories'],
  description: ['opis','opis ogłoszenia','description.pl','opis.pl'], description_en: ['opis en','english description','description.en','opis.en'],
  history: ['historia','historia pojazdu'], document: ['dokument','dokument sprzedaży','sale document'],
  contact: ['forma kontaktu','kontakt','contact method'], battery: ['bateria','pojemność baterii','battery capacity'],
  range: ['zasięg','range km','zasięg km'], photo_urls: ['zdjęcia','adresy zdjęć','photos','images','pictures','gallery','image urls','photo links','media.photos','zdjęcie','photo url','image url'],
  hours: ['motogodziny','engine hours'], grossWeight: ['masa całkowita','dmc','gross vehicle weight'],
  axles: ['osie','liczba osi'], availability: ['dostępność','status dostępności','status','stock status','available','stock availability'],
  sellerName: ['sprzedawca','nazwa sprzedawcy','seller.name','seller.company','dealer.name','dealer name','seller','company name'],
  sellerEmail: ['e-mail sprzedawcy','email','seller.email','dealer.email','contact.email'],
  listingPhone: ['telefon','numer telefonu','phone','seller.phone','dealer.phone','contact.phone']
};
export const importFields = Object.freeze(Object.keys(alias));

export function suggestMapping(columns) {
  const mapping = {};
  const names = Array.isArray(columns) ? columns.filter(c => typeof c === 'string') : [];
  const ranked = names.map(column => ({ column, full: norm(column), leaf: norm(column.split('.').at(-1)) }));
  for (const field of importFields) {
    const alternatives = [norm(field), ...alias[field].map(norm)];
    let candidate;
    for (const key of alternatives) {
      candidate = ranked.find(item => item.full === key);
      if (candidate) break;
    }
    if (!candidate) {
      // A generic nested "id" or "name" can belong to a vehicle, seller or photo.
      candidate = ranked.find(item => !['id','status','name','amount','value','type'].includes(item.leaf) &&
        alternatives.includes(item.leaf) && !/^(seller|dealer|sprzedawca|contact|media|image)\./i.test(item.column));
    }
    if (candidate) mapping[field] = candidate.column;
  }
  return mapping;
}

function limitsFor(options) {
  const result = { ...importLimits };
  for (const key of Object.keys(result)) {
    if (options[key] === undefined) continue;
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) bad();
    result[key] = Math.min(result[key], options[key]);
  }
  return result;
}

function byteView(input, limit) {
  let bytes;
  if (typeof input === 'string') {
    if (input.length > limit) limited();
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  else bad();
  if (bytes.length > limit) limited();
  if (!bytes.length) bad();
  return bytes;
}

function decode(bytes, hint) {
  const prefix = String.fromCharCode(...bytes.subarray(0,200));
  const declared = /^<\?xml\s+[^?]*?encoding\s*=\s*["']([\w-]+)["']/i.exec(prefix)?.[1];
  let encoding = String(hint ?? declared ?? 'utf-8').toLowerCase();
  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) encoding = 'utf-8';
  if ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] && bytes[1] === 0 && bytes[2] && bytes[3] === 0)) encoding = 'utf-16le';
  if ((bytes[0] === 254 && bytes[1] === 255) || (bytes[0] === 0 && bytes[1] && bytes[2] === 0 && bytes[3])) encoding = 'utf-16be';
  if (!['utf-8','utf8','utf-16','utf-16le','utf-16be','windows-1250','windows-1252','iso-8859-2','iso-8859-1','us-ascii'].includes(encoding)) bad();
  try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch { bad(); }
}

function validKey(key) {
  if (!key || key.length > 180 || /[\x00-\x1f\x7f]/.test(key) || key.split('.').some(k => unsafe.has(k))) headersError();
}

function cell(value, limits) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) bad();
  const text = String(value ?? '').trim();
  if (text.length > limits.maxCellLength) limited();
  return text;
}

function table(limits) {
  const rows = [];
  let columns, resultChars = 0;
  return {
    add(values) {
      if (!values.some(v => v !== '' && v != null)) return;
      if (values.length > limits.maxColumns) limited();
      if (!columns) {
        columns = Array.from(values, v => cell(v, limits));
        columns.forEach(validKey);
        if (new Set(columns).size !== columns.length) headersError();
      } else {
        if (rows.length >= limits.maxRows) limited();
        if (values.length > columns.length) bad();
        const row = {};
        for (let i = 0; i < columns.length; i++) {
          const key = columns[i], value = cell(values[i], limits);
          resultChars += key.length + value.length + 6;
          if (resultChars > limits.maxResultChars) limited();
          row[key] = value;
        }
        rows.push(row);
      }
    },
    result() {
      if (!columns) headersError();
      return { columns, rows };
    }
  };
}

function parseCsv(source, limits, options) {
  const declared = /^sep=([;,\t])\r?\n/i.exec(source);
  if (declared) source = source.slice(declared[0].length);
  const header = source.trimStart().split(/[\r\n]/, 1)[0].replace(/"(?:[^"]|"")*"/g, '');
  const count = symbol => header.split(symbol).length;
  const separator = options.delimiter ?? declared?.[1] ?? [';', ',', '\t'].sort((a,b) => count(b) - count(a))[0];
  if (![';', ',', '\t'].includes(separator)) bad();
  const sink = table(limits);
  let values = [], field = '', quoted = false, closed = false;
  const finish = () => {
    if (values.length >= limits.maxColumns) limited();
    values.push(cell(field, limits));
    field = ''; closed = false;
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === separator) finish();
    else if (ch === '\r' || ch === '\n') {
      finish(); sink.add(values); values = [];
      if (ch === '\r' && source[i + 1] === '\n') i++;
    } else if (ch === '"' && !closed && !field) quoted = true;
    else if (closed) { if (ch !== ' ' && ch !== '\t') bad(); }
    else { if (ch === '"') bad(); field += ch; }
    if (field.length > limits.maxCellLength) limited();
  }
  if (quoted) bad();
  if (field || closed || values.length) { finish(); sink.add(values); }
  return sink.result();
}

const listKeys = new Set([...alias.photo_urls, 'photo_urls', ...alias.equipment, 'equipment'].map(norm));
const records = new Set(['vehicle','car','offer','listing','item','ad','record','pojazd','oferta','ogloszenie','entry']);
const envelopes = new Set(['vehicles','cars','offers','listings','items','ads','records','pojazdy','oferty','ogloszenia','inventory','data','feed','rss','channel','results','result','response','stock','auto']);
const emptyXmlCollections = new Set(['vehicles','cars','offers','listings','items','ads','records','pojazdy','oferty','ogloszenia','inventory','stock']);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

function listItems(value, limits, depth = 0) {
  if (depth > 18) limited();
  if (!Array.isArray(value) && !isObject(value)) return [cell(value, limits)];
  if (isObject(value)) {
    const keys = Object.keys(value);
    const key = ['url','src','href','link','value','name','code','label','address'].find(k => own(value,k)) ?? (keys.length === 1 ? keys[0] : null);
    if (!key) fail(422, 'Podaj adres URL zdjęcia lub nazwę elementu wyposażenia.', 'Provide the image URL or equipment item name.');
    return listItems(value[key], limits, depth + 1);
  }
  if (value.length > 256) limited();
  const result = [];
  for (const item of value) {
    result.push(...listItems(item, limits, depth + 1));
    if (result.length > 256) limited();
  }
  return result;
}

function structuredRows(items, limits) {
  if (!Array.isArray(items)) bad();
  if (items.length > limits.maxRows) limited();
  const names = new Set();
  let resultChars = 0;
  const rows = items.map(item => {
    if (!isObject(item)) bad();
    const row = dict();
    function flatten(object, prefix = '', depth = 0) {
      if (depth > 18) limited();
      for (const [key,value] of Object.entries(object)) {
        validKey(key);
        const path = prefix ? prefix + '.' + key : key;
        validKey(path);
        const knownList = listKeys.has(norm(key));
        if (isObject(value) && !knownList) { flatten(value, path, depth + 1); continue; }
        if (own(row, path)) headersError();
        names.add(path);
        if (names.size > limits.maxColumns) limited();
        const column = Array.isArray(value) || (knownList && isObject(value)) ? listItems(value, limits).filter(Boolean) : cell(value, limits);
        resultChars += path.length + 6 + (Array.isArray(column) ? column.reduce((n,v) => n + v.length + 3, 0) : column.length);
        if (resultChars > limits.maxResultChars) limited();
        row[path] = column;
      }
    }
    flatten(item);
    return { ...row };
  });
  return { columns: [...names], rows };
}

function recordList(value, options, fromXml = false) {
  if (options.recordsPath) {
    const path = String(options.recordsPath).split('.');
    if (path.length > 18) limited();
    for (const key of path) {
      validKey(key);
      if (!isObject(value) || !own(value, key)) bad();
      value = value[key];
    }
    if (value === '' && fromXml && emptyXmlCollections.has(norm(path.at(-1)))) return [];
    return Array.isArray(value) ? value : [value];
  }
  for (let depth = 0; depth < 12; depth++) {
    if (Array.isArray(value)) return value;
    if (!isObject(value)) bad();
    const keys = Object.keys(value);
    // Individual listings, including partial ones, must retain nested vehicle metadata.
    if (keys.some(k => ['make','marka','model','externalid','vin','price','cena'].includes(norm(k)))) return [value];
    const groups = keys.filter(k => records.has(norm(k)) && (Array.isArray(value[k]) || isObject(value[k])));
    if (groups.length > 1) fail(422, 'Wskaż jedną kolekcję rekordów w tym źródle.', 'Choose a single collection of records in this source.');
    if (groups.length) return Array.isArray(value[groups[0]]) ? value[groups[0]] : [value[groups[0]]];
    if (keys.some(k => ['error','errors','fault'].includes(norm(k)))) bad();
    const container = keys.find(k => envelopes.has(norm(k)));
    if (!container) {
      const only = keys.length === 1 ? value[keys[0]] : null;
      if (isObject(only) && Object.keys(only).some(k => envelopes.has(norm(k)) || records.has(norm(k)))) { value = only; continue; }
      return [value];
    }
    value = value[container];
    if (value === '' && fromXml && emptyXmlCollections.has(norm(container))) return [];
  }
  limited();
}

const local = name => name.split(':').at(-1);
function readXml(source, handlers) {
  let depth = 0, count = 0, attributes = 0;
  const parser = new SaxesParser();
  parser.on('doctype', () => fail(422, 'Deklaracje DTD są niedozwolone w imporcie XML.', 'DTD declarations are not allowed in XML imports.'));
  parser.on('error', bad);
  parser.on('opentag', tag => {
    const keys = Object.keys(tag.attributes);
    attributes += keys.length;
    if (++depth > 40 || ++count > 240000 || keys.length > 100 || attributes > 360000) limited();
    handlers.open?.(local(tag.name), tag.attributes);
  });
  parser.on('closetag', tag => { handlers.close?.(local(tag.name)); depth--; });
  parser.on('text', text => handlers.text?.(text));
  parser.on('cdata', text => handlers.text?.(text));
  parser.write(source).close();
}

function xmlData(source, limits) {
  const stack = [];
  let root, nodes = 0;
  readXml(source, {
    open(name, attributes) {
      if (++nodes > 65000) limited();
      validKey(name);
      const values = dict();
      for (const [key,value] of Object.entries(attributes)) {
        if (key === 'xmlns' || key.startsWith('xmlns:')) continue;
        const k = local(key); validKey(k);
        if (own(values,k)) headersError();
        values[k] = cell(value, limits);
      }
      stack.push({ name, values, text: '', repeated: new Set() });
    },
    text(value) {
      if (!stack.length) return;
      const node = stack.at(-1);
      node.text += value;
      if (node.text.length > limits.maxCellLength) limited();
    },
    close() {
      const node = stack.pop(), parent = stack.at(-1), text = node.text.trim();
      let value = node.values;
      if (!Object.keys(value).length) value = text;
      else if (text) {
        if (own(value, 'value')) headersError();
        value.value = text;
      }
      if (!parent) { root = { [node.name]: value }; return; }
      if (!own(parent.values, node.name)) parent.values[node.name] = value;
      else {
        if (!parent.repeated.has(node.name)) {
          parent.values[node.name] = [parent.values[node.name]];
          parent.repeated.add(node.name);
        }
        parent.values[node.name].push(value);
      }
    }
  });
  return root;
}

function partPath(parent, target) {
  if (!target || /[\\\x00-\x1f?#]/.test(target) || /^[a-z][\w+.-]*:/i.test(target) || target.startsWith('//')) bad();
  const parts = target.startsWith('/') ? [] : parent.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!parts.length) bad(); parts.pop(); }
    else parts.push(segment);
  }
  return parts.join('/');
}

function relationships(source, parent) {
  const result = new Map();
  readXml(source, { open(name, attrs) {
    if (name !== 'Relationship' || attrs.TargetMode === 'External') return;
    if (!attrs.Id || !attrs.Type || result.has(attrs.Id)) bad();
    result.set(attrs.Id, { type: attrs.Type.split('/').at(-1), path: partPath(parent, attrs.Target) });
  }});
  return result;
}

function workbookInfo(source) {
  const sheets = [];
  let date1904 = false;
  readXml(source, { open(name, attrs) {
    if (name === 'workbookPr') date1904 = ['1','true'].includes(attrs.date1904);
    if (name === 'sheet') {
      const relKey = Object.keys(attrs).find(key => key.endsWith(':id'));
      sheets.push({ name: attrs.name, rel: attrs[relKey], visible: !attrs.state || attrs.state === 'visible' });
    }
  }});
  return { sheets, date1904 };
}

function stringTable(source, limits) {
  const strings = [];
  let current = null, text = false, phonetic = false;
  readXml(source, {
    open(name) {
      if (name === 'si') current = '';
      if (name === 'rPh') phonetic = true;
      if (name === 't' && !phonetic) text = true;
    },
    text(value) {
      if (!text || current == null) return;
      current += value;
      if (current.length > limits.maxCellLength) limited();
    },
    close(name) {
      if (name === 'rPh') phonetic = false;
      if (name === 't') text = false;
      if (name === 'si') {
        if (strings.length >= 100000) limited();
        strings.push(current);
        current = null;
      }
    }
  });
  return strings;
}

function dateStyles(source) {
  const formats = new Set([14,15,16,17,22,27,28,29,30,31,32,33,34,35,36,50,51,52,53,54,55,56,57,58]);
  const styles = [];
  let inFormats = false;
  readXml(source, {
    open(name, attrs) {
      if (name === 'numFmt' && /[yd]/i.test(String(attrs.formatCode).replace(/"[^"]*"|\\.|\[[^\]]*\]/g,''))) formats.add(Number(attrs.numFmtId));
      if (name === 'cellXfs') inFormats = true;
      if (inFormats && name === 'xf') styles.push(Number(attrs.numFmtId));
    },
    close(name) { if (name === 'cellXfs') inFormats = false; }
  });
  return styles.map(id => formats.has(id));
}

function spreadsheetValue(cell, strings, dates, date1904) {
  if (cell.type === 'inlineStr') return cell.inline;
  if (cell.type === 's') {
    if (!/^\d+$/.test(cell.value) || Number(cell.value) >= strings.length) bad();
    return strings[Number(cell.value)];
  }
  if (cell.type === 'e') return '';
  if (cell.type === 'b') return cell.value === '1' ? 'true' : 'false';
  if (cell.type === 'd') return cell.value.match(/^\d{4}-\d\d-\d\d/)?.[0] ?? cell.value;
  // Formula text is ignored. A cached scalar, if supplied by the spreadsheet, is the only value exposed.
  if (cell.value && dates[Number(cell.style)] && (!cell.type || cell.type === 'n')) {
    const serial = Number(cell.value);
    if (Number.isFinite(serial) && serial >= 0 && serial <= 2958465) {
      const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 60 ? 31 : 30);
      return new Date(epoch + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
    }
  }
  return cell.value;
}

function readSheet(source, strings, dates, date1904, limits) {
  const sink = table(limits);
  let values = null, current = null, capture = '', index = 0, rowCount = 0, phonetic = false;
  readXml(source, {
    open(name, attrs) {
      if (name === 'row') {
        if (values || ++rowCount > limits.maxRows + 201) limited();
        values = []; index = 0;
      } else if (name === 'c' && values) {
        if (current) bad();
        if (attrs.r) {
          const match = /^([A-Z]{1,3})[1-9]\d{0,6}$/i.exec(attrs.r);
          if (!match) bad();
          let column = 0;
          for (const ch of match[1].toUpperCase()) column = column * 26 + ch.charCodeAt(0) - 64;
          index = column - 1;
        }
        if (index >= limits.maxColumns) limited();
        if (own(values,index)) bad();
        current = { type: attrs.t, style: attrs.s, value: '', inline: '' };
      } else if (current) {
        if (name === 'rPh') phonetic = true;
        if (name === 'v' || (name === 't' && !phonetic)) capture = name === 'v' ? 'value' : 'inline';
      }
    },
    text(value) {
      if (!capture || !current) return;
      current[capture] += value;
      if (current[capture].length > limits.maxCellLength) limited();
    },
    close(name) {
      if (name === 'rPh') phonetic = false;
      if (name === 'v' || name === 't') capture = '';
      if (name === 'c' && current) {
        values[index++] = spreadsheetValue(current, strings, dates, date1904);
        current = null;
      }
      if (name === 'row' && values) {
        // A styled cell beyond the header or a trailing blank range is common in Excel.
        while (values.length && !values.at(-1)) values.pop();
        sink.add(values); values = null;
      }
    }
  });
  return sink.result();
}

async function parseWorkbook(bytes, limits, options) {
  const zip = new ZipReader(new Uint8ArrayReader(bytes), {
    useWebWorkers: false, useCompressionStream: true, filenameValidation: 'strict', checkSignature: true, checkOverlappingEntry: true
  });
  const entries = new Map();
  let expanded = 0, count = 0, actualTotal = 0;
  try {
    for await (const entry of zip.getEntriesGenerator()) {
      if (++count > limits.maxEntries) limited();
      if (entry.directory) continue;
      const name = entry.filename;
      if (entry.encrypted || ![0,8].includes(entry.compressionMethod) || entries.has(name) ||
          /\\|(^|\/)vbaProject\.bin$|(^|\/)macrosheets\//i.test(name)) bad();
      expanded += entry.uncompressedSize;
      if (entry.uncompressedSize > limits.maxEntryBytes || expanded > limits.maxArchiveBytes) limited();
      entries.set(name,entry);
    }
    async function read(path) {
      const entry = entries.get(path);
      if (!entry) bad();
      // Check observed output as well as metadata. Never allocate an unchecked size from an uploaded archive.
      const buffer = new Uint8Array(entry.uncompressedSize);
      let offset = 0;
      await entry.getData(new WritableStream({ write(chunk) {
        actualTotal += chunk.byteLength;
        if (offset + chunk.byteLength > buffer.length || actualTotal > limits.maxArchiveBytes) limited();
        buffer.set(chunk, offset); offset += chunk.byteLength;
      }}));
      if (offset !== buffer.length) bad();
      return decode(buffer);
    }
    const types = await read('[Content_Types].xml');
    let regularWorkbook = false;
    readXml(types, { open(name, attrs) {
      if (name !== 'Override' && name !== 'Default') return;
      if (/macroenabled|vbaproject|macrosheet/i.test(attrs.ContentType)) bad();
      if (attrs.ContentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml') regularWorkbook = true;
    }});
    if (!regularWorkbook) bad();
    const root = relationships(await read('_rels/.rels'), '');
    const workbook = [...root.values()].find(rel => rel.type === 'officeDocument')?.path;
    if (!workbook) bad();
    const { sheets, date1904 } = workbookInfo(await read(workbook));
    const lastSlash = workbook.lastIndexOf('/');
    const relPath = workbook.slice(0, lastSlash + 1) + '_rels/' + workbook.slice(lastSlash + 1) + '.rels';
    const rels = relationships(await read(relPath), workbook);
    const sheet = sheets.find(s => rels.get(s.rel)?.type === 'worksheet' && (options.sheet ? s.name === options.sheet : s.visible));
    if (!sheet) fail(422, 'W skoroszycie brakuje wskazanego arkusza z danymi.', 'The workbook does not contain the requested data sheet.');
    const parts = [...rels.values()];
    const shared = parts.find(rel => rel.type === 'sharedStrings');
    const style = parts.find(rel => rel.type === 'styles');
    const strings = shared ? stringTable(await read(shared.path), limits) : [];
    const dates = style ? dateStyles(await read(style.path)) : [];
    return readSheet(await read(rels.get(sheet.rel).path), strings, dates, date1904, limits);
  } catch (error) {
    if (error instanceof AppError) throw error;
    bad();
  } finally { await zip.close(); }
}

/** Reads a complete snapshot without outbound requests. Optional limits can only lower the server defaults. */
export async function parseImport(input, format = 'auto', options = {}) {
  const limits = limitsFor(options);
  const bytes = byteView(input, limits.maxBytes);
  const finish = result => {
    if (options.allowEmpty === false && !result.rows.length) fail(422, 'Plik nie zawiera żadnych ofert.', 'The file contains no listings.');
    return result;
  };
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let kind = String(format || 'auto').toLowerCase().replace(/^\./,'');
  if (kind === 'auto' && zip) kind = 'xlsx';
  if (kind === 'xlsx') return finish(await parseWorkbook(bytes, limits, options));
  const source = typeof input === 'string' ? input.replace(/^\ufeff/, '') : decode(bytes, options.encoding);
  if (/\0/.test(source)) bad();
  if (kind === 'auto') {
    const first = source.trimStart()[0];
    kind = first === '<' ? 'xml' : first === '{' || first === '[' ? 'json' : 'csv';
  }
  if (kind === 'csv') return finish(parseCsv(source, limits, options));
  if (kind === 'xml') return finish(structuredRows(recordList(xmlData(source, limits), options, true), limits));
  if (kind === 'json') {
    let payload;
    try {
      payload = JSON.parse(source, (_key, value, context) => {
        // A stock number sent as a JSON integer may exceed JavaScript's exact integer range.
        if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value) && context?.source) return context.source;
        return value;
      });
    } catch { bad(); }
    return finish(structuredRows(recordList(payload, options), limits));
  }
  fail(422, 'Obsługiwane formaty to CSV, XLSX, JSON i XML.', 'Supported formats are CSV, XLSX, JSON and XML.');
}
