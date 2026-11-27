# Sound Garage

Sound Garage dodaje personalizację dźwięków bez przebudowy istniejących widoków i bez zewnętrznych nagrań. Wszystkie obecne warianty są oryginalnymi efektami syntetycznymi generowanymi w przeglądarce przez Web Audio. Nazwy modeli opisują profile brzmienia; nie oznaczają autentycznego nagrania konkretnego pojazdu.

## Pliki

| Zakres | Plik |
|---|---|
| katalog 60 wariantów, kategorie i osiem zdarzeń | `public/assets/sound-catalog.js` |
| centralny odtwarzacz, synteza, blokada nakładania i głośność | `public/assets/sound-engine.js` |
| interfejs, zapis lokalny, synchronizacja i obsługa startu | `public/assets/sound-garage.js` |
| widok ustawień | `src/views-account.js` |
| walidacja i zapis ustawień konta | `src/sounds.js` |
| trasy API | `src/api.js` |
| wygląd Sound Garage i małego przycisku startowego | `public/styles.css`, `public/assets/launch-screen.css` |
| ikony PWA | `public/assets/icon-*.png`, `public/assets/icon-maskable-*.png` |

## Zdarzenia

Obsługiwane klucze to `appStart`, `newMessage`, `sellerReply`, `listingInquiry`, `watchedPrice`, `newOffer`, `vehicleSold` i `system`. Każdy ma własny wariant, wyciszenie i głośność 0–100%. Gość zapisuje ustawienia w `localStorage`. Zalogowany użytkownik dodatkowo synchronizuje je z istniejącą tabelą `settings` przez `/api/sound-settings`.

Dźwięk startowy jest podejmowany tylko raz na sesję karty, więc przejścia między podstronami go nie powtarzają. Gdy przeglądarka blokuje autoplay, ekran startowy pokazuje mały przycisk ENGINE START. Jeden centralny odtwarzacz zatrzymuje poprzedni efekt przed uruchomieniem następnego i nie blokuje renderowania aplikacji.

## Ograniczenia platform

- Efekty działają wewnątrz otwartej aplikacji. iOS i typowa instalacja PWA nie pozwalają stronie dowolnie ustawić dźwięku systemowego powiadomienia push działającego w tle.
- Ograniczenia trybu cichego, głośności systemowej i polityki autoplay mają pierwszeństwo przed ustawieniem aplikacji.
- Repozytorium nie zawiera natywnego projektu Android, Capacitor, Cordova, TWA ani konfiguracji APK. Ikony zostały podłączone do PWA; dodanie ich do APK wymaga osobnej warstwy natywnej.
- Nie ma tu płatnych ani pobranych nagrań pojazdów. Dodanie pliku audio wymaga potwierdzonej licencji komercyjnej i jawnego oznaczenia źródła.

## Kontrola

Testy modułu znajdują się w `test/sound-garage.test.mjs`. Sprawdzają liczbę wariantów, walidację ustawień, czas i wyłączność odtwarzania, blokadę autoplay, zapis konta, zdarzenia, wymiary i przezroczystość ikon oraz podłączenie manifestu i interfejsu.
