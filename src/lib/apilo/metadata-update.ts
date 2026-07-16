import {
  getWarehouseProduct,
  getWarehouseProductAttributes,
  getWarehouseProductMedia,
  patchWarehouseProductAttributes,
  updateWarehouseProducts,
} from "./client";
import { buildApiloMetadataPutPayload } from "./metadata-payload";
import {
  buildMetadataTextAttributePatches,
  type ApiloProductAttributePatchItem,
} from "./patch-product-attributes";
import { mediaToPutImages } from "./product-media";
import { parseApiloTax, truncateApiloProductName } from "./product-utils";
import type {
  ApiloWarehouseProductDetail,
  ApiloWarehouseProductMedia,
  ApiloWarehouseProductPutPayload,
} from "./types";
import type { ProductFormInput } from "@/lib/product/types";
import {
  applyMetadataFixes,
  DEFAULT_PRODUCT_UNIT,
} from "@/lib/product/metadata-fix";
import { buildApiloPayload } from "@/lib/product/validation";
import { buildIndexedApiloAttributesForPut } from "./put-attributes";

function mapStatus(value: number): 0 | 1 {
  return value === 1 ? 1 : 0;
}

function mergeMetadataPutItem(
  apiloId: number,
  existing: ApiloWarehouseProductDetail,
  formItem: ReturnType<typeof buildApiloPayload>[number],
  fixed: ProductFormInput,
  existingAttributes: Awaited<ReturnType<typeof getWarehouseProductAttributes>>,
  existingMedia: ApiloWarehouseProductMedia[],
): ApiloWarehouseProductPutPayload {
  const images =
    mediaToPutImages(existingMedia) ?? formItem.images;

  return {
    id: apiloId,
    sku: existing.sku,
    name: truncateApiloProductName(formItem.name),
    tax: parseApiloTax(String(existing.tax)),
    status: mapStatus(existing.status),
    quantity: existing.quantity,
    priceWithTax: String(existing.priceWithTax),
    originalCode: existing.originalCode ?? existing.sku,
    unit: fixed.unit.trim() || DEFAULT_PRODUCT_UNIT,
    categories: [...fixed.categoryIds],
    attributes: buildIndexedApiloAttributesForPut({
      shortDescription: formItem.shortDescription,
      description: formItem.description,
      existing: existingAttributes,
    }),
    weight: existing.weight ?? formItem.weight,
    ean: existing.ean ?? formItem.ean,
    images,
  };
}

/** Pobierz stan z Apilo i nadpisz tylko metadane (jednostka, kategorie, producent). */
export async function buildApiloMetadataPutPayloadMerged(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
): Promise<ApiloWarehouseProductPutPayload[]> {
  const fixed = applyMetadataFixes(input);
  const formItems = buildApiloPayload(fixed);
  const bySku = new Map(formItems.map((item) => [item.sku.trim(), item]));
  const result: ApiloWarehouseProductPutPayload[] = [];

  for (const [sku, id] of Object.entries(apiloIdsBySku)) {
    const formItem = bySku.get(sku.trim());
    if (!formItem) {
      continue;
    }

    const [existing, existingAttributes, existingMedia] = await Promise.all([
      getWarehouseProduct(id),
      getWarehouseProductAttributes(id),
      getWarehouseProductMedia(id),
    ]);
    result.push(
      mergeMetadataPutItem(
        id,
        existing,
        formItem,
        fixed,
        existingAttributes,
        existingMedia,
      ),
    );
  }

  return result.length > 0 ? result : buildApiloMetadataPutPayload(input, apiloIdsBySku);
}

export interface ApiloMetadataUpdateResult {
  updatedProducts: number;
  patchedAttributes: number;
  attributePatches: ApiloProductAttributePatchItem[];
}

/** PUT metadanych + PATCH atrybutów tekstowych (producent, czas dostawy). */
export async function runApiloMetadataUpdate(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
  options?: { dryRun?: boolean },
): Promise<
  | { dryRun: true; putPayload: ApiloWarehouseProductPutPayload[]; attributePatches: ApiloProductAttributePatchItem[] }
  | ApiloMetadataUpdateResult
> {
  const dryRun = options?.dryRun ?? false;
  const putPayload = await buildApiloMetadataPutPayloadMerged(input, apiloIdsBySku);
  const attributePatches: ApiloProductAttributePatchItem[] = [];

  for (const item of putPayload) {
    const existingAttributes = await getWarehouseProductAttributes(item.id);
    attributePatches.push(
      ...buildMetadataTextAttributePatches(item.id, existingAttributes),
    );
  }

  if (dryRun) {
    return { dryRun: true, putPayload, attributePatches };
  }

  let updatedProducts = 0;
  let patchedAttributes = 0;

  for (const item of putPayload) {
    const putResult = await updateWarehouseProducts([item], { dryRun: false });
    if ("dryRun" in putResult) {
      throw new Error("Otrzymano dry-run dla aktualizacji produkcyjnej.");
    }
    updatedProducts += putResult.updated ?? putResult.changes ?? 1;

    const existingAttributes = await getWarehouseProductAttributes(item.id);
    const patches = buildMetadataTextAttributePatches(item.id, existingAttributes);
    if (patches.length === 0) {
      continue;
    }

    await patchWarehouseProductAttributes({ attributes: patches }, { dryRun: false });
    patchedAttributes += patches.length;
  }

  return {
    updatedProducts,
    patchedAttributes,
    attributePatches,
  };
}

export {
  buildApiloMetadataPreview,
  buildApiloMetadataPutPayload,
} from "./metadata-payload";
export type { ApiloMetadataPreviewItem } from "./metadata-payload";
