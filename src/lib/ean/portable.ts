import type { ProductFormInput } from "@/lib/product/types";
import { parseCsvRows } from "@/lib/batch/csv";
import { parseGs1MojeGs1Xlsx, exportProductsToGs1Xlsx } from "./gs1-template";
import { allocateGtinsForProducts, type AllocateGtinsResult } from "./pool";
import type { Gs1CatalogEntry } from "./types";
import {
  GS1_EXPORT_HEADERS,
  type EanAssignmentRow,
  type EanImportResult,
  type EanTemplateRow,
} from "./types";

export { exportProductsToGs1Xlsx } from "./gs1-template";
export { allocateGtinsForProducts, type AllocateGtinsResult } from "./pool";

export function exportProductsToGs1XlsxWithPool(
  products: ProductFormInput[],
): { buffer: Buffer; allocation: AllocateGtinsResult } {
  const allocation = allocateGtinsForProducts(products);
  const buffer = exportProductsToGs1Xlsx(allocation.products);
  return { buffer, allocation };
}

function escapeCsvCell(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(headers: readonly string[], rows: string[][]): string {
  const lines = [
    headers.join(";"),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function exportGs1CatalogToCsv(entries: Gs1CatalogEntry[]): string {
  const rows = entries.map((entry) => [entry.ean, entry.name, entry.size ?? ""]);
  return buildCsv(GS1_EXPORT_HEADERS, rows);
}

export function buildProductEanTemplateRows(products: ProductFormInput[]): EanTemplateRow[] {
  const rows: EanTemplateRow[] = [];

  for (const product of products) {
    const sourceUrl =
      product.channelMetadata?.shoper?.notes?.match(/https?:\/\/\S+/)?.[0] ??
      product.description.match(/Źródło:\s*(\S+)/)?.[1] ??
      "";

    if (product.variants.length === 0) {
      rows.push({
        groupName: product.groupName,
        name: product.name,
        sku: product.sku,
        size: "",
        ean: product.ean,
        gs1Name: "",
        sourceUrl,
      });
      continue;
    }

    for (const variant of product.variants) {
      rows.push({
        groupName: product.groupName,
        name: product.name,
        sku: variant.sku,
        size: variant.size,
        ean: variant.ean ?? "",
        gs1Name: "",
        sourceUrl,
      });
    }
  }

  return rows;
}

export function exportProductEanTemplateToCsv(products: ProductFormInput[]): string {
  void products;
  throw new Error("Użyj exportProductsToGs1Xlsx — eksport jest w formacie MojeGS1 (XLSX).");
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

const EAN_HEADER_ALIASES: Record<string, keyof EanAssignmentRow | "ignore"> = {
  groupname: "groupName",
  nazwagruby: "groupName",
  nazwa: "groupName",
  symbolwewnetrzny: "sku",
  sku: "sku",
  rozmiar: "size",
  size: "size",
  ean: "ean",
  gtin: "ean",
  gs1name: "gs1Name",
  nazwags1: "gs1Name",
  pelnanazwa: "gs1Name",
};

export function parseEanAssignmentCsv(content: string): EanImportResult {
  const table = parseCsvRows(content);
  const errors: EanImportResult["errors"] = [];

  if (table.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "Plik CSV jest pusty." }] };
  }

  const header = table[0] ?? [];
  const columnMap = new Map<keyof EanAssignmentRow, number>();

  header.forEach((cell, index) => {
    const alias = EAN_HEADER_ALIASES[normalizeHeader(cell)];
    if (alias && alias !== "ignore") {
      columnMap.set(alias, index);
    }
  });

  if (!columnMap.has("sku") && !columnMap.has("ean")) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: "Brak kolumn sku lub ean/gtin. Oczekiwane nagłówki: sku, size, ean.",
        },
      ],
    };
  }

  const rows: EanAssignmentRow[] = [];

  table.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const get = (key: keyof EanAssignmentRow) => {
      const index = columnMap.get(key);
      return index === undefined ? "" : String(cells[index] ?? "").trim();
    };

    const sku = get("sku");
    const ean = get("ean").replace(/\s/g, "");
    const size = get("size");
    const groupName = get("groupName");
    const gs1Name = get("gs1Name");

    if (!sku && !ean) {
      return;
    }

    if (!sku) {
      errors.push({ row: rowNumber, message: "Brak SKU — wiersz pominięty." });
      return;
    }

    if (ean && !/^\d{8,14}$/.test(ean)) {
      errors.push({ row: rowNumber, message: `Niepoprawny EAN: ${ean}` });
      return;
    }

    rows.push({
      rowNumber,
      groupName,
      sku,
      size,
      ean,
      gs1Name,
    });
  });

  return { rows, errors };
}

export function applyEanAssignmentsToProduct(
  product: ProductFormInput,
  assignments: EanAssignmentRow[],
): ProductFormInput {
  const bySku = new Map(
    assignments
      .filter((row) => row.ean)
      .map((row) => [row.sku.toUpperCase(), row] as const),
  );

  if (bySku.size === 0) {
    return product;
  }

  const updatedVariants = product.variants.map((variant) => {
    const match = bySku.get(variant.sku.toUpperCase());
    if (!match) {
      return variant;
    }
    if (match.size && match.size.toUpperCase() !== variant.size.toUpperCase()) {
      return variant;
    }
    return { ...variant, ean: match.ean };
  });

  const mainSku = product.sku.toUpperCase();
  const mainMatch = bySku.get(mainSku);
  const variantSMatch = updatedVariants.find((variant) => variant.size.toUpperCase() === "S");
  const mainEan =
    mainMatch?.ean ??
    variantSMatch?.ean ??
    updatedVariants.find((variant) => variant.ean)?.ean ??
    product.ean;

  return {
    ...product,
    ean: mainEan,
    variants: updatedVariants,
  };
}

export function parseEanAssignmentInput(
  input: { csv?: string; xlsxBase64?: string },
): EanImportResult {
  if (input.xlsxBase64?.trim()) {
    return parseGs1MojeGs1Xlsx(Buffer.from(input.xlsxBase64, "base64"));
  }
  if (input.csv?.trim()) {
    return parseEanAssignmentCsv(input.csv);
  }
  return { rows: [], errors: [{ row: 0, message: "Brak pliku CSV lub XLSX." }] };
}

export function applyEanImportToProducts(
  products: ProductFormInput[],
  input: { csv?: string; xlsxBase64?: string },
): { products: ProductFormInput[]; importResult: EanImportResult } {
  const importResult = parseEanAssignmentInput(input);
  const updated = products.map((product) =>
    applyEanAssignmentsToProduct(product, importResult.rows),
  );
  return { products: updated, importResult };
}

export function applyEanCsvToProducts(
  products: ProductFormInput[],
  csv: string,
): { products: ProductFormInput[]; importResult: EanImportResult } {
  return applyEanImportToProducts(products, { csv });
}

export function countAppliedEans(
  before: ProductFormInput[],
  after: ProductFormInput[],
): number {
  let count = 0;

  for (let index = 0; index < after.length; index += 1) {
    const prev = before[index];
    const next = after[index];
    if (!prev || !next) {
      continue;
    }

    if (!prev.ean && next.ean) {
      count += 1;
    }

    for (const variant of next.variants) {
      const prevVariant = prev.variants.find((item) => item.sku === variant.sku);
      if (prevVariant && !prevVariant.ean && variant.ean) {
        count += 1;
      }
    }
  }

  return count;
}
