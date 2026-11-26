import { defaultHomeLogo, originalBrandLogo } from './brand-logos.js';
import { after, changes, id, now, row, rows, stmt, text } from './core.js';
import { semiTrailerBodies, vehicleTypes, vehicleBodies } from './vehicle-types.js';
import { heavyVehicleFilters, vehicleModels } from './vehicle-catalog.js';
import { catalogDemoVehicles, taycanDemoNumber } from './demo-catalog.js';

export const options = {
  type:vehicleTypes,
  body:vehicleBodies,
  fuel: { petrol:['Benzyna','Petrol'], diesel:['Diesel','Diesel'], lpg:['LPG','LPG'], hybrid:['Hybryda','Hybrid'], plugin:['Hybryda plug-in','Plug-in hybrid'], electric:['Elektryczny','Electric'], other:['Inne','Other'] },
  gearbox: { auto:['Automatyczna','Automatic'], manual:['Manualna','Manual'], cvt:['CVT / bezstopniowa','CVT'], hydrostatic:['Hydrostatyczna','Hydrostatic'] },
  drive: { fwd:['Przód','Front-wheel drive'], rwd:['Tył','Rear-wheel drive'], awd:['4×4','All-wheel drive'], tracked:['Gąsienicowy','Tracked'] },
  condition: { new:['Nowy','New'], used:['Używany','Used'] },
  damage: { no:['Bez uszkodzeń','No damage'], yes:['Uszkodzony','Damaged'], unknown:['Brak informacji','Unspecified'] },
  seller: { private:['Osoba prywatna','Private seller'], company:['Firma','Business seller'] },
  status: { draft:['Szkic','Draft'], pending:['Oczekuje na moderację','In review'], published:['Opublikowane','Published'], rejected:['Odrzucone','Rejected'], held:['Wstrzymane','Paused'], sold:['Sprzedane','Sold'], archived:['Zarchiwizowane','Archived'] },
  document: { agreement:['Umowa kupna-sprzedaży','Sales agreement'], vat:['Faktura VAT','VAT invoice'], margin:['Faktura VAT marża','VAT margin invoice'], other:['Inny dokument','Other document'] },
  contact: { message:['Wiadomość','Message'], phone:['Telefon (z opcją wiadomości)','Phone and messages'] },
  proposal: { proposed:['Propozycja oględzin','Viewing proposed'], accepted:['Termin potwierdzony','Viewing confirmed'], declined:['Termin odrzucony','Viewing declined'] },
  role: { user:['Użytkownik','User'], moderator:['Moderator','Moderator'], admin:['Administrator','Administrator'] },
  sort: { latest:['Najnowsze','Newest'], price_asc:['Cena rosnąco','Price low to high'], price_desc:['Cena malejąco','Price high to low'], mileage:['Najniższy przebieg','Lowest mileage'], mileage_desc:['Najwyższy przebieg','Highest mileage'], year:['Najmłodszy rocznik','Newest model year'], year_asc:['Najstarszy rocznik','Oldest model year'] }
};

export const features = {
  safety: ['Bezpieczeństwo','Safety',{abs:['ABS','ABS'], esp:['ESP','ESC'], airbags:['Poduszki powietrzne','Airbags'], blind:['Czujnik martwego pola','Blind spot monitoring'], lane:['Asystent pasa ruchu','Lane assist'], cruise:['Tempomat adaptacyjny','Adaptive cruise control']}],
  comfort: ['Komfort','Comfort',{ac:['Klimatyzacja','Air conditioning'], heated:['Podgrzewane fotele','Heated seats'], parking:['Czujniki parkowania','Parking sensors'], camera:['Kamera cofania','Reversing camera'], keyless:['Dostęp bezkluczykowy','Keyless entry'], sunroof:['Szyberdach','Sunroof']}],
  media: ['Multimedia','Multimedia',{nav:['Nawigacja','Navigation'], carplay:['Apple CarPlay / Android Auto','Apple CarPlay / Android Auto'], bt:['Bluetooth','Bluetooth'], dab:['Radio DAB','DAB radio']}]
};
export const featureKeys = Object.values(features).flatMap(x => Object.keys(x[2]));
export const regions = ['Dolnośląskie','Kujawsko-pomorskie','Lubelskie','Lubuskie','Łódzkie','Małopolskie','Mazowieckie','Opolskie','Podkarpackie','Podlaskie','Pomorskie','Śląskie','Świętokrzyskie','Warmińsko-mazurskie','Wielkopolskie','Zachodniopomorskie'];
export const defaultBrand = {
  name: 'BRUMBRUM.VIN', accent: '#076fe5', logo_key: '', home_logo: defaultHomeLogo, launch_logo: originalBrandLogo, operator_name: '', operator_address: '', operator_email: ''
};

export const brandCopy = value => value?.replace(
  /(?<![\p{L}\p{N}@./-])(?:all[\s-]*4[\s-]*auto|al{1,2}[\s-]*for[\s-]*auto|brum[\s-]*brum\s*\.\s*(?:vin|win))(?![\p{L}\p{N}@/]|\.[\p{L}\p{N}])/giu,
  defaultBrand.name
);

const brandCopyKey = /^(?:help|terms|privacy|dealers|ads)_(?:pl|en|cs|sk|de|uk)$/;

export async function brandFor(ctx) {
  const settings = await rows(ctx.db, 'SELECT key,value FROM settings WHERE scope=? OR scope=? ORDER BY CASE WHEN scope=? THEN 1 ELSE 0 END',
    ctx.scope, ctx.demo ? 'demo:seed' : 'live', ctx.scope);
  const brand = { ...defaultBrand, operator_name:ctx.env.OPERATOR_NAME || '', operator_address:ctx.env.OPERATOR_ADDRESS || '',
    operator_email:ctx.env.OPERATOR_EMAIL || '', ...Object.fromEntries(settings.map(({key,value}) => [key,brandCopyKey.test(key)?brandCopy(value):value])) };
  return {...brand,name:brandCopy(brand.name)};
}

export async function catalogFor(ctx) {
  const [dictionary,lookup]=await Promise.all([
    rows(ctx.db,'SELECT * FROM dictionary WHERE scope=? ORDER BY value',ctx.scope),
    rows(ctx.db,`SELECT DISTINCT l.type,l.body,l.make,l.model FROM listings l
      JOIN users u ON u.id=l.user_id AND u.deleted_at IS NULL
      WHERE l.scope=? AND l.status='published' AND l.type<>'robot' AND l.make<>''`,ctx.scope)
  ]);
  const types = { ...options.type };
  const makeOverrides=new Map();
  const modelOverrides=new Map();
  for (const entry of dictionary) {
    if (entry.kind==='type') {
      if (entry.active) types[entry.value]=[entry.label_pl||entry.value,entry.label_en||entry.value];
      else delete types[entry.value];
    } else if (entry.kind==='make') {
      makeOverrides.set(entry.value,Boolean(entry.active));
    } else if (entry.kind==='model') {
      if (!modelOverrides.has(entry.parent)) modelOverrides.set(entry.parent,new Map());
      modelOverrides.get(entry.parent).set(entry.value,Boolean(entry.active));
    }
  }

  const byType=new Map(Object.keys(types).map(type=>[type,new Map()]));
  const heavyMakes=new Map();
  const allMakes=new Map();
  function addModel(group,make,model) {
    if (!group.has(make)) group.set(make,new Set());
    if (model) group.get(make).add(model);
  }
  function addConfiguredModels(makes,configured) {
    for (const [make,models] of Object.entries(configured)) {
      if (makeOverrides.get(make)===false) continue;
      addModel(makes,make);
      for (const model of models) {
        if (modelOverrides.get(make)?.get(model)!==false) addModel(makes,make,model);
      }
    }
  }
  for (const [type,makes] of byType) {
    if (Object.hasOwn(vehicleModels,type)) addConfiguredModels(makes,vehicleModels[type]);
  }
  for (const [type,body,,,models] of Object.values(heavyVehicleFilters)) {
    if (!byType.has(type)) continue;
    const makes=new Map();
    addConfiguredModels(makes,models);
    heavyMakes.set(body,makes);
  }
  for (const {type,body,make,model} of lookup) {
    if (byType.has(type)) addModel(byType.get(type),make,model);
    const heavyBody=type==='trailer'&&semiTrailerBodies.includes(body)?'semi_trailer':body;
    if (heavyMakes.has(heavyBody)&&heavyVehicleFilters[heavyBody][0]===type) addModel(heavyMakes.get(heavyBody),make,model);
    addModel(allMakes,make,model);
  }
  for (const makes of byType.values()) {
    for (const [make,models] of makes) {
      addModel(allMakes,make);
      for (const model of models) addModel(allMakes,make,model);
    }
  }
  // Older dictionary entries have no vehicle type. A listing assigns them to a category.
  for (const [make,active] of makeOverrides) {
    if (active) addModel(allMakes,make);
  }
  for (const [make,models] of modelOverrides) {
    if (!allMakes.has(make)||makeOverrides.get(make)===false) continue;
    for (const [model,active] of models) {
      if (active) addModel(allMakes,make,model);
    }
  }
  const order=new Intl.Collator('pl',{numeric:true});
  const sorted=makes=>Object.fromEntries([...makes].sort(([a],[b])=>order.compare(a,b))
    .map(([make,models])=>[make,[...models].sort(order.compare)]));
  return {
    types,
    makesByType:Object.fromEntries([['',sorted(allMakes)],...Array.from(byType,([type,makes])=>[type,sorted(makes)])]),
    heavyFilters:Object.fromEntries(Array.from(heavyMakes,([body,makes])=>{
      const [type,,pl,en]=heavyVehicleFilters[body];
      return [body,{type,label:[pl,en],makes:sorted(makes)}];
    }))
  };
}

const standardDemoVehicles = [
  ['Audi','A4','Avant 40 TFSI S line','car','wagon','petrol','auto',2022,48600,139900,'Warszawa','Mazowieckie',190,'dealer'],
  ['Toyota','Corolla','Touring Sports 1.8 Hybrid','car','wagon','hybrid','auto',2021,67800,79900,'Kraków','Małopolskie',122,'seller'],
  ['Volkswagen','Golf','VIII 1.5 TSI Style','car','hatchback','petrol','manual',2020,89400,69900,'Wrocław','Dolnośląskie',150,'seller'],
  ['BMW','X3','xDrive20d M Sport','car','suv','diesel','auto',2023,34200,179900,'Poznań','Wielkopolskie',190,'dealer'],
  ['Hyundai','IONIQ 5','77,4 kWh AWD','car','suv','electric','auto',2022,29000,146900,'Gdańsk','Pomorskie',325,'dealer'],
  ['Mazda','MX-5','RF 2.0 Skyactiv-G','car','convertible','petrol','manual',2019,56200,89900,'Łódź','Łódzkie',184,'seller'],
  ['Ford','Transit','350 L3H2 2.0 EcoBlue','van','panel','diesel','manual',2021,119000,87500,'Katowice','Śląskie',130,'dealer'],
  ['Mercedes-Benz','Klasa C','C 200 Avantgarde','car','sedan','petrol','auto',2018,108300,82900,'Szczecin','Zachodniopomorskie',184,'seller'],
  ['Toyota','Hilux','2.8 D-4D Invincible','car','pickup','diesel','auto',2022,62400,148000,'Lublin','Lubelskie',204,'dealer'],
  ['MAN','TGX','18.510 4×2','truck','tractor','diesel','auto',2020,421000,189000,'Bydgoszcz','Kujawsko-pomorskie',510,'dealer'],
  ['Fiat','Ducato','2.2 Multijet · Kamper','camper','camper','diesel','manual',2024,12000,296000,'Opole','Opolskie',140,'seller'],
  ['Peugeot','208','1.2 PureTech Allure','car','hatchback','petrol','manual',2024,0,72900,'Rzeszów','Podkarpackie',100,'dealer'],
  ['Yamaha','MT-07','ABS','motorcycle','naked','petrol','manual',2022,11800,24900,'Warszawa','Mazowieckie',73,'seller',{drive:'rwd',engine:689,equipment:['abs']}],
  ['CFMOTO','CFORCE 520','EPS','quad','atv_utility','petrol','cvt',2023,2300,26900,'Poznań','Wielkopolskie',34,'dealer',{drive:'awd',hours:137,engine:495,equipment:[]}],
  ['Honda','PCX','125','scooter','scooter','petrol','cvt',2023,3900,12500,'Kraków','Małopolskie',12,'seller',{drive:'rwd',engine:125,equipment:['abs']}],
  ['Polaris','Ranger','570 EPS','utv','utv','petrol','cvt',2021,null,47900,'Gdańsk','Pomorskie',44,'dealer',{drive:'awd',hours:285,seats:2,equipment:[]}],
  ['Kubota','U27-4','Minikoparka gąsienicowa','construction','excavator','diesel','hydrostatic',2020,null,114900,'Lublin','Lubelskie',21,'dealer',{drive:'tracked',hours:1870,equipment:[]}],
  ['Debon','Roadster 300','Przyczepa zamknięta','trailer','cargo_trailer','','',2023,null,22900,'Opole','Opolskie',null,'seller',{drive:'',grossWeight:1300,axles:1,equipment:[]}],
  ['BMW','Seria 4','430i Coupé','car','coupe','petrol','auto',2022,46500,154900,'Katowice','Śląskie',245,'dealer',{drive:'rwd'}],
  ['Volkswagen','Touran','1.5 TSI DSG','car','van','petrol','auto',2021,84000,94900,'Bydgoszcz','Kujawsko-pomorskie',150,'seller',{seats:7}],
  ['Dacia','Duster','1.0 ECO-G','car','suv','lpg','manual',2022,51500,58900,'Białystok','Podlaskie',100,'seller'],
  ['Mitsubishi','Outlander','2.4 PHEV','car','suv','plugin','auto',2020,92000,82900,'Szczecin','Zachodniopomorskie',224,'dealer',{drive:'awd',battery:13.8,range:45}],
  ['Tesla','Model 3','Long Range AWD','car','sedan','electric','auto',2021,61800,105900,'Gdańsk','Pomorskie',351,'dealer',{drive:'awd',battery:75,range:520}],
  ['Hyundai','i20','1.2 MPI Comfort','car','hatchback','petrol','manual',2023,24100,55900,'Wrocław','Dolnośląskie',84,'seller']
];
const premiumDemoVehicles = [
  ['Lamborghini','Huracán','EVO 5.2 V10','car','coupe','petrol','auto',2021,14600,1295000,'Warszawa','Mazowieckie',640,'dealer',
    {drive:'awd',engine:5204,seats:2,color:'Czarny',description:'Czarny Huracán EVO z wolnossącym V10 i napędem na cztery koła. Czerwone zaciski kontrastują z czarnymi felgami.',
      description_en:'Black Huracán EVO with a naturally aspirated V10 and all-wheel drive. Red calipers stand out against the black wheels.'}],
  ['Lamborghini','Aventador','SVJ 6.5 V12','car','coupe','petrol','auto',2020,7600,3290000,'Poznań','Wielkopolskie',770,'dealer',
    {drive:'awd',engine:6498,seats:2,color:'Zielony',description:'Aventador SVJ w limonkowej zieleni. W galerii widać szeroki tył, karbonowe detale i charakterystyczne skrzydło.',
      description_en:'Lime-green Aventador SVJ. The gallery shows the wide rear, carbon details and distinctive wing.'}],
  ['Lamborghini','Revuelto','6.5 V12 Plug-in','car','coupe','plugin','auto',2024,0,3749000,'Warszawa','Mazowieckie',1015,'dealer',
    {drive:'awd',engine:6498,seats:2,color:'Pomarańczowy',condition:'new',battery:3.8,description:'Pomarańczowy Revuelto łączy silnik V12 z napędem hybrydowym plug-in. Czarny dach podkreśla niską sylwetkę.',
      description_en:'Orange Revuelto combining a V12 with plug-in hybrid power. The black roof emphasizes its low profile.'}],
  ['Lamborghini','Urus','Performante 4.0 V8','car','suv','petrol','auto',2023,20100,1390000,'Gdańsk','Pomorskie',666,'dealer',
    {drive:'awd',engine:3996,seats:5,color:'Grafitowy mat',description:'Urus Performante w matowym graficie, z czarnymi kołami i żółtymi zaciskami. Trzy kadry pokazują proporcje sportowego SUV-a.',
      description_en:'Matte graphite Urus Performante with black wheels and yellow calipers. Three angles show its performance SUV proportions.'}],
  ['Ferrari','488 GTB','3.9 V8 Twin Turbo','car','coupe','petrol','auto',2018,24900,990000,'Kraków','Małopolskie',670,'seller',
    {drive:'rwd',engine:3902,seats:2,color:'Rosso Corsa',description:'Ferrari 488 GTB w czerwieni Rosso Corsa na srebrnych felgach. Boczne wloty powietrza dobrze widać na ujęciu z profilu.',
      description_en:'Rosso Corsa Ferrari 488 GTB on silver wheels. The profile photograph clearly shows its side air intakes.'}],
  ['Ferrari','F8 Tributo','3.9 V8','car','coupe','petrol','auto',2021,13600,1475000,'Wrocław','Dolnośląskie',720,'dealer',
    {drive:'rwd',engine:3902,seats:2,color:'Giallo Modena',description:'Żółte F8 Tributo z czarnym dachem i ciemnymi felgami. Tylne ujęcie pokazuje cztery okrągłe światła.',
      description_en:'Yellow F8 Tributo with a black roof and dark wheels. The rear angle shows its four circular tail lamps.'}],
  ['Ferrari','812 Superfast','6.5 V12','car','coupe','petrol','auto',2019,18100,1799000,'Katowice','Śląskie',800,'dealer',
    {drive:'rwd',engine:6496,seats:2,color:'Bordowy metalik',description:'812 Superfast w głębokiej czerwieni z klasyczną długą maską. Zdjęcie z boku pokazuje proporcje coupé z silnikiem V12 z przodu.',
      description_en:'Deep red 812 Superfast with a classic long bonnet. The side view shows the proportions of the front-engined V12 coupé.'}],
  ['Ferrari','296 GTB','3.0 V6 Plug-in','car','coupe','plugin','auto',2023,8900,1599000,'Warszawa','Mazowieckie',830,'dealer',
    {drive:'rwd',engine:2992,seats:2,color:'Blu Corsa',battery:7.45,description:'Niebieskie 296 GTB z napędem hybrydowym plug-in i ciemnymi felgami. W galerii są osobne zdjęcia przodu, tyłu i profilu.',
      description_en:'Blue 296 GTB with plug-in hybrid power and dark wheels. The gallery includes separate front, rear and side views.'}],
  ['Ferrari','Roma','3.9 V8','car','coupe','petrol','auto',2022,17900,1129000,'Gdynia','Pomorskie',620,'seller',
    {drive:'rwd',engine:3855,seats:4,color:'Zielony metalik',description:'Ferrari Roma w ciemnej zieleni na srebrnych felgach. Ujęcie z profilu pokazuje płynną linię nadwozia grand tourera.',
      description_en:'Dark green Ferrari Roma on silver wheels. The profile view shows the flowing lines of the grand tourer.'}],
  ['Ferrari','SF90 Stradale','4.0 V8 Plug-in','car','coupe','plugin','auto',2023,5900,2690000,'Poznań','Wielkopolskie',1000,'dealer',
    {drive:'awd',engine:3990,seats:2,color:'Biała perła',battery:7.9,description:'Białe SF90 Stradale z czarnym dachem. Zdjęcia pokazują rozbudowaną aerodynamikę i niski profil hybrydowego coupé.',
      description_en:'Pearl white SF90 Stradale with a black roof. The photos show the hybrid coupé’s aerodynamic body and low profile.'}],
  ['Porsche','911','GT3 RS 4.0','car','coupe','petrol','auto',2024,4100,1499000,'Warszawa','Mazowieckie',525,'dealer',
    {drive:'rwd',engine:3996,seats:2,color:'Biały z czerwonymi akcentami',description:'Białe 911 GT3 RS z czerwonymi felgami i dużym tylnym skrzydłem. Ujęcia pokazują elementy aerodynamiczne z trzech stron.',
      description_en:'White 911 GT3 RS with red wheels and a large rear wing. Three views show its aerodynamic details.'}],
  ['Porsche','911','Turbo S 3.8 PDK','car','coupe','petrol','auto',2022,24800,969000,'Szczecin','Zachodniopomorskie',650,'seller',
    {drive:'awd',engine:3745,seats:4,color:'Srebrny metalik',description:'Srebrne 911 Turbo S generacji 992 z napędem na cztery koła. Tylne zdjęcie pokazuje szerokie nadkola i spojler Turbo S.',
      description_en:'Silver 992-generation 911 Turbo S with all-wheel drive. The rear photo shows its wide wheel arches and Turbo S spoiler.'}],
  ['McLaren','720S','4.0 V8 Performance','car','coupe','petrol','auto',2019,18300,1249000,'Wrocław','Dolnośląskie',720,'dealer',
    {drive:'rwd',engine:3994,seats:2,color:'Pomarańczowy',description:'McLaren 720S w pomarańczowym lakierze z czarnym dachem. Przedni kadr pokazuje charakterystyczne wloty wokół reflektorów.',
      description_en:'Orange McLaren 720S with a black roof. The front view shows the distinctive air intakes around the headlights.'}],
  ['McLaren','Artura','3.0 V6 Plug-in','car','coupe','plugin','auto',2024,7800,1195000,'Kraków','Małopolskie',680,'dealer',
    {drive:'rwd',engine:2993,seats:2,color:'Szmaragdowy metalik',battery:7.4,description:'Szmaragdowa Artura z hybrydowym napędem V6. Ciemne felgi i czarny dach podkreślają kolor nadwozia.',
      description_en:'Emerald green Artura with V6 hybrid power. Dark wheels and a black roof accent the body color.'}],
  ['Aston Martin','DBS Superleggera','5.2 V12','car','coupe','petrol','auto',2021,21800,1199000,'Gdańsk','Pomorskie',725,'dealer',
    {drive:'rwd',engine:5204,seats:4,color:'Grafitowy metalik',description:'Grafitowy DBS Superleggera z silnikiem V12 i czarnymi felgami. Profil pokazuje długą maskę oraz opadającą linię dachu.',
      description_en:'Graphite DBS Superleggera with a V12 and black wheels. The profile shows the long bonnet and sloping roofline.'}],
  ['Aston Martin','Vantage','4.0 V8','car','coupe','petrol','auto',2024,9200,1049000,'Poznań','Wielkopolskie',665,'dealer',
    {drive:'rwd',engine:3982,seats:2,color:'Granatowy metalik',description:'Granatowy Vantage z rocznika 2024 na dwukolorowych felgach. Przednie ujęcie pokazuje szeroką osłonę chłodnicy.',
      description_en:'Midnight blue 2024 Vantage on two-tone wheels. The front angle shows its broad grille.'}],
  ['Mercedes-Benz','AMG GT','R 4.0 V8','car','coupe','petrol','auto',2020,21800,819000,'Katowice','Śląskie',585,'seller',
    {drive:'rwd',engine:3982,seats:2,color:'Zielony mat',description:'AMG GT R w matowej zieleni z czarnym skrzydłem. Profil eksponuje długą maskę i nisko osadzoną kabinę.',
      description_en:'Matte green AMG GT R with a black wing. The side profile shows its long bonnet and low cabin.'}],
  ['Audi','R8','V10 Performance quattro','car','coupe','petrol','auto',2022,18800,799000,'Lublin','Lubelskie',620,'dealer',
    {drive:'awd',engine:5204,seats:2,color:'Jasnoszary perłowy',description:'Jasnoszare Audi R8 V10 Performance z czarnymi panelami bocznymi. W galerii można obejrzeć nadwozie i tylny dyfuzor.',
      description_en:'Light pearl gray Audi R8 V10 Performance with black side blades. The gallery shows the body and rear diffuser.'}],
  ['Nissan','GT-R','Nismo 3.8 V6','car','coupe','petrol','auto',2021,17200,945000,'Kraków','Małopolskie',600,'seller',
    {drive:'awd',engine:3799,seats:4,color:'Biała perła',description:'Białe GT-R Nismo z czarnym skrzydłem i czerwonymi akcentami na dolnej krawędzi nadwozia. Tylne ujęcie pokazuje okrągłe lampy GT-R.',
      description_en:'Pearl white GT-R Nismo with a black wing and red lower-body accents. The rear image shows the GT-R’s round tail lamps.'}],
  ['Bentley','Continental GT','Speed 6.0 W12','car','coupe','petrol','auto',2022,26300,1179000,'Warszawa','Mazowieckie',659,'dealer',
    {drive:'awd',engine:5950,seats:4,color:'Burgundowy metalik',description:'Burgundowy Continental GT Speed z silnikiem W12 i polerowanymi felgami. Ujęcia pokazują eleganckie proporcje czteromiejscowego coupé.',
      description_en:'Burgundy Continental GT Speed with a W12 and polished wheels. The photographs show the proportions of the four-seat coupé.'}]
];
export const demoBaseCount=standardDemoVehicles.length+premiumDemoVehicles.length;
export const demoCatalogReadyKey='demo-catalog/gallery-v1-ready';
const seedVehicles=[...standardDemoVehicles,...premiumDemoVehicles,...catalogDemoVehicles];
export const demoListingCount=seedVehicles.length;
const demoNames = { seller:['Sprzedawca demo','private','user'], buyer:['Kupujący demo','private','user'], dealer:['Komis demonstracyjny','company','user'], moderator:['Moderator demo','private','moderator'], admin:['Administrator demo','private','admin'] };
const recentDemoOrder = [25,29,35,27,34,37,39,28,30,31,32,33,36,38,40,41,42,43,44,26,19,13,24,14,23,15,20,16,21,17,22,18];
export const demoRoles = Object.keys(demoNames);
const seedScope = 'demo:seed';
const demoId = (scope, actor) => scope.replace(':','-') + '-' + actor;

const seedListingColumns=['id','scope','user_id','client_key','slug','status','make','model','variant','type','body','fuel',
  'gearbox','drive','condition','damage','year','mileage','power','price','currency','city','region','data','demo_photo',
  'created_at','updated_at','published_at'];
const insertSeedListings=`INSERT OR IGNORE INTO listings(${seedListingColumns.join(',')})
  SELECT ${seedListingColumns.map(column=>`json_extract(value,'$.${column}')`).join(',')} FROM json_each(?)`;

function seedStatements(db, scope, actors, count) {
  const created = now();
  const output = actors.map(actor => {
    const [name,type,role] = demoNames[actor];
    return stmt(db,`INSERT OR IGNORE INTO users(id,scope,email,name,profile_type,role,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)`,
      demoId(scope,actor),scope,actor+'@demo.invalid',name,type,role,created,created);
  });
  output.push(stmt(db,`INSERT OR IGNORE INTO companies(user_id,name,description,address,hours) VALUES(?,?,?,?,?)`,demoId(scope,'dealer'),'Komis demonstracyjny',
    'Przykładowy profil firmowy w katalogu BRUMBRUM.VIN. / Sample company profile in the BRUMBRUM.VIN catalog.','Warszawa, Polska','Pon.–pt. 9:00–17:00'));
  const listings=seedVehicles.slice(0,count).map((vehicle,index)=>{
    const [make,model,variant,type,body,fuel,gearbox,year,mileage,price,city,region,power,actor,extra={}] = vehicle;
    const {drive,condition,...specs}=extra;
    const num = index + 1;
    const ageHours=num===taycanDemoNumber?0:num>demoBaseCount?72+(num-demoBaseCount)/6:num<=12?num*5:recentDemoOrder.indexOf(num)/6;
    const published = new Date(Date.now() - ageHours * 3600000).toISOString();
    const data = { country:'Polska', description:'Przykładowe ogłoszenie pokazujące sposób prezentacji parametrów i wyposażenia. Zdjęcie poglądowe.',
      description_en:'Example listing showing vehicle specifications and equipment. Illustrative image.', negotiable:index % 3 === 1, document:actor === 'dealer' ? 'vat' : 'agreement',
      service:index % 2 === 0, firstOwner:index % 4 === 0, accidentFree:index % 3 !== 2, equipment:['abs','ac','bt',...(index % 2 === 0 ? ['camera','carplay'] : ['parking'])], battery:fuel === 'electric' ? 77.4 : null,
      range:fuel === 'electric' ? 454 : null, powerUnit:'KM', countryOrigin:'Polska', contact:'message', ...specs };
    return {
      id:demoId(scope,'car-'+num),scope,user_id:demoId(scope,actor),client_key:'seed-'+num,slug:'przyklad-'+num,
      status:'published',make,model,variant,type,body,fuel,gearbox,drive:drive??([4,5,9].includes(num)?'awd':'fwd'),
      condition:condition??(num===12?'new':'used'),damage:num===8?'yes':'no',year,mileage,power,
      price:price*100,currency:'PLN',city,region,data:JSON.stringify(data),demo_photo:samplePhoto(type,num),
      created_at:published,updated_at:published,published_at:published
    };
  });
  output.push(stmt(db,insertSeedListings,JSON.stringify(listings)));
  return output;
}

const frameName=(number,angle)=>String(number).padStart(2,'0')+'-'+angle+'.webp';
const samplePhoto = (type,index) => {
  if (index>standardDemoVehicles.length) return '/assets/showcase-hd/'+frameName(index,'front');
  return index<=12||type==='car'?'/assets/vehicle-'+index+'.webp':'/assets/category-type-'+type+'.webp';
};
export const demoPhotos = new Set(seedVehicles.map((vehicle,index)=>samplePhoto(vehicle[3],index+1)));
export const demoGalleries = new Map(seedVehicles.map((vehicle,index)=>{
  const number=index+1;
  const cover=samplePhoto(vehicle[3],number);
  const photos=['front','rear','side'].map(angle=>{
    const filename=frameName(number,angle);
    const hotspots=number===taycanDemoNumber&&angle==='front'?
      [{detail:'headlights',x:59,y:54},{detail:'wheels',x:70,y:68}]:undefined;
    return {url:'/assets/showcase-hd/'+filename,thumb:'/assets/showcase/'+filename,wide:true,detail:angle,hotspots};
  });
  return [cover,photos];
}));
export const bundledDemoFrames=demoGalleries.get(samplePhoto('car',taycanDemoNumber));
export const externalCatalogGalleries=[...demoGalleries.values()].slice(demoBaseCount).filter(gallery=>gallery!==bundledDemoFrames);

async function availableDemoCount(env) {
  return env.runtime==='node'||await env.BUCKET.head(demoCatalogReadyKey)?demoListingCount:demoBaseCount;
}

export async function ensureDemo(ctx) {
  const scope=ctx.scope;
  if (await row(ctx.db,'SELECT id FROM listings WHERE id=?',demoId(scope,'car-'+demoListingCount))) return;
  const count=await availableDemoCount(ctx.env);
  if (count===demoBaseCount&&await row(ctx.db,'SELECT id FROM listings WHERE id=?',demoId(scope,'car-'+demoBaseCount))) return;
  const actors=scope===seedScope?['seller','dealer']:demoRoles;
  await ctx.db.batch(seedStatements(ctx.db,scope,actors,count));
}

export async function activateDemo(ctx, actor, tokenDigest) {
  if (!demoRoles.includes(actor)) actor = 'seller';
  let scope = ctx.scope;
  if (scope === seedScope) {
    scope = 'demo:' + id();
    const count=await availableDemoCount(ctx.env);
    await ctx.db.batch([
      stmt(ctx.db,'INSERT INTO demo_workspaces(token,scope,expires_at) VALUES(?,?,?)',tokenDigest,scope,after(2*86400000)),
      ...seedStatements(ctx.db,scope,demoRoles,count)
    ]);
  }
  return {scope, userId:demoId(scope,actor)};
}
