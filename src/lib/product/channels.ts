export const SALES_CHANNELS = [
  { id: "shoper", label: "Shoper", required: false },
  { id: "allegro", label: "Allegro", required: true },
  { id: "amazon-pl", label: "Amazon PL", required: false },
  { id: "amazon-de", label: "Amazon DE", required: false },
  { id: "amazon-fr", label: "Amazon FR", required: false },
  { id: "amazon-it", label: "Amazon IT", required: false },
  { id: "amazon-es", label: "Amazon ES", required: false },
  { id: "amazon-nl", label: "Amazon NL", required: false },
  { id: "amazon-se", label: "Amazon SE", required: false },
  { id: "amazon-uk", label: "Amazon UK", required: false },
  { id: "amazon-be", label: "Amazon BE", required: false },
  { id: "amazon-ie", label: "Amazon IE", required: false },
] as const;

export const CHANNEL_NOTE =
  "Produkt dodany do Apilo. Sprawdź/potwierdź synchronizację kanałów w panelu Apilo.";

export const APILO_NEXT_STEPS = [
  "Otwórz panel Apilo i znajdź nowy produkt w magazynie.",
  "Przypisz kategorie i parametry wymagane przez Allegro.",
  "Zweryfikuj zdjęcia — bezpośrednie URL-e muszą być publicznie dostępne.",
  "Uruchom synchronizację kanałów (Shoper, Allegro, Amazon) w Apilo.",
];
