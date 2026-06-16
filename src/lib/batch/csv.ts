export function detectCsvDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = 0;

  for (const delimiter of candidates) {
    const count = headerLine.split(delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }

  return best;
}

export function parseCsvRows(content: string): string[][] {
  const normalized = content.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(normalized.split(/\r?\n/)[0] ?? ";");
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]!;
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === "\r") {
      continue;
    }

    if (!inQuotes && char === "\n") {
      row.push(current);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  groupname: "groupName",
  nazwagruby: "groupName",
  nazwa_grupy: "groupName",
  nazwa: "name",
  productname: "name",
  rozmiar: "size",
  size: "size",
  sku: "sku",
  ean: "ean",
  gtin: "ean",
  pricewithtax: "priceWithTax",
  cena: "priceWithTax",
  cenabrutto: "priceWithTax",
  tax: "tax",
  vat: "tax",
  quantity: "quantity",
  stan: "quantity",
  ilosc: "quantity",
  weight: "weight",
  waga: "weight",
  unit: "unit",
  jednostka: "unit",
  description: "description",
  opis: "description",
  opisdlugi: "description",
  shortdescription: "shortDescription",
  opiskrotki: "shortDescription",
  categoryids: "categoryIds",
  kategoria: "categoryIds",
  categorylabel: "categoryLabel",
  etykietakategorii: "categoryLabel",
  imageurls: "imageUrls",
  zdjecia: "imageUrls",
  status: "status",
  selectedchannels: "selectedChannels",
  kanaly: "selectedChannels",
  allegrocategory: "allegroCategory",
  allegroparameters: "allegroParameters",
  allegrolistingtitle: "allegroListingTitle",
  allegronotes: "allegroNotes",
  shoopercategory: "shoperCategory",
  shoperparameters: "shoperParameters",
  shoperlistingtitle: "shoperListingTitle",
  shopernotes: "shoperNotes",
};

export function mapCsvHeaders(headers: string[]): Map<number, string> {
  const mapping = new Map<number, string>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const canonical = HEADER_ALIASES[normalized] ?? normalized;
    mapping.set(index, canonical);
  });

  return mapping;
}
