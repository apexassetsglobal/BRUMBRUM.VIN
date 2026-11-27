const sound=(id,name,brand,category,profile)=>({
  id,name,brand,category,profile,available:true,source:'synthetic'
});

export const soundCategories={
  original:['Oryginalne','Original'],
  ferrari:['Ferrari','Ferrari'],
  lamborghini:['Lamborghini','Lamborghini'],
  porsche:['Porsche','Porsche'],
  amg:['Mercedes-AMG i Brabus','Mercedes-AMG & Brabus'],
  german:['BMW i Audi','BMW & Audi'],
  tuning:['Tuning','Tuning'],
  hypercar:['Hypercar i USA','Hypercars & USA'],
  racing:['Wyścigowe','Racing'],
  motorcycle:['Motocykle','Motorcycles'],
  aircraft:['Samoloty','Aircraft']
};

// Wszystkie odsłuchy są oryginalnymi syntezami BRUMBRUM.VIN. Nazwy modeli
// opisują wariant strojenia, a nie źródło ani autentyczne nagranie pojazdu.
export const soundCatalog=[
  sound('brumbrum-signature','ENGINE START Signature','BRUMBRUM.VIN','original','signature'),

  sound('ferrari-488-pista','488 Pista','Ferrari','ferrari','v8-turbo'),
  sound('ferrari-f8-tributo','F8 Tributo','Ferrari','ferrari','v8-turbo'),
  sound('ferrari-458-speciale','458 Speciale','Ferrari','ferrari','v8-high'),
  sound('ferrari-812-superfast','812 Superfast','Ferrari','ferrari','v12-high'),
  sound('ferrari-f12-berlinetta','F12 Berlinetta','Ferrari','ferrari','v12-high'),
  sound('ferrari-sf90-stradale','SF90 Stradale','Ferrari','ferrari','hybrid-v8'),
  sound('ferrari-laferrari','LaFerrari','Ferrari','ferrari','hybrid-v12'),

  sound('lamborghini-huracan-performante','Huracán Performante','Lamborghini','lamborghini','v10-high'),
  sound('lamborghini-aventador-svj','Aventador SVJ','Lamborghini','lamborghini','v12-high'),
  sound('lamborghini-revuelto','Revuelto','Lamborghini','lamborghini','hybrid-v12'),
  sound('lamborghini-gallardo','Gallardo','Lamborghini','lamborghini','v10-mid'),
  sound('lamborghini-murcielago','Murciélago','Lamborghini','lamborghini','v12-raw'),
  sound('lamborghini-urus-performante','Urus Performante','Lamborghini','lamborghini','v8-turbo'),
  sound('lamborghini-huracan-twin-turbo','Huracán Twin Turbo','Lamborghini','lamborghini','v10-turbo'),

  sound('porsche-911-gt3-rs','911 GT3 RS','Porsche','porsche','flat6-high'),
  sound('porsche-911-turbo-s','911 Turbo S','Porsche','porsche','flat6-turbo'),
  sound('porsche-carrera-gt','Carrera GT','Porsche','porsche','v10-high'),
  sound('porsche-918-spyder','918 Spyder','Porsche','porsche','hybrid-v8'),
  sound('porsche-gt2-rs','GT2 RS','Porsche','porsche','flat6-turbo'),
  sound('porsche-911-rsr','911 RSR','Porsche','porsche','flat6-race'),

  sound('amg-gt-black-series','AMG GT Black Series','Mercedes-AMG','amg','v8-turbo'),
  sound('amg-c63-v8','C63 V8','Mercedes-AMG','amg','v8-deep'),
  sound('amg-e63-s','E63 S','Mercedes-AMG','amg','v8-turbo'),
  sound('amg-g63','G63','Mercedes-AMG','amg','v8-deep'),
  sound('brabus-800','Brabus 800','Brabus','amg','v8-turbo'),
  sound('brabus-900','Brabus 900','Brabus','amg','v8-raw'),

  sound('bmw-m5-e60-v10','M5 E60 V10','BMW','german','v10-high'),
  sound('bmw-m5-cs','M5 CS','BMW','german','v8-turbo'),
  sound('bmw-m4-competition','M4 Competition','BMW','german','i6-turbo'),
  sound('bmw-m3-g80','M3 G80','BMW','german','i6-turbo'),
  sound('audi-r8-v10','R8 V10','Audi','german','v10-mid'),
  sound('audi-rs6','RS6','Audi','german','v8-turbo'),
  sound('audi-rs3','RS3','Audi','german','i5-turbo'),

  sound('nissan-gtr-1000','GT-R 1000 HP','Nissan','tuning','v6-turbo'),
  sound('toyota-supra-2jz','Supra 2JZ','Toyota','tuning','i6-turbo'),
  sound('nissan-skyline-r34','Skyline R34','Nissan','tuning','i6-turbo'),
  sound('mazda-rx7-rotary','RX-7 Rotary','Mazda','tuning','rotary'),
  sound('bmw-m3-akrapovic','M3 Akrapovič','BMW','tuning','i6-raw'),
  sound('audi-r8-armytrix','R8 Armytrix','Audi','tuning','v10-raw'),
  sound('dodge-hellcat-straight-pipe','Hellcat Straight Pipe','Dodge','tuning','v8-raw'),
  sound('mitsubishi-lancer-evolution','Lancer Evolution','Mitsubishi','tuning','i4-turbo'),
  sound('subaru-impreza-wrx-sti','Impreza WRX STI','Subaru','tuning','flat4-turbo'),

  sound('bugatti-chiron-w16','Chiron W16','Bugatti','hypercar','w16-turbo'),
  sound('koenigsegg-jesko','Jesko','Koenigsegg','hypercar','v8-high'),
  sound('pagani-zonda','Zonda','Pagani','hypercar','v12-raw'),
  sound('pagani-huayra','Huayra','Pagani','hypercar','v12-turbo'),
  sound('mclaren-720s','720S','McLaren','hypercar','v8-turbo'),
  sound('lexus-lfa','LFA','Lexus','hypercar','v10-high'),
  sound('dodge-viper','Viper','Dodge','hypercar','v10-deep'),
  sound('mustang-shelby-gt500','Mustang Shelby GT500','Ford','hypercar','v8-raw'),
  sound('corvette-z06','Corvette Z06','Chevrolet','hypercar','v8-high'),

  sound('ferrari-f1-v10','F1 V10','Ferrari','racing','v10-race'),
  sound('f1-v8','F1 V8','Formula','racing','v8-race'),
  sound('nascar-v8','NASCAR V8','NASCAR','racing','v8-deep'),

  sound('ducati-panigale-v4','Panigale V4','Ducati','motorcycle','bike-v4'),
  sound('kawasaki-ninja-h2r','Ninja H2R','Kawasaki','motorcycle','bike-supercharged'),
  sound('bmw-s1000rr','S1000RR','BMW','motorcycle','bike-i4'),

  sound('aircraft-f16','F-16','General Dynamics','aircraft','jet'),
  sound('aircraft-f35','F-35','Lockheed Martin','aircraft','jet-heavy')
];

export const soundEvents=[
  ['appStart','Uruchomienie aplikacji','App start','brumbrum-signature',72],
  ['newMessage','Nowa wiadomość','New message','porsche-911-gt3-rs',45],
  ['sellerReply','Odpowiedź sprzedawcy','Seller reply','ferrari-458-speciale',45],
  ['listingInquiry','Nowe zapytanie o ogłoszenie','New listing enquiry','amg-gt-black-series',45],
  ['watchedPrice','Zmiana ceny obserwowanego pojazdu','Saved vehicle price change','bmw-m5-cs',50],
  ['newOffer','Nowa oferta','New listing','audi-r8-v10',45],
  ['vehicleSold','Sprzedaż pojazdu','Vehicle sold','lamborghini-aventador-svj',60],
  ['system','Powiadomienia systemowe','System notifications','brumbrum-signature',38]
];

export const defaultSoundSettings=()=>({
  version:1,
  favorites:['brumbrum-signature'],
  events:Object.fromEntries(soundEvents.map(([key,,,soundId,volume])=>[key,{soundId,volume,muted:false}]))
});

export const soundById=new Map(soundCatalog.map(item=>[item.id,item]));
