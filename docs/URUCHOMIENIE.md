# Uruchomienie BRUMBRUM.VIN w VS Code

## Pierwszy start

1. Rozpakuj archiwum do nowego katalogu. W VS Code wybierz **Plik → Otwórz folder** i wskaż katalog, w którym są `package.json`, `package-lock.json`, `server.mjs`, `src/` i `public/`.
2. Otwórz **Terminal → Nowy terminal**. Sprawdź `node --version` i `npm --version`. Projekt wymaga Node.js 24 lub nowszego.
3. Uruchom polecenia poniżej. Pierwsze instaluje zależności według pliku blokady. Drugie pozostawia serwer uruchomiony w terminalu.

```sh
npm ci
npm run dev
```

Domyślny adres to [http://127.0.0.1:3000](http://127.0.0.1:3000). Katalog testowych ogłoszeń znajdziesz pod [http://127.0.0.1:3000/demo/szukaj](http://127.0.0.1:3000/demo/szukaj). Trasa `/demo` jest najłatwiejszym miejscem na pierwsze sprawdzenie aplikacji, zdjęć i roli sprzedawcy.

Przy zajętym porcie uruchom `npm run dev -- --port 3010` i otwórz adres z terminala. Lokalny serwer domyślnie nasłuchuje na `127.0.0.1`. W trybie deweloperskim `APP_ORIGIN` pozostaw pusty, aby żądania i linki korzystały z faktycznego adresu. Używaj tego samego hosta i portu przez całą sesję.

## Edycja i podgląd obok kodu

W palecie poleceń VS Code wybierz **Simple Browser: Show**, wklej adres działającego serwera i przenieś kartę podglądu do prawej grupy edytora. Ten sam adres działa w zwykłej przeglądarce. Do sprawdzania uprawnień kamery i układu telefonu użyj zewnętrznej przeglądarki z narzędziami deweloperskimi.

| Co zmieniasz | Gdzie pracować | Jak zobaczyć wynik |
| --- | --- | --- |
| Style, obrazy i kod wykonywany przez przeglądarkę | `public/styles.css`, właściwy plik w `public/assets/` lub `public/app.js` | Zapisz plik i odśwież stronę. Serwer czyta zasoby z dysku przy żądaniu. Przy starej wersji włącz pomijanie service workera i wyłącz pamięć podręczną w narzędziach deweloperskich, a następnie przeładuj stronę. |
| Widoki, routing i logika serwera | `src/`, `server.mjs` | Przy `npm run dev` zakończ proces przez **Ctrl+C**, ponownie uruchom `npm run dev` i odśwież stronę. |
| Migracje, konfiguracja środowiska | `drizzle/`, prywatny plik środowiska | Zrestartuj proces. Nowe migracje uruchomią się przy starcie. Sprawdź je najpierw na osobnej bazie testowej. |

Do dłuższej edycji serwera możesz użyć `node --watch server.mjs`. Node wtedy restartuje proces po zmianie jego modułów. Podgląd w przeglądarce odświeżasz samodzielnie. Domyślne `npm run dev` i `npm start` uruchamiają `node server.mjs`. Ten proces obsługuje trasy i SQLite potrzebne do działania podglądu.

## Dane lokalne i opcjonalne usługi

Przy pierwszym uruchomieniu Node tworzy katalog `var/`, bazę `var/all4auto.sqlite` i stosuje migracje z `drizzle/`. Zdjęcia przesłane podczas pracy trafiają do `var/objects/`. Zmiana `DATA_DIR` przenosi miejsce tworzenia tych plików. Domyślny katalog jest liczony od położenia `server.mjs`, zaś względny `DATA_DIR` względem katalogu uruchomienia.

Podstawowe demo działa na lokalnym SQLite i systemie plików. W trybie deweloperskim bez `MAIL_API_KEY` wiadomości rejestracyjne zapisują się w `DATA_DIR/mailbox.jsonl`. Ten plik zawiera linki potwierdzeń i resetów. Zachowaj go lokalnie. Klucze Stripe, dostawcy poczty, AI, kanałów publikacji oraz uprawnienia do D1/R2 dotyczą odpowiednich integracji.

Lokalny serwer uruchamia harmonogram importów, domyślnie sprawdzany co 10 sekund. Do ćwiczeń używaj nowego `DATA_DIR`, pustej konfiguracji kanałów i kont testowych. Podpięte źródła, aktywne zadania i ich klucze mogą spowodować kontakt z usługą zewnętrzną. Zmiana interwału przez `IMPORT_TICK_MS` reguluje częstotliwość. Wartość `0` przywraca domyślny interwał.

Jeśli używasz pliku `.env`, skopiuj `.env.example` do prywatnego `.env`, uzupełnij własne wartości i uruchom `node --env-file=.env server.mjs`. Zwykły skrypt `npm run dev` dziedziczy środowisko terminala. Konfiguracja produkcyjna wymaga m.in. dokładnego `APP_ORIGIN` w HTTPS bez końcowego ukośnika. Szczegóły integracji opisują [README](../README.md), [STRIPE.md](../STRIPE.md) oraz [USLUGI-IMPORT.md](../USLUGI-IMPORT.md).

## Kontrole przed przekazaniem zmian

```sh
npm test
npm run build
```

Testy Node korzystają z lokalnych danych testowych. Kompilacja tworzy katalog `dist/` dla wariantu Worker. Praca lokalna z `npm run dev` odczytuje źródła bezpośrednio. Zasady dla współpracujących asystentów opisują [AGENTS.md](../AGENTS.md) i [instrukcje Copilota](../.github/copilot-instructions.md).

## Ręczny import do prywatnego repozytorium GitHub

Docelowe repozytorium to **apexassetsglobal/BRUMBRUM-VIN**. Sprawdź właściciela, dokładną nazwę, oznaczenie **Private** i swoje uprawnienia zapisu. Jeżeli korzystasz z GitHub CLI, polecenie poniżej wyświetli także nazwę obecnej gałęzi domyślnej.

```sh
gh repo view apexassetsglobal/BRUMBRUM-VIN --json nameWithOwner,visibility,defaultBranchRef
```

**Jeśli w repozytorium są już commity**, sklonuj je do nowego katalogu obok rozpakowanej kopii. Utwórz gałąź z aktualnej gałęzi domyślnej pobranej przez klonowanie.

```sh
git clone https://github.com/apexassetsglobal/BRUMBRUM-VIN.git BRUMBRUM-przeglad
cd BRUMBRUM-przeglad
git remote -v
git status --short
git switch -c backup/import-brumbrum
```

Zachowaj bazowy commit i utwórz punkt odniesienia poleceniem `git branch backup/przed-importem` w klonie docelowego repozytorium. Użyj świeżo rozpakowanego ZIP. Na gałąź `backup/import-brumbrum` przenieś **całą jego zawartość**, łącznie z ukrytymi katalogami `.backup`, `.github` i `.openai` oraz plikiem `.env.example`. Kopiuj bez usuwania plików, które istnieją wyłącznie w klonie. Zachowaj dotychczasowy katalog `.git`. Zmiany plików o tych samych nazwach będą widoczne w porównaniu gałęzi, a ich poprzednie wersje pozostaną w commicie bazowym. W kopii po uruchomieniu aplikacji pomiń także lokalną bazę, `.env`, `node_modules` i `dist`.

Pełną listę plików eksportu wraz z sumami zawiera `.backup/SHA256SUMS`. W katalogu docelowym uruchom `node scripts/sprawdz-kopie.mjs`, następnie sprawdź `git status --short`. Po skopiowaniu wszystkich plików i osobnym commicie dokumentacji dodaj pozostałe ścieżki eksportu do osobnego commitu. Przed wysyłką sprawdź, czy działające w docelowym repozytorium automatyzacje pomijają wdrożenie z gałęzi roboczej i PR.

Poniższy przykład przygotowuje dokumentację. Przed zapisem przejrzyj listę plików oraz pełną różnicę. Kod i zasoby dodawaj osobnymi commitami, wskazując ich ścieżki.

```sh
git add -- README.md AGENTS.md .github/copilot-instructions.md docs/URUCHOMIENIE.md
git diff --cached --name-status
git diff --cached
git commit -m "Dodaj instrukcje pracy i uruchomienia BRUMBRUM.VIN"
```

Jeżeli wybrane pliki są identyczne z wersją w repozytorium, pomiń ten commit. Pomiń także `.env`, dane z `var/`, prywatne pliki SQLite, korespondencję, tokeny, katalogi pamięci podręcznej i pobrane zależności. Zachowaj reguły ignorowania z obu kopii. Przed wysłaniem sprawdź zebrane zmiany względem właściwej gałęzi bazowej i uruchom odpowiednie testy.

Po akceptacji zakresu wyślij tylko gałąź roboczą. W GitHub wybierz **Compare & pull request** i jako bazę wskaż potwierdzoną wcześniej gałąź domyślną. Pozostaw PR otwarty do decyzji właściciela. Jeśli nazwa gałęzi roboczej jest już zajęta, wybierz nową i użyj jej w poleceniu wysyłki. Ta procedura nie wymaga wymuszonego pushu, usuwania gałęzi ani nadpisywania gałęzi domyślnej.

```sh
git push -u origin backup/import-brumbrum
```

**Jeśli prywatne repozytorium jest zupełnie puste**, do otwarcia PR potrzebna jest bazowa gałąź z pierwszym commitem. Właściciel może zainicjalizować ją na GitHubie pojedynczym plikiem README. To odrębna decyzja, bo pierwszy commit ustanawia bazę. Po jej utworzeniu wykonaj kroki od klonowania i przenieś źródła na gałąź roboczą. Do czasu uzgodnienia bazy kopia ZIP pozostaje gotowa do pracy lokalnej.
