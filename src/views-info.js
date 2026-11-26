import { isEmail } from './core.js';
import { apiForm, area, check, e, enquiryAccess, field, flash, hidden, href, icon, link, pageHead, panel, submit, wrap } from './ui.js';

const copy = {
  terms:[
    [
      "Zakres usług",
      "Scope of the service",
      "BrumBrum.VIN umożliwia przeglądanie i wyszukiwanie ogłoszeń motoryzacyjnych, zapisywanie ulubionych, publikowanie ofert, wymianę wiadomości i proponowanie terminu oględzin. Ogłoszenia demonstracyjne przedstawiają przykładowe pojazdy.",
      "BrumBrum.VIN lets you browse and search automotive listings, save favourites, publish listings, exchange messages and propose viewing times. Demo listings show example vehicles."
    ],
    [
      "Konto i opłaty",
      "Accounts and fees",
      "Możesz przeglądać katalog bez konta. Publikacja i wiadomości wymagają zalogowania. Umowa o prowadzenie konta rozpoczyna się po zakończeniu rejestracji i trwa do jego zamknięcia. Podstawowa publikacja jest bezpłatna. Do korzystania potrzebujesz internetu i aktualnej przeglądarki z JavaScriptem. Dane i preferencje kontaktu zmienisz w ustawieniach. Konto z hasłem możesz zamknąć w ustawieniach po potwierdzeniu hasłem. Jeśli logujesz się wyłącznie przez ChatGPT lub nie możesz zakończyć usługi w ustawieniach, skorzystaj z formularza Kontakt.",
      "You can browse without an account. Publishing and messaging require sign-in. The account agreement starts when registration is complete and ends when the account is closed. Basic publication is free. You need internet access and an up-to-date browser with JavaScript. Use account settings to edit your details and contact preferences or close a password-based account by confirming your password. If you only use ChatGPT sign-in or cannot close the account in settings, use the Contact form."
    ],
    [
      "Dobrowolne wsparcie",
      "Voluntary contributions",
      "Publikacja ogłoszenia jest zawsze bezpłatna. Dobrowolne wsparcie BRUMBRUM.VIN obejmuje jednorazowe wpłaty 10, 100, 1 000 lub 10 000 PLN. Nie wpływa na widoczność ani pozycjonowanie ogłoszenia. Nie uruchamia subskrypcji ani automatycznego odnawiania. Płatność potwierdzasz na stronie Stripe, gdy obsługa wpłat jest włączona. Rezygnacja z wpłaty nie wycofuje ogłoszenia.",
      "Listing publication is always free. Voluntary support for BRUMBRUM.VIN consists of one-time contributions of PLN 10, 100, 1,000 or 10,000. It does not affect listing visibility or ranking. It does not start a subscription or automatic renewal. When contributions are enabled, you confirm payment on Stripe. Abandoning a contribution does not withdraw your listing."
    ],
    [
      "Publikacja ogłoszeń",
      "Publishing listings",
      "Opisz rzeczywisty pojazd, podaj aktualną cenę i znane istotne wady. Określ, czy sprzedajesz prywatnie, czy jako firma. Zamieszczaj zdjęcia i filmy, do których masz prawa. Przekazujesz operatorowi niewyłączną, bezpłatną licencję na techniczne przetwarzanie i wyświetlanie materiałów w ramach ogłoszenia przez czas jego udostępniania. Oferta trafia do moderacji po przesłaniu oraz po zmianach wymagających ponownej oceny. Po sprzedaży oznacz ogłoszenie jako sprzedane.",
      "Describe the actual vehicle, enter the current price and disclose known material defects. Identify yourself as a private or business seller. Upload photos and videos you are entitled to use. You grant the operator a non-exclusive, royalty-free licence to process and display them as part of the listing for as long as it remains available. Listings go through review after submission and after changes that require a new review. Mark the listing as sold once the sale is complete."
    ],
    [
      "Kolejność wyników wyszukiwania",
      "Search result order",
      "Wyniki najpierw ograniczamy do wybranych filtrów. Domyślnie nowsze ogłoszenia są wyżej, według daty publikacji. Wybierając sortowanie według ceny, rocznika lub przebiegu, zmieniasz główne kryterium kolejności. Oferty bez przebiegu trafiają na koniec przy sortowaniu według przebiegu.",
      "Filters first determine which listings match. By default, newer listings appear first by publication date. Sorting by price, year or mileage changes the main ordering criterion. Listings with no mileage appear last when sorting by mileage."
    ],
    [
      "Edycja, wycofanie i status sprzedaży",
      "Editing, withdrawal and sale status",
      "Ogłoszeniami zarządzasz w sekcji „Moje ogłoszenia”. Istotna zmiana może wymagać ponownej moderacji. Po oznaczeniu pojazdu jako sprzedany dotychczasowy link pokazuje status, a rozpoczęte rozmowy pozostają dostępne w wiadomościach.",
      "Manage your listings under My listings. Material changes may require another review. When you mark a vehicle as sold, its existing link shows the updated status and earlier conversations remain in Messages."
    ],
    [
      "Wiadomości, oględziny i sprzedaż",
      "Messages, viewings and sales",
      "Proponowany termin oględzin wymaga potwierdzenia przez sprzedawcę. Kupujący i sprzedawca uzgadniają warunki i zawierają umowę bezpośrednio. Operator udostępnia narzędzia ogłoszeniowe i odpowiada za własne usługi. Informacje o historii i stanie pojazdu pochodzą od sprzedawcy. Uprawnienia konsumenckie zależą m.in. od tego, czy sprzedawca jest przedsiębiorcą.",
      "A proposed viewing time requires seller confirmation. Buyer and seller agree the terms and conclude the sale directly. The operator provides listing tools and is responsible for its own services. Vehicle history and condition information comes from the seller. Consumer rights depend, among other things, on whether the seller is acting as a business."
    ],
    [
      "Moderacja, zgłoszenia i odwołania",
      "Moderation, reports and appeals",
      "Zabronione są treści nielegalne, fałszywe oferty, próby wyłudzeń, spam i materiały naruszające cudze prawa. Moderator może odrzucić albo ograniczyć ogłoszenie odpowiednio do naruszenia. Skorzystaj z formularza przy ogłoszeniu. Wskaż treść i wyjaśnij powód zgłoszenia. Przy zgłoszeniu nielegalnej treści podaj także dokładny adres, imię i nazwisko lub nazwę, e-mail i potwierdź, że działasz w dobrej wierze, z uwzględnieniem wyjątków ustawowych. Jeżeli formularz nie obsługuje Twojego przypadku, skorzystaj z kanału kontaktu wskazanego poniżej. Decyzję dotyczącą ogłoszenia sprawdzisz w „Moich ogłoszeniach”. Odwołanie od odrzucenia złożysz z podglądu oferty. Zachowujesz prawo skorzystania z właściwych środków przewidzianych w DSA, w tym skargi do koordynatora ds. usług cyfrowych.",
      "Illegal content, fake listings, fraud, spam and infringement are prohibited. Moderators may reject or restrict listings in proportion to the violation. Use the report form on the listing and explain your reasons. For illegal content, provide the exact location, your name or company name, email and a good-faith statement, subject to statutory exceptions. If the form does not cover your case, use the contact channel below. Check My listings for the decision and appeal a rejection from the listing preview. Your remedies under the Digital Services Act, including a complaint to the Digital Services Coordinator, remain available."
    ],
    [
      "Reklamacje i odstąpienie",
      "Complaints and withdrawal",
      "Reklamację dotyczącą działania BrumBrum.VIN złóż przez formularz Kontakt lub na dane operatora podane poniżej. Podaj opis sprawy i sposób kontaktu. Operator odpowiada konsumentowi na trwałym nośniku w terminie 14 dni, chyba że przepisy przewidują inny termin. Jeśli przysługuje Ci prawo odstąpienia od umowy zawartej z operatorem na odległość, masz co do zasady 14 dni od jej zawarcia na wysłanie jednoznacznego oświadczenia. Możesz też skorzystać z pomocy właściwego rzecznika konsumentów.",
      "Use the Contact form or the operator details below to complain about BrumBrum.VIN. Describe the issue and tell us how to reach you. The operator responds to consumer complaints on a durable medium within 14 days unless another statutory deadline applies. If you have a right to withdraw from a distance agreement with the operator, you generally have 14 days from conclusion to send a clear statement. You may also seek help from the relevant consumer ombudsman."
    ],
    [
      "Niezgodność usługi cyfrowej z umową",
      "Digital service conformity",
      "Jeśli usługa cyfrowa jest niezgodna z umową, konsument może zażądać doprowadzenia jej do zgodności. W sytuacjach przewidzianych w ustawie o prawach konsumenta może też obniżyć cenę lub odstąpić od umowy. Oświadczenie o odstąpieniu możesz przesłać na dane operatora podane na końcu. Podaj usługę, datę zawarcia umowy, imię i nazwisko oraz sposób kontaktu.",
      "If a digital service does not conform to the contract, a consumer may request that it be brought into conformity. Where the Polish Consumer Rights Act provides for it, the consumer may also seek a price reduction or withdraw. Send your withdrawal statement using the operator details below. Include the service, contract date, name and contact details."
    ],
    [
      "Ogłoszeniodawcy biznesowi",
      "Business sellers",
      "Gdy ma zastosowanie rozporządzenie (UE) 2019/1150, operator przekazuje uzasadnienie ograniczenia lub zawieszenia usługi na trwałym nośniku przed jego wejściem w życie lub w chwili jego wejścia w życie. Przy zakończeniu całości usług uzasadnienie przekazuje co do zasady co najmniej 30 dni wcześniej, z uwzględnieniem wyjątków przewidzianych w tym rozporządzeniu.",
      "Where Regulation (EU) 2019/1150 applies, the operator provides reasons on a durable medium before or when a restriction or suspension takes effect. For full termination of the service, it generally gives reasons at least 30 days beforehand, subject to the exceptions in that regulation."
    ]
  ],
  privacy:[
    [
      "Administrator danych",
      "Data controller",
      "Polityka dotyczy strony i aplikacji BrumBrum.VIN. Administratorem danych jest operator wskazany na końcu dokumentu. Pytania i wnioski dotyczące danych możesz przesłać bezpośrednio na jego adres e-mail.",
      "This notice covers the BrumBrum.VIN website and app. The controller is the operator identified at the end of this notice. You can send questions and data requests directly to its email address."
    ],
    [
      "Logowanie przez ChatGPT",
      "Sign in with ChatGPT",
      "Jeśli wybierzesz tę metodę, serwis otrzyma adres e-mail z usługi logowania i użyje go do rozpoznania lub utworzenia konta. Dostępną nazwę profilu wykorzysta przy zakładaniu konta. Historia rozmów z ChatGPT nie jest częścią tej integracji.",
      "If you choose this method, the service receives your email address from the sign-in provider and uses it to recognise or create your account. An available profile name is used when a new account is created. ChatGPT conversation history is outside this integration."
    ],
    [
      "Dane, cele i podstawy prawne",
      "Data, purposes and legal bases",
      "Dane konta, ogłoszeń, materiałów, ulubionych, wiadomości, oględzin i importu CSV przetwarzamy w zakresie niezbędnym do świadczenia wybranej usługi (art. 6 ust. 1 lit. b RODO). Dane przedstawicieli firm, zapytań oraz dane techniczne potrzebne do bezpieczeństwa i ochrony przed nadużyciami przetwarzamy w uzasadnionym interesie obsługi spraw, zabezpieczenia usługi i ochrony roszczeń (lit. f). Obowiązki prawne, w tym dotyczące zgłoszeń nielegalnych treści, realizujemy na podstawie lit. c. Podanie wymaganych pól jest potrzebne do obsługi danej funkcji. Dane z importu i zgłoszeń mogą pochodzić od osoby, która je przesłała.",
      "We process account, listing, media, favourites, message, viewing and CSV import data as necessary to provide the selected service (GDPR Article 6(1)(b)). We process business representative, enquiry and technical security data based on our legitimate interests in handling requests, securing the service and protecting legal claims (point (f)). Legal obligations, including those concerning illegal-content reports, rely on point (c). Required fields are needed to use the relevant feature. Import and report data may come from the person who submitted it."
    ],
    [
      "Widoczność i odbiorcy",
      "Visibility and recipients",
      "W publicznym ogłoszeniu pokazujemy zatwierdzony opis, zdjęcia i filmy, dane pojazdu (w tym VIN lub inny identyfikator, jeśli podano) oraz publiczne pola profilu sprzedawcy. Numer telefonu można odsłonić, gdy sprzedawca udostępnił go w ustawieniach i wybrał kontakt telefoniczny w ogłoszeniu. Uczestnicy rozmowy widzą wiadomości i propozycje oględzin. Uprawniony personel może sprawdzić treść istotną dla rozpatrzenia zgłoszenia. Dane mogą otrzymać dostawcy hostingu, przechowywania plików, poczty transakcyjnej i logowania oraz organy w granicach prawa.",
      "Public listings show approved descriptions, photos and videos, vehicle details (including a VIN or other identifier when supplied), and public seller profile fields. A phone number can be revealed when the seller enables disclosure in settings and selects phone contact on the listing. Conversation participants see messages and viewing proposals. Authorised staff may review content relevant to a report. Data recipients may include hosting, storage, transactional email and authentication providers and legally authorised authorities."
    ],
    [
      "Wpłaty przez Stripe",
      "Contributions through Stripe",
      "Przy dobrowolnym wsparciu zapisujemy identyfikator konta i wybranego pakietu, kwotę, walutę, identyfikatory techniczne Stripe, status i czas wpłaty oraz opcjonalne powiązanie z ogłoszeniem. Dane służą obsłudze i uzgodnieniu wybranej wpłaty. Dane karty podajesz bezpośrednio Stripe. Serwis nie zapisuje numeru karty ani kodu CVC. Zasady przetwarzania danych podanych na stronie płatności opisuje również polityka prywatności Stripe.",
      "For voluntary contributions, we store the account and selected package identifiers, amount, currency, Stripe technical identifiers, payment status and time, and an optional listing reference. These records support processing and reconciliation of your chosen contribution. You enter card details directly on Stripe. This service does not store card numbers or CVC codes. Stripe’s privacy policy also covers information entered on its payment page."
    ],
    [
      "Import ofert i dane otrzymane od innych osób",
      "Imported listings and indirect sources",
      "Przy imporcie CSV źródłem danych jest plik przekazany przez dealera oraz wskazane w nim źródła materiałów, jeżeli import z tych źródeł jest dostępny. Przy zgłoszeniu źródłem jest zgłaszający oraz treść, której sprawa dotyczy. Dane wykorzystujemy odpowiednio do obsługi importu, publikacji lub wyjaśnienia zgłoszenia. Jeżeli przepisy tego wymagają, osobie, której dane pozyskaliśmy pośrednio, przekazujemy informacje wymagane przez art. 14 RODO.",
      "For CSV imports, data comes from the dealer’s file and from any supported media sources identified in it. For reports, data comes from the reporter and the content at issue. We use it to handle imports, publication or investigation as appropriate. Where required, we provide the information under GDPR Article 14 to people whose data we obtained indirectly."
    ],
    [
      "Zewnętrzne sprawdzanie historii pojazdu",
      "External vehicle history checks",
      "Przycisk carVertical otwiera stronę tego dostawcy. Numer VIN kopiujesz z ogłoszenia i wklejasz samodzielnie w zewnętrznym formularzu. Dane podane na tej stronie podlegają polityce prywatności dostawcy.",
      "The carVertical button opens the provider’s website. You copy the VIN from the listing and paste it into the external form yourself. Information entered there is subject to the provider’s privacy notice."
    ],
    [
      "Zamknięcie konta i przechowywanie danych",
      "Closing your account and data retention",
      "Dane konta wykorzystujemy przez czas świadczenia usługi. Zamknięcie konta usuwa dane identyfikacyjne z profilu, kończy sesje i archiwizuje ogłoszenia. Drugi uczestnik zachowuje dostęp do dotychczasowych wiadomości. Zgłoszenia i reklamacje przetwarzamy w trakcie rozpatrywania sprawy. Dane potrzebne do wypełnienia obowiązku prawnego lub obrony roszczeń przechowujemy przez czas wynikający z tego obowiązku lub właściwych terminów przedawnienia. Sesja logowania jest ważna do 14 dni. Link do potwierdzenia adresu działa przez 24 godziny, a link do zmiany hasła przez godzinę.",
      "We use account data while providing the service. Closing an account removes identifying profile details, ends sessions and archives listings. The other participant retains access to earlier messages. We process reports and complaints while handling the matter. Data needed for legal obligations or claims is kept for the applicable statutory or limitation period. A sign-in session is valid for up to 14 days. The email confirmation link is valid for 24 hours and the password reset link for one hour."
    ],
    [
      "Cookies i ustawienia urządzenia",
      "Cookies and device settings",
      "Cookies obsługują logowanie i zapamiętują język. Przeglądarka przechowuje motyw, porównanie i ulubione gościa. W ustawieniach cookies znajdziesz opis i opcję usunięcia lokalnych preferencji. Publiczny licznik wyświetleń zapisuje tylko datę i dzienną sumę. Działa po stronie serwera, bez cookies i identyfikatorów odwiedzających.",
      "Cookies support sign-in and remember your language. Your browser stores theme, comparison and guest favourites preferences. Cookie settings explain their use and let you clear local preferences. The public view counter stores only the date and daily total. It runs on the server and uses no cookies or visitor identifiers."
    ],
    [
      "Twoje prawa",
      "Your rights",
      "W granicach RODO możesz żądać dostępu do danych, ich kopii, sprostowania, usunięcia, ograniczenia lub przeniesienia. Możesz wnieść sprzeciw wobec przetwarzania opartego na uzasadnionym interesie. Zgodę, jeśli stanowi podstawę przetwarzania, możesz wycofać w dowolnym momencie. Z wnioskiem zwróć się do administratora. Skargę możesz złożyć do Prezesa Urzędu Ochrony Danych Osobowych.",
      "Subject to the GDPR, you can ask to access, copy, correct, erase, restrict or transfer your data. You may object to processing based on legitimate interests. Where processing relies on consent, you can withdraw it at any time. Contact the controller to exercise your rights. You can complain to the Polish Personal Data Protection Office."
    ],
    [
      "Kontakt z administratorem i termin odpowiedzi",
      "Contacting the controller and response time",
      "Wniosek dotyczący danych możesz wysłać na adres administratora lub po zalogowaniu przez formularz kontaktowy. Wskaż, którego konta lub sprawy dotyczy, oraz jakiego działania oczekujesz. Administrator co do zasady odpowiada w ciągu miesiąca. Jeśli zgodnie z RODO przedłuży termin, poinformuje Cię o tym i poda powód w ciągu pierwszego miesiąca. Wycofanie zgody nie wpływa na zgodność z prawem wcześniejszego przetwarzania.",
      "Send a data request directly to the controller or through the contact form after signing in. Identify the account or matter and the action you are requesting. The controller generally responds within one month. If the GDPR allows an extension, the controller will explain it within the first month. Withdrawing consent does not affect earlier lawful processing."
    ]
  ],
  help:[
    ['Jak dodać pojazd?','How do I list a vehicle?','Wybierz „Sprzedaj pojazd”, dodaj dane i zdjęcia, a potem prześlij ogłoszenie z pełnego podglądu. Oferty samochodów, które przejdą kontrolę, pojawią się w katalogu automatycznie.',
      'Select Sell a vehicle, add details and photos, then submit the listing from the full preview. Car listings that pass the checks appear in the catalog automatically.'],
    ['Gdzie zobaczę decyzję moderacji?','Where can I see the moderation decision?','Sprawdź „Moje ogłoszenia” lub powiadomienia. Przy odrzuconej ofercie znajdziesz uzasadnienie, dostęp do edycji i możliwość odwołania.',
      'Check My listings or Notifications. A rejected listing includes the reason, a link to edit it and an option to appeal.'],
    ['Jak umówić oględziny?','How do I arrange a viewing?','Wybierz „Umów oględziny” w ogłoszeniu i zaproponuj termin. Odpowiedź sprzedawcy zobaczysz w tej samej rozmowie.',
      'Select Arrange a viewing and propose a date and time. The seller’s response appears in the same conversation.'],
    ['Jak zakończyć sprzedaż?','How do I finish selling?','W panelu „Moje ogłoszenia” wybierz „Oznacz jako sprzedane”. Dotychczasowy link pokazuje status, a rozmowy pozostają w wiadomościach.',
      'Select Mark as sold in My listings. The original link shows the sold status, and conversations remain in Messages.'],
    ['Kiedy kupujący zobaczy mój numer?','When can a buyer see my phone number?','Jeśli włączysz pokazywanie telefonu w ustawieniach konta, zainteresowany może odsłonić numer przez opcję kontaktu telefonicznego w ogłoszeniu. Wiadomości w serwisie pozwalają kontaktować się również bez udostępniania numeru.','When phone visibility is enabled in account settings, a buyer can reveal it using the listing’s phone contact option. You can also communicate through messages without sharing your number.'],
    ['Jak zgłosić podejrzane ogłoszenie?','How do I report a suspicious listing?','Otwórz formularz zgłoszenia przy ofercie, wybierz odpowiedni powód i opisz sytuację. Jeśli ktoś przesyła podejrzany link do płatności lub prosi o dane logowania, nie otwieraj linku i zgłoś sprawę.','Open the listing report form, select the relevant reason and describe what happened. If someone sends a suspicious payment link or asks for sign-in details, avoid opening the link and report it.'],
    ['Jak dodać wiele ogłoszeń firmowych?','How do I publish multiple business listings?','W panelu dealera pobierz wzór CSV, przypisz kolumny i sprawdź podgląd. Po imporcie przy każdej ofercie zobaczysz wynik publikacji.','Download the CSV template from the dealer dashboard, map the columns and check the preview. After import, each listing shows its publication status.']
  ],
  dealers:[
    ['Własna wizytówka','Your business profile','Konto firmowe pozwala podać logo, opis, godziny otwarcia i adres. Katalog pokazuje aktywne oferty firmy.',
      'A business account lets you add a logo, description, opening hours and address. Its profile shows active listings.'],
    ['Import ofert','Import listings','Pobierz wzór CSV w panelu dealera. Dopasuj kolumny i sprawdź wyniki przed zatwierdzeniem. Oferty samochodów po pozytywnej kontroli publikują się automatycznie.',
      'Download the CSV template in the dealer dashboard. Map columns and review the results before confirming. Car listings that pass the checks publish automatically.']
  ]
};

function custom(ctx,key) {
  const language=[ctx.lang,'pl','en'].find(code=>ctx.brand[key+'_'+code]);
  return language?panel('',`<div class="prose" lang="${language}">${e(ctx.brand[key+'_'+language])}</div>`):'';
}
function paragraphs(ctx,key) {
  const override=custom(ctx,key);
  if (override) return override;
  const sections=copy[key].map(([pl,en,bodyPl,bodyEn],index)=>{
    const id=key+'-'+(index+1);
    const card=panel(ctx.t(pl,en),`<p>${e(ctx.t(bodyPl,bodyEn))}</p>`);
    return {id,title:ctx.t(pl,en),card};
  });
  const contents=['terms','privacy'].includes(key)?panel(ctx.t('Spis treści','Contents'),
    `<ol class="legal-contents">${sections.map(({id,title})=>`<li><a href="#${id}">${e(title)}</a></li>`).join('')}</ol>`):'';
  return contents+sections.map(({id,card})=>`<div id="${id}" class="info-section">${card}</div>`).join('');
}
export function info(ctx,kind) {
  const t=ctx.t;
  const titles={help:t('Pomoc i FAQ','Help & FAQ'),dealers:t('Dla dealerów i komisów','For dealers and showrooms'),ads:t('Reklama w {brand}','Advertise on {brand}',{brand:ctx.brand.name}),
    contact:t('Kontakt','Contact'),terms:t('Regulamin','Terms of use'),privacy:t('Polityka prywatności','Privacy notice'),cookies:t('Ustawienia cookies','Cookie settings')};
  const title=titles[kind];
  let body;
  if (kind==='contact'||kind==='ads') {
    const ad=kind==='ads';
    const subject=ad?t('Zapytanie o reklamę','Advertising enquiry'):t('Napisz do nas','Contact us');
    const intro=ad?t('Opisz kampanię, termin i miejsce emisji, które Cię interesuje.','Tell us about your campaign, dates and preferred placement.'):
      t('Skorzystaj z formularza w sprawie działania portalu lub swojego konta.','Use this form for questions about the marketplace or your account.');
    const operatorEmail=ctx.brand.operator_email;
    const supportEmail=!ad&&!ctx.demo&&isEmail(operatorEmail)?`<p class="enquiry-help">${t('Nie masz dostępu do konta?','Can’t access your account?')}
      <a class="text-link" href="mailto:${e(operatorEmail)}">${t('Napisz do obsługi e-mailem','Email support')}</a></p>`:'';
    const enquiry=ctx.user?apiForm('/contact',hidden('kind',ad?'ad':'support')+
      `<div class="field-grid">${field('name',t('Imię i nazwisko lub firma','Name or company'),ctx.user.name,{required:true,attributes:'minlength="2" maxlength="90" autocomplete="name"'})}
      ${field('email',t('Adres e-mail','Email address'),ctx.user.email,{type:'email',required:true,attributes:'maxlength="254" autocomplete="email"'})}</div>
      <label class="trap" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label>`+
      area('body',t('Treść zapytania','Your enquiry'),'',{required:true,attributes:'minlength="10" maxlength="5000"'})+
      submit(t('Wyślij zapytanie','Send enquiry'),'arrow'),{success:t('Zapytanie zapisano.','Your enquiry has been saved.'),go:'reset-form'}):
      enquiryAccess(ctx,ctx.url.pathname+ctx.url.search)+supportEmail;
    body=(ad?custom(ctx,'ads'):'')+panel(subject,`<p>${intro}</p>${enquiry}`);
  } else if (kind==='cookies') {
    body=panel(t('Niezbędne ustawienia','Essential settings'),`<p>${t('Sesja logowania oraz język korzystają z plików cookies. W tej przeglądarce zapisywane są motyw, porównanie i ulubione gościa.','Sign-in sessions and language use cookies. This browser stores your theme, comparison and guest favorites.')}</p>
      <p>${t('Pomiar banerów zapisuje dzienne sumy wyświetleń i kliknięć bez cookies ani identyfikatorów odwiedzających.','Banner measurement stores daily totals of views and clicks without cookies or visitor identifiers.')}</p>
      <p>${t('Google Tag Manager zarządza zewnętrznymi tagami serwisu. Zakres pomiaru zależy od tagów aktywnych w kontenerze GTM.','Google Tag Manager manages the site’s external tags. Measurement depends on the tags active in the GTM container.')}</p>
      <p>${t('Publiczny licznik wyświetleń działa po stronie serwera i zapisuje dzienne sumy bez cookies.','The public view counter runs on the server and stores daily totals without cookies.')}</p>
      <button class="btn" type="button" data-reset-preferences>${icon('close',18)}${t('Wyczyść ustawienia lokalne','Clear local preferences')}</button>`);
  } else if (kind==='terms'||kind==='privacy') {
    const op=ctx.brand;
    const ready=Boolean(op.operator_name&&op.operator_address&&op.operator_email&&op.operator_tax_id&&op.operator_registry);
    const status=ready&&op.operator_dsa_email?'':flash(t(
      'Wersja robocza. Dane operatora wymagają uzupełnienia przed publicznym uruchomieniem.',
      'Draft. Operator details must be completed before public launch.'),'warn');
    const contact=link(ctx,'/kontakt',t('Otwórz formularz kontaktowy','Open the contact form'),'btn','message');
    const operator=panel(
      kind==='privacy'?t('Dane administratora i kontakt','Controller details and contact'):t('Dane operatora i kontakt','Operator details and contact'),
      (ready?'<p>'+[op.operator_name,op.operator_address,op.operator_tax_id,op.operator_registry,op.operator_email].filter(Boolean).map(e).join('<br>')+'</p>':
        '<p>'+t('Pełna nazwa firmy, adres, dane rejestrowe i e-mail zostaną podane przed publicznym uruchomieniem.','The company’s full name, address, registration details and email will be provided before public launch.')+'</p>')+
      (op.operator_dsa_email&&kind==='terms'?'<p>'+t('Punkt kontaktowy DSA','DSA contact point')+' · '+e(op.operator_dsa_email)+'</p>':'')+`<div class="info-contact">${contact}</div>`);
    const remaining=kind==='privacy'?flash(t(
      'Do potwierdzenia pozostają okresy przechowywania archiwum, wiadomości i zgłoszeń oraz informacje o przekazywaniu danych poza EOG.',
      'Retention periods for archived data, messages and reports, and details of transfers outside the EEA, are pending confirmation.'),'warn'):'';
    body=status+remaining+paragraphs(ctx,kind)+operator;
  } else {
    body=paragraphs(ctx,kind)+`<div class="${kind==='help'?'info-contact':'inline'}">${kind==='dealers'?link(ctx,ctx.user?.profile_type==='company'?'/panel-dealera':ctx.user?'/ustawienia':'/zarejestruj',
      t('Przejdź do konta firmowego','Open business account'),'btn primary','building'):link(ctx,'/kontakt',t('Skontaktuj się z nami','Contact us'),'btn primary','message')}</div>`;
  }
  return {title,index:['dealers','help','ads','contact'].includes(kind),body:wrap(pageHead(title)+`<div class="info-stack">${body}</div>`)};
}
export function errorPage(ctx,status,message) {
  const t=ctx.t;
  const title=status===404?t('Strona nie istnieje','Page not found'):status===403?t('Brak dostępu','Access denied'):status===503?t('Serwis chwilowo niedostępny','Service temporarily unavailable'):t('Nie udało się otworzyć strony','This page could not be opened');
  return {title,body:wrap(`<div class="error-view"><span class="error-code">${status}</span><h1>${title}</h1><p>${e(message)}</p><div class="inline">${link(ctx,'/',t('Strona główna','Home'),'btn primary','home')}${link(ctx,'/szukaj',t('Szukaj pojazdów','Find vehicles'),'btn','search')}</div></div>`)};
}
