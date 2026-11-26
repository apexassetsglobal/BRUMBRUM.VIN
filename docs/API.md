# API BRUMBRUM.VIN

Opis dotyczy tras zaimplementowanych w `src/api.js`, `src/app.js`, `src/services.js` i `src/automation.js`. W tabelach skrócone ścieżki zaczynają się za `/api`. Zapis `{id}` oznacza identyfikator konkretnego rekordu. Ścieżki HTML, m.in. `/oferta/{slug}`, zwracają widok strony.

## Sesja i odpowiedzi

Przeglądarka przesyła ciasteczko sesji HTTP-only. Typowe operacje zapisu z interfejsu oczekują żądania z tej samej domeny. Odczyt prywatnych szkiców, wiadomości, zamówień i materiałów wymaga odpowiedniej sesji i uprawnień do zasobu. Handlowiec ma dostęp do własnych ogłoszeń. Moderator i administrator używają osobnych operacji przeglądu. Demo działa w odrębnym zakresie danych pod `/demo/api/…`. Sesję demonstracyjną tworzy `POST /demo/api/access`, np. z `{"actor":"seller"}`.

Większość tras przyjmuje JSON i zwraca `200` z `{"ok":true,...}`. Błąd obsługiwany przez aplikację ma postać `{"ok":false,"error":"…"}`, czasem dodatkowo `fields`. `401` oznacza wymaganą sesję, `403` odmowę dostępu, `404` brak dostępnego obiektu lub trasy, `409` konflikt stanu, `413` przekroczenie rozmiaru, `422` błąd danych, `429` limit żądań. Pliki, szablony CSV i komunikaty operatorów zewnętrznych mają własne formaty.

## Katalog, konta i komunikacja

| Metoda i ścieżka | Dane i wynik | Dostęp |
|---|---|---|
| `GET /catalog`, `GET /search` | Słowniki lub wyniki z `offers`, `total`, `page`, `pages`, `sort`. Przykład: `/api/search?make=Toyota&page=1`. Rynek robotów obsługuje `market=robotics`. | Publiczny |
| `GET /compare?keys={id1},{id2}` | Do czterech ofert w polu `offers`. | Publiczny katalog |
| `GET /offers/{id}/phone` | `phone`, jeśli publiczna oferta dopuszcza telefon. Odczyt ma limit częstotliwości. | Publiczny |
| `GET /exchange-rates`, `GET /china-market-news` | Dane dla odpowiednich sekcji strony. | Właściwa witryna |
| `POST /auth/register`, `/auth/verify`, `/auth/login`, `/auth/logout` | Rejestracja m.in. `email`, `password`, `name`, `terms`; weryfikacja tokenem i hasłem; logowanie ustawia ciasteczko. | Uczestnik procesu |
| `POST /auth/resend`, `/auth/reset-request`, `/auth/reset`, `/auth/change`, `/auth/delete`, `/auth/owner` | Potwierdzenie adresu, odzyskanie dostępu, zmiana hasła, usunięcie konta i jednorazowa aktywacja uprawnień właściciela. | Właściwe poświadczenie, token lub sesja |
| `PUT /profile`, `GET` / `PUT /appearance` | Edycja profilu. Wygląd zapisuje obiekt `engine` na koncie; gość otrzymuje `engine:null`. | Własne konto przy zapisie |
| `GET` / `POST /favorites`, `GET /badges`, `POST /notifications/read` | Do zmiany ulubionych służą `key` lub `keys` oraz `add`. Liczniki wiadomości i powiadomień są powiązane z kontem. | Zapis na własnym koncie |
| `POST /offers/{id}/message`, `GET` / `POST /messages/{thread}`, `POST /messages/{thread}/{read,block,proposal}` | Wiadomość przy ofercie tworzy lub odnajduje wątek. Odpowiedź zawiera `thread` i `message`. | Zalogowany kupujący i uczestnicy wątku |
| `POST /report`, `POST /contact` | Zgłoszenie lub zapytanie. Kontakt przyjmuje `name`, `email`, `body`, opcjonalnie `kind:"ad"`; zwraca `id`. | Według formularza; kontakt wymaga zalogowania |

## Szkic, publikacja i Smart Camera

| Metoda i ścieżka | Kontrakt właściciela ogłoszenia |
|---|---|
| `POST /listings` | `{"key":"<stabilny UUID klienta>"}` tworzy szkic. Ponowienie z tym samym kluczem na koncie zwraca ten sam `id`. Odpowiedź zawiera też `next`. |
| `GET /listings/{id}/edit` | Aktualny stan, m.in. `version`, `data`, `photos`, `spin`, `video`, `step`, `smartCamera`. |
| `PUT /listings/{id}/edit` | `version` oraz zmieniane pola formularza. Tablice zdjęć mogą zawierać wyłącznie identyfikatory należące do aktualnego zbioru. Pierwsze zdjęcie jest okładką. |
| `POST /listings/{id}/photo`, `/spin`, `/video` | Binarny upload przez istniejący szkic z nagłówkiem `X-Edit-Version`. Przy wysyłce obrazu z miniaturą ciało zawiera obraz i miniaturę jeden po drugim, a `X-Image-Length` określa długość pierwszej części w bajtach. |
| `POST /listings/{id}/submit`, `POST /listings/{id}/status` | Zgłoszenie do publikacji wymaga bieżącej `version`; zmiana już publicznej oferty wymaga potwierdzenia, gdy sygnalizuje to formularz. Osobna operacja statusu przyjmuje np. `{"status":"sold"}` dla obsługiwanego przejścia. |

Studio przypisuje ujęcie przez `X-Studio-Shot`, np. `front_left`. Dla obrotu wysyła `X-Studio-Frames` (12, 24 lub 36) i `X-Studio-Angle` zgodny z krokiem 30°, 15° lub 10°. `X-Studio-Replace` wskazuje poprzedni identyfikator ujęcia. `X-Studio-Reuse` pozwala przesłać pusty POST do `/spin` i przypisać istniejące zdjęcie z tej galerii o zgodnym kącie. Przy ponawianiu tego samego ujęcia klient zachowuje `X-Studio-Capture-Id` i ten sam materiał.

Zmianę planu sesji zapisuje `PUT /edit` z `version` i `studioCount` lub `studioSkip:{"shot":"trunk","skip":true}` w ramach ścieżki ogłoszenia. Odpowiedź po zdjęciu zawiera bieżącą wersję, listy mediów, mapę opisów i stan studia. `needsRefresh:true` po powtórzeniu oznacza, że formularz musi pobrać aktualny szkic przed następnym zapisem. Po `409` ponownie odczytaj stan przed scaleniem własnych zmian. Obrazy odczytuje się spod `/media/{id}` i `/media/{id}/thumb`, film spod `/wideo/{id}`. Dostęp wynika z widoczności oferty i roli odbiorcy.

## Pozostałe moduły

| Metoda i ścieżka | Funkcja i dostęp |
|---|---|
| `GET /dealer/template`, `POST /dealer/preview`, `POST /dealer/import` | Szablon CSV, podgląd, import na własnym koncie firmowym. |
| `POST /reels`, `POST /reels/{id}/remove` | Film firmowy jako dane binarne, opcjonalnie `X-Reel-Listing` i `X-Reel-Caption`. Usuwanie należy do właściciela. |
| `GET` / `POST /robot-orders`, `GET /robot-orders/{id}`, `POST /robot-orders/{id}/status` | Utworzenie zamówienia dla `listingId`, dostęp uczestnika do historii, szczegółów i dozwolonych zmian statusu. |
| `POST /services/create`, `POST /services/{id}/{save,media,delete-media,delete,ai,reply}` | Wizytówka usługowa i jej materiały. Zmiany wykonuje właściciel. Przy usuwaniu wymagane jest `revision`. |
| `POST /services/{id}/{review,report}`, `POST /services/moderate` | Opinia zawiera `stars` od 1 do 5 i `content`. Zgłoszenie ma `reason`. Moderacja wymaga odpowiedniej roli. |
| `POST /moderation/{listingId}`, `POST /moderation/reports/{id}` | Decyzja moderatorska i rozpatrzenie zgłoszenia. Decyzja dla oferty używa bieżącej `revision`. |
| `POST /admin/{settings,dictionary}`, `POST /admin/roles/{id}`, `POST /admin/banners[/{id}]`, `POST /admin/features/{id}`, `POST /admin/contacts/{id}` | Administracja konfiguracją, słownikiem, rolami, banerami, wyróżnieniami i obsługą zapytań. |
| `POST /asset/{kind}[/{target}]`, `POST /banner-event` | Obraz binarny profilu lub marki. Role zależą od `kind` i zasobu. Zdarzenia banerów obsługują emisje i kliknięcia. |
| `POST /youtube-promotions`, `POST /youtube-promotions/{id}` | Zgłoszenie filmu i zmiana jego statusu w obiegu redakcyjnym. |

## Integracje i monitorowanie importu

Do monitorowania służą następujące odczyty.

| Metoda i ścieżka | Kto i co odczytuje |
|---|---|
| `GET /automation/health` | Zwraca `lastTick` dla tego zakresu, również `null` przed pierwszym wykonaniem. |
| `GET /automation/job/{jobId}` | Właściciel w sesji otrzymuje `job` i zdarzenia `events` własnego importu. |
| `GET /automation/push/{sourceId}/jobs/{jobId}` | Dostawca z `Authorization: Bearer <token źródła>` odczytuje status własnej dostawy: `pending`, `accepted` lub `rejected`. |

`POST /automation/push/{sourceId}` **zapisuje** dostawę CSV, XLSX, XML lub JSON. Używa tokenu źródła. Dostawca powinien zachować ten sam `Idempotency-Key` przy ponowieniu jednej dostawy. Odpowiedź `202` zawiera `jobId`. `?snapshot=1` oznacza pełny stan magazynu. Przykładowe ciało to `{"offers":[{"external_id":"A17","make":"Toyota","model":"Corolla"}]}`.

Właściciel konfiguruje import przez `POST /automation/sources`, `/automation/channels` i `/automation/source/{id}/{preview,run,rotate,connection,enabled,settings}`. Administrator ma `POST /automation/admin/policy` i `/automation/admin/suspend`. `POST /automation/tick` **uruchamia pracę kolejki**. Dostęp wymaga uprawnień administracyjnych, sekretu harmonogramu lub skonfigurowanego wywołania z prywatnego hostingu. Zasady mapowania, zgód i ponowień opisano w pliku źródłowym `USLUGI-IMPORT.md`.

## Stripe, reklamy i finansowanie

`POST /support/start` wymaga zalogowania. Ciało ma pola `package`, `key` i opcjonalne `listing` należące do użytkownika. Serwer zwraca `next` do jednorazowej wpłaty. Pakiety obejmują 10, 100, 1 000 i 10 000 PLN. W konfiguracji śledzonej `POST /stripe/webhook` odbiera podpisane zdarzenia Stripe w oryginalnym formacie; konfigurację i rozliczenie przez zewnętrzny odbiornik opisuje `STRIPE.md`.

Reklamodawca przesyła zapytanie przez `POST /contact` z `kind:"ad"`. W tej wersji brak automatycznego abonamentu reklamowego i cyklicznego obciążania karty. Zapytanie o leasing z oferty trafia do jej wątku wiadomości. Kod nie potwierdza przekazania wniosku do banku ani naliczenia prowizji.
