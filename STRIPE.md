# Dobrowolne wsparcie BRUMBRUM.VIN

Przycisk „Opublikuj za darmo — 0 zł” korzysta z dotychczasowej publikacji. Wybór pakietu także najpierw zapisuje i wysyła ogłoszenie. Osobna strona wsparcia uruchamia jednorazowy Stripe Checkout na życzenie użytkownika. Wpłata, rezygnacja i awaria Stripe nie wpływają na status, widoczność ani kolejność oferty.

## Pakiety i przypisanie linków

| Klucz | Nazwa produktu w Stripe | Kwota w PLN |
| --- | --- | ---: |
| `pit-stop` | PIT STOP BRUMBRUM | 10 |
| `v8-club` | V8 CLUB BRUMBRUM | 100 |
| `supercar-elite` | SUPERCAR ELITE BRUMBRUM | 1 000 |
| `hypercar-sovereign` | HYPERCAR SOVEREIGN BRUMBRUM | 10 000 |

W trybie `STRIPE_SUPPORT_CHECKOUT=hosted_links` strona otwiera publiczny Stripe Checkout. W `STRIPE_LIVE_PAYMENT_LINKS` administrator zapisuje URL pod kluczem właściwego pakietu po sprawdzeniu sprzedawcy, produktu i ceny w PLN. Po włączeniu `STRIPE_SUPPORT_ENABLED` klient widzi przycisk dla każdego skonfigurowanego pakietu. Brak linku lub powtórzony URL blokuje ten pakiet. Stripe obsługuje potwierdzenie i historię wpłat. Tryb demonstracyjny nie otwiera rzeczywistych płatności.

21 listopada 2026 r. w Checkout sprzedawcy **BRUM BRUM.VIN** link z końcówką `oc04` pokazał PIT STOP za 10 zł, `oc03` V8 CLUB za 100 zł, a `oc02` SUPERCAR ELITE za 1 000 zł. Link `oc01` zwrócił błąd niedostępnej strony. HYPERCAR pozostaje bez linku do czasu sprawdzenia Checkout za 10 000 zł. Link `oc00` jest wycofany.

Pozostałe sekcje dotyczą trybu `tracked`, który zapisuje zweryfikowane płatności w portalu. Serwer sprawdza cztery linki, konto, produkty, ceny, sposób powrotu oraz konfigurację potwierdzeń. Dopuszcza końcówkę `.VIN` oraz prawidłową kwotę w nazwie produktu, np. `SUPERCAR ELITE BRUMBRUM.VIN 1 000 zł`. Cenę sprawdza osobno na obiekcie Price.

## Webhook na hostingu

Bramka logowania na głównej domenie odpowiada `401` na anonimowy POST jeszcze przed uruchomieniem aplikacji. Publiczny odbiornik HTTPS obsługuje dwa adresy.

| Środowisko w Stripe Workbench | Adres docelowy |
| --- | --- |
| Produkcja | `https://brumbrum-stripe-webhook.apexassets.chatgpt.site/api/stripe/webhook` |
| Sandbox | `https://brumbrum-stripe-webhook.apexassets.chatgpt.site/sandbox/api/stripe/webhook` |

Zarejestruj zdarzenia z własnego konta: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` oraz `checkout.session.expired`. Wybierz format zdarzeń zawierający obiekt sesji Checkout. Każde środowisko otrzymuje własny sekret konkretnego endpointu.

Odbiornik sprawdza `Stripe-Signature` na surowych bajtach metodą HMAC-SHA256, tolerancję czasu 300 sekund, konto i tryb. Potwierdza obserwowane zdarzenie po trwałym zapisie identyfikatorów zdarzenia i sesji. Para tryb i identyfikator zdarzenia jest unikalna. Prywatny serwer pobiera zdarzenia po uwierzytelnieniu, ponownie odczytuje sesję z API Stripe i sprawdza jej powiązanie z próbą wpłaty, kwotę, walutę oraz status. Zapis i deduplikacja w portalu są transakcyjne. Po błędzie odbiornik ponowi przetwarzanie. Harmonogram działa także po zamknięciu przeglądarki. Powrót zalogowanego użytkownika może przyspieszyć potwierdzenie jego sesji.

## Ustawienia środowisk

Sekrety wpisuje się wyłącznie w ustawieniach serwerowych właściwego projektu i środowiska.

| Gdzie | Ustawienia |
| --- | --- |
| Aplikacja | `APP_ORIGIN`, `STRIPE_SUPPORT_ENABLED`, `STRIPE_SUPPORT_MODE`, `STRIPE_ACCOUNT_ID`, `STRIPE_RESTRICTED_KEY`, `STRIPE_TAX_REVIEWED_AT`, `STRIPE_WEBHOOK_ORIGIN`, `STRIPE_INBOX_TOKEN` |
| Produkcyjna aplikacja | `STRIPE_SUPPORT_MODE=live` i `STRIPE_LIVE_PAYMENT_LINKS` |
| Aplikacja testowa | `STRIPE_SUPPORT_MODE=test`, `STRIPE_TEST_PAYMENT_LINKS` i, na hostingu, `STRIPE_SANDBOX_ORIGIN` równy dokładnemu adresowi HTTPS aplikacji testowej |
| Publiczny odbiornik | `STRIPE_INBOX_TOKEN` współdzielony z portalem, `STRIPE_ACCOUNT_ID` i `STRIPE_WEBHOOK_SECRET` z produkcji, `STRIPE_SANDBOX_ACCOUNT_ID` i `STRIPE_SANDBOX_WEBHOOK_SECRET` z sandboxa |

Na hostingu `STRIPE_WEBHOOK_ORIGIN` wskazuje domenę odbiornika, bez ścieżki. `STRIPE_INBOX_TOKEN` to losowe 32 bajty zapisane szesnastkowo, przekazywane między serwerami. W samodzielnej instalacji z publicznie dostępnym webhookiem na domenie aplikacji można użyć `STRIPE_WEBHOOK_SECRET` bez odbiornika. Klucz Stripe z ograniczonymi uprawnieniami potrzebuje odczytu konta, linków, pozycji, cen, produktów, sesji Checkout, konfiguracji webhooków oraz Stripe Tax. Sekrety testowe i produkcyjne są oddzielne.

W każdym linku ustaw po zapłacie przekierowanie na dokładny adres aplikacji danego środowiska z końcówką `/wsparcie/powrot?session_id={CHECKOUT_SESSION_ID}`. Dla obecnej głównej domeny jest to `https://all4auto.apexassets.chatgpt.site/wsparcie/powrot?session_id={CHECKOUT_SESSION_ID}`. Identyfikator sesji w adresie nie stanowi potwierdzenia wpłaty. Przed zapłatą klient może wrócić przyciskiem przeglądarki do swoich ogłoszeń.

## Weryfikacja przed uruchomieniem

1. W sandboxie właściwego konta ustaw klucz testowy, cztery testowe linki, adres powrotu i właściwy sekret sandboxa. W osobnym środowisku testowym wykonaj cztery ukończone zakupy testowe. Porównaj nazwę, kwotę i PLN z tabelą. Sprawdź rezygnację, sukces asynchroniczny, niepowodzenie, ponowne dostarczenie i potwierdzenie po powrocie. W Workbench sprawdź rzeczywiste dostarczenia HTTP 2xx oraz pojedynczy zapis tej samej sesji w serwisie.
2. W produkcyjnym Dashboard sprawdź tożsamość polskiej JDG i aktywność konta, dane siedziby, rejestracje podatkowe, kody podatkowe produktów, sposób wykazywania podatku oraz końcową cenę każdego pakietu. Jeśli podatek jest doliczany automatycznie, suma dla klienta musi odpowiadać tabeli. Wpisz rzeczywistą datę zakończenia weryfikacji w `STRIPE_TAX_REVIEWED_AT`. Konfigurację podatkową firmy potwierdza właściciel.
3. Przy `STRIPE_SUPPORT_ENABLED=0` otwórz **Administracja → Wsparcie Stripe**. Po pozytywnym wyniku testów dostawcy, weryfikacji czterech linków, Tax i poprawnej rejestracji webhooka włącz `STRIPE_SUPPORT_ENABLED=1` w produkcji.
4. `npm test` i `python test/support-browser.py` sprawdzają logikę aplikacji oraz bezpłatną publikację lokalnie. Repozytorium odbiornika zawiera osobne testy podpisów, zapisu, dostarczeń i ponowień. Te wyniki należy odróżnić od potwierdzeń w Workbench właściwego konta Stripe.
