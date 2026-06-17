import type { ProductFormInput } from "./types";

export const DEFAULT_BRAND = "Incore Sports";
export const DEFAULT_PRODUCT_UNIT = "szt.";
/** ID typu atrybutu „Producent” w Apilo (GET /rest/api/warehouse/attribute/). */
export const APILO_PRODUCENT_ATTRIBUTE_ID = "13";
/** Odzież → Dla niego → Koszulki męskie */
export const MENS_SHIRTS_CATEGORY_IDS = [25, 43, 49] as const;
export const MENS_SHIRTS_CATEGORY_LABEL = "Odzież / Dla niego / Koszulki męskie";

export function buildApiloProducerAttribute(): Record<string, string> {
  return {
    [APILO_PRODUCENT_ATTRIBUTE_ID]: DEFAULT_BRAND,
  };
}

export function normalizeMensShirtsCategoryIds(categoryIds: number[]): number[] {
  if (categoryIds.length === 0) {
    return [...MENS_SHIRTS_CATEGORY_IDS];
  }

  if (categoryIds.includes(49)) {
    return categoryIds;
  }

  if (categoryIds.length === 1 && categoryIds[0] === 25) {
    return [...MENS_SHIRTS_CATEGORY_IDS];
  }

  if (categoryIds.includes(25) && categoryIds.includes(43)) {
    return [...categoryIds, 49];
  }

  return categoryIds;
}

export function applyMetadataFixes(product: ProductFormInput): ProductFormInput {
  const categoryIds = normalizeMensShirtsCategoryIds(product.categoryIds);
  const categoryChanged =
    categoryIds.length !== product.categoryIds.length ||
    categoryIds.some((id, index) => id !== product.categoryIds[index]);

  return {
    ...product,
    unit: DEFAULT_PRODUCT_UNIT,
    categoryIds,
    categoryLabel: categoryChanged
      ? MENS_SHIRTS_CATEGORY_LABEL
      : product.categoryLabel.trim() || MENS_SHIRTS_CATEGORY_LABEL,
  };
}

export function describeMetadataFix(product: ProductFormInput): string[] {
  const fixed = applyMetadataFixes(product);

  return [
    `Jednostka: ${product.unit.trim() || "—"} → ${fixed.unit}`,
    `Kategoria (ID): [${product.categoryIds.join(", ") || "—"}] → [${fixed.categoryIds.join(", ")}]`,
    `Producent (atrybut ${APILO_PRODUCENT_ATTRIBUTE_ID}): ${DEFAULT_BRAND}`,
  ];
}
