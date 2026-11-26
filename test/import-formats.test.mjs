import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ZipWriter, TextReader, Uint8ArrayWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { importLimits, parseImport, suggestMapping } from '../src/import-formats.js';

const sample = kind => readFile(new URL('../public/assets/import-samples/pojazdy.' + kind, import.meta.url));
const encoded = text => new TextEncoder().encode(text);
const rejected = (promise, status) => assert.rejects(promise, error => error.status === status && Boolean(error.pl && error.en));

test('the four downloadable templates yield the same vehicles, fields, currency, Unicode and galleries', async () => {
  let reference;
  for (const format of ['csv','xlsx','json','xml']) {
    const bytes = await sample(format);
    const { columns, rows } = await parseImport(bytes, 'auto');
    assert.equal(rows.length, 2, format);
    const mapping = suggestMapping(columns);
    assert.equal(Object.keys(mapping).length, 24, format);
    const records = rows.map(row => Object.fromEntries(Object.entries(mapping).map(([field, col]) => {
      const value = row[col];
      return [field, ['photo_urls','equipment'].includes(field) && typeof value === 'string' ? value.split('|') : value];
    })));
    if (reference) assert.deepEqual(records,reference,format);
    else reference = records;
  }
  assert.equal(reference[0].external_id,'SZABLON-001');
  assert.equal(reference[0].city,'Łódź');
  assert.equal(reference[1].type,'motorcycle');
  assert.equal(reference[0].photo_urls.length,2);
  assert.equal(reference[0].currency,'PLN');
});

test('CSV handles Polish Excel delimiter, DOS and multiline quoted values, double quotes, tabs and leading zeroes', async () => {
  const csv = '\ufeffsep=;\r\nID;Opis;Cena\r\n001;"Kombi; z bagażnikiem\r\n""Touring""";0\r\n\r\n002;Szkic\r\n';
  const {rows} = await parseImport(encoded(csv).buffer,'csv');
  assert.deepEqual(rows,[{ID:'001',Opis:'Kombi; z bagażnikiem\r\n"Touring"',Cena:'0'},{ID:'002',Opis:'Szkic',Cena:''}]);
  assert.deepEqual((await parseImport('VIN\tModel\n0012\tŁada')).rows,[{VIN:'0012',Model:'Łada'}]);
  assert.deepEqual((await parseImport('Make,Model\r"Toyota","Yaris"','csv')).rows,[{Make:'Toyota',Model:'Yaris'}]);
});

test('nested JSON and namespace-aware XML retain attribute prices, labels, locations and a seller email',async () => {
  const listing = { external_id: '007', vehicle:{make:'Ford',model:'Transit'},price:{amount:1200,currency:'EUR'},seller:{name:'Sample',email:'seller@example.invalid'},metadata:{active:false},photos:[{src:'one'},{url:'two'}],equipment:[{name:'abs'}, {code:'ac'}] };
  const parsed = await parseImport(JSON.stringify(listing),'json');
  assert.deepEqual(parsed.rows[0],{external_id:'007','vehicle.make':'Ford','vehicle.model':'Transit','price.amount':'1200','price.currency':'EUR','seller.name':'Sample','seller.email':'seller@example.invalid','metadata.active':'false',photos:['one','two'],equipment:['abs','ac']});
  assert.deepEqual(suggestMapping(parsed.columns),{external_id:'external_id',make:'vehicle.make',model:'vehicle.model',price:'price.amount',currency:'price.currency',equipment:'equipment',photo_urls:'photos',sellerName:'seller.name',sellerEmail:'seller.email'});
  const xml = '<i:catalog xmlns:i="urn:feed"><i:stock><i:offer id="A"><i:price currency="EUR">1800</i:price><i:photos><i:photo href="one"/><i:photo href="two"/></i:photos><i:description><![CDATA[Opis <A>]]> &amp; B</i:description></i:offer></i:stock></i:catalog>';
  const fromXml = await parseImport(xml,'xml');
  assert.deepEqual(fromXml.rows,[{id:'A','price.currency':'EUR','price.value':'1800',photos:['one','two'],description:'Opis <A> & B'}]);
});

test('custom paths, empty snapshots, large JSON stock identifiers and row-specific fields', async () => {
  const {columns,rows} = await parseImport('{"payload":{"stock-list":[{"id":9007199254740999,"new":true},{"id":"0001","city":"Łódź"}]}}','json',{recordsPath:'payload.stock-list'});
  assert.deepEqual(columns,['id','new','city']);
  assert.equal(rows[0].id,'9007199254740999');
  for (const [format,data] of [['json','[]'],['json','{"offers":[]}'],['xml','<offers/>'],['csv','Marka;Model\n']]) assert.equal((await parseImport(data,format)).rows.length,0);
  await rejected(parseImport('{"offers":[]}','json',{recordsPath:'missing'}),422);
});

test('an empty authoritative snapshot is distinct from a blank body, malformed feed, provider error or empty scalar',async () => {
  const cases = [['json','{"offers":[]}'],['json','[]'],['csv','external_id;make;model\n'],['xml','<offers/>']];
  for (const [kind,source] of cases) {
    const snapshot = await parseImport(source,kind,{allowEmpty:true});
    assert.deepEqual(snapshot.rows,[]);
    if (kind === 'csv') assert.deepEqual(snapshot.columns,['external_id','make','model']);
    await rejected(parseImport(source,kind,{allowEmpty:false}),422);
  }
  for (const [kind,source] of [['csv',''],['csv','\r\n'],['json','{"offers":null}'],['json','{"offers":""}'],['json','{"error":"temporarily unavailable"}'],['xml','<fault>offline</fault>'],['xml','<offers>']]) {
    await rejected(parseImport(source,kind,{allowEmpty:true}),422);
  }
});

test('UTF-8 without BOM, UTF-16, byte views and a legacy XML declaration decode predictably', async () => {
  const json = '\ufeff[{"miasto":"Łódź"}]';
  const unicode = Buffer.from(json,'utf16le');
  assert.equal((await parseImport(unicode)).rows[0].miasto,'Łódź');
  const view = encoded('!Marka;Model\nFiat;500').subarray(1);
  assert.equal((await parseImport(view,'csv')).rows[0].Marka,'Fiat');
  const latin = Buffer.from('<?xml version="1.0" encoding="iso-8859-1"?><offers><offer><model>Caf\xe9</model></offer></offers>','latin1');
  assert.equal((await parseImport(latin)).rows[0].model,'Café');
});

test('row, column, input, decoded-result and cell ceilings cannot be bypassed by caller overrides', async () => {
  await rejected(parseImport('A\n1\n2','csv',{maxRows:1}),413);
  await rejected(parseImport('A;B\n1;2','csv',{maxColumns:1}),413);
  await rejected(parseImport('{"id":1}','json',{maxBytes:2}),413);
  await rejected(parseImport('A\n12345','csv',{maxCellLength:4}),413);
  await rejected(parseImport('[{"name":"abc"}]','json',{maxResultChars:3}),413);
  const tooMany = Array.from({length:importLimits.maxRows+1},() => ({id:1}));
  await rejected(parseImport(JSON.stringify(tooMany),'json',{maxRows:importLimits.maxRows+10}),413);
});

test('invalid records, ambiguous columns, XML declarations of entities and malformed parts return bilingual errors', async () => {
  for (const [kind,data] of [
    ['csv','Make;Make\nA;B'],['csv','Make;\nA;B'],['csv','A;B\n1;"broken'],['csv','A\na;b'],
    ['json','[{"__proto__":"x"}]'],['json','[{"a.b":1,"a":{"b":2}}]'],['json','[123]'],
    ['xml','<!DOCTYPE offers [<!ENTITY sample "data">]><offers/>'],['xml','<offers><item><id>&unavailable;</id></item></offers>'],
    ['xml','<offers><item></offers>'],['xlsx','plain text'],['unknown','hello']
  ]) await rejected(parseImport(data,kind),422);
  assert.equal({}.polluted,undefined);
});

const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
async function workbook(options = {}) {
  const parts = {
    '[Content_Types].xml':'<Types><Override PartName="/file/book.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    '_rels/.rels':'<Relationships><Relationship Id="book" Type="'+ns+'officeDocument" Target="file/book.xml"/></Relationships>',
    'file/book.xml':'<workbook xmlns:r="urn:r"><workbookPr date1904="1"/><sheets><sheet name="Notes" state="hidden" r:id="a"/><sheet name="Inventory" r:id="b"/></sheets></workbook>',
    'file/_rels/book.xml.rels':'<Relationships><Relationship Id="b" Type="'+ns+'worksheet" Target="worksheets/data.xml"/><Relationship Id="a" Type="'+ns+'worksheet" Target="worksheets/notes.xml"/><Relationship Id="s" Type="'+ns+'sharedStrings" Target="strings.xml"/><Relationship Id="t" Type="'+ns+'styles" Target="styles.xml"/><Relationship Id="outside" Type="'+ns+'externalLink" TargetMode="External" Target="https://unused.example/"/></Relationships>',
    'file/strings.xml':'<sst><si><r><t>Mo</t></r><r><t>del</t></r><rPh><t>ignored</t></rPh></si><si><t>Yaris</t></si></sst>',
    'file/styles.xml':'<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    'file/worksheets/data.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Price</t></is></c><c r="C1" t="inlineStr"><is><t>Date</t></is></c><c r="D1" t="inlineStr"><is><t>No cache</t></is></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2"><f>2*4</f><v>8</v></c><c r="C2" s="1"><v>1</v></c><c r="D2"><f>2*9</f></c></row></sheetData></worksheet>',
    'file/worksheets/notes.xml':'<worksheet><sheetData><row><c t="inlineStr"><is><t>Note</t></is></c></row><row><c t="inlineStr"><is><t>Private</t></is></c></row></sheetData></worksheet>',
    ...options
  };
  const archive = new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false,useCompressionStream:true});
  for (const [path,body] of Object.entries(parts)) await archive.add(path,new TextReader(body));
  return archive.close();
}

test('Excel uses the visible sheet and custom part paths, reads dates, shared rich text and only cached formula results', async () => {
  const bytes = await workbook();
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('No import reader may fetch.'); };
  try {
    assert.deepEqual((await parseImport(bytes,'xlsx')).rows,[{Model:'Yaris',Price:'8',Date:'1904-01-02','No cache':''}]);
    assert.deepEqual((await parseImport(bytes,'xlsx',{sheet:'Notes'})).rows,[{Note:'Private'}]);
  } finally { globalThis.fetch = original; }
  await rejected(parseImport(bytes,'xlsx',{sheet:'missing'}),422);
});

test('XLSX rejects macro-enabled files and enforces both archive and expanded-result limits',async () => {
  const bytes = await sample('xlsx');
  await rejected(parseImport(bytes,'xlsx',{maxEntries:2}),413);
  await rejected(parseImport(bytes,'xlsx',{maxEntryBytes:400}),413);
  await rejected(parseImport(bytes,'xlsx',{maxArchiveBytes:800}),413);
  await rejected(parseImport(bytes,'xlsx',{maxResultChars:100}),413);
  await rejected(parseImport(await workbook({'xl/vbaProject.bin':'invalid'}),'xlsx'),422);
});
