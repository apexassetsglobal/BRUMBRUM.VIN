# Instalacja zależności bez internetu

Rozpakuj cały katalog projektu razem z ukrytym folderem `.backup`. Otwórz terminal w katalogu zawierającym `package.json`. Wymagany jest zainstalowany Node.js 24 lub nowszy wraz z npm.

Poniższe polecenia działają w PowerShell, wierszu polecenia Windows oraz powłokach macOS i Linux.

```sh
npm ci --offline --cache .backup/npm-cache --include=dev --include=optional --no-audit --no-fund
npm run build
```

Polecenie `npm ci` odtwarza `node_modules` z wersji ustalonych w `package-lock.json`. Składniki deweloperskie obejmują kompilator esbuild. Składniki opcjonalne dostarczają jego właściwy plik wykonywalny dla systemu i architektury. Kompilacja tworzy katalog `dist`.

## Zawartość kopii

W `.backup/npm-cache` zapisano 30 archiwów npm. Są to `esbuild@0.25.12`, 26 jego wariantów platformowych, `@zip.js/zip.js@2.25.0`, `saxes@6.0.0` i `xmlchars@2.2.0`. Ich sumy SHA-512 odpowiadają wpisom w `package-lock.json`. Warianty esbuild obejmują między innymi Windows x64, macOS na Intel i Apple Silicon oraz Linux x64 i ARM64. Instalator npm dobiera plik do platformy.

## Wykonane kontrole

- Linux x64, Node.js 24.22.3, npm 11.19.1. Instalacja offline w czystej kopii oraz kompilacja przeszły poprawnie.
- Windows x64. Sprawdzono instalację pakietu dla wskazanej platformy w trybie offline na Linuksie i potwierdzono format PE x64 pliku `esbuild.exe`. Uruchomienie kompilacji na rzeczywistym komputerze z Windows wymaga odrębnej weryfikacji.
- Wszystkie 30 archiwów przeszło kontrolę SHA-512. Sprawdzono także, że indeks zawiera dokładnie 30 pozycji z pliku blokady.
