import { readFileSync, readdirSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { ProductFormInput } from "@/lib/product/types";

interface Gs1Entry {
  ean: string;
  name: string;
  normalizedName: string;
  size: string | null;
  sku: string;
}

import type { Gs1CatalogEntry } from "./types";

const SIZE_PATTERN = /\b(XS|S|M|L|XL|2XL|3XL)\b/i;
const STOPWORDS = new Set([
  "koszulka",
  "koszulki",
  "t",
  "shirt",
  "tshirt",
  "bawełniana",
  "bawelniana",
  "incore",
  "sports",
  "czarny",
  "czarna",
  "męska",
  "meska",
  "męski",
  "meski",
]);

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractSize(text: string): string | null {
  const match = normalizeText(text).toUpperCase().match(SIZE_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

function getRelevantWords(text: string): string[] {
  return [...new Set(
    normalizeText(text)
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  )];
}

function scoreEntry(entry: Gs1Entry, words: string[]): number {
  if (words.length === 0) return 0;
  let score = 0;
  for (const word of words) {
    if (entry.normalizedName.includes(word)) {
      score += 1;
    }
  }
  if (score === words.length) {
    score += 3;
  }
  return score;
}

export function findGs1Workbook(): string {
  const files = listGs1Workbooks();
  if (files.length === 0) {
    throw new Error("Brak pliku XLSX w katalogu kody_ean.");
  }
  return path.join(process.cwd(), "kody_ean", files[0]);
}

export function listGs1Workbooks(): string[] {
  const dir = path.join(process.cwd(), "kody_ean");
  return readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".xlsx"))
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));
}

export function resolveGs1Workbook(filename?: string): string {
  if (!filename) {
    return findGs1Workbook();
  }
  const files = new Set(listGs1Workbooks());
  if (!files.has(filename)) {
    throw new Error(`Nie znaleziono pliku GS1: ${filename}`);
  }
  return path.join(process.cwd(), "kody_ean", filename);
}

export function readGs1Entries(filePath: string): Gs1Entry[] {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const header = rows[1]?.map((cell) => String(cell).trim()) ?? [];
  const gtinIndex = header.indexOf("GTIN");
  const nameIndex = header.indexOf("Pełna, ustandaryzowana nazwa produktu.");
  const skuIndex = header.indexOf("Symbol wewnętrzny");
  if (gtinIndex < 0 || nameIndex < 0) {
    throw new Error("Nie znaleziono kolumn GTIN/Nazwa w pliku GS1.");
  }

  return rows
    .slice(2)
    .map((row) => {
      const ean = String(row[gtinIndex] ?? "").trim();
      const name = String(row[nameIndex] ?? "").trim();
      return {
        ean,
        name,
        normalizedName: normalizeText(name),
        size: extractSize(name),
        sku: skuIndex >= 0 ? String(row[skuIndex] ?? "").trim() : "",
      };
    })
    .filter((entry) => /^\d{8,14}$/.test(entry.ean) && entry.name.length > 0);
}

export function listGs1CatalogEntries(filename?: string): Gs1CatalogEntry[] {
  const workbookPath = resolveGs1Workbook(filename);
  return readGs1Entries(workbookPath).map((entry) => ({
    ean: entry.ean,
    name: entry.name,
    size: entry.size,
  }));
}

export function matchEansForProduct(
  product: ProductFormInput,
  entries: Gs1Entry[],
): {
  mainEan: string | null;
  variantEans: Record<string, string>;
  matchedRows: Array<{ size: string | null; ean: string; name: string }>;
} {
  const words = getRelevantWords(`${product.groupName} ${product.name}`);
  const sorted = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const variantEans: Record<string, string> = {};
  const matchedRows: Array<{ size: string | null; ean: string; name: string }> = [];

  for (const variant of product.variants) {
    const wantedSize = variant.size.toUpperCase();
    const bySku = sorted.find(
      (item) =>
        item.entry.sku &&
        item.entry.sku.toUpperCase() === variant.sku.toUpperCase() &&
        !Object.values(variantEans).includes(item.entry.ean),
    );
    const match =
      bySku ??
      sorted.find(
        (item) => item.entry.size === wantedSize && !Object.values(variantEans).includes(item.entry.ean),
      );
    if (match) {
      variantEans[wantedSize] = match.entry.ean;
      matchedRows.push({
        size: wantedSize,
        ean: match.entry.ean,
        name: match.entry.name,
      });
    }
  }

  const mainCandidate =
    sorted.find((item) => item.entry.size === "S")?.entry ??
    sorted[0]?.entry ??
    null;

  return {
    mainEan: mainCandidate?.ean ?? null,
    variantEans,
    matchedRows,
  };
}
