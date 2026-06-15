import type { ProductFormInput } from "./types";

export const TEST_PRODUCT: ProductFormInput = {
  groupName: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny",
  name: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny S",
  sku: "TMCS-EYR-IS-S",
  ean: "5906058689547",
  priceWithTax: "79.00",
  tax: "23",
  quantity: 10,
  weight: 0.1,
  unit: "KG",
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
  categoryIds: [],
  categoryLabel: "Odzież / Dla niego / T-shirt",
  imageUrls: [
    "https://1drv.ms/i/c/8a1a4240d1db3aab/IQAf4s6OvWadRo3csDQ8lddAAVnN9rDsGcQjXNoC8h3JXwI?e=GUCLYa",
    "https://1drv.ms/i/c/8a1a4240d1db3aab/IQDJv-SZGnOST5LvltX0g-7fAQzSX0c5lhg7-WB74UKRl5Q?e=EQ5ykW",
    "https://1drv.ms/i/c/8a1a4240d1db3aab/IQDblc837AiKQ6cw220ql0ltAcD3Dkm7IkNfxy2wPsu37zc?e=8hFSyy",
  ],
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
};

export const DEFAULT_VARIANT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
