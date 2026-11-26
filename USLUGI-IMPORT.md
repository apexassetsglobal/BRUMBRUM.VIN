# Usługi motoryzacyjne i automatyzacja ogłoszeń

Moduły korzystają z dotychczasowej sesji, kont i ról. Folder `drizzle` zawiera przyrostową migrację `0009_services_automation.sql`. Uruchomienie `npm ci`, a następnie `npm start`, stosuje migracje do bazy lokalnej. `npm run build` przygotowuje Workera i zasoby witryny do wdrożenia. Migracja dodaje tabele i indeksy bez usuwania istniejących ofert.

## Usługi

Katalog znajduje się pod `/uslugi`, panel właściciela pod `/moje-uslugi`, a kolejka pracowników pod `/moderacja-uslug`. Do tych samych widoków w izolowanej sesji demonstracyjnej prowadzi prefiks `/demo`. Profil może utworzyć każde zweryfikowane konto. Właściciel wskazuje usługi i podaje współrzędne, może też zaznaczyć punkt na mapie. Po zapisaniu treści lub mediów edytowanej publicznej wizytówki właściciel wysyła zmiany do ponownej moderacji.

Podstawowy profil oraz publikacja są bezpłatne. Po zgłoszeniu firmy dostępne są istniejące jednorazowe pakiety dobrowolnego wsparcia. Wyszukiwanie sortuje firmy według odległości przy wybranym promieniu albo według aktualizacji. Wpłaty nie są kryterium rankingu.

Publikowane są wyłącznie zaakceptowane wizytówki i recenzje. Dodanie recenzji wymaga zweryfikowanego konta. Właściciel nie może ocenić własnej firmy, a każde konto może zamieścić jedną opinię o danej firmie. Moderator rozpatruje opinie, odpowiedzi właściciela, sygnały spamu, duplikaty i zgłoszenia. Kontakt telefoniczny, e-mail i WhatsApp wykorzystują publiczne dane firmy podane za jej zgodą. Trasa otwiera mapę z konkretnym celem. Mapa usług korzysta z lokalnego podkładu świata i ulicznych kafli OpenStreetMap z atrybucją. GPS uruchamia się po akcji użytkownika.

Adres firmy pozostaje stały po zmianie nazwy. Strony kategorii i miast powstają z zatwierdzonych danych. Nawigacja kategorii bez ofert otwiera filtr katalogu. Indeksowanie korzysta z istniejącego `PUBLIC_INDEXING` i widoczności całej witryny.

Narzędzia autora przygotowują propozycje do ręcznego zaakceptowania. Lokalny algorytm TextRank pozwala złożyć z opisu krótką notę z faktów. Generatywny redaktor wykorzystuje obsługiwaną przez przeglądarkę funkcję Writer lub serwerowy model Workers AI. Dla wariantu serwerowego użyj powiązania `AI` lub ustaw `SERVICES_AI_ACCOUNT` i tajny `SERVICES_AI_TOKEN` z dostępem do Workers AI. Tłumaczenia działają również lokalnie w przeglądarkach z WebAssembly. Przy pierwszym użyciu użytkownik widzi rozmiar potrzebnych modeli Mozilli i zatwierdza ich pobranie. Tekst pozostaje na urządzeniu. Obsługiwane są wszystkie pary PL, EN, CS, SK, DE i UK, z angielskim jako językiem pośrednim dla części kierunków. Zatwierdzone modele można ponownie wykorzystać z pamięci podręcznej. Samo wygenerowanie propozycji nie zapisuje jej we wpisie. Instagram i TikTok otrzymują plik dopiero wtedy, gdy właściciel sam go opublikuje. Edytor eksportuje PNG 1080 × 1920 oraz pionowy klip z własnych zdjęć lub wideo firmy, po zaznaczeniu praw do materiałów.

## Import

Każdy zarejestrowany użytkownik znajdzie moduł pod **Moje ogłoszenia → Import i automatyzacja** (`/moje-ogloszenia/import`). Podłączenie wymaga potwierdzenia prawa do danych i zdjęć. Administrator zarządza czterema przełącznikami i dostępem poszczególnych klientów pod `/administracja/import`. Skonfigurowane źródło można wstrzymać oraz wznowić. Lokalizacja lub token nowego połączenia wymaga podania nowego zestawu uprawnień.

1. Utwórz źródło plikowe, adres feedu, API odbiorcze lub połączenie z systemem dealerskim udostępniającym kompatybilny eksport. Dla API pobierającego dostępne jest uwierzytelnienie Bearer.
2. Wybierz plik lub pobierz podgląd feedu. Dopasuj kolumny automatycznie albo ręcznie. Minimalnym stabilnym kluczem do ponownych importów jest identyfikator zewnętrzny. Przykłady czterech formatów są w `public/assets/import-samples/`. Adresy w domenie `.example` zastąp adresami zdjęć, do których masz prawa.
3. Ustal, czy import przedstawia cały stan magazynu. Pełny, poprawnie przetworzony eksport oznacza nieobecne wcześniej importowane rekordy do sprawdzenia. Nawet całkowicie pusty, prawidłowo zidentyfikowany eksport nie usuwa ogłoszeń.
4. Włącz publikację i interwał 1, 6, 12 albo 24 h, jeśli chcesz prowadzić synchronizację. Plik i API przyjmujące dane działają na żądanie nadawcy. Niekompletne pozycje pojawiają się w panelu do uzupełnienia. Moderacja zachowuje ręczne decyzje dotyczące ofert i oznacza dane wymagające uwagi.

Limity odczytu wynoszą 4 MiB, 1000 rekordów, 100 kolumn oraz do 30 zdjęć na pojazd. Zdjęcia są pobierane i weryfikowane przed publikacją. Kolejka zapisuje postęp, przygotowane zdjęcia i wynik każdego wiersza. Dla XLSX do przetwarzania trafia pierwszy widoczny arkusz. Sesja demonstracyjna i właściwa baza klientów mają rozłączne zakresy danych.

## API dla dostawców

Po wyborze rodzaju **REST API (odbiór)** panel jednorazowo pokazuje losowy token danego źródła i jego adres. `POST /api/automation/push/{sourceId}` przyjmuje CSV, XLSX, XML lub JSON. Wyślij `Authorization: Bearer <token>`, właściwy `Content-Type` i stabilny `Idempotency-Key` na czas ponowienia tej samej dostawy. Kolejne zmiany otrzymują nowy klucz. Dla kompletnego stanu dodaj parametr `snapshot=1`.

Przykładowe ciało JSON ma postać `{"offers":[{"external_id":"A17","make":"Toyota","model":"Corolla"}]}`. Tak krótki wpis tworzy pozycję do uzupełnienia. Pełne pliki przykładowe przedstawiają nazwy pól, walutę, wyposażenie i zdjęcia.

Odpowiedź `202` zawiera `jobId`. `GET /api/automation/push/{sourceId}/jobs/{jobId}` z tym samym tokenem podaje przyjęcie, oczekiwanie lub odrzucenie importu. Token można wymienić w panelu źródła.

## Serwer i kanały dystrybucji

| Ustawienie | Znaczenie |
|---|---|
| `IMPORT_SECRET_KEY` | Trwały sekret serwera, 32 kryptograficznie losowe bajty w Base64. Chroni tokeny i poufne URL-e feedów szyfrowaniem AES-GCM powiązanym z kontem i integracją. |
| `IMPORT_TICK_SECRET` | Opcjonalny sekret Bearer zewnętrznego harmonogramu dla własnego hostingu. |
| `IMPORT_PRIVATE_SITE_DISPATCH` | Wartość `1` pozwala używać uwierzytelnienia platformy w witrynie dostępnej wyłącznie dla właściciela. Wyłącz przed poszerzeniem dostępu. |
| `IMPORT_PUBLIC_ORIGIN` | Kanoniczny, osiągalny zewnętrznie adres strony do odnośników ofert i zdjęć. Pierwszeństwo ma istniejący `APP_ORIGIN`. |
| `IMPORT_CHANNELS` | Lista zatwierdzonych przez operatora oficjalnych punktów publikacyjnych zgodnych z protokołem poniżej. Domyślnie pusta. |
| `IMPORT_TICK_MS` | Odstęp zegara lokalnego procesu Node w ms, domyślnie `10000`. |
| `SERVICES_AI_ACCOUNT`, `SERVICES_AI_TOKEN` | Opcjonalne powiązanie serwerowego modelu opisu i przekładów, jeśli hosting nie udostępnia `AI.run`. |

Węzeł Node ma działający zegar w procesie serwera. Workera skonfigurowano z funkcją `scheduled` oraz minutowym cronem. Na hostingu z harmonogramem witryny zadanie może wysłać `POST /api/automation/tick` i potwierdzić wynik przez `GET /api/automation/health`. Punkt wybudzenia przyjmuje pusty POST, nie pozwala wybrać źródła ani adresata i ujawnia tylko czas i liczbę operacji. Serwer pobiera pracę z trwałej kolejki i przestrzega lease, częstotliwości oraz zgód właściciela. Przy prywatnej witrynie wywołanie wymaga dostępu do samej witryny. Zmiana interwału w panelu klienta nie wymaga wdrożenia nowej wersji.

Dostęp do kanału wymaga wprowadzenia przez operatora rzeczywistego oficjalnego HTTPS endpointu. Wpis `IMPORT_CHANNELS` ma pola `id`, `name`, `endpoint`, `protocol`. Protokół `brumbrum-v1` współpracuje z opisanym wyżej API push. `receipt-v1` wysyła JSON w formie `{"offers":[...]}` z `Idempotency-Key`. Odbiorca odpowiada `{"status":"accepted"}` albo `{"status":"rejected"}`. Błędy transportu przechodzą ograniczone ponowienia. Inne protokoły wymagają adaptera i autoryzacji dostawcy. Sam adres strony portalu lub kanału społecznościowego nie wystarcza.

Użytkownik osobno wybiera kanał i wyraża zgodę na wysyłkę swoich ofert. Konto ma dostęp do własnych źródeł, historii i wyników. Wyłączenie integracji zatrzymuje nową pracę. Sekrety oraz adresy feedów nie są wypisywane w raportach. Komunikacja korzysta z HTTPS, kontroli publicznych adresów, limitów i zakazu przekierowań.

## Weryfikacja

`npm test` obejmuje aplikację, importy i profile usług. Testy przeglądarkowe uruchamia się przez `python test/services-workflows-browser.py` i `python test/services-map-browser.py` w środowisku z Python Playwright i Chromium. Sprawdzają rzeczywiste formularze, mapę, geolokalizację, odpowiedzi na moderację, kontrastujące motywy i pięć rozmiarów ekranu. Pliki testowe nie trafiają do publicznego katalogu firm.

W wydaniu z 21 listopada 2026 r. przeszły 103 testy serwerowe i regresyjne. W Chromium sprawdzono cztery główne ekrany nowych modułów na szerokościach 360, 390, 768, 1024 i 1440 px w obu motywach, a także 30 kierunków tłumaczenia. Na hostingu sprawdzono dostęp do katalogu i panelu, odmowę administracji dla sprzedawcy, odczyt zewnętrznego feedu w prywatnej sesji demo, przetworzenie kolejki i zapis stanu do bazy. W odizolowanym demo pełny import ze zdjęciem opublikował ofertę. Ponowny import zwrócił ten sam identyfikator i stan „bez zmian”. Testowe źródła zostały zatrzymane.
