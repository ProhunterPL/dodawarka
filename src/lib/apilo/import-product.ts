import {
  createWarehouseProduct,
  isApiloApiError,
} from "@/lib/apilo/client";
import {
  buildVariantApiloIds,
  extractApiloProductIds,
  formatApiloErrorDetails,
  formatSkuList,
} from "@/lib/apilo/product-utils";
import type { ProductFormInput, ValidationIssue } from "@/lib/product/types";
import { buildApiloPayload, validateProductInput } from "@/lib/product/validation";
import { CHANNEL_LABELS } from "@/lib/product/channels";
import { formatChannelMetadataLines } from "@/lib/product/channel-metadata";
import { isS3Configured } from "@/lib/storage/s3-config";
import {
  appendImportLog,
  saveLocalProduct,
} from "@/lib/storage/local-store";

type WarehouseItem = ReturnType<typeof buildApiloPayload>[number];

const APILO_NAME_MAX = 120;

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

function buildLocalProductRecord(
  product: ProductFormInput,
  importStatus: "dry-run" | "success" | "error",
  extras: {
    apiloProductIds?: number[];
    variantApiloIds?: Record<string, number>;
    formSnapshot?: ProductFormInput;
    errorMessage?: string;
  } = {},
) {
  const variantSkus = product.variants.map((variant) => variant.sku.trim()).filter(Boolean);

  return {
    groupName: product.groupName,
    sku: formatSkuList(product),
    variantSkus: variantSkus.length > 0 ? variantSkus : undefined,
    status: product.status,
    importStatus,
    formSnapshot: extras.formSnapshot ?? {
      ...product,
      apiloIdsBySku: extras.variantApiloIds ?? product.apiloIdsBySku,
    },
    ...extras,
  };
}

export interface ImportProductOptions {
  dryRun?: boolean;
  blockedSkus?: string[];
  skipLocalSave?: boolean;
  skipImportLog?: boolean;
}

export interface ImportProductResult {
  success: boolean;
  dryRun?: boolean;
  message: string;
  sku: string;
  validationIssues?: ValidationIssue[];
  apiloProductIds?: number[];
  variantApiloIds?: Record<string, number>;
  payload?: unknown[];
  fallbackUsed?: boolean;
  details?: unknown;
}

async function importWithFallback(
  payload: WarehouseItem[],
  dryRun: boolean,
): Promise<{
  result: Awaited<ReturnType<typeof createWarehouseProduct>>;
  fallbackUsed: boolean;
}> {
  try {
    const result = await createWarehouseProduct(payload, { dryRun });
    return { result, fallbackUsed: false };
  } catch (error) {
    if (
      dryRun ||
      payload.length < 2 ||
      !isApiloApiError(error) ||
      error.status < 500
    ) {
      throw error;
    }

    const products: Record<string, number> = {};
    for (const item of payload) {
      const singleResult = await importSingleWithSafeFallback(item);
      const ids = extractApiloProductIds(singleResult.products);
      if (ids[0] === undefined) {
        throw new Error(`Brak ID produktu w odpowiedzi Apilo dla SKU ${item.sku}.`);
      }
      products[item.sku] = ids[0];
    }

    return {
      result: { products },
      fallbackUsed: true,
    };
  }
}

async function importSingleWithSafeFallback(
  item: WarehouseItem,
): Promise<Exclude<Awaited<ReturnType<typeof createWarehouseProduct>>, { dryRun: true; payload: WarehouseItem[] }>> {
  try {
    const result = await createWarehouseProduct([item], { dryRun: false });
    if ("dryRun" in result) {
      throw new Error("Otrzymano dry-run dla importu produkcyjnego.");
    }
    return result;
  } catch (error) {
    if (!isApiloApiError(error) || error.status < 500) {
      throw error;
    }

    const safeItem: WarehouseItem = {
      ...item,
      name: truncate(normalizeForApilo(item.name), APILO_NAME_MAX),
      groupName: undefined,
      sku: item.sku,
      originalCode: item.originalCode ?? item.sku,
    };

    const safeResult = await createWarehouseProduct([safeItem], { dryRun: false });
    if ("dryRun" in safeResult) {
      throw new Error("Otrzymano dry-run dla importu produkcyjnego.");
    }
    return safeResult;
  }
}

export async function importProductToApilo(
  product: ProductFormInput,
  options: ImportProductOptions = {},
): Promise<ImportProductResult> {
  const dryRun = options.dryRun ?? process.env.APILO_DRY_RUN === "true";
  const skuLabel = formatSkuList(product);

  const validation = validateProductInput(product, {
    blockedSkus: options.blockedSkus ?? [],
    requireImages: isS3Configured(),
  });

  if (!validation.valid) {
    return {
      success: false,
      message: "Walidacja nie powiodła się.",
      sku: skuLabel,
      validationIssues: validation.issues,
    };
  }

  try {
    const payload = buildApiloPayload(product);
    const { result, fallbackUsed } = await importWithFallback(payload, dryRun);

    if ("dryRun" in result && result.dryRun) {
      if (!options.skipImportLog) {
        await appendImportLog({
          action: "dry-run",
          sku: skuLabel,
          success: true,
          message: "Wygenerowano payload bez wysyłki do Apilo.",
        });
      }

      if (!options.skipLocalSave) {
        await saveLocalProduct(buildLocalProductRecord(product, "dry-run"));
      }

      return {
        success: true,
        dryRun: true,
        message: "Dry-run — payload wygenerowany.",
        sku: skuLabel,
        payload: result.payload,
      };
    }

    const apiloProductIds = extractApiloProductIds(
      "products" in result ? result.products : null,
    );
    const variantApiloIds = buildVariantApiloIds(
      product.variants.map((variant) => variant.sku),
      apiloProductIds,
      "products" in result ? result.products : null,
    );
    const formSnapshot: ProductFormInput = {
      ...product,
      apiloIdsBySku: variantApiloIds,
    };

    const channelLines = formatChannelMetadataLines(
      product.channelMetadata,
      CHANNEL_LABELS,
      product.selectedChannels,
    );
    const message = fallbackUsed
      ? "Produkt dodany do Apilo (warianty wysłane pojedynczo)."
      : "Produkt utworzony w Apilo.";
    const fullMessage =
      channelLines.length > 0
        ? `${message}\n\nNotatki kanałów:\n${channelLines.join("\n")}`
        : message;

    if (!options.skipImportLog) {
      await appendImportLog({
        action: "import",
        sku: skuLabel,
        success: true,
        message: fullMessage,
        apiloProductIds,
      });
    }

    if (!options.skipLocalSave) {
      await saveLocalProduct(
        buildLocalProductRecord(product, "success", {
          apiloProductIds,
          variantApiloIds,
          formSnapshot,
        }),
      );
    }

    return {
      success: true,
      dryRun: false,
      message: fullMessage,
      sku: skuLabel,
      apiloProductIds,
      variantApiloIds,
      fallbackUsed,
    };
  } catch (error) {
    const detailMessage = formatApiloErrorDetails(
      isApiloApiError(error) ? error.details : undefined,
    );
    const message = detailMessage
      ? `${error instanceof Error ? error.message : "Import do Apilo nie powiódł się."}\n${detailMessage}`
      : error instanceof Error
        ? error.message
        : "Import do Apilo nie powiódł się.";

    if (!options.skipImportLog) {
      await appendImportLog({
        action: "import",
        sku: skuLabel,
        success: false,
        message,
      }).catch(() => undefined);
    }

    if (!options.skipLocalSave) {
      await saveLocalProduct(
        buildLocalProductRecord(product, "error", { errorMessage: message }),
      ).catch(() => undefined);
    }

    return {
      success: false,
      message,
      sku: skuLabel,
      details: isApiloApiError(error) ? error.details : undefined,
    };
  }
}
