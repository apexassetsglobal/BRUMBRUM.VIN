# BRUMBRUM.VIN — raport kompletności i testów

**26 listopada 2026 r.** Źródłem kopii jest opublikowana wersja **284** serwisu BRUMBRUM.VIN. Commit źródłowy to `776e2d9cb0784a2f9ca025a5e3dae8b748e1233f`, a drzewo Git to `7a0de4411bfdf4ff7e509e0188f48cac6ea2ee45`.

## Co zabezpieczono

Sprawdzono status udanego wdrożenia, historię zapisanych wersji, świeżą kopię repozytorium źródłowego i katalog roboczy użyty przy publikacji. Wszystkie wskazują tę samą rewizję. Zdalne źródło zgłosiło jedną gałąź `main`. W katalogu źródłowym nie było lokalnych zmian ani nowych nieśledzonych plików aplikacji. Kod do eksportu wyprowadzono z drzewa Git.

Wersja źródłowa obejmuje **1459 plików**, w tym **1352 pliki w public/**, 54 pliki w `src/`, 26 plików w `test/` i 11 migracji SQL wraz z dziennikiem migracji. Kopia zawiera oryginalne katalogi pojazdów, zasoby i szablony, frontend, backend, panel administracyjny, uprawnienia, galerie, rolki, Smart Camera 360°, PWA, moduły importu i integracji płatniczej. Spis wszystkich ścieżek, praw dostępu i sum SHA-256 znajduje się w `.backup/ZRODLA.json`.

## Zgodność i prywatność

- **1454 pliki** wersji przenośnej są identyczne bajt po bajcie z plikami źródłowymi. Uzupełniono `README.md`, `.gitignore` i `.env.example`. W `src/accounts.js` i `src/views-account.js` prywatny adres właściciela zastąpiono odczytem z `OWNER_EMAIL`. Aktywacja pierwszego administratora wymaga teraz podania tego adresu w prywatnej konfiguracji kopii.
- W `.backup/oryginal/` zachowano pierwotne warianty tych pięciu plików z usuniętym adresem. Właściciel może odtworzyć dokładną rewizję, podając dawny adres lokalnie. Sprawdzono pełne odtworzenie **1459/1459 plików** oraz ich uprawnienia. Tymczasowy wynik próby został usunięty.
- Porównano wynik kompilacji z lokalnym pakietem użytym przy publikacji wersji 284. **683/683 pliki klienta** są identyczne. Zgodne są też oba pliki konfiguracji hostingowej i wszystkie 12 plików z katalogu migracji pakietu. Skompilowany Worker różni się wskutek opisanej zmiany adresu właściciela.
- Kontrola objęła wzorce poświadczeń, szablony, przykładowe importy, grafiki i filmy testowe. W 1294 śledzonych grafikach rastrowych nie wykryto EXIF/GPS/XMP. Przykładowe dane testów i syntetyczne identyfikatory integracji są częścią testów. Prawdziwe wartości kluczy, tokenów, haseł i pliki lokalnych użytkowników pozostają poza paczką.

## Wyniki kontroli

| Kontrola | Wynik |
|---|---|
| Instalacja bez internetu | Czysta instalacja z 30 archiwów npm. SHA-512 każdego pakietu odpowiada plikowi blokady. W pakiecie są warianty esbuild m.in. dla Windows, macOS i Linux. |
| Kompilacja | `npm run build` zakończone poprawnie na Linux x64 z Node.js 24.22.3 i npm 11.19.1. Wygenerowano klienta i Worker. |
| Testy projektu | `npm test` w kopii eksportowej, na odizolowanych danych. **204 zaliczone, 0 błędów, 0 pominiętych**. |
| Aktywacja właściciela | Próby na tymczasowej bazie potwierdziły nadanie uprawnień przy poprawnej konfiguracji i odrzucenie błędnego tokenu, próby z obcego konta oraz ponownej aktywacji. |
| Podgląd | Przeglądarka wyświetliła stronę główną eksportu. Link do przykładowych ogłoszeń otworzył wyniki z licznikiem **113**, sortowaniem i trybem rolek. Podgląd ma odrębny SQLite. |
| Windows | Zweryfikowano instalację zależności dla x64 i nagłówek PE pliku esbuild. Kompilację wykonano na Linux x64. |
| Integralność paczki | Plik `.backup/SHA256SUMS` wylicza zawartość eksportu poza samym manifestem. Po rozpakowaniu zweryfikuj kopię przez `node scripts/sprawdz-kopie.mjs`. |

## GitHub i dostęp

Gałąź roboczą `backup/brumbrum-v284` przygotowano w lokalnym repozytorium eksportu. Dostępne połączenie GitHub wskazało wyłącznie konto `blackbullsupercars-tech`. Lokalny GitHub CLI nie miał zalogowanego użytkownika. Odczyt metadanych wskazanego repozytorium zwrócił 404. W przypadku repozytorium prywatnego taka odpowiedź nie rozstrzyga, czy ono istnieje.

Nie wysłano źródeł na GitHub i nie otwarto Pull Requestu. Aby dokończyć eksport, połącz **apexassetsglobal**, udostępnij aplikacji prywatne repozytorium **BRUMBRUM-VIN** i przyznaj odczyt metadanych oraz zapis w **Contents** i **Pull requests**. Jeżeli repozytorium jeszcze nie istnieje, potrzebne jest też uprawnienie do jego utworzenia na tym koncie. Instrukcja obejmuje osobną gałąź z aktualnej bazy i otwarcie PR do przeglądu. Repozytorium hostingu oraz produkcyjna baza nie były modyfikowane.

## Granice kopii źródłowej

To kopia aplikacji i schematu bazy. Konta, ogłoszenia klientów, sesje, wiadomości, transakcje, prywatne zdjęcia i filmy z produkcyjnego magazynu oraz historia Git zawierająca dawną konfigurację pozostają poza ZIP-em. Odtworzenie danych produkcyjnych wymaga osobnego prywatnego backupu D1/R2. To samo dotyczy zewnętrznych kont Stripe, Google i DNS.

Zapisano nazwy 14 zmiennych z hostingu i jawne, sprawdzone ustawienia w [stanie hostingu](docs/STAN_HOSTINGU.md). Projekt zawiera własne liczniki. W tej rewizji nie znaleziono osadzenia GA4/GTM. Obsługę płatności i faktyczny zakres reklam opisuje [dokumentacja API](docs/API.md). Nie uruchamiano płatności ani wdrożenia produkcyjnego. Produkcyjnego aparatu na fizycznym telefonie i zewnętrznych usług nie testowano w ramach eksportu.
