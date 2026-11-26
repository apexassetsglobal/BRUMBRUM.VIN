# Roboty i automatyka

Strefa `/roboty` jest częścią istniejącej aplikacji BRUMBRUM.VIN. Korzysta z tych
samych kont, sesji, uprawnień, wiadomości, moderacji oraz magazynu zdjęć i filmów.
Ma osobny interfejs, katalog kategorii, formularz ogłoszenia i manifest aplikacji.
Baner strony głównej i stopka „Nasze projekty” prowadzą do strefy.

## Główne adresy

| Adres | Funkcja |
| --- | --- |
| `/roboty` | Strona główna i 11 kategorii |
| `/roboty/szukaj` | Filtry kategorii, zakupu/najmu, producenta, ceny i lokalizacji |
| `/roboty/sprzedaj` | Nowe ogłoszenie dla zalogowanego użytkownika |
| `/roboty/moje-ogloszenia` | Szkice i własne ogłoszenia robotów |
| `/roboty/oferta/:slug` | Publiczna oferta, kontakt, zamówienie i rezerwacja |
| `/roboty/zamowienia` | Zakupy, sprzedaż oraz najem |
| `/roboty/zamowienia/:id` | Kwoty, terminy i obsługa statusu zamówienia |
| `/roboty/panel-dealera` | Istniejący panel firmowy z importem CSV robotów |
| `/roboty/ulubione` | Ulubione roboty |
| `/roboty/porownanie` | Porównanie maksymalnie czterech urządzeń |
| `/roboty/asystent` | Dobór kategorii i filtrów według zastosowania |
| `/roboty/rolki` | Filmy i zdjęcia ofert robotów |
| `/roboty/demo` | 22 przykładowe ogłoszenia, po dwa w każdej kategorii |
| `/roboty/demo/:slug` | Szczegóły fikcyjnego ogłoszenia demonstracyjnego |

Prefiks `/demo` zachowuje izolację demonstracyjnych kont i danych. Działy usług
oraz automatyzacja importu pojazdów zachowują swoje dotychczasowe główne adresy.

## Przykłady i wygląd

Karty z oznaczeniem DEMO są statycznymi przykładami wyglądu ofert, z fikcyjnymi
nazwami, parametrami i cenami. Nie są rekordami w tabeli `listings`, nie zwiększają
liczby prawdziwych ogłoszeń i nie przyjmują zamówień, rezerwacji ani wiadomości.
Gdy katalog jest pusty, pokazują układ oferty od razu; filtry kategorii i rodzaju
oferty działają również dla przykładów. Ilustracje pochodzą z atlasu kategorii.

Przycisk wyglądu w nagłówku i sekcja „Ramki i ikony” w ustawieniach udostępniają
zwykłą oraz neonową ramkę, dziewięć kolorów i własny kolor, grubość 1–6 px oraz
siłę poświaty 0–100%. Preferencje zapisują się wyłącznie w tej przeglądarce,
pod kluczem `a4-robot-frame`. Skrypt odtwarza je przed załadowaniem CSS, synchronizuje
oba panele i inne karty. Nie modyfikuje ustawień motoryzacyjnej części aplikacji.

## Ogłoszenia i dostępność

Ogłoszenia robotów używają tabeli `listings` z `type = 'robot'`. Dane kategorii,
trybu sprzedaż/najem/oba, stawek najmu, kaucji, minimalnego okresu, czasu
przygotowania i puli sztuk są częścią istniejącego pola JSON. Formularz robotów
nie wymaga VIN ani parametrów samochodowych. Oba katalogi filtrują rodzaj oferty.

`stock` oznacza całkowitą pulę sztuk. Zaakceptowane i zrealizowane zakupy zużywają
ją trwale. Zaakceptowany najem zajmuje sztuki tylko w swoim przedziale dat.
Dzień zwrotu nie wchodzi w okres najmu. Kontrola uwzględnia szczyt równoczesnych
rezerwacji, a nie sumę rozłącznych terminów. Zmniejszenie puli przez edycję lub
CSV nie może naruszyć już zaakceptowanych zobowiązań.

## Zamówienia

Nowe zamówienie ma status `requested`. Sprzedawca akceptuje lub odrzuca
zgłoszenie. Kupujący może anulować zgłoszenie oczekujące. Sprzedawca może anulować
zaakceptowane zamówienie lub oznaczyć je jako zrealizowane; najem można zakończyć
po dacie zwrotu. Dostęp do szczegółów mają jego uczestnicy.

Serwer oblicza kwoty w najmniejszych jednostkach waluty i zapisuje warunki
oferty w zamówieniu. Zmiana sprzętu, opisu, ceny lub warunków przed akceptacją
wymaga nowego zgłoszenia. Zaakceptowane zamówienie zachowuje własne warunki.
Kaucja jest pokazana osobno. Tydzień najmu ma 7 dni, miesiąc 30 dni; niepełny
okres rozliczeniowy jest zaokrąglany w górę. Daty używają Europe/Warsaw.

Ten moduł zapisuje i obsługuje zamówienia oraz rezerwacje. Płatność i dostawę
strony uzgadniają bezpośrednio; moduł nie pobiera pieniędzy ani kaucji. Istniejące
dobrowolne wsparcie serwisu pozostaje osobną funkcją.

## Kod i wdrożenie

- `src/robot-catalog.js`: kategorie i walidacja pól.
- `src/robot-orders.js`: wyceny, statusy, snapshoty i atomowe limity dostępności.
- `src/views-robots.js`: strony i formularze strefy.
- `public/assets/robots.js`, `robots.css`, `robots/`: edytor, styl i grafiki.
- `drizzle/0010_robot_orders.sql`: tabela zamówień, dodana po migracji usług.
- `test/robot*.test.mjs`, `test/robots*.test.mjs`: regresje nowych ścieżek.

Przed wdrożeniem uruchom `npm test` i `npm run build`. Publikuj z istniejącym
identyfikatorem Site w `.openai/hosting.json`; zachowaj jego D1, R2 i dostęp.
Migracji już zastosowanych w serwisie nie należy przepisywać.
