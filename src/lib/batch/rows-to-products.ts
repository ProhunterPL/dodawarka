import {
  buildChannelMetadataFromCsvColumns,
  mergeChannelMetadata,
} from "@/lib/product/channel-metadata";
import { SALES_CHANNELS } from "@/lib/product/channels";
import type { ProductFormInput, ProductVariantInput } from "@/lib/product/types";
import { mapCsvHeaders, parseCsvRows } from "./csv";
import type { BatchCsvRow, BatchPreviewResult, CsvParseError } from "./types";
import { BATCH_CSV_COLUMNS } from "./types";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const KNOWN_CHANNEL_IDS = new Set(SALES_CHANNELS.map((channel) => channel.id));

function splitList(value: string, delimiter: RegExp): string[] {
  return value
    .split(delimiter)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseStatus(value: string): "draft" | "active" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active" || normalized === "aktywny" || normalized === "1") {
    return "active";
  }
  return "draft";
}

function parseNumber(value: string, fallback: number): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowFromRecord(
  record: Record<string, string>,
  rowNumber: number,
): { row?: BatchCsvRow; error?: CsvParseError } {
  const groupName = record.groupName?.trim() ?? "";
  const sku = record.sku?.trim() ?? "";

  if (!groupName) {
    return { error: { row: rowNumber, message: "Brak groupName." } };
  }
  if (!sku) {
    return { error: { row: rowNumber, message: "Brak SKU." } };
  }

  const categoryIds = splitList(record.categoryIds ?? "", /[,;]/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (categoryIds.length === 0) {
    return {
      error: {
        row: rowNumber,
        message: "Brak categoryIds (np. 25 lub 25,44).",
      },
    };
  }

  const priceWithTax = record.priceWithTax?.trim() ?? "";
  if (!priceWithTax || Number.isNaN(Number(priceWithTax.replace(",", ".")))) {
    return { error: { row: rowNumber, message: "Niepoprawna cena brutto." } };
  }

  const tax = record.tax?.trim() ?? "";
  if (!tax || Number.isNaN(Number(tax.replace(",", ".")))) {
    return { error: { row: rowNumber, message: "Niepoprawny VAT." } };
  }

  const channels = splitList(record.selectedChannels ?? "", /\|/)
    .filter((channel) => KNOWN_CHANNEL_IDS.has(channel as (typeof SALES_CHANNELS)[number]["id"]));

  const channelMetadata = buildChannelMetadataFromCsvColumns(record);

  return {
    row: {
      rowNumber,
      groupName,
      name: record.name?.trim() || groupName,
      size: record.size?.trim() ?? "",
      sku,
      ean: record.ean?.trim() ?? "",
      priceWithTax,
      tax,
      quantity: parseNumber(record.quantity ?? "", 0),
      weight: parseNumber(record.weight ?? "", 0.1),
      unit: record.unit?.trim() || "szt.",
      description: record.description?.trim() ?? "",
      shortDescription: record.shortDescription?.trim() ?? "",
      categoryIds,
      categoryLabel: record.categoryLabel?.trim() ?? "",
      imageUrls: splitList(record.imageUrls ?? "", /\|/),
      status: parseStatus(record.status ?? "draft"),
      selectedChannels:
        channels.length > 0
          ? channels
          : ["shoper", "allegro", "amazon-pl", "amazon-de"],
      channelMetadata,
    },
  };
}

export function parseBatchCsv(content: string): BatchPreviewResult {
  const table = parseCsvRows(content);
  const parseErrors: CsvParseError[] = [];
  const warnings: string[] = [];

  if (table.length === 0) {
    return {
      products: [],
      rowCount: 0,
      groupCount: 0,
      parseErrors: [{ row: 0, message: "Plik CSV jest pusty." }],
      warnings,
    };
  }

  const headerMapping = mapCsvHeaders(table[0] ?? []);
  const canonicalHeaders = new Set([...headerMapping.values()]);
  const missingHeaders = BATCH_CSV_COLUMNS.filter(
    (column) => !canonicalHeaders.has(column) && ["groupName", "sku", "priceWithTax", "tax", "categoryIds"].includes(column),
  );

  if (!canonicalHeaders.has("groupName") || !canonicalHeaders.has("sku")) {
    return {
      products: [],
      rowCount: 0,
      groupCount: 0,
      parseErrors: [
        {
          row: 1,
          message: `Brak wymaganych kolumn. Wymagane: groupName, sku, priceWithTax, tax, categoryIds. Znalezione: ${[...canonicalHeaders].join(", ")}`,
        },
      ],
      warnings,
    };
  }

  if (missingHeaders.length > 0) {
    warnings.push(`Brak opcjonalnych nagłówków: ${missingHeaders.join(", ")}.`);
  }

  const parsedRows: BatchCsvRow[] = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index] ?? [];
    const record: Record<string, string> = {};

    for (const [cellIndex, canonical] of headerMapping.entries()) {
      record[canonical] = cells[cellIndex]?.trim() ?? "";
    }

    const { row, error } = rowFromRecord(record, index + 1);
    if (error) {
      parseErrors.push(error);
      continue;
    }
    if (row) {
      parsedRows.push(row);
    }
  }

  const groups = new Map<string, BatchCsvRow[]>();
  for (const row of parsedRows) {
    const key = row.groupName.trim();
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const products: ProductFormInput[] = [];

  for (const [groupName, rows] of groups.entries()) {
    const first = rows[0]!;
    const withSize = rows.filter((row) => row.size);
    const duplicateSizes = new Set<string>();
    const duplicateSkus = new Set<string>();

    for (const row of withSize) {
      const sizeKey = row.size.toUpperCase();
      if (duplicateSizes.has(sizeKey)) {
        parseErrors.push({
          row: row.rowNumber,
          message: `Zduplikowany rozmiar ${row.size} w grupie „${groupName}".`,
        });
      }
      duplicateSizes.add(sizeKey);

      const skuKey = row.sku.toUpperCase();
      if (duplicateSkus.has(skuKey)) {
        parseErrors.push({
          row: row.rowNumber,
          message: `Zduplikowany SKU ${row.sku} w pliku.`,
        });
      }
      duplicateSkus.add(skuKey);
    }

    const variants: ProductVariantInput[] = withSize
      .sort((a, b) => {
        const ai = SIZE_ORDER.indexOf(a.size.toUpperCase());
        const bi = SIZE_ORDER.indexOf(b.size.toUpperCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map((row) => ({
        size: row.size.toUpperCase(),
        sku: row.sku,
        quantity: row.quantity,
        ean: row.ean || undefined,
      }));

    const singleRow = withSize.length === 0 ? first : null;
    let channelMetadata = first.channelMetadata ?? {};
    for (const row of rows) {
      channelMetadata = mergeChannelMetadata(channelMetadata, row.channelMetadata);
    }

    products.push({
      groupName,
      name: first.name,
      sku: singleRow?.sku ?? "",
      ean: singleRow?.ean ?? "",
      priceWithTax: first.priceWithTax,
      tax: first.tax,
      quantity: singleRow?.quantity ?? first.quantity,
      weight: first.weight,
      unit: first.unit,
      description: first.description,
      shortDescription: first.shortDescription,
      categoryIds: first.categoryIds,
      categoryLabel: first.categoryLabel,
      imageUrls: first.imageUrls,
      status: first.status,
      variants,
      selectedChannels: first.selectedChannels,
      channelMetadata,
    });
  }

  return {
    products,
    rowCount: parsedRows.length,
    groupCount: products.length,
    parseErrors,
    warnings,
  };
}
