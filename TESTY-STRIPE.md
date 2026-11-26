# Raport testów — 21 listopada 2026

Weryfikacja na lokalnym, jednorazowym środowisku Node 24 i SQLite.
Nie pobrano żadnych opłat. Dane testowe usunięto po zakończeniu testów.

| Scenariusz | Wykonanie i wynik |
| --- | --- |
| Darmowa publikacja bez konfiguracji Stripe | API i prawdziwa przeglądarka — poprawnie zapisuje i publikuje ogłoszenie |
| Wybór wsparcia po formularzu | Przeglądarka — ogłoszenie przesłane przed płatnością, wybrany pakiet zachowany |
| Cztery kwoty i cztery adresy | Testy z kontrolowanymi odpowiedziami Stripe API — 10, 100, 1 000, 10 000 PLN i dokładne linki z zamówienia |
| Błędna cena, waluta, konto, produkt, subskrypcja, ilość, dodatki lub powrót | Audyt blokuje rozpoczęcie wpłaty |
| Webhook | Podpis surowego żądania, czas, konto, tryb, sesja, kwota i waluta sprawdzone |
| Opóźnione płatności, błędy i wygaśnięcie | Potwierdzenie tylko po stanie paid; błąd i wygaśnięcie nie zmieniają ogłoszenia |
| Powtórzenia i starsze zdarzenia | Idempotentny zapis, potwierdzenie nie jest cofane przez późne zdarzenie |
| Fałszywy adres sukcesu | Nie daje potwierdzenia wpłaty |
| Odczyt wpłaty innego konta, edycja obcego ogłoszenia, CSRF i panel administratora | Odrzucone przez serwer |
| Powrót i rezygnacja w interfejsie aplikacji | Przeglądarka — powrót do ogłoszeń działa; nie symuluje potwierdzenia Stripe |
| Responsywność | 360, 390, 768, 1024 i 1440 px — wybór pakietów, podgląd ogłoszenia i strona powrotu bez poziomego przewijania |
| Błędy JavaScript | W kontrolowanych procesach przeglądarki nie wystąpiły zdarzenia pageerror |
| Pozostałe funkcje aplikacji | Istniejące testy rejestracji, publikacji, uprawnień, wiadomości, wyszukiwania, plików, importu i demo przechodzą |

`npm test` — **60 zaliczonych, 0 błędów, 0 pominiętych**.

`test/support-browser.py` — wykonane procesy publikacji, wyboru wsparcia,
powrotu oraz pięć szerokości ekranu. Podczas kontroli wykryto i naprawiono
kolizję selektora okna rozmowy z dekoracyjną próbką nici. Ponowna kontrola
przeglądarki przeszła bez błędów JavaScript.

## Niewykonane u dostawcy

Nie wykonano rzeczywistego przejścia przez cztery strony płatności, anulowania
w Stripe ani testowego obciążenia i automatycznego powrotu od dostawcy.
Nie potwierdzono cen i Stripe Tax w produkcyjnym panelu BRUMBRUM.VIN.
Dostępne połączenie dotyczy wyłącznie konta testowego innej marki.

Do uruchomienia wpłat potrzebne są właściwe konto, zweryfikowane Payment Links
i Tax, adresy powrotu, publicznie osiągalny endpoint webhooka oraz sekrety serwera.
Obecna witryna ma ograniczony dostęp na poziomie hostingu, którego nie zmieniono.
Dokładna procedura
i nazwy zmiennych są w [STRIPE.md](STRIPE.md). Do tego czasu wpłaty pozostają
wyłączone; bezpłatna publikacja jest dostępna.
