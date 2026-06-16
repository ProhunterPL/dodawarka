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

export type SalesChannelId = (typeof SALES_CHANNELS)[number]["id"];

export const CHANNEL_LABELS: Record<string, string> = Object.fromEntries(
  SALES_CHANNELS.map((channel) => [channel.id, channel.label]),
);

export type ChannelMetadataFieldKey =
  | "marketplaceCategory"
  | "parameters"
  | "listingTitle"
  | "notes";

export interface ChannelFieldConfig {
  key: ChannelMetadataFieldKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

const MARKETPLACE_FIELDS: ChannelFieldConfig[] = [
  {
    key: "marketplaceCategory",
    label: "Kategoria na marketplace",
    placeholder: "np. Allegro: Sport i rekreacja / Odzież sportowa / Koszulki",
  },
  {
    key: "parameters",
    label: "Parametry do uzupełnienia w Apilo",
    placeholder: "np. Marka: Incore Sports, Stan: Nowy, Kolor: czarny, Materiał: bawełna",
    multiline: true,
  },
  {
    key: "listingTitle",
    label: "Tytuł oferty (opcjonalnie inny niż w magazynie)",
    placeholder: "np. Koszulka treningowa Incore Sports Earn Your Reps czarna",
  },
  {
    key: "notes",
    label: "Notatki operacyjne",
    placeholder: "np. sprawdź mapowanie rozmiarów, dodaj zdjęcie lifestyle",
    multiline: true,
  },
];

const SIMPLE_FIELDS: ChannelFieldConfig[] = [
  {
    key: "listingTitle",
    label: "Tytuł oferty",
    placeholder: "Opcjonalny tytuł pod dany marketplace",
  },
  {
    key: "notes",
    label: "Notatki",
    placeholder: "Uwagi do publikacji / synchronizacji",
    multiline: true,
  },
];

export const CHANNEL_FIELD_SETS: Record<string, ChannelFieldConfig[]> = {
  allegro: MARKETPLACE_FIELDS,
  shoper: [
    {
      key: "marketplaceCategory",
      label: "Kategoria w Shoper",
      placeholder: "np. Odzież / Koszulki / Męskie",
    },
    {
      key: "parameters",
      label: "Atrybuty / filtry Shoper",
      placeholder: "np. Producent: Incore Sports, Kolekcja: Earn Your Reps",
      multiline: true,
    },
    {
      key: "listingTitle",
      label: "Nazwa produktu w sklepie",
      placeholder: "Opcjonalna nazwa widoczna w Shoper",
    },
    {
      key: "notes",
      label: "Notatki Shoper",
      placeholder: "np. przypisz do kolekcji Nowości, SEO opis skrócony",
      multiline: true,
    },
  ],
};

export function getFieldsForChannel(channelId: string): ChannelFieldConfig[] {
  return CHANNEL_FIELD_SETS[channelId] ?? SIMPLE_FIELDS;
}

export const CHANNEL_NOTE =
  "Produkt dodany do Apilo. Sprawdź/potwierdź synchronizację kanałów w panelu Apilo.";

export const APILO_NEXT_STEPS = [
  "Otwórz panel Apilo i znajdź nowy produkt w magazynie.",
  "Przypisz kategorie i parametry wymagane przez Allegro.",
  "Zweryfikuj zdjęcia — bezpośrednie URL-e muszą być publicznie dostępne.",
  "Uruchom synchronizację kanałów (Shoper, Allegro, Amazon) w Apilo.",
];
