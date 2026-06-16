import { buildVariantApiloIds } from "@/lib/apilo/product-utils";
import type { LocalProductRecord, ProductFormInput } from "./types";
import { TEST_PRODUCT } from "./test-product";

const SIZE_FROM_SKU = /-(XS|2XL|3XL|S|M|L|XL)$/i;

function sizeFromSku(sku: string): string {
  const match = sku.match(SIZE_FROM_SKU);
  return match?.[1]?.toUpperCase() ?? sku;
}

export function resolveApiloIdsBySku(record: LocalProductRecord): Record<string, number> {
  if (record.variantApiloIds && Object.keys(record.variantApiloIds).length > 0) {
    return record.variantApiloIds;
  }

  return buildVariantApiloIds(record.variantSkus, record.apiloProductIds);
}

export function buildProductFormFromRecord(record: LocalProductRecord): ProductFormInput {
  const apiloIdsBySku = resolveApiloIdsBySku(record);

  if (record.formSnapshot) {
    return {
      ...record.formSnapshot,
      apiloIdsBySku,
    };
  }

  const variants =
    record.variantSkus?.map((sku) => ({
      size: sizeFromSku(sku),
      sku,
      quantity: 10,
      ean: undefined,
    })) ?? TEST_PRODUCT.variants;

  return {
    ...TEST_PRODUCT,
    groupName: record.groupName,
    name: record.groupName,
    sku: record.variantSkus?.[0] ?? "",
    variants,
    apiloIdsBySku,
  };
}

export function canUpdateInApilo(record: LocalProductRecord): boolean {
  const ids = resolveApiloIdsBySku(record);
  return Object.keys(ids).length > 0;
}
