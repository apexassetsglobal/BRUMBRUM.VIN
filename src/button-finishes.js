const makePreset = ([id,pl,en,color,material,stitch,thread])=>({id,pl,en,finish:{color,material,stitch,thread}});

export const buttonFinishPresets = [
  ['graphite-gt','Grafit GT','Graphite GT','graphite','grained','double','red'],
  ['track-red','Czerwień torowa','Track red','red','alcantara','single','ivory'],
  ['cognac','Koniak','Cognac','cognac','grained','double','ivory'],
  ['ivory','Kość słoniowa','Ivory','ivory','nappa','double','sepia'],
  ['racing-green','Zieleń wyścigowa','Racing green','green','grained','single','ivory'],
  ['midnight-navy','Granat nocny','Midnight navy','navy','nappa','double','blue'],
  ['steel-gray','Stalowy szary','Steel gray','steel','perforated','single','slate'],
  ['aubergine','Oberżyna','Aubergine','plum','alcantara','single','silver'],
  ['ice-blue','Błękit lodu','Ice blue','ice','perforated','single','slate'],
  ['copper','Miedź','Copper','copper','grained','single','copper'],
  ['stock','Fabryczny niebieski','Factory blue','blue','smooth','none','silver'],
].map(makePreset);

export const blackStoneFinishPresets = [
  ['stone-01','Czarny diament','Black diamond'],
  ['stone-02','Onyks falisty','Wavy onyx'],
  ['stone-03','Obsydian lustrzany','Mirror obsidian'],
  ['stone-04','Marmur Marquina','Marquina marble'],
  ['stone-05','Agat pasmowy','Banded agate'],
  ['stone-06','Hematyt','Hematite'],
  ['stone-07','Bazalt kolumnowy','Columnar basalt'],
  ['stone-08','Turmalin czarny','Black tourmaline'],
  ['stone-09','Labradoryt nocny','Midnight labradorite'],
  ['stone-10','Kwarc dymny','Smoky quartz'],
  ['stone-11','Granit galaktyczny','Galaxy granite'],
  ['stone-12','Łupek antracytowy','Anthracite slate'],
  ['stone-13','Spinel czarny','Black spinel'],
  ['stone-14','Obsydian śnieżny','Snowflake obsidian'],
  ['stone-15','Szungit','Shungite'],
  ['stone-16','Czarny opal ognisty','Black fire opal'],
  ['stone-17','Marmur Portoro','Portoro marble'],
  ['stone-18','Sardonyks','Sardonyx'],
  ['stone-19','Gabro srebrzyste','Silver gabbro'],
  ['stone-20','Obsydian tęczowy','Rainbow obsidian'],
].map(([id,pl,en])=>makePreset([id,pl,en,'graphite',id,'none','silver']));

export const rollsRoyceFinishPresets = [
  ['rr-grace-suite','Biel z granatową nicią','White with navy stitch','rr-grace','coachbuild-grain','double','navy'],
  ['rr-navy-suite','Granat z lamówką','Navy with piping','rr-navy','placed-perforation','piping','silver'],
  ['rr-tan-suite','Koniak z krzyżykiem','Tan with cross stitch','rr-tan','coachbuild-grain','cross','ivory'],
  ['rr-charles-suite','Błękit perforowany','Perforated blue','rr-charles','placed-perforation','single','navy'],
].map(makePreset);

export const carbonAndMetalFinishPresets = [
  ['finish-carbon','Karbon','Carbon fiber','graphite','carbon-fiber','none','silver'],
  ['finish-brushed-copper','Miedź szczotkowana','Brushed copper','copper','brushed-copper','none','silver'],
  ['finish-brushed-aluminum','Aluminium szczotkowane','Brushed aluminum','steel','brushed-aluminum','none','silver'],
  ['finish-titanium','Tytan','Titanium','navy','titanium','none','silver'],
].map(makePreset);

export const luxuryBrandPresetGroups = [
  {id:'lamborghini',label:['Lamborghini Ad Personam','Lamborghini Ad Personam'],presets:[
    ['lambo-verde','Nero + Verde Scandal','Nero + Verde Scandal','l-nero','q-citura','honeycomb','neon-green'],
    ['lambo-arancio','Nero + Arancio','Nero + Arancio','l-nero','q-citura','honeycomb','orange'],
    ['lambo-giallo','Nero + Giallo','Nero + Giallo','l-nero','q-citura','honeycomb','yellow'],
  ].map(makePreset)},
  {id:'maybach',label:['Mercedes‑Maybach','Mercedes-Maybach'],presets:[
    ['maybach-crystal','Nappa Biel Kryształu','Crystal White Nappa','m-crystal','nappa','piping','sepia'],
    ['maybach-tartufo','Nappa Brąz Tartufo','Tartufo Brown Nappa','m-tartufo','nappa','piping','ivory'],
    ['maybach-bordeaux','Nappa Bordo z lamówką','Bordeaux Nappa with piping','m-bordeaux','nappa','piping','ivory'],
  ].map(makePreset)},
  {id:'aston-martin',label:['Aston Martin Q','Aston Martin Q'],presets:[
    ['aston-oxford','Oxford Tan Brogue','Oxford Tan Brogue','a-oxford','brogued-leather','brogue','ivory'],
    ['aston-dark-knight','Dark Knight Brogue','Dark Knight Brogue','a-dark-knight','brogued-leather','brogue','silver'],
  ].map(makePreset)},
  {id:'pagani-bugatti',label:['Pagani / Bugatti','Pagani / Bugatti'],presets:[
    ['pagani-forged','Kuty karbon','Forged Carbon','pb-forged','forged-carbon','none','silver'],
    ['pagani-aged-cognac','Postarzany koniak','Aged Cognac','pb-cognac','vintage','double','ivory'],
    ['bugatti-racing-blue','French Racing Blue','French Racing Blue','pb-racing-blue','semi-aniline','double','white'],
  ].map(makePreset)},
];

export const luxuryBrandFinishPresets = luxuryBrandPresetGroups.flatMap(({presets})=>presets);

export const buttonFinishes = Object.fromEntries(
  [...buttonFinishPresets,...rollsRoyceFinishPresets,...carbonAndMetalFinishPresets,...luxuryBrandFinishPresets,...blackStoneFinishPresets].map(({id,finish})=>[id,finish]));

export const buttonFinishPalettes = [
  {id:'standard',label:['Kolory podstawowe','Base colors'],colors:
    buttonFinishPresets.map(({pl,en,finish})=>[finish.color,pl,en])},
  {id: 'ferrari', label: ['Inspiracje Ferrari', 'Ferrari inspiration'], colors: [
    ['f-nero', 'Czerń Nero', 'Nero black'],
    ['f-rosso', 'Czerwień Rosso', 'Rosso red'],
    ['f-cuoio', 'Koniak Cuoio', 'Cuoio tan'],
    ['f-crema', 'Krem Crema', 'Crema cream'],
    ['f-sabbia', 'Beż Sabbia', 'Sabbia beige'],
    ['f-bordeaux', 'Bordo Granata', 'Granata burgundy'],
    ['f-blu', 'Granat Blu', 'Blu navy'],
    ['f-grigio', 'Szary Grigio', 'Grigio gray'],
  ]},
  {id: 'porsche', label: ['Inspiracje Porsche', 'Porsche inspiration'], colors: [
    ['p-bordeaux', 'Bordo Bordeaux', 'Bordeaux red'],
    ['p-chalk', 'Kreda', 'Chalk'],
    ['p-slate', 'Szary łupkowy', 'Slate gray'],
    ['p-island', 'Zieleń islandzka', 'Iceland green'],
    ['p-graphite', 'Grafitowy błękit', 'Graphite blue'],
    ['p-mojave', 'Beż Mojave', 'Mojave beige'],
    ['p-cognac', 'Klasyczny koniak', 'Classic cognac'],
    ['p-truffle', 'Brąz truflowy', 'Truffle brown'],
    ['p-cohiba', 'Brąz Cohiba', 'Cohiba brown'],
    ['p-lavender', 'Lawenda', 'Lavender'],
  ]},
  {id: 'bentley', label: ['Inspiracje Bentleyem', 'Bentley inspiration'], colors: [
    ['b-oak', 'Palony dąb', 'Burnt oak'],
    ['b-damson', 'Śliwka Damson', 'Damson plum'],
    ['b-cricket', 'Bordo Cricket', 'Cricket burgundy'],
    ['b-hotspur', 'Czerwień Hotspur', 'Hotspur red'],
    ['b-saddle', 'Brąz Saddle', 'Saddle brown'],
    ['b-newmarket', 'Koniak Newmarket', 'Newmarket tan'],
    ['b-camel', 'Beż Camel', 'Camel tan'],
    ['b-magnolia', 'Magnolia', 'Magnolia'],
    ['b-linen', 'Jasny len', 'Light linen'],
    ['b-portland', 'Szary Portland', 'Portland gray'],
    ['b-gravity', 'Szary Gravity', 'Gravity gray'],
    ['b-brunel', 'Błękit Brunel', 'Brunel blue'],
    ['b-beluga', 'Czerń Beluga', 'Beluga black'],
    ['b-cumbrian', 'Zieleń Cumbrian', 'Cumbrian green'],
    ['b-imperial', 'Granat Imperial', 'Imperial blue'],
  ]},
  {id: 'rolls-royce', label: ['Inspiracje Rolls‑Royce’em', 'Rolls-Royce inspiration'], colors: [
    ['rr-grace', 'Biel Grace', 'Grace white'],
    ['rr-charles', 'Błękit Charles', 'Charles blue'],
    ['rr-navy', 'Głęboki granat', 'Deep navy'],
    ['rr-peony', 'Róż Peony', 'Peony pink'],
    ['rr-tan', 'Koniak Bespoke', 'Bespoke tan'],
    ['rr-seashell', 'Beż Seashell', 'Seashell beige'],
    ['rr-grey', 'Szarość Scivaro', 'Scivaro gray'],
    ['rr-turchese', 'Turkus Turchese', 'Turchese turquoise'],
  ]},
  ...luxuryBrandPresetGroups.map(({id,label,presets})=>({id,label:['Inspiracje '+label[0],label[1]+' inspiration'],colors:
    presets.map(({pl,en,finish})=>[finish.color,pl,en])})),
];

export const buttonFinishFields = {
  material: {label: ['Materiał', 'Material'], options: [
    ['smooth','Gładkie wykończenie','Smooth'],
    ['nappa','Skóra Nappa','Nappa leather'],
    ['grained','Skóra groszkowana','Grained leather'],
    ['perforated','Skóra perforowana','Perforated leather'],
    ['alcantara','Alcantara','Alcantara'],
    ['semi-aniline', 'Skóra półanilinowa', 'Semi-aniline leather'],
    ['vintage', 'Skóra vintage', 'Vintage leather'],
    ['alcantara-perforated', 'Alcantara perforowana', 'Perforated Alcantara'],
    ['quilted', 'Skóra pikowana', 'Quilted leather'],
    ['coachbuild-grain', 'Skóra gładka Bespoke', 'Bespoke smooth leather'],
    ['placed-perforation', 'Skóra z perforacją wzorzystą', 'Pattern-perforated leather'],
    ['q-citura','Alcantara Q‑Citura','Q-Citura Alcantara'],
    ['brogued-leather','Skóra z perforacją brogue','Brogue-perforated leather'],
    ['forged-carbon','Kuty karbon','Forged carbon'],
    ...carbonAndMetalFinishPresets.map(({pl,en,finish})=>[finish.material,pl,en]),
    ...blackStoneFinishPresets.map(({id,pl,en})=>[id,pl,en]),
  ]},
  stitch: {label: ['Przeszycie','Stitching'], options: [
    ['none','Bez przeszycia','No stitching'],
    ['single','Pojedyncze','Single stitch'],
    ['double','Podwójne','Double stitch'],
    ['cross', 'Krzyżykowe', 'Cross stitch'],
    ['piping', 'Lamówka', 'Piping'],
    ['honeycomb','Plaster miodu Q‑Citura','Q-Citura honeycomb'],
    ['brogue','Perforowany ścieg brogue','Perforated brogue stitch'],
  ]},
  thread: {label: ['Kolor nici','Thread color'], options: [
    ['silver','Srebrne','Silver'],
    ['ivory','Kość słoniowa','Ivory'],
    ['copper','Miedziane','Copper'],
    ['red','Czerwone','Red'],
    ['blue','Niebieskie','Blue'],
    ['sepia','Sepia','Sepia'],
    ['slate','Łupkowe','Slate'],
    ['black', 'Czarne', 'Black'],
    ['white', 'Białe', 'White'],
    ['orange', 'Pomarańczowe', 'Orange'],
    ['yellow', 'Żółte', 'Yellow'],
    ['green', 'Zielone', 'Green'],
    ['lavender', 'Lawendowe', 'Lavender'],
    ['pink', 'Różowe', 'Pink'],
    ['gold', 'Złote', 'Gold'],
    ['navy', 'Granatowe', 'Navy'],
    ['neon-green','Verde Scandal','Verde Scandal'],
  ]},
};

export const buttonHardwareFields = {
  metal:{label:['Wykończenie metalu','Metal finish'],options:[
    ['titanium','Szczotkowany tytan','Brushed titanium'],['rose-gold','Różowe złoto','Rose gold'],
    ['dark-chrome','Ciemny chrom','Dark chrome'],['brass','Mosiądz szczotkowany','Brushed brass'],
    ['stainless','Stal nierdzewna','Stainless steel'],
  ]},
  fasteners:{label:['Frezowane śruby','Milled fasteners'],options:[['none','Bez śrub','No fasteners'],['torx','Śruby Torx Pagani','Pagani Torx screws']]},
  piping:{label:['Lamówka okuć','Hardware piping'],options:[['none','Bez lamówki','No piping'],['contrast','Kontrastowa lamówka','Contrast piping']]},
  strap:{label:['Klamra i pasek','Buckle and strap'],options:[['none','Bez paska','No strap'],['buckle','Skórzany pasek ze sprzączką','Leather strap with buckle']]},
  trim:{label:['Listwa dekoracyjna','Decorative trim'],options:[
    ['none','Bez listwy','No trim'],['walnut','Orzech open‑pore','Open-pore walnut'],
    ['forged-carbon','Kuty karbon','Forged carbon'],['slate','Kamień łupkowy','Slate stone'],
  ]},
  lettering:{label:['Wykończenie napisu','Lettering finish'],options:[['classic','Klasyczne / haftowane','Classic / embroidered'],['debossed','Głęboko tłoczone na gorąco','Deep heat debossed']]},
  plaque:{label:['Tabliczka znamionowa','Nameplate'],options:[['none','Bez tabliczki','No nameplate'],['engraved','Grawerowana tabliczka','Engraved nameplate']]},
};

export const buttonHardwareChoices = Object.fromEntries(Object.entries(buttonHardwareFields).map(([field,{options}])=>[field,options.map(([value])=>value)]));
export const defaultButtonHardware = {metal:'titanium',fasteners:'none',piping:'none',strap:'none',trim:'none',lettering:'classic',plaque:'none'};

export const buttonFinishChoices = {
  color: buttonFinishPalettes.flatMap(({colors})=>colors.map(([value])=>value)),
  ...Object.fromEntries(Object.entries(buttonFinishFields).map(([field,{options}])=>
    [field,options.map(([value])=>value)])),
};

export const buttonEmbroideryOptions = [
  ['satin','Satynowa','Satin thread'],
  ['cotton','Matowa bawełna','Matte cotton thread'],
  ['silk','Jedwabna','Silk thread'],
  ['metallic','Metalizowana','Metallic thread'],
  ['reflective','Odblaskowa','Reflective thread'],
  ['plain','Gładki napis','Plain label'],
];
