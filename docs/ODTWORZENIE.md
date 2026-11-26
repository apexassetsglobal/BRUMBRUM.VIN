# Odtworzenie oryginalnych źródeł

Do zwykłej pracy wystarczy rozpakowany projekt z przenośną konfiguracją. Opcjonalny skrypt odtwarza 1459 plików śledzonych w wersji `776e2d9cb0784a2f9ca025a5e3dae8b748e1233f`. Identyfikator drzewa to `7a0de4411bfdf4ff7e509e0188f48cac6ea2ee45`.

1. Otwórz terminal w katalogu projektu. Potrzebny jest Python 3. Git, dodatkowe pakiety i połączenie z siecią nie są wymagane.
2. Uruchom `python3 scripts/odtworz-zrodla.py --sprawdz`. Wpisz pierwotny adres e-mail właściciela, z zachowaniem wielkości liter. Znaki pozostają ukryte. Skrypt weryfikuje sumę manifestu i SHA-256 wszystkich plików w pamięci.
3. Aby zapisać wynik, uruchom `python3 scripts/odtworz-zrodla.py --do ../BRUMBRUM-oryginal`. W systemie Windows możesz użyć `py -3` zamiast `python3`. Wybierz prywatną lokalizację z istniejącym katalogiem nadrzędnym. Katalog wyniku musi być nowy i znajdować się poza rozpakowaną kopią. Zapis rozpoczyna się po zweryfikowaniu całego zestawu.

Wynik odtwarza również pierwotny adres w dawnym kodzie i konfiguracji. Używaj go jako prywatnego archiwum. W przenośnej kopii adres został zastąpiony znacznikiem. Szablony pięciu plików źródłowych są w `.backup/oryginal/`; pozostałe pliki pochodzą bezpośrednio z projektu. Spis ścieżek, trybów Git i sum znajduje się w `.backup/ZRODLA.json`. W systemach POSIX odtwarzane są bity uprawnień plików; w Windows o dostępie decyduje lokalny system uprawnień. Odtworzenie obejmuje śledzone pliki projektu. Historia Git, infrastruktura, baza produkcyjna, pliki użytkowników i sekrety wdrożeniowe leżą poza zakresem tej procedury.
