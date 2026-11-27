# BRUMBRUM.VIN

Polski portal kupna i sprzedaży pojazdów. Katalog, panele i demo korzystają z tego samego interfejsu renderowanego przez serwer. Wdrożenie na własnym serwerze używa SQLite i katalogu z obrazami. Wariant Worker korzysta z D1 oraz R2. Demo ma osobny zakres danych, 112 przykładowych pojazdów i odrębny obszar roboczy dla każdej przeglądarki. Każda kategoria i odmiana ma przynajmniej jedną ofertę demonstracyjną.

Architekturę personalizacji dźwięków opisuje [Sound Garage](docs/SOUND-GARAGE.md).

## Uruchomienie lokalne

Wymagany jest Node.js 24 lub nowszy. Aplikacja działająca na Node nie wymaga pakietów z npm do uruchomienia.

```sh
npm run dev
```

Otwórz [http://127.0.0.1:3000](http://127.0.0.1:3000). Przykładowe ogłoszenia są pod [http://127.0.0.1:3000/demo/szukaj](http://127.0.0.1:3000/demo/szukaj). Wyniki układają się w siatkę. **Pokaż więcej ogłoszeń** dołącza kolejne wyniki na tej samej stronie. **Tryb rolek** wyświetla jedno ogłoszenie na całą dostępną szerokość i obsługuje przewijanie w bok. Przycisk **Konto** w demo pozwala przełączać się między sprzedawcą, kupującym, dealerem, moderatorem i administratorem. Przełączenie roli zachowuje dane w tym samym obszarze demonstracyjnym. Dostęp do obszaru wygasa po 48 godzinach.

Szczegóły oferty otwierają galerię na całą szerokość ekranu. Na komputerze i tablecie parametry i kontakt są po lewej stronie zdjęcia. Na wąskim telefonie pojawiają się pod galerią. Zdjęcia wybiera się w pełnowymiarowym pasku miniatur lub przesuwając palcem po głównym kadrze. **Opis sprzedawcy** rozwija się w pierwszym pasku pod galerią. Każde przykładowe ogłoszenie ma trzy poglądowe kadry WebP wyeksportowane do 1920 × 1080. Preferencja ograniczonego ruchu wyłącza automatyczny pokaz. Na komputerze przezroczyste menu rozwija się po najechaniu lub przejściu do niego klawiaturą. Dźwięk najechania działa po pierwszej interakcji ze stroną i można go wyciszyć przyciskiem **Dźwięk menu**. Telefon i tablet mają dolne menu.

Serwer przy starcie stosuje migracje SQL z `drizzle/` i zapisuje ich wykonanie w tabeli `schema_migrations`. Baza oraz pliki powstają w `DATA_DIR`, domyślnie w `var/`. Katalog danych musi znajdować się na trwałym woluminie. Przy kopiach SQLite używaj mechanizmu kopii SQLite lub zatrzymaj proces przed skopiowaniem bazy i obrazów.

Strona `/aplikacja` zawiera instalację aplikacji webowej na ekranie głównym i instrukcje dla Safari oraz Chrome. `/demo/aplikacja` instaluje osobny skrót uruchamiający demo. Widoki `/zegarek` oraz `/demo/zegarek` pokazują najnowsze oferty i ulubione zapisane na zalogowanym koncie. Wymagają przeglądarki zegarka obsługującej dostęp do witryny i połączenia z internetem.

W trybie deweloperskim bez skonfigurowanego dostawcy poczty linki potwierdzające i resetujące trafiają do `var/mailbox.jsonl`. Odczytaj plik lokalnie z terminala, po czym otwórz odpowiedni link. Potwierdzenie wymaga hasła ustawionego podczas rejestracji. Używaj kont testowych. Produkcja wymaga skonfigurowanej poczty.

## Konfiguracja

Skopiuj `.env.example` do `.env`, uzupełnij wartości i uruchom:

```sh
node --env-file=.env server.mjs
```

| Zmienna | Zastosowanie |
| --- | --- |
| `APP_MODE` | `development` do pracy lokalnej lub `production` na własnym serwerze |
| `APP_ORIGIN` | Dokładny adres HTTPS bez ukośnika na końcu. Wymagany w produkcji i dla linków e-mail |
| `HOST`, `PORT` | Adres i port nasłuchu Node. Przy wdrożeniu ustaw reverse proxy z HTTPS |
| `DATA_DIR` | Katalog bazy i obrazów dla Node |
| `MAIL_API_KEY`, `MAIL_FROM` | Klucz i adres nadawcy transakcyjnego w zweryfikowanej domenie. Dostawca to Resend |
| `OWNER_EMAIL` | E-mail pierwszego administratora. Domyślnie `{{BRUMBRUM_SOURCE_RESTORE_OWNER_EMAIL_776E2D9C}}` |
| `OWNER_SETUP_TOKEN` | Losowy sekret serwera używany raz przy aktywacji właściciela. Co najmniej 32 znaki |
| `IMPORT_IMAGE_ORIGINS` | Opcjonalna lista dokładnych źródeł HTTPS, oddzielonych przecinkami. Bez niej import obsługuje zdjęcia własnych ofert i przykładowe zdjęcia w demo |
| `PUBLIC_INDEXING` | Ustaw `1` po uruchomieniu publicznej domeny, by odblokować indeksowanie publicznych stron |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_EMAIL` | Dane operatora. Można je też ustawić w panelu administratora |

Nazwa, kolor, logo i dane operatora są edytowalne w panelu **Administracja → Marka i integracje**. Domyślne wartości są w `src/data.js`. Treści informacyjne i emisję banerów edytuje się w tym samym panelu. Limity zdjęć, kodów pojazdów, filtrowania i importu są po stronie serwera. Cena jest przechowywana w najmniejszej jednostce waluty z kodem waluty. Aktywną walutą startową jest PLN.

W sekcji **Administracja → Banery** pole **Nazwa firmy** ustawia nazwę widoczną w pasku po zwinięciu reklamy.

## Dostęp właściciela

1. Skonfiguruj `APP_ORIGIN`, pocztę i `OWNER_SETUP_TOKEN` po stronie serwera. Losową wartość możesz utworzyć poleceniem `openssl rand -hex 32`.
2. Zarejestruj `{{BRUMBRUM_SOURCE_RESTORE_OWNER_EMAIL_776E2D9C}}`, otwórz link z tej skrzynki i potwierdź hasłem rejestracji. Następnie zaloguj się do serwisu.
3. Otwórz **Konto → Skonfiguruj dostęp właściciela** albo `/dostep-wlasciciela`. Wprowadź sekret konfiguracji. Serwer sprawdza potwierdzony adres, sekret i brak innego aktywnego administratora.
4. Otwórz `/administracja`. Role zweryfikowanych użytkowników ustawisz w sekcji **Użytkownicy**. Po jednorazowym uruchomieniu usuń `OWNER_SETUP_TOKEN` z konfiguracji. Serwer odnotowuje aktywację oraz zmiany ról.

## Wdrożenie Worker

```sh
npm ci
npm run build
```

Punkt wejścia to `dist/server/index.js`. Przypnij bazę D1 jako `DB` i prywatny magazyn R2 jako `BUCKET`. Przed wystawieniem ruchu zastosuj migracje z `drizzle/`. Jeśli platforma stosuje migracje przy wdrożeniu, używaj jej historii migracji. Zmienne pocztowe i sekret właściciela podaj w konfiguracji serwera. Przy wdrożeniu poza domyślną platformą wykorzystaj ten sam moduł Worker oraz własne przypięcie zasobów.

Przy pierwszym wdrożeniu z pustym R2 ustaw losowy `DEMO_MEDIA_SETUP_TOKEN` o długości co najmniej 32 znaków jako sekret Workera. Ustaw tę samą wartość w środowisku terminala i uruchom `node scripts/load-demo-photos.mjs https://adres-serwisu`. Na prywatnym podglądzie Sites podaj też tymczasowy token dostępu do witryny w `DEMO_MEDIA_SITE_BEARER`. Skrypt przesyła kadry Full HD i miniatury, sprawdzając sumę kontrolną każdego pliku. Jeśli R2 zawiera już kadry ofert 1–24, dodaj argument `25`, aby wgrać tylko nowe kadry Full HD i wszystkie miniatury. Po wgraniu ustaw `DEMO_MEDIA_SETUP_TOKEN` na `disabled` i ponownie wdróż konfigurację. Serwer Node czyta obrazy z `public/assets/showcase-hd` i `public/assets/showcase` bez dodatkowej konfiguracji.

Aby udostępnić rozszerzony katalog w wariancie Worker, ustaw osobny losowy sekret `DEMO_CATALOG_MEDIA_TOKEN` w konfiguracji i w środowisku terminala. Uruchom `node scripts/load-demo-photos.mjs https://adres-serwisu --catalog`. Skrypt udostępnia dodatkowe oferty po zapisaniu wszystkich ujęć i miniatur.

Oryginały karuzeli są zapisane w `public/assets/ad-banners/`. Kompilacja kopiuje je do `dist/client/assets/ad-banners/` i obsługuje z tej samej domeny przez powiązanie `ASSETS`. Na hostingu bez tego powiązania ustaw tymczasowy sekret `AD_CAROUSEL_MEDIA_TOKEN` i uruchom `node scripts/load-ad-media.mjs https://adres-serwisu` z tym samym sekretem w środowisku terminala. Skrypt sprawdza sumy kontrolne i udostępnia karuzelę po wgraniu kompletu do R2. Usuń sekret po zakończeniu. Opcjonalna zmienna `JCB_AD_URL` przyjmuje adres HTTPS do banera JCB.

## Zdjęcia i import

W formularzu przeglądarka dekoduje zdjęcia, zachowuje orientację, kompresuje je do JPEG i przygotowuje miniatury. Serwer sprawdza format, rozmiar i wymiary oraz usuwa metadane z przesłanych JPEG, PNG i WebP. Zdjęcie dostępne publicznie jest powiązane z aktualną opublikowaną lub sprzedaną wersją oferty. Katalogowe i demonstracyjne obrazy są wygenerowanymi zdjęciami poglądowymi. Plik licencyjny kroju Manrope znajduje się w `public/assets/manrope-OFL.txt`.

W kroku **Zdjęcia** sprzedawca może uruchomić SMART CAMERA 360° STUDIO albo dodać własną serię 8–36 zdjęć. Studio prowadzi przez 18 ujęć i sesje obrotowe po 12, 24 lub 36 klatek. Ujęcia ze studia są porządkowane według kąta, a pliki dodane ręcznie według nazw. Zdjęcia ze studia są zapisywane jako WebP lub JPEG. Instrukcja techniczna i mapa plików znajdują się w [SMART-CAMERA.md](SMART-CAMERA.md). W tej samej sekcji dostępny jest jeden plik **Wideo**, MP4 z obrazem H.264 lub WebM, do 90 MiB. Limit dotyczy rozmiaru pliku. W tej samej granicy można dodać film trwający minutę lub dwie. Materiały są zapisane w szkicu i podlegają moderacji razem z ogłoszeniem. Kupujący wybiera je nad galerią.

W panelu „Moje ogłoszenia” każdy zweryfikowany użytkownik może importować pliki CSV, XLSX, JSON i XML, podłączyć feed lub REST API i ustawić synchronizację. Limit pojedynczego importu to 1000 pozycji, 4 MiB i 30 zdjęć na pojazd.

Starszy formularz CSV w panelu dealera akceptuje do 25 wierszy i cztery zdjęcia na wiersz. Pole `type` przyjmuje także typy rozszerzone, np. `motorcycle`, `quad`, `construction` i `trailer`. Dla maszyn można podać `hours`, a dla przyczep `grossWeight` i `axles`. Wzór i mapowanie są w panelu dealera. Obsługiwane są nazwy kolumn ze wzoru oraz ręczne mapowanie. Ponowny import używa klucza dealer + źródło + identyfikator zewnętrzny. Zdjęcia z zatwierdzonego HTTPS są pobierane z limitem rozmiaru i bez przekierowań. Zdjęcia importowane zachowują bezpieczny format źródłowy. Dla importu używany jest obraz źródłowy również w miniaturze. Raport importu pokazuje wynik publikacji każdej zapisanej oferty.

Oferty samochodów osobowych z formularza i importu CSV publikują się po sprawdzeniu wymaganych pól i reguł moderacji. Do moderatora trafiają oferty z VIN-em powtórzonym w aktywnym ogłoszeniu, wybranymi oznakami wyłudzenia lub filmem do sprawdzenia. Automat działa przy przesłaniu nowych ofert i zmian.

## Testy

```sh
npm test
python3 test/browser.py
```

Testy serwera uruchamiają izolowaną bazę, lokalną skrzynkę, testowych użytkowników i testowe zdjęcia. Test przeglądarkowy korzysta z Python Playwright i Chromium. Ścieżkę do binarium można podać jako `CHROMIUM_PATH`. Opcjonalny `BROWSER_TEST_OUTPUT` wskazuje katalog na zrzuty z testu. Produkcyjna poczta i zewnętrzne źródła zdjęć wymagają osobnego sprawdzenia na docelowej konfiguracji.

## Dane do publicznego startu

1. Ustal domenę BRUMBRUM.VIN, włącz HTTPS i ustaw `APP_ORIGIN`.
2. Skonfiguruj zweryfikowanego nadawcę i klucz pocztowy. Sprawdź dostarczenie potwierdzenia i resetu w docelowym środowisku. Aktywuj konto właściciela.
3. Uzupełnij prawdziwe dane operatora oraz kontakt do zgłoszeń. Dokończ treści regulaminu i prywatności, w tym podstawy przetwarzania, odbiorców danych, okresy retencji i sposób realizacji praw. Ustal praktyczną obsługę zgłoszeń i retencję materiałów zarchiwizowanych. [Informacje UODO](https://uodo.gov.pl/pl/493/2254) · [Zgłaszanie treści według UKE](https://www.uke.gov.pl/uslugi-cyfrowe-dsa/twoje-prawa-w-dsa/zglaszanie-nielegalnych-tresci).
4. Ustaw kopie zapasowe bazy i zdjęć. Mapa usług działa od razu. Konta z podłączonym źródłem mogą wybrać częstotliwość automatycznej synchronizacji. Zewnętrzne kanały publikacji wymagają oddzielnego podłączenia.

Dokumentacja poczty [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email).

Dobrowolne jednorazowe wsparcie Stripe — konfiguracja, ograniczenia aktywacji i testy w [STRIPE.md](STRIPE.md).

Usługi motoryzacyjne, importy, harmonogram i protokół kanałów opisuje [USLUGI-IMPORT.md](USLUGI-IMPORT.md).
