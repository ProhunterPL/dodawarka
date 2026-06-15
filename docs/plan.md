Plan Dla Agenta:

Zbuduj aplikację webową do dodawania produktów do Apilo jako centralnego katalogu produktowego Incore Sports, z myślą o późniejszej publikacji/synchronizacji do Shoper, Allegro i Amazon marketplace’ów obsługiwanych przez Apilo.

Cel aplikacji
Aplikacja ma umożliwiać Michałowi dodanie produktu raz, uzupełnienie wszystkich danych wymaganych przez kanały sprzedaży, a następnie wysłanie produktu do Apilo przez REST API. Pierwsza wersja ma obsługiwać bezpieczny pilot na jednym produkcie testowym, potem batch import.

Zakres MVP

Formularz produktu:
nazwa produktu,
SKU,
EAN,
cena brutto,
VAT,
stan magazynowy,
waga,
opis długi,
opis krótki,
zdjęcia URL lub upload,
kategoria wewnętrzna Apilo,
rozmiar / wariant,
status: szkic / aktywny.
Obsługa wariantów:
produkt główny: np. koszulka Earn Your Reps,
warianty: XS, S, M, L, XL, 2XL, 3XL,
SKU wariantu, np. TMCS-EYR-IS-S,
osobny stan magazynowy dla wariantu.
Integracja z Apilo:
autoryzacja przez POST /rest/auth/token/,
zapis accessToken tylko po stronie backendu,
odświeżanie tokenu przez refreshToken,
pobieranie kategorii z Apilo,
tworzenie produktu przez POST /rest/api/warehouse/product/,
walidacja odpowiedzi i czytelny komunikat sukcesu/błędu.
Kanały sprzedaży:
aplikacja ma pokazywać checklistę kanałów: Shoper, Allegro, Amazon PL/DE/FR/IT/ES/NL/SE/UK/BE/IE,
w MVP nie zakładać automatycznego wystawienia oferty, jeśli Apilo API nie udostępnia endpointu publikacji,
po utworzeniu produktu w Apilo aplikacja ma pokazać: “Produkt dodany do Apilo. Sprawdź/potwierdź synchronizację kanałów w panelu Apilo.”
Bezpieczeństwo:
credentiale Apilo trzymać w .env, nigdy w frontendzie,
nie logować tokenów,
nie commitować .env,
dodać .env.example,
dodać tryb dry-run, który pokazuje payload bez wysyłania do Apilo.

Proponowana architektura

Frontend: React / Next.js.
Backend: Next.js API routes albo mały backend Node/Express.
Konfiguracja:
APILO_HOST
APILO_CLIENT_ID
APILO_CLIENT_SECRET
APILO_AUTHORIZATION_CODE
APILO_REFRESH_TOKEN
Dane robocze: na MVP wystarczy lokalny JSON albo SQLite.
Później: baza produktów, historia importów, status synchronizacji.

Ekrany MVP

Dashboard
ostatnio dodane produkty,
status API Apilo,
przycisk “Dodaj produkt”.
Dodaj produkt
formularz danych podstawowych,
sekcja wariantów,
sekcja zdjęć,
wybór kategorii Apilo,
wybór kanałów docelowych jako checklisty.
Podgląd payloadu
pokazuje JSON, który zostanie wysłany do Apilo,
waliduje brakujące pola,
ostrzega, jeśli zdjęcia są linkami OneDrive, które mogą nie być bezpośrednimi URL-ami.
Wynik importu
sukces / błąd,
ID produktu z Apilo, jeśli zwrócone,
lista kolejnych kroków w panelu Apilo.

Wymagania techniczne

Zbuduj klienta Apilo jako osobny moduł:
authenticate()
refreshToken()
getCategories()
createWarehouseProduct(productPayload)
Dodaj walidację danych produktu przed wysłaniem.
Dodaj obsługę błędów API:
brak autoryzacji,
wygasły token,
błędny payload,
brak kategorii,
niedostępny host Apilo.
Dodaj log importu bez sekretów.

Produkt testowy
Użyj jako przykładu:

nazwa: Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny S
SKU: TMCS-EYR-IS-S
EAN: 5906058689547
cena brutto: 79.00
VAT: 23
stan: 10
waga: 0.1
kategoria: Odzież / Dla niego / T-shirt
status: najpierw draft albo dry-run, potem aktywny po potwierdzeniu.

Definicja ukończenia
Aplikacja jest gotowa, gdy:

pozwala wprowadzić produkt testowy,
pobiera kategorie z Apilo,
generuje poprawny payload,
ma tryb dry-run,
potrafi wysłać produkt do Apilo,
pokazuje wynik importu,
nie ujawnia credentiali w frontendzie ani logach,
ma README z instrukcją konfiguracji .env i uruchomienia.

Priorytet wykonania
Najpierw zbudować ścieżkę: formularz → payload → dry-run → autoryzacja Apilo → create product. Dopiero potem rozbudowywać marketplace’y, warianty i batch import.