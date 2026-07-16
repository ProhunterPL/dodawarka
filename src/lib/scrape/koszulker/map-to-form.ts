import { generateSkuPrefix, generateSkus } from "@/lib/product/sku";
import {
  MENS_SHIRTS_CATEGORY_IDS,
  MENS_SHIRTS_CATEGORY_LABEL,
  WOMENS_SHIRTS_CATEGORY_IDS,
  WOMENS_SHIRTS_CATEGORY_LABEL,
} from "@/lib/product/metadata-fix";
import type { ProductFormInput } from "@/lib/product/types";
import type { KoszulkerProductDetail } from "./types";

function buildGroupName(detail: KoszulkerProductDetail): string {
  const parts = [
    detail.title,
    detail.garmentType,
    detail.gender === "kobieta" ? "damski" : detail.gender === "mezczyzna" ? "męski" : "",
    detail.color,
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function buildDescription(detail: KoszulkerProductDetail): string {
  const sections = [
    detail.descriptionText,
    detail.extraDescription,
    detail.color ? `Kolor: ${detail.color}` : "",
    detail.garmentType ? `Rodzaj: ${detail.garmentType}${detail.garmentFit ? ` (${detail.garmentFit})` : ""}` : "",
    `Źródło: ${detail.sourceUrl}`,
  ].filter(Boolean);

  return sections.join("\n\n").trim();
}

function defaultCategory(detail: KoszulkerProductDetail): {
  categoryIds: number[];
  categoryLabel: string;
} {
  if (detail.gender === "kobieta") {
    return {
      categoryIds: [...WOMENS_SHIRTS_CATEGORY_IDS],
      categoryLabel: WOMENS_SHIRTS_CATEGORY_LABEL,
    };
  }

  return {
    categoryIds: [...MENS_SHIRTS_CATEGORY_IDS],
    categoryLabel: MENS_SHIRTS_CATEGORY_LABEL,
  };
}

function buildChannelParameters(detail: KoszulkerProductDetail): string {
  return [
    `Marka: Incore Sports`,
    detail.color ? `Kolor: ${detail.color}` : "",
    detail.garmentType ? `Rodzaj: ${detail.garmentType}` : "",
    detail.garmentFit ? `Krój: ${detail.garmentFit}` : "",
    `Koszulker ID: ${detail.productId}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function koszulkerDetailToProductForm(
  detail: KoszulkerProductDetail,
  options?: { defaultQuantity?: number },
): ProductFormInput {
  const quantity = options?.defaultQuantity ?? 10;
  const category = defaultCategory(detail);
  const groupName = buildGroupName(detail);
  const description = buildDescription(detail);

  const variants =
    detail.sizes.length > 0
      ? detail.sizes.map((size) => ({
          size,
          sku: "",
          quantity,
        }))
      : [];

  const product: ProductFormInput = {
    groupName,
    name: groupName,
    sku: "",
    ean: "",
    priceWithTax: detail.price || "79.00",
    tax: "23",
    quantity,
    weight: 0.1,
    unit: "szt.",
    description,
    shortDescription:
      detail.shortDescription ||
      `${detail.title} — ${detail.garmentType || "odzież"} Incore Sports`.slice(0, 256),
    categoryIds: category.categoryIds,
    categoryLabel: category.categoryLabel,
    imageUrls: detail.imageUrls.length > 0 ? detail.imageUrls : detail.imageUrl ? [detail.imageUrl] : [],
    status: "draft",
    variants,
    selectedChannels: ["shoper", "allegro"],
    channelMetadata: {
      allegro: {
        parameters: buildChannelParameters(detail),
        notes: `Zaimportowano z Koszulker (${detail.sourceUrl}). Zweryfikuj kategorię i zdjęcia.`,
      },
      shoper: {
        parameters: buildChannelParameters(detail),
        notes: `Źródło: Koszulker #${detail.productId}`,
      },
    },
  };

  const withSkus = generateSkus(product);
  // Unikalne SKU: wiele projektów Koszulker ma tę samą nazwę/kolor.
  const idTag = `K${detail.productId}`;
  return {
    ...withSkus,
    sku: withSkus.variants[0]
      ? `${generateSkuPrefix(product)}-${idTag}-${withSkus.variants[0].size.toUpperCase()}`
      : `${generateSkuPrefix(product)}-${idTag}`,
    variants: withSkus.variants.map((variant) => ({
      ...variant,
      sku: `${generateSkuPrefix(product)}-${idTag}-${variant.size.toUpperCase()}`,
    })),
  };
}
