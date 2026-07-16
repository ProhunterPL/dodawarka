import type { ApiloWarehouseProductAttribute } from "./types";
import {
  APILO_PRODUCENT_ATTRIBUTE_ID,
  DEFAULT_BRAND,
} from "@/lib/product/metadata-fix";
import { APILO_DEFAULT_DELIVERY_DAYS } from "./put-attributes";

/** Typ wartości atrybutu tekstowego (Producent, Czas dostawy) w PATCH product/attributes. */
export const APILO_TEXT_ATTRIBUTE_VALUE_TYPE = 1 as const;

export interface ApiloProductAttributePatchItem {
  /** Przy tworzeniu: ID definicji atrybutu (np. 13). Przy aktualizacji: ID instancji na produkcie. */
  id: number;
  productId: number;
  type: typeof APILO_TEXT_ATTRIBUTE_VALUE_TYPE;
  values: Array<{ value: string }>;
}

export interface MetadataTextAttributeSpec {
  definitionId: number;
  value: string;
}

export const METADATA_TEXT_ATTRIBUTE_SPECS: MetadataTextAttributeSpec[] = [
  { definitionId: 10, value: APILO_DEFAULT_DELIVERY_DAYS },
  {
    definitionId: Number(APILO_PRODUCENT_ATTRIBUTE_ID),
    value: DEFAULT_BRAND,
  },
];

export function buildTextAttributePatchItem(
  productId: number,
  definitionId: number,
  value: string,
  existing?: ApiloWarehouseProductAttribute,
): ApiloProductAttributePatchItem | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const current = existing?.values?.[0]?.value?.trim() ?? "";
  if (current === trimmed) {
    return null;
  }

  return {
    id: existing?.id ?? definitionId,
    productId,
    type: APILO_TEXT_ATTRIBUTE_VALUE_TYPE,
    values: [{ value: trimmed }],
  };
}

export function buildMetadataTextAttributePatches(
  productId: number,
  existingAttributes: ApiloWarehouseProductAttribute[],
  specs: MetadataTextAttributeSpec[] = METADATA_TEXT_ATTRIBUTE_SPECS,
): ApiloProductAttributePatchItem[] {
  const patches: ApiloProductAttributePatchItem[] = [];

  for (const spec of specs) {
    const existing = existingAttributes.find(
      (row) => row.attributeTypeId === spec.definitionId,
    );
    const patch = buildTextAttributePatchItem(
      productId,
      spec.definitionId,
      spec.value,
      existing,
    );
    if (patch) {
      patches.push(patch);
    }
  }

  return patches;
}
