import { numeric } from './core.js';

// Presentation fixtures only. These are never seeded into listings or offered for transactions.
// Names, configurations, locations and amounts below are invented, not manufacturer quotations.
const examples = [
  ['humanoidalne','humanoid-h01','Humanoid H-01','Humanoid H-01','both',129900,890,'day','PLN',
    'Humanoid do prezentacji, obsługi pokazów i prostych zadań w przestrzeni biurowej. Konfiguracja z chwytakami i panelem sterowania.',
    'A humanoid for presentations, demonstrations and simple office tasks. Configured with grippers and a control panel.',
    [['Wysokość','Height','165 cm'],['Udźwig','Payload','8 kg'],['Czas pracy','Runtime','4 h']]],
  ['humanoidalne','humanoid-h02','Humanoid badawczy H-02','Research humanoid H-02','sale',24500,null,'day','EUR',
    'Kompaktowa platforma edukacyjna do nauki programowania ruchu i interakcji. Przygotowana do zajęć w pracowni robotyki.',
    'A compact educational platform for programming movement and interaction. Configured for a robotics classroom.',
    [['Wysokość','Height','120 cm'],['Stopnie swobody','Degrees of freedom','24'],['Masa','Weight','28 kg']]],
  ['przemyslowe','cobot-p01','Cobot montażowy P-01','Assembly cobot P-01','both',42900,340,'day','PLN',
    'Ramię do powtarzalnych zadań montażowych i przekładania detali. Zestaw obejmuje sterownik oraz podstawę do stanowiska roboczego.',
    'An arm for repetitive assembly and component handling. The configuration includes a controller and a workstation base.',
    [['Udźwig','Payload','10 kg'],['Zasięg','Reach','1 200 mm'],['Osie','Axes','6']]],
  ['przemyslowe','ramie-p02','Ramię przemysłowe P-02','Industrial arm P-02','rent',null,1490,'week','PLN',
    'Sześcioosiowe ramię do stanowiska szkoleniowego. Kompaktowy zasięg ułatwia demonstrację sekwencji montażowych i paletyzacji.',
    'A six-axis arm for a training station. Its compact reach suits assembly sequence and palletising demonstrations.',
    [['Udźwig','Payload','5 kg'],['Zasięg','Reach','850 mm'],['Osie','Axes','6']]],
  ['kroczace','robot-k01','Robot kroczący K-01','Legged robot K-01','both',39900,490,'day','PLN',
    'Czworonożny robot do pokazów mobilności i testów terenowych. Platforma z miejscem na dodatkowy moduł pomiarowy.',
    'A quadruped for mobility demonstrations and terrain trials. The platform has space for an additional sensing module.',
    [['Masa','Weight','18 kg'],['Udźwig','Payload','5 kg'],['Czas pracy','Runtime','2 h']]],
  ['kroczace','robot-k02','Robot terenowy K-02','Terrain robot K-02','rent',null,180,'day','EUR',
    'Robot kroczący do pokazów, szkoleń i sprawdzania tras przejazdu. Większa platforma pozwala zamontować dodatkowe wyposażenie.',
    'A legged robot for demonstrations, training and route trials. The larger platform accommodates additional equipment.',
    [['Masa','Weight','32 kg'],['Udźwig','Payload','12 kg'],['Czas pracy','Runtime','3 h']]],
  ['uslugowe','robot-u01','Robot recepcyjny U-01','Reception robot U-01','sale',17900,null,'day','PLN',
    'Robot do prezentowania informacji w recepcji i kierowania gości do właściwej strefy. Wyposażony w ekran dotykowy.',
    'A robot for displaying reception information and directing visitors. Equipped with a touchscreen.',
    [['Ekran','Display','15″'],['Wysokość','Height','130 cm'],['Czas pracy','Runtime','8 h']]],
  ['uslugowe','robot-u02','Robot dostawczy U-02','Delivery robot U-02','both',34900,1200,'month','PLN',
    'Robot do przewożenia tac i drobnych przesyłek wewnątrz budynku. Trzy półki pozwalają oddzielić poszczególne dostawy.',
    'A robot for carrying trays and small packages indoors. Three shelves keep individual deliveries separate.',
    [['Udźwig','Payload','30 kg'],['Półki','Shelves','3'],['Czas pracy','Runtime','10 h']]],
  ['magazynowe','amr-m01','Robot magazynowy M-01','Warehouse robot M-01','both',64900,1900,'week','PLN',
    'Platforma AMR do transportu pojemników między stanowiskami magazynowymi. Niska konstrukcja ułatwia załadunek.',
    'An AMR platform for transporting containers between warehouse stations. Its low profile simplifies loading.',
    [['Udźwig','Payload','300 kg'],['Prędkość','Speed','1,5 m/s'],['Czas pracy','Runtime','8 h']]],
  ['magazynowe','amr-m02','Platforma transportowa M-02','Transport platform M-02','rent',null,690,'day','PLN',
    'Platforma transportowa do cięższych ładunków i obsługi stałych tras magazynowych. Konfiguracja z płaskim pokładem.',
    'A transport platform for heavier loads and fixed warehouse routes. Configured with a flat deck.',
    [['Udźwig','Payload','600 kg'],['Szerokość','Width','85 cm'],['Czas pracy','Runtime','10 h']]],
  ['rolnicze','robot-r01','Robot polowy R-01','Field robot R-01','sale',89900,null,'day','PLN',
    'Autonomiczna platforma do prac polowych i przewożenia wyposażenia między rzędami upraw. Konfiguracja o szerokości roboczej 120 cm.',
    'An autonomous platform for field work and carrying equipment between crop rows. Configured with a 120 cm working width.',
    [['Szerokość robocza','Working width','120 cm'],['Masa','Weight','260 kg'],['Czas pracy','Runtime','6 h']]],
  ['rolnicze','robot-r02','Robot szklarniowy R-02','Greenhouse robot R-02','rent',null,690,'week','EUR',
    'Robot do transportu pojemników w szklarni. Wąska konstrukcja została dobrana do poruszania się między stanowiskami upraw.',
    'A robot for transporting greenhouse containers. Its narrow design suits movement between growing stations.',
    [['Udźwig','Payload','150 kg'],['Szerokość','Width','65 cm'],['Czas pracy','Runtime','7 h']]],
  ['budowlane','robot-b01','Robot budowlany B-01','Construction robot B-01','both',119900,890,'day','PLN',
    'Kompaktowy robot do prac budowlanych, wyposażony w ramię robocze i podwozie gąsienicowe. Sterowanie z osobnego panelu.',
    'A compact construction robot with a working arm and tracked chassis. Operated through a separate control panel.',
    [['Masa','Weight','850 kg'],['Zasięg roboczy','Working reach','3,2 m'],['Zasilanie','Power','400 V']]],
  ['budowlane','robot-b02','Robot transportowy B-02','Site transport robot B-02','rent',null,2300,'week','PLN',
    'Platforma do przewozu materiałów i narzędzi na placu budowy. Pokład transportowy mieści ładunki o masie do 500 kg.',
    'A platform for carrying materials and tools on a construction site. Its transport deck accommodates loads up to 500 kg.',
    [['Udźwig','Payload','500 kg'],['Szerokość','Width','90 cm'],['Czas pracy','Runtime','5 h']]],
  ['domowe-ogrodowe','robot-d01','Robot ogrodowy D-01','Garden robot D-01','sale',2900,null,'day','PLN',
    'Robot do pielęgnacji trawnika przy domu. Zestaw z bazą ładowania i możliwością ustalenia harmonogramu pracy.',
    'A robot for home lawn care. Configured with a charging base and a programmable working schedule.',
    [['Powierzchnia','Area','800 m²'],['Szerokość robocza','Working width','22 cm'],['Masa','Weight','9 kg']]],
  ['domowe-ogrodowe','robot-d02','Robot sprzątający D-02','Cleaning robot D-02','both',5900,180,'week','PLN',
    'Urządzenie do sprzątania podłóg w domu i małym biurze. Konfiguracja z pojemnikiem na wodę i stacją dokującą.',
    'A device for cleaning floors at home or in a small office. Configured with a water tank and a docking station.',
    [['Czas pracy','Runtime','3 h'],['Pojemność zbiornika','Tank capacity','2 l'],['Masa','Weight','12 kg']]],
  ['medyczne','robot-med01','Platforma szkoleniowa MED-01','Training platform MED-01','rent',null,3500,'month','PLN',
    'Platforma szkoleniowa do nauki sterowania dwoma ramionami. Przeznaczona do zajęć i demonstracji robotyki medycznej.',
    'A training platform for learning to control two arms. Designed for classes and medical robotics demonstrations.',
    [['Ramiona','Arms','2'],['Masa','Weight','180 kg'],['Zasilanie','Power','230 V']]],
  ['medyczne','robot-med02','Robot demonstracyjny MED-02','Demonstration robot MED-02','sale',48900,null,'day','EUR',
    'Stacja demonstracyjna do nauki sterowania ramieniem i ćwiczenia precyzyjnych sekwencji ruchu. Konfiguracja do pracowni edukacyjnej.',
    'A demonstration station for arm control and precise movement sequences. Configured for an educational laboratory.',
    [['Osie','Axes','6'],['Zasięg','Reach','700 mm'],['Masa','Weight','95 kg']]],
  ['drony','dron-a01','Dron inspekcyjny A-01','Inspection drone A-01','both',9900,190,'day','PLN',
    'Dron z kamerą do dokumentowania obiektów i oględzin z powietrza. Kompaktowy zestaw z aparaturą sterującą.',
    'A camera drone for documenting structures and aerial inspections. A compact configuration with a remote controller.',
    [['Czas lotu','Flight time','35 min'],['Masa','Weight','1,4 kg'],['Kamera','Camera','4K']]],
  ['drony','dron-a02','Dron pomiarowy A-02','Survey drone A-02','sale',29900,null,'day','PLN',
    'Zestaw pomiarowy z dronem i modułem pozycjonowania. Platforma z miejscem na dodatkowy sensor do dokumentacji terenu.',
    'A survey kit with a drone and a positioning module. The platform accommodates an additional terrain survey sensor.',
    [['Czas lotu','Flight time','45 min'],['Masa','Weight','3,2 kg'],['Udźwig','Payload','1 kg']]],
  ['inspekcyjne','robot-i01','Robot inspekcyjny I-01','Inspection robot I-01','both',24900,390,'day','PLN',
    'Robot gąsienicowy do oględzin trudno dostępnych miejsc. Kamera na ruchomej głowicy ułatwia obserwację otoczenia.',
    'A tracked robot for inspecting hard-to-reach locations. A camera on a movable head assists observation.',
    [['Masa','Weight','15 kg'],['Szerokość','Width','32 cm'],['Kamera','Camera','1080p']]],
  ['inspekcyjne','robot-i02','Robot do kanałów I-02','Duct inspection robot I-02','rent',null,1800,'week','PLN',
    'Robot do inspekcji kanałów i wąskich przestrzeni technicznych. Zestaw z przewodem i panelem do obserwacji obrazu.',
    'A robot for inspecting ducts and narrow technical spaces. Configured with a cable and a video monitoring panel.',
    [['Masa','Weight','8 kg'],['Szerokość','Width','22 cm'],['Przewód','Cable','50 m']]]
];

export const robotDemoExamples=Object.freeze(examples.map(([robotCategory,slug,title,title_en,tradeMode,price,rentalPrice,rentalUnit,currency,description,description_en,parameters],index)=>Object.freeze({
  id:'robot-demo-'+slug,slug,type:'robot',demo:true,readOnly:true,robotCategory,title,title_en,make:'Producent DEMO',
  model:title.split(' ').at(-1),tradeMode,price,rentalPrice,rentalUnit,currency,description,description_en,
  condition:index%4===1?'used':'new',year:index%4===1?2024:2026,
  city:['Warszawa','Poznań','Wrocław','Gdańsk'][index%4],country:'Polska',
  parameters:Object.freeze(parameters.map(parameter=>Object.freeze(parameter))),
  specs:parameters.map(([pl,en,value])=>`${pl} / ${en}: ${value}`).join('\n')
})));

const bySlug=new Map(robotDemoExamples.map(example=>[example.slug,example]));
export const getRobotDemo=slug=>bySlug.get(slug)||null;
const featuredCategories=['humanoidalne','przemyslowe','kroczace','uslugowe','magazynowe','drony','rolnicze','medyczne'];
export const featuredRobotDemos=Object.freeze(featuredCategories.map(key=>robotDemoExamples.find(example=>example.robotCategory===key)));

const lower=value=>String(value??'').trim().toLocaleLowerCase('pl');
const bounded=value=>numeric(value,0,100000000);

// Keep demonstrative counts separate from the real marketplace search and its pagination.
export function listRobotDemos(params=new URLSearchParams()) {
  const value=key=>String(params.get(key)||'').trim().slice(0,100);
  const selectedCategory=value('robotCategory')||value('category'),mode=value('tradeMode')||value('mode');
  const q=lower(value('q'));
  const minimum=bounded(value('minPrice')),maximum=bounded(value('maxPrice'));
  const currency=value('currency').toUpperCase()||((minimum!==null||maximum!==null)?'PLN':'');
  const minRental=bounded(value('minRentalPrice')),maxRental=bounded(value('maxRentalPrice'));
  const minYear=bounded(value('minYear')),maxYear=bounded(value('maxYear'));
  const priceOf=example=>mode==='rent'?example.rentalPrice:example.price;
  const matches=robotDemoExamples.filter(example=>{
    if(selectedCategory&&example.robotCategory!==selectedCategory)return false;
    if(mode&&example.tradeMode!==mode&&!(example.tradeMode==='both'&&['sale','rent'].includes(mode)))return false;
    if(currency&&example.currency!==currency)return false;
    for(const key of ['make','model','condition','country'])if(value(key)&&lower(example[key])!==lower(value(key)))return false;
    if(value('city')&&!lower(example.city).includes(lower(value('city'))))return false;
    if(q&&!lower([example.make,example.model,example.title,example.title_en,example.description,example.description_en,example.specs].join(' ')).includes(q))return false;
    const amount=priceOf(example);
    if(minimum!==null&&(amount===null||amount<minimum))return false;
    if(maximum!==null&&(amount===null||amount>maximum))return false;
    if(minRental!==null&&(example.rentalPrice===null||example.rentalPrice<minRental))return false;
    if(maxRental!==null&&(example.rentalPrice===null||example.rentalPrice>maxRental))return false;
    if(minYear!==null&&example.year<minYear)return false;
    if(maxYear!==null&&example.year>maxYear)return false;
    return true;
  });
  const sort=value('sort');
  if(sort==='price_asc'||sort==='price_desc')matches.sort((a,b)=>{
    const left=priceOf(a),right=priceOf(b);
    if(left===null)return right===null?0:1;
    if(right===null)return -1;
    return (sort==='price_desc'?-1:1)*(left-right);
  });
  if(sort==='year'||sort==='year_asc')matches.sort((a,b)=>(sort==='year_asc'?1:-1)*(a.year-b.year));
  return matches;
}
