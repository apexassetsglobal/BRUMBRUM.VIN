export {featureText, lookupFeatureTranslation, importFieldLabel, importStatusLabel} from '../public/assets/service-language.js';

// Stable identifiers are used in company profiles, filters and public URLs.
const languages = ['pl', 'en', 'cs', 'sk', 'de', 'uk'];

function languageOf(language) {
  const code = typeof language === 'string' ? language.toLowerCase().split(/[-_]/, 1)[0] : '';
  return languages.includes(code) ? code : 'pl';
}

function localizedValues(values) {
  return Object.freeze(Object.fromEntries(languages.map((language, index) => [language, values[index]])));
}

function category(id, names, descriptions, keywords) {
  return Object.freeze({
    id,
    names: localizedValues(names),
    descriptions: localizedValues(descriptions),
    keywords: Object.freeze(keywords.split('|'))
  });
}

export const serviceCategories = Object.freeze([
  category('detailing', [
    'Auto detailing', 'Car detailing', 'Auto detailing', 'Auto detailing', 'Fahrzeugaufbereitung', 'Автодетейлінг'
  ], [
    'Pielęgnacja lakieru i wnętrza, korekta lakieru oraz powłoki ochronne.',
    'Paint correction, interior detailing and protective coatings for paintwork.',
    'Péče o interiér a lak, korekce laku a ochranné povlaky.',
    'Starostlivosť o interiér a lak, korekcia laku a ochranné nátery.',
    'Lackkorrektur, Innenraumaufbereitung und Schutzbeschichtungen für den Lack.',
    'Догляд за салоном, корекція лакофарбового покриття й нанесення захисних покриттів.'
  ], 'detailing*|detailer*|detayling|korekt* lakier*|polerowan* lakier*|powlok* ceramiczn*|ceramic coat*|paint correction|interior detailing|lešt* lak*|leštěn* laku|lešten* laku|keramick* ochran*|lackaufbereitung|lackpolitur|innenraumaufbereitung|keramikversiegelung|детейл*|поліруван* кузов*|поліруван* лак*|керамічн* покрит*|poleruj* lakier*|powłok* hydrofobow*|zabezpiecz* ceramik*|valeting|paint polish*|polish* paintwork|voskov* karoser*|voskov* voz*|leštím* lak*|aufbereitung von innenraum*|lackversiegelung*|поліруєм* кузов*|нанесен* керамік*'),
  category('myjnie', [
    'Myjnie samochodowe', 'Car washes', 'Automyčky', 'Autoumyvárne', 'Autowaschanlagen', 'Автомийки'
  ], [
    'Mycie samochodu ręczne, automatyczne lub na stanowisku samoobsługowym.',
    'Hand washes, automatic wash bays and self-service car washing.',
    'Ruční mytí, automatické linky a samoobslužné mycí boxy pro auta.',
    'Ručné umývanie, automatické linky a samoobslužné boxy pre autá.',
    'Handwäsche, automatische Waschstraßen und Selbstbedienungs-Waschplätze für Fahrzeuge.',
    'Ручне й автоматичне миття автомобілів, мийки самообслуговування.'
  ], 'myjni*|myjni* bezdotyk*|mycie samochod*|mycie aut*|car wash*|carwash*|hand wash*|automatick* myck*|automyck*|myti aut*|autoumyvar*|umyvan* aut*|waschstrass*|waschanlag*|autowasch*|автомий*|мийк* самообслугов*|миття авто*|myjem* samochod*|myjem* aut*|myj* samochodow*|car cleaning|washing cars|ruční mytí|ručné umývanie|waschpark*|waschbox*|handwasch*|миєм* автомоб*|ручн* мийк*'),
  category('warsztaty', [
    'Warsztaty mechaniczne', 'Mechanical repair shops', 'Autoservisy', 'Autoservisy', 'Kfz-Werkstätten', 'Механічні автомайстерні'
  ], [
    'Naprawy silników, hamulców i zawieszenia oraz obsługa okresowa pojazdów.',
    'Engine, brake and suspension repairs, maintenance and periodic servicing.',
    'Opravy motorů, brzd a podvozku i pravidelná údržba vozidel.',
    'Opravy motorov, bŕzd a podvozku aj pravidelná údržba vozidiel.',
    'Reparaturen an Motor, Bremsen und Fahrwerk sowie regelmäßige Wartung.',
    'Ремонт двигуна, гальм і підвіски та планове технічне обслуговування.'
  ], 'warsztat* mechaniczn*|mechanik* samochodow*|serwis mechaniczn*|wymian* rozrzad*|wymian* hamulc*|napraw* silnik*|napraw* zawieszen*|auto repair|automotive repair|mechanical repair*|repair shop*|engine repair*|brake repair*|suspension repair*|autoservis*|oprav* motor*|opravy brzd|kfz werkstatt|kfz werkstatt*|autowerkstat*|motorreparatur*|bremsenreparatur*|автосервіс*|автослюсар*|автомайстерн*|ремонт двигун*|ремонт підвіск*|ремонт гальм*|wymien* rozrzad*|wymien* hamulc*|wymien* klock* hamulcow*|repair* engines|repair* brakes|vehicle maintenance|brake pads|vymen* brzd*|menime brzdy|opravy podvozk*|reparatur von motoren|inspektion von fahrzeug*|wartung und reparatur|ремонтуєм* двигун*|ремонтуєм* підвіск*|замін* гальмівн* колодок'),
  category('diagnostyka', [
    'Diagnostyka komputerowa', 'Computer diagnostics', 'Počítačová diagnostika', 'Počítačová diagnostika', 'Fahrzeugdiagnose', 'Комп’ютерна діагностика'
  ], [
    'Odczyt kodów usterek, analiza parametrów i diagnostyka sterowników pojazdu.',
    'Fault code reading, live data analysis and electronic control unit diagnostics.',
    'Čtení chybových kódů, analýza provozních údajů a diagnostika řídicích jednotek.',
    'Čítanie chybových kódov, analýza prevádzkových údajov a diagnostika riadiacich jednotiek.',
    'Auslesen von Fehlercodes, Analyse von Messwerten und Diagnose von Steuergeräten.',
    'Зчитування кодів несправностей, аналіз параметрів та діагностика блоків керування.'
  ], 'diagnostyk* komputer*|diagnostyk* obd*|odczyt bled*|kod* usterek|komputerow* diagnostyk*|obd|obd2|obdii|computer diagnos*|fault code*|engine diagnostics|ecu diagnostic*|pocitacov* diagnostik*|autodiagnostik*|diagnostik* motor*|chybov* kod*|fehlerspeicher*|fehlercode*|fahrzeugdiagnos*|steuergeratediagnos*|комп ютерн* діагност*|автодіагност*|зчитуван* код*|kasowan* bled*|sprawdz* sterownik*|scan tool*|diagnostic scan*|čtení závad|vycitan* zavad|diagnostika vozid*|fehlerspeicher ausles*|diagnosegerät*|комп ютерн* діагностуван*|код* несправност*'),
  category('elektryka', [
    'Elektryka samochodowa', 'Auto electrical repairs', 'Autoelektrika', 'Autoelektrika', 'Kfz-Elektrik', 'Автоелектрика'
  ], [
    'Naprawa instalacji elektrycznej, rozruszników, alternatorów i oświetlenia.',
    'Wiring, starter motor, alternator and vehicle lighting repairs.',
    'Opravy elektroinstalace, startérů, alternátorů a osvětlení vozidel.',
    'Opravy elektroinštalácie, štartérov, alternátorov a osvetlenia vozidiel.',
    'Reparatur von Verkabelung, Anlasser, Lichtmaschine und Fahrzeugbeleuchtung.',
    'Ремонт електропроводки, стартерів, генераторів та освітлення автомобіля.'
  ], 'elektryk* samochodow*|elektromechanik*|instalacj* elektryczn*|rozrusznik*|alternator*|auto electric*|car wiring|wiring harness|starter motor*|autoelektr*|elektroinstalac*|elektroinstalac* voz*|kfz elektrik*|lichtmaschine*|kabelbaum*|автоелектр*|електропроводк*|ремонт стартер*|ремонт генератор*|elektryczn* instalacj*|napraw* przewod*|wiring repairs|electrical fault*|starter repairs|opravy elektroinstalac*|elektroinstalac* aut*|kfz elektriker*|anlasser*|ремонтуєм* стартер*|ремонтуєм* електропроводк*'),
  category('blacharstwo', [
    'Blacharstwo i lakiernictwo', 'Bodywork and paint', 'Karosářství a lakování', 'Karosárstvo a lakovanie', 'Karosserie und Lack', 'Кузовні та малярні роботи'
  ], [
    'Naprawy blacharskie, usuwanie wgnieceń i lakierowanie elementów nadwozia.',
    'Body panel repair, dent removal and automotive paintwork.',
    'Opravy karoserie, odstraňování promáčklin a lakování dílů.',
    'Opravy karosérie, odstraňovanie preliačin a lakovanie dielov.',
    'Instandsetzung von Karosserieteilen, Dellenentfernung und Fahrzeuglackierung.',
    'Відновлення кузовних деталей, видалення вм’ятин та фарбування кузова.'
  ], 'blachar*|lakierni*|lakierowa*|napraw* powypadkow*|usuwan* wgniec*|body shop*|bodyshop*|bodywork|dent repair*|dent removal|collision repair*|respray*|pdr|karosar*|autolakov*|lakov* dil*|lakov* diel*|karosserie*|lackier*|dellenreparat*|кузовн* ремонт*|кузовн* робот*|фарбуван* авто*|фарбуван* кузов*|рихтуван*|usuwam* wgniec*|napraw* karoseri*|maluj* nadwoz*|body repair|panel beat*|paintless dent|oprava karoser*|rovna* karoser*|dellenentfern*|unfallinstandsetz*|рихтуєм*|фарбуєм* авто*|ремонт кузов*'),
  category('wulkanizacja', [
    'Wulkanizacja i serwis opon', 'Tyres and tyre service', 'Pneuservisy', 'Pneuservisy', 'Reifenservice', 'Шиномонтаж і ремонт шин'
  ], [
    'Wymiana, naprawa i sezonowe przechowywanie opon oraz wyważanie kół.',
    'Tyre fitting, puncture repair, seasonal tyre storage and wheel balancing.',
    'Výměna a opravy pneumatik, sezónní uskladnění a vyvažování kol.',
    'Výmena a opravy pneumatík, sezónne uskladnenie a vyvažovanie kolies.',
    'Reifenwechsel, Reifenreparatur, saisonale Einlagerung und Auswuchten von Rädern.',
    'Заміна, ремонт і сезонне зберігання шин, балансування коліс.'
  ], 'wulkaniza*|serwis opon|wymian* opon|wywazan* kol|napraw* opon|tyre*|tire service|tire repair|tire fitting|wheel balanc*|pneuservis*|pneumatik*|vyvaz* kol*|reifen*|radauswucht*|шиномонтаж*|ремонт шин|заміна шин|балансуван* коліс|wymien* opon*|napraw* opon*|wyważam* koł*|tires|tire change*|tire shop|puncture repair*|oprava defekt*|prezouv* pneumatik*|prezuvan* pneumatik*|räder auswuch*|ремонтуєм* шин*|міняєм* шин*'),
  category('tuning', [
    'Tuning mechaniczny i wizualny', 'Performance and styling', 'Výkonový a vzhledový tuning', 'Výkonový a vzhľadový tuning', 'Leistungs- und Fahrzeugtuning', 'Технічний та візуальний тюнінг'
  ], [
    'Modyfikacje osiągów, podwozia, wydechu i wyglądu samochodu.',
    'Upgrades to engine performance, suspension, exhaust and exterior styling.',
    'Úpravy výkonu motoru, podvozku, výfukové soustavy a vzhledu vozu.',
    'Úpravy výkonu motora, podvozka, výfukovej sústavy a vzhľadu vozidla.',
    'Änderungen an Motorleistung, Fahrwerk, Auspuffanlage und Fahrzeugoptik.',
    'Доопрацювання двигуна, підвіски, вихлопної системи та зовнішнього вигляду.'
  ], 'tuning*|chiptun*|chip tun*|hamowni*|remap*|body kit*|bodykit*|performance upgrade*|ecu tun*|uprava vykonu|upravy vykonu|leistungssteiger*|fahrwerktun*|тюнінг*|чип тюнінг*|чіп тюнінг*|стайлінг*|modyfikacj* silnik*|strojen* silnik*|engine tuning|stage 1|stage 2|sportovn* podvoz*|sportov* podvoz*|kennfeldoptimierung|модернізація двигун*|доопрацюван* двигун*'),
  category('ppf', [
    'Oklejanie samochodów i PPF', 'Car wrapping and PPF', 'Polepy aut a PPF', 'Polepy áut a PPF', 'Fahrzeugfolierung und PPF', 'Обклеювання авто та PPF'
  ], [
    'Zmiana koloru nadwozia folią, aplikacja folii ochronnej PPF i oklein reklamowych.',
    'Colour-change wraps, paint protection film and commercial vehicle graphics.',
    'Celopolepy pro změnu barvy, ochranné fólie PPF a reklamní polepy.',
    'Celopolepy na zmenu farby, ochranné fólie PPF a reklamné polepy.',
    'Farbwechsel durch Folierung, Lackschutzfolien und Fahrzeugbeschriftung.',
    'Зміна кольору кузова плівкою, нанесення захисної плівки PPF та рекламної графіки.'
  ], 'ppf|oklejan* aut*|oklejan* samochod*|oklejan* pojazd*|foli* ochronn*|car wrap*|vehicle wrap*|vinyl wrap*|paint protection film|celopolep*|polep* aut*|ochrann* foli*|lackschutzfol*|fahrzeugfolier*|autofolier*|обклеюван* авто*|захисн* плівк*|антигравійн*|вінілов* плівк*|oklejam* aut*|oklejam* samochod*|ochron* lakier* folia|wrap installation|vehicle graphics|zmena barvy folii|zmena farby foliou|folierung von fahrzeug*|обклеюєм* авто*|бронюван* плівк*'),
  category('szyby', [
    'Przyciemnianie szyb', 'Window tinting', 'Tónování autoskel', 'Tónovanie autoskiel', 'Scheibentönung', 'Тонування скла'
  ], [
    'Montaż folii przyciemniających i przeciwsłonecznych na szybach samochodowych.',
    'Fitting tint and solar control films to vehicle windows.',
    'Montáž tónovacích a protislunečních fólií na skla vozidel.',
    'Montáž tónovacích a protislnečných fólií na sklá vozidiel.',
    'Montage von Tönungs- und Sonnenschutzfolien auf Fahrzeugscheiben.',
    'Нанесення тонувальної та сонцезахисної плівки на автомобільне скло.'
  ], 'przyciemnian* szyb|przyciemniam* szyb*|foli* przyciemniaj*|window tint*|tinted glass|tint film|tonov* skel|tonov* autoskel|tonov* skiel|tonov* autoskiel|scheibenton*|tonungsfol*|тонуван* скл*|тонуєм* скл*|тонуван* вікон*|тонувальн* плівк*|przyciemni* szyb*|tinting car windows|tinted windows|tonujeme autoskl*|folie na autoskl*|scheiben ton*|scheiben verdunkeln|тонуєм* вікн*|затемнен* скл*'),
  category('turbosprezarki', [
    'Regeneracja turbosprężarek', 'Turbocharger rebuilding', 'Repase turbodmychadel', 'Repasovanie turbodúchadiel', 'Turbolader-Instandsetzung', 'Відновлення турбокомпресорів'
  ], [
    'Diagnostyka, wyważanie i regeneracja turbosprężarek.',
    'Turbocharger inspection, balancing and rebuilding.',
    'Kontrola, vyvažování a repasování turbodmychadel.',
    'Kontrola, vyvažovanie a repasovanie turbodúchadiel.',
    'Prüfung, Auswuchtung und Instandsetzung von Turboladern.',
    'Діагностика, балансування та відновлення турбокомпресорів.'
  ], 'turbosprezar*|regenerac* turbin*|regenerac* turbo|turbocharg*|turbo rebuild*|turbo repair*|turbodmychad*|turboduchad*|repas* turb*|turbolader*|турбокомпресор*|ремонт турбін*|відновлен* турбін*|napraw* turbin*|regenerujem* turbin*|repair turbo*|rebuild* turbo*|oprava turbin*|turboladerrevision*|ремонтуєм* турбін*|відновлюєм* турбін*'),
  category('klimatyzacja', [
    'Serwis klimatyzacji', 'Air conditioning service', 'Servis klimatizace', 'Servis klimatizácie', 'Klimaanlagenservice', 'Обслуговування кондиціонерів'
  ], [
    'Obsługa klimatyzacji samochodowej, sprawdzanie szczelności i czyszczenie układu.',
    'Vehicle air conditioning maintenance, leak testing and system cleaning.',
    'Údržba autoklimatizace, kontrola těsnosti a čištění systému.',
    'Údržba autoklimatizácie, kontrola tesnosti a čistenie systému.',
    'Wartung der Fahrzeugklimaanlage, Dichtheitsprüfung und Reinigung des Systems.',
    'Обслуговування автокондиціонерів, перевірка герметичності та очищення системи.'
  ], 'klimatyzac*|klimatyzacj*|air condition*|ac recharge|a c recharge|a c service|ac repair|regas|klimatizac*|autoklimatizac*|klimaanlag*|klimaservice|автокондиціонер*|кондиціонер*|заправ* фреон*|nabijam* klim*|nabijan* klim*|serwis klim*|aircon|air con service|servis klimy|klimaanlagenwartung|заправляєм* кондиціонер*|ремонтуєм* кондиціонер*'),
  category('pomoc-drogowa', [
    'Pomoc drogowa i lawety', 'Roadside assistance and towing', 'Silniční asistence a odtah', 'Cestná asistencia a odťah', 'Pannenhilfe und Abschleppdienst', 'Допомога на дорозі та евакуація'
  ], [
    'Pomoc przy awarii na trasie, holowanie i transport pojazdu na lawecie.',
    'Breakdown assistance, towing and vehicle recovery by transporter.',
    'Pomoc při poruše na silnici, odtah a přeprava nepojízdného vozidla.',
    'Pomoc pri poruche na ceste, odťah a preprava nepojazdného vozidla.',
    'Hilfe bei Pannen unterwegs, Abschleppen und Fahrzeugtransport.',
    'Допомога в разі поломки на дорозі, буксирування та перевезення евакуатором.'
  ], 'pomoc drogow*|lawet*|holowan*|roadside assist*|breakdown assist*|vehicle recovery|tow truck|towing|odtah*|odtahov*|silnicni asistenc*|cestna asisten*|pannenhilfe|abschlepp*|евакуатор*|буксируван*|допомог* на дорозі|дорожн* допомог*|holujem*|autolawet*|auto lawet*|car recovery|tow truck*|odtahujeme|odtahova sluzb*|bergungsdienst*|abschleppen von fahrzeug*|автоевакуатор*|буксируєм*'),
  category('elektryczne', [
    'Serwis samochodów elektrycznych', 'Electric vehicle service', 'Servis elektromobilů', 'Servis elektromobilov', 'Elektroauto-Service', 'Сервіс електромобілів'
  ], [
    'Serwis napędów elektrycznych, diagnostyka akumulatorów trakcyjnych i układów ładowania.',
    'Electric drivetrain service, traction battery diagnostics and charging system checks.',
    'Servis elektrického pohonu, diagnostika trakčních baterií a nabíjecích systémů.',
    'Servis elektrického pohonu, diagnostika trakčných batérií a nabíjacích systémov.',
    'Wartung elektrischer Antriebe, Diagnose von Traktionsbatterien und Ladesystemen.',
    'Обслуговування електроприводу, діагностика тягових батарей та систем заряджання.'
  ], 'samochod* elektryczn*|aut elektryczn*|elektromobil*|bateri* trakcyjn*|akumulator* trakcyjn*|uklad* wysokonapieciow*|serwis ev|electric vehicle*|ev service|ev repair|traction batter*|electric drivetrain|elektroaut*|trakcn* bater*|hochvolt*|traktionsbatter*|електромобіл*|тягов* батаре*|високовольтн* систем*|pojazd* elektryczn*|serwis tesl*|high voltage batter*|high voltage repair|elektrick* pohon*|wartung von elektroauto*|hochvoltbatter*|ремонт електропривод*|діагностика батарей електромобіл*'),
  category('lpg', [
    'Montaż instalacji LPG', 'LPG conversion', 'Montáž LPG', 'Montáž LPG', 'Autogas-Umrüstung', 'Встановлення ГБО'
  ], [
    'Montaż i regulacja samochodowych instalacji gazowych oraz wymiana ich podzespołów.',
    'Automotive LPG installation, system adjustment and component replacement.',
    'Montáž a seřízení LPG systémů ve vozidlech a výměna jejich součástí.',
    'Montáž a nastavenie LPG systémov vo vozidlách a výmena ich súčastí.',
    'Einbau und Einstellung von Autogasanlagen sowie Austausch ihrer Komponenten.',
    'Встановлення й налаштування газобалонного обладнання та заміна його компонентів.'
  ], 'lpg|autogaz*|autogas*|instalacj* gazow*|przebudow* na gaz|montaz plyn*|plynov* zastavb*|plynov* prestavb*|fluessiggasanlag*|flüssiggasanlag*|гбо|газобалонн*|автогаз*|montuj* gaz w samochod*|газов* установ*|газов* обладнан*|install lpg|lpg fitting|prestaveb na plyn|prestavb* na plyn|umrust* auf autogas|газов* систем* автомоб*'),
  category('klasyki', [
    'Renowacja samochodów klasycznych', 'Classic car restoration', 'Renovace veteránů', 'Renovácia veteránov', 'Oldtimer-Restaurierung', 'Реставрація класичних автомобілів'
  ], [
    'Odbudowa nadwozia, wnętrza i mechaniki samochodów zabytkowych i klasycznych.',
    'Restoration of bodywork, interiors and mechanical parts on classic vehicles.',
    'Renovace karoserie, interiéru a mechanických částí historických vozidel.',
    'Renovácia karosérie, interiéru a mechanických častí historických vozidiel.',
    'Wiederaufbau von Karosserie, Innenraum und Mechanik historischer Fahrzeuge.',
    'Відновлення кузова, салону та механічних вузлів ретроавтомобілів.'
  ], 'renowac* klasyk*|aut zabytkow*|samochod* zabytkow*|samochod* klasyczn*|classic car*|vintage car*|classic restor*|renovac* veteran*|veteran* voz*|oldtimer*|youngtimer*|ретроавт*|ретро авто*|класичн* автомоб*|реставрац* старовин*|odnaw* klasyk*|renowac* aut zabytkow*|restore classic*|historical vehicle restoration|historick* vozid*|restaurier* klassisch* fahrzeug*|реставруєм* ретроавто*|історичн* автомоб*'),
  category('mobilny-mechanik', [
    'Mobilny mechanik', 'Mobile mechanic', 'Mobilní mechanik', 'Mobilný mechanik', 'Mobiler Mechaniker', 'Виїзний автомеханік'
  ], [
    'Naprawa i obsługa pojazdu z dojazdem mechanika do miejsca wskazanego przez klienta.',
    'Maintenance and repairs carried out by a mechanic at the customer’s location.',
    'Opravy a údržba vozidla s výjezdem mechanika na místo určené zákazníkem.',
    'Opravy a údržba vozidla s výjazdom mechanika na miesto určené zákazníkom.',
    'Reparatur und Wartung durch einen Mechaniker am vom Kunden angegebenen Ort.',
    'Ремонт та обслуговування з виїздом механіка за адресою клієнта.'
  ], 'mobiln* mechanik*|mechanik z dojazdem|dojazd* do klienta|mobiln* warsztat*|mobile mechanic*|mobile auto repair|mobile workshop|mobiln* autoservis|mechanik s dojezdem|mechanik s vyjazdom|mobiler mechaniker*|mobile werkstatt|виїзн* механік*|виїзн* автомеханік*|мобільн* механік*|виїзд* до клієнт*|mobiln* serwis mechaniczn*|dojezdza* do klient*|mechanic to your door|on site mechanic*|vyjezdov* mechanik*|vyjazdov* mechanik*|mobiler fahrzeugservice|механік з виїздом|автомеханік з виїздом'),
  category('pozostale', [
    'Pozostałe usługi motoryzacyjne', 'Other automotive services', 'Ostatní automobilové služby', 'Ostatné automobilové služby', 'Weitere Kfz-Dienstleistungen', 'Інші автомобільні послуги'
  ], [
    'Inne specjalistyczne usługi związane z utrzymaniem, naprawą lub wyposażeniem pojazdów.',
    'Other specialist services for vehicle maintenance, repair or accessories.',
    'Další specializované služby související s údržbou, opravami nebo vybavením vozidel.',
    'Ďalšie špecializované služby súvisiace s údržbou, opravami alebo vybavením vozidiel.',
    'Weitere Fachleistungen für Wartung, Reparatur oder Ausstattung von Fahrzeugen.',
    'Інші спеціалізовані послуги з догляду, ремонту або оснащення автомобілів.'
  ], 'inne uslug* motoryzacyjn*|other vehicle service*|jine automobilov* sluzb*|ine automobilov* sluzb*|sonstige kfz dienstleistung*|інші автопослуг*')
]);

const byId = new Map(serviceCategories.map(item => [item.id, item]));

export function categoryName(id, language = 'pl') {
  return byId.get(id)?.names[languageOf(language)] || '';
}

export function categoryDescription(id, language = 'pl') {
  return byId.get(id)?.descriptions[languageOf(language)] || '';
}

function normalizeWords(text) {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replaceAll('ł', 'l').replaceAll('ß', 'ss');
}

// Keywords are trusted static data. A trailing * accepts inflection at the end of one word only.
function compilePhrase(phrase) {
  const words = normalizeWords(phrase).match(/[\p{L}\p{N}]+\*?/gu) || [];
  const expression = words.map(word => word.endsWith('*') ? word.slice(0, -1) + '[^ ]*' : word).join(' ');
  return {matches: new RegExp(' ' + expression + ' '), weight: Math.min(4, words.length + 1)};
}

const suggestionRules = serviceCategories.map(({id, names, keywords}) => ({
  id,
  rules: [...new Set([...Object.values(names), ...keywords].map(normalizeWords))].map(compilePhrase)
}));

export function suggestCategories(text) {
  if (typeof text !== 'string') return [];
  const tokens = normalizeWords(text.slice(0, 6000)).match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];
  const description = ' ' + tokens.join(' ') + ' ';
  const ranked = [];
  for (const {id, rules} of suggestionRules) {
    let strongest = 0;
    let matches = 0;
    for (const rule of rules) {
      if (rule.matches.test(description)) {
        strongest = Math.max(strongest, rule.weight);
        matches++;
      }
    }
    if (matches) ranked.push({id, score: strongest + Math.min(matches - 1, 4) * 0.35});
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, 6).map(entry => entry.id);
}

// Officially assigned ISO 3166-1 alpha-2 codes, including territories and dependencies.
// Display names and collation are supplied by the runtime's CLDR locale data.
export const countryCodes = Object.freeze(`
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI
BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN
CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK
FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM
HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK
ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP
NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF
TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
VN VU WF WS YE YT ZA ZM ZW`.trim().split(/\s+/));
const codeSet = new Set(countryCodes);
const countryNames = new Map();
const countriesByLanguage = new Map();

export const isCountryCode = value => codeSet.has(value);

export function countryName(code, language = 'pl') {
  if (!isCountryCode(code)) return '';
  const locale = languageOf(language);
  if (!countryNames.has(locale)) countryNames.set(locale, new Intl.DisplayNames([locale], {type: 'region'}));
  return countryNames.get(locale).of(code);
}

export function countryOptions(language = 'pl') {
  const locale = languageOf(language);
  if (!countriesByLanguage.has(locale)) {
    const collator = new Intl.Collator(locale);
    const options = countryCodes.map(code => Object.freeze({code, name: countryName(code, locale)}));
    options.sort((a, b) => collator.compare(a.name, b.name) || a.code.localeCompare(b.code));
    countriesByLanguage.set(locale, Object.freeze(options));
  }
  return countriesByLanguage.get(locale);
}
