import type { ApiloWarehouseProductPutPayload } from "./types";
import type { ProductFormInput } from "@/lib/product/types";
import {
  applyMetadataFixes,
  DEFAULT_BRAND,
} from "@/lib/product/metadata-fix";
import {
  buildIndexedApiloAttributesForPut,
  indexedAttributesToRecord,
} from "./put-attributes";
import { buildApiloPayload } from "@/lib/product/validation";

export interface ApiloMetadataPreviewItem {
  id: number;
  sku: string;
  jednostka: string;
  kategorie: number[];
  producent: string;
  /** Wartości atrybutów Apilo (indeksy 1, 4, 10, 13). */
  atrybutyApilo: Record<string, string>;
}

export function buildApiloMetadataPreview(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
): ApiloMetadataPreviewItem[] {
  const fixed = applyMetadataFixes(input);
  const formItems = buildApiloPayload(fixed);

  return Object.entries(apiloIdsBySku).map(([sku, id]) => {
    const formItem = formItems.find((item) => item.sku.trim() === sku.trim());
    const attributeValues = buildIndexedApiloAttributesForPut({
      shortDescription: formItem?.shortDescription,
      description: formItem?.description,
    });

    return {
      id,
      sku,
      jednostka: fixed.unit,
      kategorie: [...fixed.categoryIds],
      producent: DEFAULT_BRAND,
      atrybutyApilo: indexedAttributesToRecord(attributeValues),
    };
  });
}

/** Podgląd / dry-run — wymagane pola PUT + metadane. */
export function buildApiloMetadataPutPayload(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
): ApiloWarehouseProductPutPayload[] {
  const fixed = applyMetadataFixes(input);
  const formItems = buildApiloPayload(fixed);
  const bySku = new Map(formItems.map((item) => [item.sku.trim(), item]));
  const result: ApiloWarehouseProductPutPayload[] = [];

  for (const [sku, id] of Object.entries(apiloIdsBySku)) {
    const formItem = bySku.get(sku.trim());
    if (!formItem) {
      continue;
    }

    result.push({
      id,
      sku: formItem.sku,
      name: formItem.name,
      tax: formItem.tax,
      status: formItem.status,
      quantity: formItem.quantity,
      priceWithTax: formItem.priceWithTax,
      originalCode: formItem.originalCode ?? formItem.sku,
      unit: fixed.unit,
      categories: [...fixed.categoryIds],
      attributes: buildIndexedApiloAttributesForPut({
        shortDescription: formItem.shortDescription,
        description: formItem.description,
      }),
      weight: formItem.weight,
      ean: formItem.ean,
    });
  }

  return result;
}
