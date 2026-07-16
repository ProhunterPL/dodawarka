import type {
  ApiloWarehouseProductPayload,
  ApiloWarehouseProductPatchPayload,
  ApiloWarehouseProductPutPayload,
} from "@/lib/apilo/types";
import { collectProductSkus, findDuplicateSkus, parseApiloTax } from "@/lib/apilo/product-utils";
import { hasChannelMetadataContent, getChannelMetadata } from "@/lib/product/channel-metadata";
import { buildIndexedApiloAttributesForPut } from "@/lib/apilo/put-attributes";
import {
  applyMetadataFixes,
  DEFAULT_PRODUCT_UNIT,
} from "@/lib/product/metadata-fix";
import { isS3Configured } from "@/lib/storage/s3-config";
import type { ProductFormInput, ProductStatus, ValidationIssue, ValidationResult } from "./types";

export interface ValidateProductOptions {
  /** SKU już zaimportowane lokalnie — blokada przy ponownym imporcie. */
  blockedSkus?: string[];
  /** SKU należące do bieżącego produktu (tryb aktualizacji) — nie blokuj. */
  ownSkus?: string[];
  /** Wymagaj co najmniej jednego zdjęcia (np. gdy S3 jest skonfigurowany). */
  requireImages?: boolean;
  /** Tryb aktualizacji — wymaga mapowania ID Apilo. */
  updateMode?: boolean;
}

const ONEDRIVE_PATTERNS = [/1drv\.ms/i, /onedrive\.live\.com/i, /sharepoint\.com/i];
const APILO_NAME_MAX = 120;
const APILO_GROUP_MAX = 120;

function normalizeForApilo(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, max).trim();
}

function buildVariantName(baseName: string, size: string): string {
  const cleaned = baseName.replace(/\s+(XS|S|M|L|XL|2XL|3XL)$/i, "").trim();
  return `${cleaned} ${size}`.trim();
}

export function isOneDriveUrl(url: string): boolean {
  return ONEDRIVE_PATTERNS.some((pattern) => pattern.test(url));
}

export function mapStatusToApilo(status: ProductStatus): 0 | 1 {
  return status === "active" ? 1 : 0;
}

export function validateProductInput(
  input: ProductFormInput,
  options: ValidateProductOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.groupName.trim()) {
    issues.push({ field: "groupName", message: "Nazwa grupy produktu jest wymagana.", severity: "error" });
  }
  if (input.groupName.trim().length > APILO_GROUP_MAX) {
    issues.push({
      field: "groupName",
      message: `Nazwa grupy jest długa (${input.groupName.length} znaków). Zostanie skrócona do ${APILO_GROUP_MAX} dla Apilo.`,
      severity: "warning",
    });
  }
  if (input.name.trim().length > APILO_NAME_MAX) {
    issues.push({
      field: "name",
      message: `Nazwa produktu jest długa (${input.name.length} znaków). Zostanie skrócona do ${APILO_NAME_MAX} dla Apilo.`,
      severity: "warning",
    });
  }

  if (!input.sku.trim() && input.variants.length === 0) {
    issues.push({ field: "sku", message: "SKU jest wymagane.", severity: "error" });
  }

  if (!input.priceWithTax.trim() || Number.isNaN(Number(input.priceWithTax))) {
    issues.push({ field: "priceWithTax", message: "Podaj poprawną cenę brutto.", severity: "error" });
  }

  if (!input.tax.trim() || Number.isNaN(Number(input.tax.replace(",", ".")))) {
    issues.push({ field: "tax", message: "Stawka VAT jest wymagana (np. 23).", severity: "error" });
  }

  if (input.categoryIds.length === 0) {
    issues.push({
      field: "categoryIds",
      message:
        "Wybierz kategorię z listy Apilo (wyszukaj i kliknij wynik — sama etykieta nie wystarczy).",
      severity: "error",
    });
  }

  if (!input.description.trim()) {
    issues.push({ field: "description", message: "Opis długi jest wymagany.", severity: "error" });
  }

  const hasImages = input.imageUrls.some((url) => url.trim());
  if (!hasImages) {
    issues.push({
      field: "imageUrls",
      message: options.requireImages
        ? "Dodaj co najmniej jedno zdjęcie (upload S3 lub URL)."
        : "Dodaj co najmniej jedno zdjęcie (URL).",
      severity: options.requireImages ? "error" : "warning",
    });
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
    if (variant.ean?.trim() && !/^\d{8,14}$/.test(variant.ean.trim())) {
      issues.push({
        field: "variants",
        message: `EAN wariantu ${variant.size} powinien mieć 8–14 cyfr.`,
        severity: "warning",
      });
    }
  }

  if (input.ean.trim() && !/^\d{8,14}$/.test(input.ean.trim())) {
    issues.push({
      field: "ean",
      message: "EAN powinien mieć 8–14 cyfr (GTIN).",
      severity: "warning",
    });
  }

  const skus = collectProductSkus(input);
  for (const duplicate of findDuplicateSkus(skus)) {
    issues.push({
      field: "sku",
      message: `Zduplikowany SKU w formularzu: ${duplicate}`,
      severity: "error",
    });
  }

  if (options.blockedSkus?.length) {
    const own = new Set((options.ownSkus ?? []).map((sku) => sku.trim().toUpperCase()));
    const blocked = new Set(
      options.blockedSkus
        .filter((sku) => !own.has(sku.trim().toUpperCase()))
        .map((sku) => sku.trim().toUpperCase()),
    );
    for (const sku of skus) {
      if (blocked.has(sku.toUpperCase())) {
        issues.push({
          field: "sku",
          message: `SKU ${sku} było już zaimportowane do Apilo — zmień SKU lub usuń wpis z lokalnej historii.`,
          severity: "error",
        });
      }
    }
  }

  if (options.updateMode) {
    const ids = input.apiloIdsBySku ?? {};
    const missing = skus.filter((sku) => !ids[sku.trim()]);
    if (missing.length > 0) {
      issues.push({
        field: "apiloIdsBySku",
        message: `Brak ID Apilo dla SKU: ${missing.join(", ")}. Nowe warianty wymagają osobnego importu (CREATE).`,
        severity: "error",
      });
    }
  }

  if (input.selectedChannels.includes("allegro")) {
    const allegro = getChannelMetadata(input.channelMetadata, "allegro");
    if (!allegro.marketplaceCategory?.trim()) {
      issues.push({
        field: "channelMetadata",
        message:
          "Allegro jest zaznaczone — uzupełnij kategorię marketplace w metadanych kanału.",
        severity: "warning",
      });
    }
    if (!hasChannelMetadataContent(allegro)) {
      issues.push({
        field: "channelMetadata",
        message: "Allegro jest zaznaczone — brak jakichkolwiek notatek kanałowych.",
        severity: "warning",
      });
    }
  }

  if (input.selectedChannels.includes("shoper")) {
    const shoper = getChannelMetadata(input.channelMetadata, "shoper");
    if (!hasChannelMetadataContent(shoper)) {
      issues.push({
        field: "channelMetadata",
        message: "Shoper jest zaznaczony — rozważ dodanie kategorii lub notatek.",
        severity: "warning",
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

  const normalizedUnit = input.unit.trim();
  // CREATE (POST) nie toleruje tablicy `attributes` — Apilo zwraca LogicException.
  // Atrybuty (opis/producent) ustawiamy po utworzeniu przez PUT metadanych.
  // Nie wysyłamy `groupName` — Apilo skleja je z `name` (podwaja/potraja nazwę).
  const base = {
    priceWithTax: input.priceWithTax,
    tax: parseApiloTax(input.tax),
    status,
    categories: input.categoryIds,
    weight: input.weight,
    unit: normalizedUnit || DEFAULT_PRODUCT_UNIT,
    description: input.description,
    shortDescription: input.shortDescription.slice(0, 256),
    images: Object.keys(images).length > 0 ? images : undefined,
  };

  if (input.variants.length === 0) {
    return [
      {
        ...base,
        name: truncate(
          normalizeForApilo(input.name || input.groupName),
          APILO_NAME_MAX,
        ),
        sku: input.sku,
        quantity: input.quantity,
        ean: input.ean || undefined,
      },
    ];
  }

  const variantBaseName = truncate(
    normalizeForApilo(input.name || input.groupName),
    APILO_NAME_MAX,
  );

  return input.variants.map((variant) => ({
    ...base,
    name: truncate(
      buildVariantName(variantBaseName, variant.size),
      APILO_NAME_MAX,
    ),
    sku: variant.sku,
    quantity: variant.quantity,
    ean: variant.ean || undefined,
    originalCode: variant.sku,
  }));
}

export function buildApiloPutPayload(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
): ApiloWarehouseProductPutPayload[] {
  const items = buildApiloPayload(input);
  const result: ApiloWarehouseProductPutPayload[] = [];

  for (const item of items) {
    const id = apiloIdsBySku[item.sku.trim()];
    if (!id) {
      continue;
    }

    result.push({
      id,
      sku: item.sku,
      name: item.name,
      tax: item.tax,
      status: item.status,
      quantity: item.quantity,
      priceWithTax: item.priceWithTax,
      originalCode: item.originalCode,
      attributes: buildIndexedApiloAttributesForPut({
        shortDescription: input.shortDescription,
        description: input.description,
      }),
      images: item.images,
      categories: item.categories,
      ean: item.ean,
      weight: item.weight,
      unit: item.unit,
      description: item.description,
      shortDescription: item.shortDescription,
    });
  }

  return result;
}

export function buildApiloPatchPayload(
  input: ProductFormInput,
  apiloIdsBySku: Record<string, number>,
): ApiloWarehouseProductPatchPayload[] {
  const items = buildApiloPayload(input);
  const result: ApiloWarehouseProductPatchPayload[] = [];

  for (const item of items) {
    const id = apiloIdsBySku[item.sku.trim()];
    if (!id) {
      continue;
    }

    result.push({
      id,
      sku: item.sku,
      quantity: item.quantity,
      priceWithTax: item.priceWithTax,
      tax: item.tax,
      status: item.status,
    });
  }

  return result;
}

export { buildApiloMetadataPutPayload } from "@/lib/apilo/metadata-payload";
