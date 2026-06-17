import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { ProductFormInput, ProductVariantInput } from "@/lib/product/types";
import { GS1_MOJE_GS1_SHEET, normalizeGtin } from "./gs1-template";
import { listGs1Workbooks } from "./gs1";

const GTIN_PATTERN = /^\d{13}$/;

export interface AllocateGtinsResult {
  products: ProductFormInput[];
  assignedCount: number;
  nextGtin: string | null;
}

export interface AllocateGtinsOptions {
  /** Dodatkowe już zajęte GTIN-y (np. z bazy lokalnej). */
  extraUsedGtins?: Iterable<string>;
  /** Wymuś następny numer (12 cyfr bez sumy kontrolnej). */
  nextBase12?: string;
}

function ean13CheckDigit(base12: string): string {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error(`Niepoprawna baza EAN-13 (12 cyfr): ${base12}`);
  }
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(base12[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function buildEan13FromBase12(base12: string): string {
  return `${base12}${ean13CheckDigit(base12)}`;
}

export function ean13Base12(ean: string): string | null {
  const normalized = normalizeGtin(ean);
  if (!GTIN_PATTERN.test(normalized)) {
    return null;
  }
  return normalized.slice(0, 12);
}

function collectGtinsFromProducts(products: ProductFormInput[]): Set<string> {
  const used = new Set<string>();

  for (const product of products) {
    const main = normalizeGtin(product.ean);
    if (GTIN_PATTERN.test(main)) {
      used.add(main);
    }
    for (const variant of product.variants) {
      const variantEan = normalizeGtin(variant.ean);
      if (GTIN_PATTERN.test(variantEan)) {
        used.add(variantEan);
      }
    }
  }

  return used;
}

export function readUsedGtinsFromPoolFiles(): Set<string> {
  const used = new Set<string>();

  for (const filename of listGs1Workbooks()) {
    const filePath = path.join(process.cwd(), "kody_ean", filename);
    const buffer = readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[GS1_MOJE_GS1_SHEET];
    if (!sheet) {
      continue;
    }

    const table = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: "",
    });
    const headerRow = table[1]?.map((cell) => String(cell).trim()) ?? [];
    const gtinIndex = headerRow.findIndex((header) => header.toLowerCase() === "gtin");
    if (gtinIndex < 0) {
      continue;
    }

    for (const row of table.slice(2)) {
      const gtin = normalizeGtin(row[gtinIndex]);
      if (GTIN_PATTERN.test(gtin)) {
        used.add(gtin);
      }
    }
  }

  return used;
}

function maxBase12FromUsed(used: Set<string>): string | null {
  let max: bigint | null = null;

  for (const gtin of used) {
    const base12 = ean13Base12(gtin);
    if (!base12) {
      continue;
    }
    const value = BigInt(base12);
    if (max === null || value > max) {
      max = value;
    }
  }

  return max === null ? null : max.toString().padStart(12, "0");
}

function nextBase12After(base12: string): string {
  const next = (BigInt(base12) + BigInt(1)).toString();
  if (next.length > 12) {
    throw new Error("Wyczerpano pulę numerów EAN-13 w zakresie 12-cyfrowym.");
  }
  return next.padStart(12, "0");
}

function createGtinAllocator(used: Set<string>, forcedNextBase12?: string) {
  let cursor =
    forcedNextBase12 ??
    (() => {
      const maxUsed = maxBase12FromUsed(used);
      return maxUsed ? nextBase12After(maxUsed) : null;
    })();

  if (!cursor) {
    const fromEnv = process.env.EAN_POOL_START?.trim();
    const envBase = fromEnv ? ean13Base12(fromEnv) : null;
    if (!envBase) {
      throw new Error(
        "Brak numerów w puli EAN. Uzupełnij plik w kody_ean/ lub ustaw EAN_POOL_START w .env.",
      );
    }
    cursor = envBase;
  }

  return function takeNextGtin(): string {
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      const gtin = buildEan13FromBase12(cursor!);
      cursor = nextBase12After(cursor!);
      if (!used.has(gtin)) {
        used.add(gtin);
        return gtin;
      }
    }
    throw new Error("Nie udało się znaleźć wolnego numeru GTIN w puli.");
  };
}

function assignVariantEan(
  variant: ProductVariantInput,
  takeNextGtin: () => string,
): { variant: ProductVariantInput; assigned: boolean } {
  const existing = normalizeGtin(variant.ean);
  if (GTIN_PATTERN.test(existing)) {
    return { variant, assigned: false };
  }
  return {
    variant: { ...variant, ean: takeNextGtin() },
    assigned: true,
  };
}

export function allocateGtinsForProducts(
  products: ProductFormInput[],
  options: AllocateGtinsOptions = {},
): AllocateGtinsResult {
  const used = readUsedGtinsFromPoolFiles();
  for (const gtin of collectGtinsFromProducts(products)) {
    used.add(gtin);
  }
  if (options.extraUsedGtins) {
    for (const gtin of options.extraUsedGtins) {
      const normalized = normalizeGtin(gtin);
      if (GTIN_PATTERN.test(normalized)) {
        used.add(normalized);
      }
    }
  }

  const takeNextGtin = createGtinAllocator(used, options.nextBase12);
  let assignedCount = 0;

  const updatedProducts = products.map((product) => {
    if (product.variants.length === 0) {
      const existing = normalizeGtin(product.ean);
      if (GTIN_PATTERN.test(existing)) {
        return product;
      }
      assignedCount += 1;
      const ean = takeNextGtin();
      return { ...product, ean };
    }

    const updatedVariants = product.variants.map((variant) => {
      const result = assignVariantEan(variant, takeNextGtin);
      if (result.assigned) {
        assignedCount += 1;
      }
      return result.variant;
    });

    const mainSku = product.sku.toUpperCase();
    const bySku = updatedVariants.find((variant) => variant.sku.toUpperCase() === mainSku);
    const sizeS = updatedVariants.find((variant) => variant.size.toUpperCase() === "S");
    const mainEan =
      normalizeGtin(bySku?.ean) ||
      normalizeGtin(sizeS?.ean) ||
      normalizeGtin(updatedVariants.find((variant) => variant.ean)?.ean) ||
      normalizeGtin(product.ean);

    return {
      ...product,
      ean: GTIN_PATTERN.test(mainEan) ? mainEan : product.ean,
      variants: updatedVariants,
    };
  });

  const nextBase = maxBase12FromUsed(used);
  const nextGtin = nextBase ? buildEan13FromBase12(nextBase12After(nextBase)) : null;

  return {
    products: updatedProducts,
    assignedCount,
    nextGtin,
  };
}
