import {
  APILO_PRODUCENT_ATTRIBUTE_ID,
  DEFAULT_BRAND,
} from "@/lib/product/metadata-fix";

/** Kolejność atrybutów w PUT /rest/api/warehouse/product/ (wg ID typów w Apilo). */
export const APILO_PUT_ATTRIBUTE_TYPE_IDS = [1, 4, 10, 13] as const;

export const APILO_DEFAULT_DELIVERY_DAYS = "3";

export interface ApiloProductAttributeRow {
  attributeTypeId: number;
  values?: Array<{ value?: string }>;
}

export function buildIndexedApiloAttributesForPut(options: {
  shortDescription?: string;
  description?: string;
  deliveryDays?: string;
  producer?: string;
  existing?: ApiloProductAttributeRow[];
}): string[] {
  const existingById = new Map(
    (options.existing ?? []).map((row) => [
      row.attributeTypeId,
      row.values?.[0]?.value ?? "",
    ]),
  );

  const byId: Record<number, string> = {
    1: options.shortDescription ?? existingById.get(1) ?? "",
    4: options.description ?? existingById.get(4) ?? "",
    10:
      options.deliveryDays ??
      existingById.get(10) ??
      APILO_DEFAULT_DELIVERY_DAYS,
    [Number(APILO_PRODUCENT_ATTRIBUTE_ID)]:
      options.producer ??
      existingById.get(Number(APILO_PRODUCENT_ATTRIBUTE_ID)) ??
      DEFAULT_BRAND,
  };

  return APILO_PUT_ATTRIBUTE_TYPE_IDS.map((id) => byId[id] ?? "");
}

/** Podgląd: mapa ID → wartość (czytelniejsze w UI). */
export function indexedAttributesToRecord(
  values: string[],
): Record<string, string> {
  const record: Record<string, string> = {};
  APILO_PUT_ATTRIBUTE_TYPE_IDS.forEach((id, index) => {
    const value = values[index]?.trim();
    if (value) {
      record[String(id)] = value;
    }
  });
  return record;
}
