import type { ApiloWarehouseProductPayload } from "@/lib/apilo/types";
import { isS3Configured } from "@/lib/storage/s3-config";
import type { ProductFormInput, ProductStatus, ValidationIssue, ValidationResult } from "./types";

const ONEDRIVE_PATTERNS = [/1drv\.ms/i, /onedrive\.live\.com/i, /sharepoint\.com/i];

export function isOneDriveUrl(url: string): boolean {
  return ONEDRIVE_PATTERNS.some((pattern) => pattern.test(url));
}

export function mapStatusToApilo(status: ProductStatus): 0 | 1 {
  return status === "active" ? 1 : 0;
}

export function validateProductInput(input: ProductFormInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.groupName.trim()) {
    issues.push({ field: "groupName", message: "Nazwa grupy produktu jest wymagana.", severity: "error" });
  }

  if (!input.sku.trim() && input.variants.length === 0) {
    issues.push({ field: "sku", message: "SKU jest wymagane.", severity: "error" });
  }

  if (!input.priceWithTax.trim() || Number.isNaN(Number(input.priceWithTax))) {
    issues.push({ field: "priceWithTax", message: "Podaj poprawną cenę brutto.", severity: "error" });
  }

  if (!input.tax.trim()) {
    issues.push({ field: "tax", message: "Stawka VAT jest wymagana.", severity: "error" });
  }

  if (input.categoryIds.length === 0 && !input.categoryLabel.trim()) {
    issues.push({
      field: "categoryIds",
      message: "Wybierz kategorię Apilo lub podaj etykietę do dopasowania.",
      severity: "error",
    });
  }

  if (!input.description.trim()) {
    issues.push({ field: "description", message: "Opis długi jest wymagany.", severity: "error" });
  }

  if (input.imageUrls.length === 0) {
    issues.push({ field: "imageUrls", message: "Dodaj co najmniej jedno zdjęcie (URL).", severity: "warning" });
  }

  for (const url of input.imageUrls) {
    if (!url.trim()) continue;
    try {
      new URL(url);
    } catch {
      issues.push({ field: "imageUrls", message: `Niepoprawny URL zdjęcia: ${url}`, severity: "error" });
    }
    if (isOneDriveUrl(url)) {
      issues.push({
        field: "imageUrls",
        message: isS3Configured()
          ? `Link OneDrive nie zadziała w Apilo — wgraj zdjęcie przez upload S3: ${url}`
          : `Link OneDrive może nie być bezpośrednim URL-em obrazu: ${url}`,
        severity: isS3Configured() ? "error" : "warning",
      });
    }
  }

  for (const variant of input.variants) {
    if (!variant.sku.trim()) {
      issues.push({ field: "variants", message: `Brak SKU dla wariantu ${variant.size}.`, severity: "error" });
    }
    if (variant.quantity < 0) {
      issues.push({
        field: "variants",
        message: `Stan magazynowy nie może być ujemny (${variant.size}).`,
        severity: "error",
      });
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { valid: !hasErrors, issues };
}

export function buildApiloPayload(input: ProductFormInput): ApiloWarehouseProductPayload[] {
  const status = mapStatusToApilo(input.status);
  const images = Object.fromEntries(
    input.imageUrls
      .filter((url) => url.trim())
      .map((url, index) => [`img-${index + 1}`, url.trim()]),
  );

  const base = {
    priceWithTax: input.priceWithTax,
    tax: input.tax,
    status,
    categories: input.categoryIds,
    weight: input.weight,
    unit: input.unit || "KG",
    description: input.description,
    shortDescription: input.shortDescription.slice(0, 256),
    images: Object.keys(images).length > 0 ? images : undefined,
    groupName: input.groupName,
  };

  if (input.variants.length === 0) {
    return [
      {
        ...base,
        name: input.name || input.groupName,
        sku: input.sku,
        quantity: input.quantity,
        ean: input.ean || undefined,
      },
    ];
  }

  return input.variants.map((variant) => ({
    ...base,
    name: `${input.groupName} ${variant.size}`.trim(),
    sku: variant.sku,
    quantity: variant.quantity,
    ean: variant.ean || input.ean || undefined,
    originalCode: variant.sku,
  }));
}
