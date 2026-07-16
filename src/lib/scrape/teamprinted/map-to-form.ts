import { generateSkuPrefix, generateSkus } from "@/lib/product/sku";
import {
  MENS_SHIRTS_CATEGORY_IDS,
  MENS_SHIRTS_CATEGORY_LABEL,
  WOMENS_SHIRTS_CATEGORY_IDS,
  WOMENS_SHIRTS_CATEGORY_LABEL,
} from "@/lib/product/metadata-fix";
import type { ProductFormInput } from "@/lib/product/types";
import type { TeamPrintedProductDetail } from "./types";

function detectGenderLabel(detail: TeamPrintedProductDetail): "damski" | "męski" | "" {
  const text = `${detail.title} ${detail.slug} ${detail.category}`.toLowerCase();
  if (/\b(damsk|woman|women|kobiet|female)\b/.test(text) || /woman|women/.test(detail.slug)) {
    return "damski";
  }
  if (/\b(męsk|mesk|man|men|mężczyzn)\b/.test(text)) {
    return "męski";
  }
  return "";
}

function primaryColor(detail: TeamPrintedProductDetail): string {
  const black = detail.colorNames.find((name) => /black|czarn/i.test(name));
  return black ?? detail.colorNames[0] ?? "czarny";
}

function defaultCategory(detail: TeamPrintedProductDetail): {
  categoryIds: number[];
  categoryLabel: string;
} {
  const gender = detectGenderLabel(detail);
  if (gender === "damski") {
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

function buildGroupName(detail: TeamPrintedProductDetail): string {
  const gender = detectGenderLabel(detail);
  const color = primaryColor(detail);
  return [detail.title, gender, color, "Incore Sports"]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function teamPrintedDetailToProductForm(
  detail: TeamPrintedProductDetail,
  options?: { defaultQuantity?: number },
): ProductFormInput {
  const quantity = options?.defaultQuantity ?? 10;
  const category = defaultCategory(detail);
  const groupName = buildGroupName(detail);
  const color = primaryColor(detail);

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
    priceWithTax: detail.price || "0.00",
    tax: "23",
    quantity,
    weight: 0.2,
    unit: "szt.",
    description: detail.descriptionText,
    shortDescription: detail.shortDescription,
    categoryIds: category.categoryIds,
    categoryLabel: category.categoryLabel,
    imageUrls: detail.imageUrls.length > 0 ? detail.imageUrls : detail.imageUrl ? [detail.imageUrl] : [],
    status: "draft",
    variants,
    selectedChannels: ["shoper", "allegro"],
    channelMetadata: {
      allegro: {
        parameters: [
          "Marka: Incore Sports",
          detail.category ? `Kategoria: ${detail.category}` : "",
          `Kolor bazowy: ${color}`,
          detail.colorNames.length ? `Kolory: ${detail.colorNames.join(", ")}` : "",
          `TeamPrinted ID: ${detail.productId}`,
        ]
          .filter(Boolean)
          .join(", "),
        notes: `Zaimportowano z TeamPrinted (${detail.sourceUrl}). Zweryfikuj kategorię, rozmiary i zdjęcia.`,
      },
      shoper: {
        parameters: `Producent: Incore Sports, TeamPrinted ID: ${detail.productId}`,
        notes: `Źródło: TeamPrinted #${detail.productId}`,
      },
    },
  };

  const withSkus = generateSkus(product);
  const idTag = `TP${detail.productId}`;
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
