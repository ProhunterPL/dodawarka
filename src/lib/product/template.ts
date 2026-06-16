import type { ProductFormInput, ProductTemplate } from "./types";

/** Usuwa identyfikatory specyficzne dla produktu — do zapisu szablonu / duplikacji. */
export function stripProductIdentifiers(product: ProductFormInput): ProductFormInput {
  return {
    ...product,
    sku: "",
    ean: "",
    apiloIdsBySku: undefined,
    variants: product.variants.map((variant) => ({
      size: variant.size,
      sku: "",
      quantity: variant.quantity,
      ean: undefined,
    })),
  };
}

export function applyTemplateProduct(template: ProductTemplate): ProductFormInput {
  return stripProductIdentifiers(template.product);
}

export function productFromSnapshot(snapshot: ProductFormInput): ProductFormInput {
  return stripProductIdentifiers(snapshot);
}

export function buildTemplateFromProduct(
  product: ProductFormInput,
  name: string,
  description?: string,
): Omit<ProductTemplate, "id" | "createdAt"> {
  return {
    name: name.trim(),
    description: description?.trim() || undefined,
    product: stripProductIdentifiers(product),
  };
}
