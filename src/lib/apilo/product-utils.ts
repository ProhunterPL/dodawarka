import type { ProductFormInput } from "@/lib/product/types";

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

  if (!Number.isFinite(value)) {
    throw new Error(`Niepoprawna stawka VAT: ${tax}`);
  }

  return value;
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
