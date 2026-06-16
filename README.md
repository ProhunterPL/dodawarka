# Dodawarka do Apilo — Incore Sports

Aplikacja webowa do dodawania produktów do [Apilo](https://apilo.com/pl/) jako centralnego katalogu produktowego Incore Sports. Umożliwia uzupełnienie danych produktu (w tym wariantów rozmiarów), podgląd payloadu REST API, tryb dry-run oraz wysyłkę do magazynu Apilo.

## Co to jest Apilo?

Apilo to platforma e-commerce w chmurze do wielokanałowej sprzedaży. Obsługuje m.in. Shoper, Allegro i Amazon. REST API pozwala m.in. na zarządzanie produktami, stanami magazynowymi i zamówieniami. Dokumentacja: https://developer.apilo.com/api/

## Wymagania

- Node.js 20+
- Konto Apilo z kluczem REST API (Administracja → Klucze API Apilo → Nowa aplikacja REST API)

## Konfiguracja

1. Skopiuj `.env.example` do `.env.local`
2. Uzupełnij zmienne:

```env
APILO_HOST=https://twoja-instancja.apilo.com
APILO_CLIENT_ID=...
APILO_CLIENT_SECRET=...
APILO_AUTHORIZATION_CODE=...
APILO_DRY_RUN=true
```

Po pierwszej autoryzacji refresh token jest zapisywany lokalnie w `data/apilo-tokens.json` (plik jest ignorowany przez git).

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja: http://localhost:3000

## Testy i diagnostyka

```bash
npm test                  # testy walidacji i payloadu Apilo
npm run apilo:test-import # ręczny POST jednego produktu do Apilo (wymaga tokenów)
npm run apilo:auth        # odświeżenie tokenów OAuth
```

Uwaga bezpieczeństwa: skrypty, które wysyłają testowe produkty do Apilo, wymagają
jawnego ustawienia `APILO_ALLOW_WRITE_TESTS=true` w środowisku uruchomieniowym.

## Typowe problemy importu

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| `Invalid value of tax` | VAT wysłany jako string | Naprawione — VAT idzie jako liczba |
| Walidacja kategorii | Tylko etykieta bez ID | Wyszukaj kategorię i **kliknij** wynik z listy |
| Brak zdjęć | S3 skonfigurowany | Wgraj zdjęcie przez upload w formularzu |
| Duplikat SKU | Produkt już w Apilo | Zmień SKU lub usuń stary wpis w Apilo |
| `sku: unknown` w logach | Stary błąd logowania | Naprawione — logi pokazują wszystkie SKU wariantów |

Szczegóły błędów Apilo widać na ekranie wyniku importu oraz w **Historii importów** na dashboardzie.

## Ścieżka MVP

1. **Dashboard** — status połączenia z Apilo, ostatnio dodane produkty
2. **Dodaj produkt** — formularz z produktem testowym „Earn Your Reps”
3. **Podgląd payloadu** — JSON wysyłany do `POST /rest/api/warehouse/product/`
4. **Dry-run / import** — wysyłka lub symulacja bez zapisu w Apilo
5. **Wynik** — ID produktu i kolejne kroki synchronizacji kanałów w panelu Apilo

## Bezpieczeństwo

- Credentiale tylko w `.env.local` (nigdy w frontendzie)
- Tokeny nie są logowane w konsoli
- `.env*` i `data/` są w `.gitignore`

## Produkt testowy

Przycisk „Wczytaj produkt testowy” wypełnia dane koszulki EARN YOUR REPS (SKU `TMCS-EYR-IS-S`, warianty XS–3XL). Szczegóły w `docs/apilo.txt` i `docs/plan.md`.

## Zdjęcia produktów (S3)

Linki OneDrive nie są bezpośrednimi URL-ami obrazów — Apilo ich nie pobierze. Aplikacja wspiera **upload na AWS S3**:

1. Utwórz bucket i politykę jednym poleceniem (używa `.env.local`):

```bash
npm run s3:setup
```

Skrypt tworzy bucket (jeśli nie istnieje), ustawia publiczny odczyt tylko dla `incore-products/*` i zostawia zapis przez IAM usera.

2. Uzupełnij w `.env.local`:

```env
AWS_REGION=eu-central-1
AWS_S3_BUCKET=twoj-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# opcjonalnie przy CloudFront:
AWS_S3_PUBLIC_BASE_URL=https://cdn.twojadomena.pl
```

3. W formularzu produktu użyj **„Wybierz pliki”** — zdjęcia trafią na S3, a publiczny URL zostanie dodany do payloadu Apilo.

Test po konfiguracji: `node scripts/test-s3-upload.mjs` (opcjonalnie).

## Uwagi

- Automatyczna publikacja na marketplace’ach nie jest w MVP — po imporcie zsynchronizuj kanały w panelu Apilo.
- **Asystent AI (OpenAI):** przy błędach walidacji lub odpowiedzi Apilo aplikacja proponuje poprawki opisu, kategorii itd. Ustaw `OPENAI_API_KEY` w `.env.local`, potem użyj „Popraw z AI” w formularzu.
