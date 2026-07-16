import type { ProductFormInput } from "./types";

const EYR_DESCRIPTION = `Koszulka INCORE SPORTS „Earn Your Reps”

Koszulka INCORE SPORTS „Earn Your Reps” to coś więcej niż element sportowej garderoby — to manifest podejścia do treningu, pracy i codziennej dyscypliny. Hasło „Earn Your Reps” przypomina, że każdy wynik trzeba sobie wypracować: powtórzenie po powtórzeniu, dzień po dniu.

Sprawdzi się podczas treningów siłowych, kettlebell, mobility, rozgrzewki czy aktywnego dnia, ale równie dobrze pasuje do codziennych stylizacji.

Cechy produktu:
- sportowy design INCORE SPORTS
- hasło „Earn Your Reps”
- gramatura 190g, 100% bawełna ring-spun
- taśma wzmacniająca na ramionach, bez bocznych szwów`;

const EYR_CHANNELS = [
  "shoper",
  "allegro",
  "amazon-pl",
  "amazon-de",
  "amazon-it",
  "amazon-nl",
  "amazon-es",
  "amazon-se",
  "amazon-uk",
  "amazon-be",
  "amazon-fr",
  "amazon-ie",
] as const;

export const TEST_PRODUCT: ProductFormInput = {
  groupName: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny",
  name: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny S",
  sku: "",
  ean: "5906058689547",
  priceWithTax: "79.00",
  tax: "23",
  quantity: 10,
  weight: 0.1,
  unit: "szt.",
  description: EYR_DESCRIPTION,
  shortDescription:
    "Koszulka INCORE SPORTS Earn Your Reps — bawełniana, sportowy krój, idealna na trening i na co dzień.",
  categoryIds: [25],
  categoryLabel: "Odzież / Dla niego / Koszulki męskie",
  imageUrls: [],
  status: "draft",
  variants: [
    { size: "XS", sku: "TMCS-EYR-IS-XS", quantity: 10, ean: "5906058689585" },
    { size: "S", sku: "TMCS-EYR-IS-S", quantity: 10, ean: "5906058689547" },
    { size: "M", sku: "TMCS-EYR-IS-M", quantity: 10, ean: "5906058689554" },
    { size: "L", sku: "TMCS-EYR-IS-L", quantity: 10, ean: "5906058689561" },
    { size: "XL", sku: "TMCS-EYR-IS-XL", quantity: 10, ean: "5906058689578" },
    { size: "2XL", sku: "TMCS-EYR-IS-2XL", quantity: 10 },
    { size: "3XL", sku: "TMCS-EYR-IS-3XL", quantity: 10 },
  ],
  selectedChannels: [...EYR_CHANNELS],
  channelMetadata: {
    allegro: {
      marketplaceCategory: "Sport i rekreacja / Odzież sportowa / Koszulki",
      parameters: "Marka: Incore Sports, Stan: Nowy, Kolor: czarny, Materiał: bawełna",
      listingTitle: "Koszulka treningowa Incore Sports Earn Your Reps czarna",
      notes: "Sprawdź mapowanie rozmiarów XS–3XL i wymagane zdjęcia Allegro.",
    },
    shoper: {
      marketplaceCategory: "Odzież / Koszulki / Męskie",
      parameters: "Producent: Incore Sports, Kolekcja: Earn Your Reps",
      notes: "Przypisz do kolekcji nowości po synchronizacji.",
    },
  },
};

/** Damska EYR — GTIN XS–XL z kody_ean/ean_koszulki_warianty_uzupelnione.xlsx */
export const TEST_PRODUCT_WOMEN: ProductFormInput = {
  groupName: "Koszulka damska T-shirt bawełniana EARN YOUR REPS Incore Sports czarna",
  name: "Koszulka damska T-shirt bawełniana EARN YOUR REPS Incore Sports czarna S",
  sku: "TDCS-EYR-IS-S",
  ean: "5906058689608",
  priceWithTax: "79.00",
  tax: "23",
  quantity: 10,
  weight: 0.1,
  unit: "szt.",
  description: EYR_DESCRIPTION,
  shortDescription:
    "Koszulka damska INCORE SPORTS Earn Your Reps — bawełniana, sportowy krój, idealna na trening i na co dzień.",
  categoryIds: [25, 46, 52],
  categoryLabel: "Odzież / Dla niej / Koszulki damskie",
  imageUrls: [
    "https://incore-sports-apilo.s3.eu-central-1.amazonaws.com/incore-products/2026/06/523e29f7-f2a9-4e10-9b50-3a5f07768df8-5ef1789b-c32f-4c0c-8bd3-6d1c09905bd5.jpeg",
    "https://incore-sports-apilo.s3.eu-central-1.amazonaws.com/incore-products/2026/06/5a301bb0-5215-4010-8502-6e5947e30ded-00579c96-ffd7-49d2-9dea-443796782a99.png",
  ],
  status: "draft",
  variants: [
    { size: "XS", sku: "TDCS-EYR-IS-XS", quantity: 10, ean: "5906058689592" },
    { size: "S", sku: "TDCS-EYR-IS-S", quantity: 10, ean: "5906058689608" },
    { size: "M", sku: "TDCS-EYR-IS-M", quantity: 10, ean: "5906058689615" },
    { size: "L", sku: "TDCS-EYR-IS-L", quantity: 10, ean: "5906058689622" },
    { size: "XL", sku: "TDCS-EYR-IS-XL", quantity: 10, ean: "5906058689639" },
  ],
  selectedChannels: [...EYR_CHANNELS],
  channelMetadata: {
    allegro: {
      marketplaceCategory: "Sport i rekreacja / Odzież sportowa / Koszulki",
      parameters: "Marka: Incore Sports, Stan: Nowy, Kolor: czarny, Materiał: bawełna, Płeć: damska",
      listingTitle: "Koszulka damska treningowa Incore Sports Earn Your Reps czarna",
      notes: "Sprawdź mapowanie rozmiarów XS–XL i wymagane zdjęcia Allegro.",
    },
    shoper: {
      marketplaceCategory: "Odzież / Koszulki / Damskie",
      parameters: "Producent: Incore Sports, Kolekcja: Earn Your Reps",
      notes: "Przypisz do kolekcji nowości po synchronizacji.",
    },
  },
};

export const DEFAULT_VARIANT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
