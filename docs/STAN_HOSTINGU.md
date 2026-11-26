# Stan hostingu przy eksporcie

Źródłem jest opublikowana wersja 284. Najnowsza wersja zapisana w Sites, świeżo pobrany zdalny `main` oraz czysty katalog użyty do ostatniej publikacji wskazują commit `776e2d9cb0784a2f9ca025a5e3dae8b748e1233f`. Zdalne repozytorium źródłowe zgłosiło jedną gałąź. Nie było drugiej wersji do osobnego archiwum. GitHub jest odrębnym miejscem docelowym.

| Ustawienie | Wartość odczytana podczas eksportu |
|---|---|
| Domena niestandardowa | `brumbrum.vin` — aktywna |
| Adres wdrożenia | `https://brumbrum.vin` |
| Dostęp | Publiczny |
| Wariant hostingu | Worker z powiązaniami `DB` i `BUCKET` |
| Tryb wsparcia Stripe | `live` |
| Publiczne źródło importu | `https://all4auto.apexassets.chatgpt.site` |

Nazwy zmiennych zarejestrowanych na hostingu w momencie eksportu:

- `DEMO_CATALOG_MEDIA_TOKEN`
- `DEMO_MEDIA_SETUP_TOKEN`
- `IMPORT_PRIVATE_SITE_DISPATCH`
- `IMPORT_PUBLIC_ORIGIN`
- `IMPORT_SECRET_KEY`
- `STRIPE_INBOX_TOKEN`
- `STRIPE_LIVE_PAYMENT_LINKS`
- `STRIPE_PRICE_AD_MONTHLY`
- `STRIPE_PRICE_AD_YEARLY`
- `STRIPE_SUPPORT_CHECKOUT`
- `STRIPE_SUPPORT_ENABLED`
- `STRIPE_SUPPORT_MODE`
- `STRIPE_WEBHOOK_ORIGIN`
- `STRIPE_WEBHOOK_SECRET`

Lista opisuje konfigurację hostingu. Obecność nazwy nie potwierdza, że ta rewizja aplikacji używa jej w kodzie. Wartości prywatne, identyfikatory i łącza płatności należy odtworzyć w menedżerze sekretów odpowiedniego środowiska. Szablon programistyczny jest w `.env.example`. Podgląd lokalny działa z własną bazą i magazynem plików.

W kodzie istnieją między innymi znaczniki SEO, mapa witryny i własne statystyki. Kod nie zawiera osadzonego kontenera Google Tag Manager ani tagu GA4. Konfiguracja kont Google, DNS u rejestratora, prywatne ustawienia panelu Stripe, historia webhooków, dane D1, obiekty klientów i harmonogramy skonfigurowane poza kodem nie stanowią części archiwum źródłowego. Dołączone są skrypty obsługi tych integracji, definicje powiązań, migracje i zasoby znajdujące się w repozytorium.
