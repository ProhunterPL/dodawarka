import type { AiFieldSuggestion } from "./types";
import type { ProductFormInput } from "@/lib/product/types";

const TEXT_FIELDS = [
  "groupName",
  "name",
  "sku",
  "ean",
  "priceWithTax",
  "tax",
  "unit",
  "description",
  "shortDescription",
  "categoryLabel",
] as const;

type TextField = (typeof TEXT_FIELDS)[number];

function isTextField(field: AiFieldSuggestion["field"]): field is TextField {
  return TEXT_FIELDS.includes(field as TextField);
}

export function applyAiSuggestions(
  product: ProductFormInput,
  suggestions: AiFieldSuggestion[],
): ProductFormInput {
  const next: ProductFormInput = {
    ...product,
    categoryIds: [...product.categoryIds],
    imageUrls: [...product.imageUrls],
    variants: product.variants.map((variant) => ({ ...variant })),
    selectedChannels: [...product.selectedChannels],
  };

  for (const suggestion of suggestions) {
    if (suggestion.field === "categoryIds") {
      next.categoryIds = Array.isArray(suggestion.value)
        ? suggestion.value.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
        : next.categoryIds;
      continue;
    }

    if (suggestion.field === "imageUrls") {
      next.imageUrls = Array.isArray(suggestion.value)
        ? suggestion.value.map(String)
        : next.imageUrls;
      continue;
    }

    if (suggestion.field === "quantity" || suggestion.field === "weight") {
      next[suggestion.field] = Number(suggestion.value);
      continue;
    }

    if (isTextField(suggestion.field)) {
      next[suggestion.field] = String(suggestion.value);
    }
  }

  return next;
}
