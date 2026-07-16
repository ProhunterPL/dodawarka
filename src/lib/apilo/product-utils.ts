import type { ProductFormInput } from "@/lib/product/types";

export const APILO_NAME_MAX = 120;

export function truncateApiloProductName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= APILO_NAME_MAX) {
    return trimmed;
  }
  return trimmed.slice(0, APILO_NAME_MAX).trim();
}

export function isRepeatedApiloProductName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 40) {
    return false;
  }

  const third = Math.floor(trimmed.length / 3);
  if (third >= 20) {
    const partA = trimmed.slice(0, third);
    const partB = trimmed.slice(third, third * 2);
    const partC = trimmed.slice(third * 2);
    if (partA === partB && partB === partC) {
      return true;
    }
  }

  for (let partLength = 20; partLength <= trimmed.length / 2; partLength++) {
    const part = trimmed.slice(0, partLength);
    if (part.length < 20) {
      continue;
    }
    const repeats = Math.round(trimmed.length / part.length);
    if (repeats >= 2 && part.repeat(repeats).startsWith(trimmed)) {
      return true;
    }
  }

  return false;
}

/** Apilo psuje nazwę przy PUT z groupName — dla metadanych nie wysyłamy groupName. */
export function resolveApiloProductNameForPut(
  existingName: string | undefined,
  preferredName: string,
): string {
  const existing = existingName?.trim() ?? "";
  const preferred = preferredName.trim();

  const preferredSafe =
    preferred.length > 0
      ? preferred.length <= APILO_NAME_MAX
        ? preferred
        : preferred.slice(0, APILO_NAME_MAX).trim()
      : "";

  if (
    preferredSafe &&
    (existing.length > APILO_NAME_MAX ||
      isRepeatedApiloProductName(existing) ||
      (existing.length > preferredSafe.length * 1.4 &&
        existing.includes(preferredSafe)))
  ) {
    return preferredSafe;
  }

  if (existing.length > 0 && existing.length <= APILO_NAME_MAX) {
    return existing;
  }

  if (preferredSafe) {
    return preferredSafe;
  }

  return existing.slice(0, APILO_NAME_MAX).trim();
}

export function collectProductSkus(input: ProductFormInput): string[] {
  if (input.variants.length > 0) {
    return input.variants.map((variant) => variant.sku.trim()).filter(Boolean);
  }

  return input.sku.trim() ? [input.sku.trim()] : [];
}

export function findDuplicateSkus(skus: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const sku of skus) {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      duplicates.add(sku.trim());
    }
    seen.add(normalized);
  }

  return [...duplicates];
}

export function formatSkuList(input: ProductFormInput): string {
  const skus = collectProductSkus(input);
  return skus.length > 0 ? skus.join(", ") : "unknown";
}

export function parseApiloTax(tax: string): number {
  const normalized = tax.replace(",", ".").trim();
  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Niepoprawna stawka VAT: ${tax}`);
  }

  return Math.round(value);
}

export function extractApiloProductIds(
  products: unknown,
): number[] {
  return Object.values(extractApiloProductsBySku(products));
}

export function extractApiloProductsBySku(products: unknown): Record<string, number> {
  if (!products) {
    return {};
  }

  if (Array.isArray(products)) {
    const map: Record<string, number> = {};
    const ids: number[] = [];
    for (const product of products) {
      if (typeof product === "number") {
        ids.push(product);
        continue;
      }
      if (
        typeof product === "object" &&
        product !== null &&
        "id" in product &&
        typeof product.id === "number"
      ) {
        if (
          "sku" in product &&
          typeof product.sku === "string" &&
          product.sku.trim()
        ) {
          map[product.sku] = product.id;
        } else {
          ids.push(product.id);
        }
      }
    }
    if (Object.keys(map).length > 0) {
      return map;
    }
    return Object.fromEntries(ids.map((id, index) => [String(index), id]));
  }

  if (typeof products === "object") {
    const map: Record<string, number> = {};
    for (const [sku, id] of Object.entries(products as Record<string, unknown>)) {
      if (typeof id === "number") {
        map[sku] = id;
      }
    }
    return map;
  }

  return {};
}

export function buildVariantApiloIds(
  variantSkus: string[] | undefined,
  apiloProductIds: number[] | undefined,
  productsResponse?: unknown,
): Record<string, number> {
  const fromResponse = extractApiloProductsBySku(productsResponse);
  if (Object.keys(fromResponse).length > 0) {
    return fromResponse;
  }

  const map: Record<string, number> = {};
  if (variantSkus?.length && apiloProductIds?.length) {
    variantSkus.forEach((sku, index) => {
      const id = apiloProductIds[index];
      const normalized = sku.trim();
      if (normalized && typeof id === "number") {
        map[normalized] = id;
      }
    });
  }

  return map;
}

export function formatApiloErrorDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const record = details as {
    message?: string;
    description?: string;
    errors?: Array<{
      message?: string;
      description?: string;
      field?: string;
    }>;
  };

  const parts: string[] = [];

  if (record.message) {
    parts.push(record.message);
  }

  if (record.description) {
    parts.push(record.description);
  }

  for (const error of record.errors ?? []) {
    const line = [error.field, error.message, error.description]
      .filter(Boolean)
      .join(" — ");
    if (line) {
      parts.push(line);
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
