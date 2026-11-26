# Uruchomienie i wdrożenie BRUMBRUM.VIN

Projekt można uruchomić jako serwer Node.js z SQLite i katalogiem plików albo zbudować jako Worker z D1, R2 i zasobami statycznymi. Właściciel wybiera docelowe środowisko i publikuje z własnego konta hostingowego. Poniższe polecenia wykonuj z katalogu zawierającego `package.json`.

## Lokalnie

Wymagany jest **Node.js 24 lub nowszy** z npm. Zależności instaluje się zgodnie z dołączonym plikiem blokady.

```sh
npm ci
npm run dev
```

Otwórz `http://127.0.0.1:3000`. `/demo/szukaj` pokazuje przykładowe oferty, a `/healthz` sprawdza połączenie z bazą. Pierwszy start stosuje kolejne migracje z `drizzle/` i zakłada lokalną bazę. Zatrzymaj serwer kombinacją Ctrl+C.

Aby ustawić inny port, własny katalog danych lub pocztę, utwórz lokalny `.env` według szablonu i uruchom serwer z odczytem tego pliku.

```sh
cp .env.example .env
node --env-file=.env server.mjs
```

Domyślny `DATA_DIR` to `var/`. Baza to `all4auto.sqlite`; obrazy, wideo i ich metadane są w `objects/`. W trybie developerskim bez klucza pocztowego linki potwierdzeń i resetu zostają zapisane w `mailbox.jsonl` w tym samym katalogu. Traktuj ten plik tak jak lokalną skrzynkę odbiorczą. Klucze, baza i pliki klientów należą do środowiska, w którym powstały.

Do sprawdzenia kodu oraz przygotowania paczki Workera służą:

```sh
npm test
npm run build
```

Testy tworzą odizolowane dane lokalne. Kompilacja odtwarza `dist/`; wynik serwerowy to `dist/server/index.js`, zasoby przeglądarkowe są w `dist/client/`, a konfiguracja Workera w `dist/server/wrangler.json`. Uruchomienie wariantu Node korzysta bezpośrednio z `src/` i `public/`.

## Wariant A — własny serwer Node.js

1. Skopiuj kod na serwer z Node.js 24+, wykonaj `npm ci` i przygotuj trwały katalog należący do konta procesu. Wskaż go jako `DATA_DIR`. Przy przenoszeniu działającej instalacji odtwórz bazę **razem z odpowiadającym jej katalogiem obiektów**. Czysty start utworzy nową bazę.
2. W konfiguracji procesu ustaw `APP_MODE=production`, `APP_ORIGIN=https://<domena>`, `HOST=127.0.0.1` i port wewnętrzny. Dokładny origin zawiera schemat i nazwę domeny, bez końcowego ukośnika i bez ścieżki. Dodaj ustawienia poczty i operatora z tabeli niżej.
3. Skieruj DNS wybranej domeny na publiczny adres własnego serwera lub adres wskazany przez hosting. W reverse proxy skonfiguruj certyfikat dla tej domeny i przekazanie ruchu na lokalny port Node. Panel lub serwer publikujący powinien wskazywać ten sam adres co `APP_ORIGIN`.
4. Uruchom `node --env-file=.env server.mjs` w menedżerze procesów hostingu albo skonfiguruj w nim te same zmienne i polecenie `npm start`. Start automatycznie stosuje niewykonane migracje, odnotowywane w `schema_migrations`. Przed aktualizacją istniejącej bazy wykonaj jej kopię i kopię obiektów. Dla SQLite w trybie WAL użyj mechanizmu kopii SQLite albo zatrzymaj proces na czas spójnego kopiowania całego katalogu danych.
5. Otwórz `https://<domena>/healthz` i wykonaj kontrolę po uruchomieniu. Zegar importów działa w procesie Node, domyślnie co 10 sekund. W środowisku bez bramy logowania Sites pozostaw integrację `SITES_CHATGPT_SIGNIN` wyłączoną.

## Wariant B — Sites lub Worker

1. Na koncie właściciela wybierz właściwy projekt i jego środowisko. Konfiguracja `.openai/hosting.json` opisuje projekt Sites i nazwy powiązań. Przy przeniesieniu na inne konto uzyskaj własny identyfikator projektu i uprawnienia do jego zasobów.
2. Uruchom `npm ci` i `npm run build`. W przeznaczonym do publikacji środowisku połącz **`DB`** z właściwą bazą D1, **`BUCKET`** z prywatnym magazynem R2, a **`ASSETS`** z `dist/client/`. Przywrócenie danych wymaga kopii bazy i powiązanych plików z tego samego środowiska. Nazwy zasobów i przykładowy identyfikator bazy w wygenerowanym `wrangler.json` są przeznaczone do podstawienia przez platformę. Przy własnym wdrożeniu wprowadź identyfikatory przydzielone na swoim koncie.
3. Zastosuj migracje `drizzle/*.sql` chronologicznie. W istniejącym środowisku wykorzystaj historię wykonanych migracji platformy. Opcjonalne powiązanie `AI` obsługuje funkcje autora opisu. Konfiguracja Workera przewiduje wywołanie `scheduled` co minutę dla zadań w tle.
4. W Sites użyj procesu publikacji istniejącego projektu na koncie właściciela. Przy hostingu Workera poza Sites dostosuj przed publikacją punkt wejścia generowany przez `scripts/build.mjs`. Obecny wariant wymusza integrację logowania Sites, która ufa nagłówkom tożsamości dostarczanym przez tę platformę. Poza zaufaną bramą wyłącz tę integrację w punkcie wejścia, usuń przychodzące nagłówki tożsamości na brzegu, przebuduj Worker i używaj logowania aplikacji. Warstwa Workera powinna obsługiwać ruch przed zasobami statycznymi, zgodnie z konfiguracją kompilacji.
5. Dodaj domenę niestandardową w panelu wybranego hostingu, ustaw dokładnie rekordy DNS pokazane dla tej domeny, poczekaj na certyfikat HTTPS i ustaw zgodny `APP_ORIGIN`. Adres podglądu oraz domena publiczna mogą mieć osobne ustawienia logowania, płatności i widoczności. Kopiowanie plików projektu nie tworzy połączenia z domeną ani dostępu do istniejącej bazy.
6. Gdy docelowe R2 jest puste, sprawdź dostępność zdjęć demo z większych galerii. Repozytorium dostarcza `scripts/load-demo-photos.mjs` oraz opcję `--catalog` do uzupełniania takich zasobów na wybranym hoście. Użyj tymczasowego `DEMO_MEDIA_SETUP_TOKEN` lub `DEMO_CATALOG_MEDIA_TOKEN` zgodnie z opisem w głównym README i wyłącz token po zakończeniu. Banery są w pakiecie `ASSETS`; procedura z `AD_CAROUSEL_MEDIA_TOKEN` dotyczy hostingu korzystającego z zastępczego odczytu banerów z R2.

## Ustawienia środowiska

| Zakres | Wartości do ustawienia przez właściciela |
|---|---|
| Domena, operator i widoczność | `APP_ORIGIN`, `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_EMAIL`. Domyślnie `PUBLIC_INDEXING=0`; wartość `1` odblokowuje indeksowanie po otwarciu domeny. |
| Konta i wysyłka poczty | `MAIL_API_KEY=<sekret Resend>`, `MAIL_FROM=<zweryfikowany nadawca>`. Dodaj w DNS domeny nadawczej rekordy podane dla niej przez Resend. Przy pierwszej konfiguracji właściciela ustaw `OWNER_EMAIL` i jednorazowy `OWNER_SETUP_TOKEN` o długości co najmniej 32 znaków. Po weryfikacji konta aktywuj je przez `/dostep-wlasciciela` i usuń token. |
| Importy i integracje | `IMPORT_SECRET_KEY` to trwały sekret z 32 losowych bajtów w Base64, potrzebny do szyfrowanych połączeń. Przy przenoszeniu istniejących integracji zachowaj wartość w bezpiecznej konfiguracji. `IMPORT_PUBLIC_ORIGIN` obsługuje odnośniki do witryny, `IMPORT_CHANNELS` domyślnie wynosi `[]`. `IMPORT_TICK_SECRET` jest opcjonalnym sekretem wywołania harmonogramu. `IMPORT_IMAGE_ORIGINS` określa dozwolone źródła obrazów importu dealerskiego. |
| Funkcje AI usług | Opcjonalne `AI` lub `SERVICES_AI_ACCOUNT` z prywatnym `SERVICES_AI_TOKEN`. Smart Camera wykonuje wskazówki jakościowe lokalnie. |
| Płatności | Domyślnie `STRIPE_SUPPORT_ENABLED=0`. Właściciel oddzielnie konfiguruje konto, tryb testowy lub live, kwoty, linki i ewentualny odbiornik zdarzeń. Warianty `hosted_links` i `tracked` mają inne wymagania. Szczegóły, potrzebne nazwy zmiennych oraz próby w środowisku testowym opisują `STRIPE.md` i `TESTY-STRIPE.md`. |

Sekrety wpisuj w konfiguracji serwera lub w menedżerze sekretów hostingu. Szablon `.env.example` przedstawia nazwy i puste wartości. Własnego `.env`, kopii bazy, listy osób ani plików klientów nie umieszczaj w katalogu publicznym.

## Kontrola po uruchomieniu

- Otwórz `/healthz` i sprawdź `{"ok":true,"database":true}`. Następnie otwórz `/demo/szukaj`, jedną ofertę, miniaturę i zdjęcie w pełnym rozmiarze. To sprawdza także dostęp do materiałów.
- W środowisku testowym przejdź rejestrację, potwierdzenie e-mail, logowanie i odzyskiwanie hasła. W izolowanym demo zapisz szkic z fotografią, ponownie otwórz edycję i sprawdź, czy obraz się ładuje.
- Dla wdrożeń z importami sprawdź `GET /api/automation/health`. Pole `lastTick` dotyczy ostatniej pracy zegara w danym zakresie. Pełne pomyślne wykonanie konkretnego importu potwierdza odczyt odpowiedniego zadania.
- W instalacji z płatnościami sprawdź sukces, rezygnację i ponowienie zdarzenia w sandboxie przed włączeniem obsługi live. Kontrolę DNS, certyfikatu, doręczania poczty i płatności wykonuje się na właściwym koncie operatora.
