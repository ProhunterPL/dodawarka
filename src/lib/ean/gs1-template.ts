import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { ProductFormInput, ProductVariantInput } from "@/lib/product/types";
import type { EanAssignmentRow, EanImportResult } from "./types";

export const GS1_IMPORT_TEMPLATE_FILENAME = "ean_koszulki_warianty_uzupelnione.xlsx";
export const GS1_MOJE_GS1_SHEET = "MojeGS1";
export const GS1_DATA_START_ROW = 2;

const PRODUCT_TYPE =
  "Produkt do sprzedaży detalicznej/online (GTIN-13, GTIN-12, GTIN-8)";
const LANGUAGE = "PL";
const BRAND = "Incore Sports";
const NET_CONTENT = 1;
const UNIT = "szt";
const GPC_CLASSIFICATION = 10001352;
const SALES_COUNTRIES = "PL,EU,WW";
const MARKET_STATUS = "Aktywny (w sprzedaży)";
const DEFAULT_WEBSITE = "https://incoreports.eu";

function hasTrailingSize(text: string, size: string): boolean {
  return new RegExp(`\\b${size}\\b\\s*$`, "i").test(text.trim());
}

function extractSize(text: string): string {
  const trailing = text.match(/\b(XS|2XL|3XL|XXL|XL|S|M|L)\b\s*$/i);
  if (trailing?.[1]) {
    return trailing[1].toUpperCase();
  }

  const match = text.match(/\b(XS|2XL|3XL|XXL|XL|S|M|L)\b/gi);
  return match?.at(-1)?.toUpperCase() ?? "";
}

function buildCommonName(product: ProductFormInput, variant?: ProductVariantInput): string {
  const base = product.groupName.trim();
  if (!variant?.size) {
    return base;
  }
  const size = variant.size.toUpperCase();
  if (hasTrailingSize(base, size)) {
    return base;
  }
  return `${base} ${size}`.trim();
}

export function getGs1ImportTemplatePath(): string {
  return path.join(process.cwd(), "kody_ean", GS1_IMPORT_TEMPLATE_FILENAME);
}

function buildFullGs1Name(commonName: string): string {
  if (commonName.toLowerCase().startsWith("incore sports")) {
    return commonName;
  }
  return `Incore Sports ${commonName}`;
}

function resolveWebsite(product: ProductFormInput): string {
  const fromDescription = product.description.match(/Źródło:\s*(\S+)/)?.[1];
  if (fromDescription?.startsWith("http")) {
    return fromDescription;
  }
  return DEFAULT_WEBSITE;
}

function resolveImageUrl(product: ProductFormInput): string {
  return product.imageUrls.find((url) => url.trim())?.trim() ?? "";
}

function buildGs1VariantValue(_variant?: ProductVariantInput): string {
  // GS1 wymaga min. 2 znaki w polu Wariant — w szablonie referencyjnym pole jest puste;
  // rozmiar jest w Nazwie zwyczajowej.
  return "";
}

export function parseGs1VariantValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const labeled = trimmed.match(/^rozmiar\s+(.+)$/i);
  if (labeled?.[1]) {
    return extractSize(labeled[1]) || labeled[1].toUpperCase();
  }
  if (/^(XS|2XL|3XL|XXL|XL|S|M|L)$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return extractSize(trimmed);
}

export function buildGs1MojeGs1DataRow(
  product: ProductFormInput,
  variant?: ProductVariantInput,
): Array<string | number> {
  const commonName = buildCommonName(product, variant);
  const fullName = buildFullGs1Name(commonName);
  const sku = variant?.sku ?? product.sku;
  const ean = variant?.ean ?? product.ean ?? "";
  const description = product.description.split("\n\n")[0]?.trim() ?? product.shortDescription;

  return [
    PRODUCT_TYPE,
    fullName,
    ean,
    LANGUAGE,
    BRAND,
    "",
    commonName,
    buildGs1VariantValue(variant),
    NET_CONTENT,
    UNIT,
    "",
    "",
    "",
    "",
    GPC_CLASSIFICATION,
    "",
    SALES_COUNTRIES,
    MARKET_STATUS,
    resolveWebsite(product),
    resolveImageUrl(product),
    description,
    sku,
    "",
    "",
  ];
}

export function buildGs1MojeGs1DataRows(products: ProductFormInput[]): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];

  for (const product of products) {
    if (product.variants.length === 0) {
      rows.push(buildGs1MojeGs1DataRow(product));
      continue;
    }
    for (const variant of product.variants) {
      rows.push(buildGs1MojeGs1DataRow(product, variant));
    }
  }

  return rows;
}

function writeGs1SheetWithDataRows(
  workbook: XLSX.WorkBook,
  headerRows: Array<Array<string | number>>,
  dataRows: Array<Array<string | number>>,
): Buffer {
  const newSheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

  const gtinColumn = 2;
  const skuColumn = 21;
  for (let row = GS1_DATA_START_ROW; row < headerRows.length + dataRows.length; row += 1) {
    const dataIndex = row - GS1_DATA_START_ROW;
    const gtin = String(dataRows[dataIndex]?.[gtinColumn] ?? "");
    const sku = String(dataRows[dataIndex]?.[skuColumn] ?? "");
    if (gtin) {
      writeStringCell(newSheet, row, gtinColumn, gtin);
    }
    if (sku) {
      writeStringCell(newSheet, row, skuColumn, sku);
    }
  }

  workbook.Sheets[GS1_MOJE_GS1_SHEET] = newSheet;
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export function exportProductsToGs1Xlsx(products: ProductFormInput[]): Buffer {
  const templatePath = getGs1ImportTemplatePath();
  const workbook = XLSX.read(readFileSync(templatePath), { type: "buffer" });
  const sheet = workbook.Sheets[GS1_MOJE_GS1_SHEET];

  if (!sheet) {
    throw new Error(`Brak arkusza ${GS1_MOJE_GS1_SHEET} w szablonie GS1.`);
  }

  const existing = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });
  const headerRows = existing.slice(0, GS1_DATA_START_ROW);
  const dataRows = buildGs1MojeGs1DataRows(products);
  return writeGs1SheetWithDataRows(workbook, headerRows, dataRows);
}

/** Dopisuje wiersze produktów do istniejącego katalogu MojeGS1 (bez kasowania EYR itd.). */
export function appendProductsToGs1Xlsx(products: ProductFormInput[]): Buffer {
  const templatePath = getGs1ImportTemplatePath();
  const workbook = XLSX.read(readFileSync(templatePath), { type: "buffer" });
  const sheet = workbook.Sheets[GS1_MOJE_GS1_SHEET];

  if (!sheet) {
    throw new Error(`Brak arkusza ${GS1_MOJE_GS1_SHEET} w szablonie GS1.`);
  }

  const existing = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });
  const headerRows = existing.slice(0, GS1_DATA_START_ROW);
  const existingData = existing
    .slice(GS1_DATA_START_ROW)
    .filter((row) => String(row[2] ?? "").trim() || String(row[1] ?? "").trim());
  const dataRows = [...existingData, ...buildGs1MojeGs1DataRows(products)];
  return writeGs1SheetWithDataRows(workbook, headerRows, dataRows);
}

export function normalizeGtin(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  return String(value).replace(/\s/g, "").replace(/\.0+$/, "");
}

function writeStringCell(sheet: XLSX.WorkSheet, row: number, col: number, value: string) {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  sheet[ref] = { t: "s", v: value };
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " "),
  );

  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.toLowerCase());
    if (index >= 0) {
      return index;
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const header = normalized[index] ?? "";
    if (candidates.some((candidate) => header.includes(candidate.toLowerCase()))) {
      return index;
    }
  }

  return -1;
}

export function parseGs1MojeGs1Xlsx(buffer: Buffer): EanImportResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[GS1_MOJE_GS1_SHEET];

  if (!sheet) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Brak arkusza ${GS1_MOJE_GS1_SHEET} w pliku XLSX.` }],
    };
  }

  const table = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (table.length < GS1_DATA_START_ROW + 1) {
    return { rows: [], errors: [{ row: 0, message: "Plik GS1 nie zawiera wierszy danych." }] };
  }

  const headerRow = table[1]?.map((cell) => String(cell).trim()) ?? [];
  const variantIndex = findHeaderIndex(headerRow, ["wariant"]);
  const gtinIndex = findHeaderIndex(headerRow, ["gtin"]);
  const skuIndex = findHeaderIndex(headerRow, ["symbol wewnętrzny"]);
  const commonNameIndex = findHeaderIndex(headerRow, ["nazwa zwyczajowa"]);
  const fullNameIndex = findHeaderIndex(headerRow, [
    "pełna, ustandaryzowana nazwa produktu.",
    "pełna, ustandaryzowana nazwa produktu",
  ]);

  if (gtinIndex < 0) {
    return {
      rows: [],
      errors: [{ row: 2, message: "Nie znaleziono kolumny GTIN w szablonie MojeGS1." }],
    };
  }

  const rows: EanAssignmentRow[] = [];
  const errors: EanImportResult["errors"] = [];

  table.slice(GS1_DATA_START_ROW).forEach((cells, offset) => {
    const rowNumber = offset + GS1_DATA_START_ROW + 1;
    const get = (index: number) => (index < 0 ? "" : String(cells[index] ?? "").trim());
    const ean = normalizeGtin(cells[gtinIndex]);
    const sku = get(skuIndex);
    const gs1Name = get(commonNameIndex) || get(fullNameIndex);
    const explicitSize = parseGs1VariantValue(get(variantIndex));
    const size = explicitSize || extractSize(gs1Name);

    if (!sku && !ean) {
      return;
    }

    if (!sku) {
      errors.push({
        row: rowNumber,
        message: "Brak Symbolu wewnętrznego (SKU) — wiersz pominięty.",
      });
      return;
    }

    if (!ean) {
      errors.push({
        row: rowNumber,
        message: "Brak GTIN — wiersz pominięty (pole wymagane w imporcie GS1).",
      });
      return;
    }

    if (!/^\d{8,14}$/.test(ean)) {
      errors.push({ row: rowNumber, message: `Niepoprawny GTIN: ${ean}` });
      return;
    }

    rows.push({
      rowNumber,
      groupName: "",
      sku,
      size,
      ean,
      gs1Name,
    });
  });

  return { rows, errors };
}
