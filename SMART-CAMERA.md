# SMART CAMERA 360° STUDIO

W formularzu dodawania lub edycji pojazdu przejdź do kroku **Zdjęcia**. Pierwsze osiem pozycji przewodnika określa położenie fotografa względem kierunku jazdy. Przód pojazdu to 0°, prawy bok to 90°. Kąt jest wybierany przez fotografa. Przy zgodnym kącie można wykorzystać już zapisane zdjęcie po sprawdzeniu skali i oświetlenia.

| Obszar | Pliki | Odpowiedzialność |
|---|---|---|
| Formularz sprzedawcy | `src/views-account.js`, `public/app.js` | Wejścia do studia, profil nadwozia ze szkicu, kolejka zapisów, kompresja i miniatury, obsługa galerii. |
| Aparat i przewodnik | `public/smart-camera.js`, `public/assets/smart-camera.css`, `public/smart-camera-guides.js` | Podgląd aparatu, kontury SVG, wybór ujęć, sesje 12/24/36, przechowanie jednego oczekującego zdjęcia na szkic w IndexedDB. |
| Ocena zdjęcia | `public/smart-camera-quality.js` | Lokalny pomiar ekspozycji i ostrości, rozdzielczość, orientacja i porównywanie ujęć. |
| Zapis | `src/api.js`, `src/market.js`, `src/camera-session.js` | Weryfikacja właściciela, wersji szkicu i kąta, wymiana zdjęcia, ponowienie zapisu i kolejność klatek. Wykorzystuje istniejącą bazę i magazyn zdjęć. |
| Widok kupującego | `src/spin-viewer.js`, `public/assets/spin-viewer.js`, `src/views-market.js`, `src/views-reels.js`, `public/assets/reels-feed.js`, `public/styles.css` | Obrót, stopniowe wczytywanie zdjęć, klawiatura, dotyk, powiększenie i pełny ekran. |
| Dostarczanie modułu | `src/app.js`, `src/ui.js`, `public/sw.js` | Dostęp do aparatu w edytorze właściciela, udostępnianie modułów i wersjonowanie zasobów. |

Zamknięcie aparatu zwalnia strumień. Kontury i siatkę rysuje interfejs w osobnej warstwie. Do pliku trafia obraz ze źródła, a serwer sprawdza format i usuwa metadane. Operacje na zdjęciach zapisują szkic. Publikacja korzysta z istniejącej ścieżki zatwierdzenia.

Do aparatu przeglądarkowego potrzebne są HTTPS i zgoda urządzenia. Po odmowie można skorzystać z wyboru pliku lub aparatu systemowego. Poziomica zależy od dostępności czujnika. Dopasowanie pojazdu do konturu pozostaje w rękach fotografa.
