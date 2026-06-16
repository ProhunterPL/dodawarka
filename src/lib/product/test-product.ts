import type { ProductFormInput } from "./types";

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
  description: `Koszulka INCORE SPORTS „Earn Your Reps”

Koszulka INCORE SPORTS „Earn Your Reps” to coś więcej niż element sportowej garderoby — to manifest podejścia do treningu, pracy i codziennej dyscypliny. Hasło „Earn Your Reps” przypomina, że każdy wynik trzeba sobie wypracować: powtórzenie po powtórzeniu, dzień po dniu.

Sprawdzi się podczas treningów siłowych, kettlebell, mobility, rozgrzewki czy aktywnego dnia, ale równie dobrze pasuje do codziennych stylizacji.

Cechy produktu:
- sportowy design INCORE SPORTS
- hasło „Earn Your Reps”
- gramatura 190g, 100% bawełna ring-spun
- taśma wzmacniająca na ramionach, bez bocznych szwów`,
  shortDescription:
    "Koszulka INCORE SPORTS Earn Your Reps — bawełniana, sportowy krój, idealna na trening i na co dzień.",
  categoryIds: [25],
  categoryLabel: "Odzież / Dla niego / Koszulki męskie",
  imageUrls: [],
  status: "draft",
  variants: [
    { size: "XS", sku: "TMCS-EYR-IS-XS", quantity: 10 },
    { size: "S", sku: "TMCS-EYR-IS-S", quantity: 10, ean: "5906058689547" },
    { size: "M", sku: "TMCS-EYR-IS-M", quantity: 10 },
    { size: "L", sku: "TMCS-EYR-IS-L", quantity: 10 },
    { size: "XL", sku: "TMCS-EYR-IS-XL", quantity: 10 },
    { size: "2XL", sku: "TMCS-EYR-IS-2XL", quantity: 10 },
    { size: "3XL", sku: "TMCS-EYR-IS-3XL", quantity: 10 },
  ],
  selectedChannels: ["shoper", "allegro", "amazon-pl", "amazon-de", "amazon-it", "amazon-nl", "amazon-es", "amazon-se", "amazon-uk", "amazon-be", "amazon-fr", "amazon-ie"],
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

export const DEFAULT_VARIANT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
