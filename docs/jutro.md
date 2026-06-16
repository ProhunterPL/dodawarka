# Do zrobienia jutro (blokery po stronie użytkownika)

## 1. Import produktu testowego Earn Your Reps

Przed pierwszym prawdziwym importem:

1. Uruchom `npm run dev` i wejdź na http://localhost:3000/products/new
2. Kliknij **„Wczytaj produkt testowy”** (kategoria ID 25 jest już ustawiona)
3. **Wgraj co najmniej 1 zdjęcie** przez upload S3 (wymagane przy skonfigurowanym AWS)
4. Opcjonalnie: kliknij **„Pobierz kategorie”** i potwierdź wybór kategorii T-shirt
5. Zrób **dry-run** → sprawdź payload (pole `tax` musi być liczbą, `categories: [25]`)
6. Odznacz dry-run i wyślij **jeden wariant** (np. tylko S) albo całą serię

## 2. Duplikaty SKU w Apilo

W Apilo mogły powstać produkty testowe z wcześniejszych prób:

- `TMCS-EYR-IS-S-TEST`, `TMCS-EYR-IS-S-TEST2` (oraz inne z sufiksem `-TEST-*`)

Jeśli import `TMCS-EYR-IS-S` zwróci błąd duplikatu — usuń stary produkt w panelu Apilo **lub** zmień SKU w formularzu.

Lokalna aplikacja blokuje ponowny import SKU, które mają status `success` w `data/products.json`.

## 3. Tokeny Apilo

Jeśli status API na dashboardzie jest czerwony:

```bash
npm run apilo:auth
```

(wymaga ważnego `APILO_AUTHORIZATION_CODE` lub `APILO_REFRESH_TOKEN` w `.env.local`)

## 4. Diagnostyka z terminala

```bash
npm test                  # 10 testów walidacji/payloadu — powinno być zielone
npm run apilo:test-import # ręczny POST; 500 od Apilo = błąd po stronie serwera Apilo
```

## Co zostało zrobione dziś (autonomicznie)

- VAT (`tax`) wysyłany jako liczba całkowita
- Parsowanie odpowiedzi Apilo `{ products: { SKU: id } }`
- Szczegóły błędów Apilo w UI i na dashboardzie (historia importów)
- Wymuszony wybór kategorii z listy Apilo (`categoryIds`)
- Walidacja zduplikowanych SKU w formularzu + blokada ponownego importu
- Zdjęcia wymagane gdy S3 skonfigurowany
- Produkt testowy: `categoryIds: [25]`, bez duplikatu SKU rodzica
- Dashboard: historia importów + komunikaty błędów przy produktach
- `npm test`, `npm run apilo:test-import`
