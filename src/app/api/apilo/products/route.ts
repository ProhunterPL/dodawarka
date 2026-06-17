import { NextResponse } from "next/server";
import { suggestProductFixes } from "@/lib/ai/suggest-product-fixes";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import {
  createWarehouseProduct,
  isApiloApiError,
  patchWarehouseProducts,
  updateWarehouseProducts,
} from "@/lib/apilo/client";
import {
  buildVariantApiloIds,
  extractApiloProductIds,
  formatApiloErrorDetails,
  formatSkuList,
} from "@/lib/apilo/product-utils";
import {
  buildApiloMetadataPutPayload,
  buildApiloPatchPayload,
  buildApiloPayload,
  buildApiloPutPayload,
  validateProductInput,
} from "@/lib/product/validation";
import type { LocalProductRecord, ProductFormInput, ProductUpdateScope } from "@/lib/product/types";
import { applyMetadataFixes } from "@/lib/product/metadata-fix";
import { isS3Configured } from "@/lib/storage/s3-config";
import {
  appendImportLog,
  listKnownSkus,
  saveLocalProduct,
  updateLocalProduct,
} from "@/lib/storage/local-store";

interface VariantDiagnostic {
  sku: string;
  ok: boolean;
  details?: unknown;
  message?: string;
}

interface ImportWithFallbackResult {
  result: Awaited<ReturnType<typeof createWarehouseProduct>>;
  fallbackUsed: boolean;
}

type WarehouseItem = Awaited<ReturnType<typeof buildApiloPayload>>[number];
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

function buildLocalProductRecord(
  product: ProductFormInput,
  importStatus: LocalProductRecord["importStatus"],
  extras: Partial<
    Pick<
      LocalProductRecord,
      "apiloProductIds" | "variantApiloIds" | "errorMessage" | "formSnapshot"
    >
  > = {},
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

async function maybeSuggestFixes(
  product: ProductFormInput,
  options: {
    validationIssues?: ReturnType<typeof validateProductInput>["issues"];
    apiloError?: { message: string; status?: number; details?: unknown };
  },
) {
  if (!isOpenAiConfigured()) {
    return null;
  }

  try {
    return await suggestProductFixes({
      product,
      validationIssues: options.validationIssues,
      apiloError: options.apiloError,
    });
  } catch (error) {
    console.error("AI suggest error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function POST(request: Request) {
  let productInput: ProductFormInput | null = null;

  try {
    const body = (await request.json()) as {
      product: ProductFormInput;
      dryRun?: boolean;
    };
    productInput = body.product;

    const dryRun =
      typeof body.dryRun === "boolean"
        ? body.dryRun
        : process.env.APILO_DRY_RUN === "true";

    const knownSkus = dryRun ? [] : await listKnownSkus();
    const validation = validateProductInput(body.product, {
      blockedSkus: knownSkus,
      requireImages: isS3Configured(),
    });

    if (!validation.valid) {
      const aiSuggestions = await maybeSuggestFixes(body.product, {
        validationIssues: validation.issues,
      });

      return NextResponse.json(
        {
          success: false,
          validation,
          aiSuggestions,
          message: "Walidacja nie powiodła się. Sprawdź sugestie AI.",
        },
        { status: 422 },
      );
    }

    const payload = buildApiloPayload(body.product);
    const { result, fallbackUsed } = await importWithFallback(payload, dryRun);
    const skuLabel = formatSkuList(body.product);

    if ("dryRun" in result && result.dryRun) {
      await appendImportLog({
        action: "dry-run",
        sku: skuLabel,
        success: true,
        message: "Wygenerowano payload bez wysyłki do Apilo.",
      });

      await saveLocalProduct(buildLocalProductRecord(body.product, "dry-run"));

      return NextResponse.json({
        success: true,
        dryRun: true,
        payload: result.payload,
        validation,
        channelNote:
          "Tryb dry-run — produkt nie został wysłany do Apilo. Odznacz „dry-run” i wyślij ponownie.",
      });
    }

    const apiloProductIds = extractApiloProductIds(
      "products" in result ? result.products : null,
    );
    const variantApiloIds = buildVariantApiloIds(
      body.product.variants.map((variant) => variant.sku),
      apiloProductIds,
      "products" in result ? result.products : null,
    );
    const formSnapshot: ProductFormInput = {
      ...body.product,
      apiloIdsBySku: variantApiloIds,
    };

    await appendImportLog({
      action: "import",
      sku: skuLabel,
      success: true,
      message: "Produkt utworzony w Apilo.",
      apiloProductIds,
    });

    await saveLocalProduct(
      buildLocalProductRecord(body.product, "success", {
        apiloProductIds,
        variantApiloIds,
        formSnapshot,
      }),
    );

    return NextResponse.json({
      success: true,
      dryRun: false,
      apiloProductIds,
      products: "products" in result ? result.products : [],
      validation,
      channelNote:
          fallbackUsed
            ? "Produkt dodany do Apilo. Import zbiorczy wywoływał błąd API, więc warianty wysłano pojedynczo."
            : "Produkt dodany do Apilo. Sprawdź/potwierdź synchronizację kanałów w panelu Apilo.",
    });
  } catch (error) {
    const diagnostics = await buildVariantDiagnostics(productInput, error);
    const status = isApiloApiError(error) ? error.status : 500;
    const details = isApiloApiError(error) ? error.details : undefined;
    const detailMessage = formatApiloErrorDetails(details);
    const diagnosticsMessage = formatDiagnosticsMessage(diagnostics);
    const baseMessage = detailMessage
      ? `${error instanceof Error ? error.message : "Import do Apilo nie powiódł się."}\n${detailMessage}`
      : error instanceof Error
        ? error.message
        : "Import do Apilo nie powiódł się.";
    const message = diagnosticsMessage
      ? `${baseMessage}\n${diagnosticsMessage}`
      : baseMessage;

    const apiloError = isApiloApiError(error)
      ? { message, status: error.status, details: error.details }
      : { message, status };

    let aiSuggestions = null;
    if (productInput) {
      aiSuggestions = await maybeSuggestFixes(productInput, { apiloError });
    }

    const skuLabel = productInput ? formatSkuList(productInput) : "unknown";

    await appendImportLog({
      action: "import",
      sku: skuLabel,
      success: false,
      message,
    }).catch(() => undefined);

    if (productInput) {
      await saveLocalProduct(
        buildLocalProductRecord(productInput, "error", { errorMessage: message }),
      ).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: false,
        message,
        details: diagnostics
          ? {
              ...(isApiloApiError(error) && error.details && typeof error.details === "object"
                ? (error.details as Record<string, unknown>)
                : { original: isApiloApiError(error) ? error.details : undefined }),
              diagnostics,
            }
          : isApiloApiError(error)
            ? error.details
            : undefined,
        aiSuggestions,
      },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  let productInput: ProductFormInput | null = null;
  let localProductId: string | undefined;

  try {
    const body = (await request.json()) as {
      product: ProductFormInput;
      apiloIdsBySku?: Record<string, number>;
      updateScope?: ProductUpdateScope;
      dryRun?: boolean;
      localProductId?: string;
    };
    productInput = body.product;
    localProductId = body.localProductId;

    const dryRun =
      typeof body.dryRun === "boolean"
        ? body.dryRun
        : process.env.APILO_DRY_RUN === "true";

    const updateScope: ProductUpdateScope = body.updateScope ?? "full";
    const apiloIdsBySku = body.apiloIdsBySku ?? body.product.apiloIdsBySku ?? {};
    const ownSkus = Object.keys(apiloIdsBySku);

    const validation = validateProductInput(
      { ...body.product, apiloIdsBySku },
      {
        requireImages: updateScope === "full" ? isS3Configured() : false,
        updateMode: true,
        ownSkus,
      },
    );

    if (!validation.valid) {
      const aiSuggestions = await maybeSuggestFixes(body.product, {
        validationIssues: validation.issues,
      });

      return NextResponse.json(
        {
          success: false,
          validation,
          aiSuggestions,
          message: "Walidacja aktualizacji nie powiodła się.",
        },
        { status: 422 },
      );
    }

    const payload =
      updateScope === "quick"
        ? buildApiloPatchPayload({ ...body.product, apiloIdsBySku }, apiloIdsBySku)
        : updateScope === "metadata"
          ? buildApiloMetadataPutPayload({ ...body.product, apiloIdsBySku }, apiloIdsBySku)
          : buildApiloPutPayload({ ...body.product, apiloIdsBySku }, apiloIdsBySku);

    if (payload.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Brak wariantów z mapowaniem ID Apilo do aktualizacji.",
        },
        { status: 422 },
      );
    }

    const { result, fallbackUsed } = await updateWithFallback(
      payload,
      updateScope,
      dryRun,
    );
    const skuLabel = formatSkuList(body.product);
    const apiloProductIds = Object.values(apiloIdsBySku);

    if ("dryRun" in result && result.dryRun) {
      await appendImportLog({
        action: "update",
        sku: skuLabel,
        success: true,
        message: `Dry-run aktualizacji (${updateScope.toUpperCase()}).`,
      });

      return NextResponse.json({
        success: true,
        dryRun: true,
        updateScope,
        payload: result.payload,
        validation,
      });
    }

    const updatedCount =
      "updated" in result && typeof result.updated === "number"
        ? result.updated
        : "changes" in result && typeof result.changes === "number"
          ? result.changes
          : payload.length;

    const formSnapshot: ProductFormInput = {
      ...(updateScope === "metadata" ? applyMetadataFixes(body.product) : body.product),
      apiloIdsBySku,
    };

    await appendImportLog({
      action: "update",
      sku: skuLabel,
      success: true,
      message: `Zaktualizowano ${updatedCount} wariantów w Apilo (${updateScope.toUpperCase()}).`,
      apiloProductIds,
    });

    if (localProductId) {
      await updateLocalProduct(localProductId, {
        importStatus: "updated",
        status: body.product.status,
        formSnapshot,
        variantApiloIds: apiloIdsBySku,
        apiloProductIds,
        errorMessage: undefined,
      });
    } else {
      await saveLocalProduct(
        buildLocalProductRecord(body.product, "updated", {
          apiloProductIds,
          variantApiloIds: apiloIdsBySku,
          formSnapshot,
        }),
      );
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      updateScope,
      updatedCount,
      apiloProductIds,
      validation,
      channelNote: fallbackUsed
        ? `Aktualizacja wysłana wariant po wariancie (${updateScope.toUpperCase()}).`
        : `Produkt zaktualizowany w Apilo (${updateScope.toUpperCase()}).`,
    });
  } catch (error) {
    const status = isApiloApiError(error) ? error.status : 500;
    const details = isApiloApiError(error) ? error.details : undefined;
    const detailMessage = formatApiloErrorDetails(details);
    const message = detailMessage
      ? `${error instanceof Error ? error.message : "Aktualizacja w Apilo nie powiodła się."}\n${detailMessage}`
      : error instanceof Error
        ? error.message
        : "Aktualizacja w Apilo nie powiodła się.";

    const skuLabel = productInput ? formatSkuList(productInput) : "unknown";

    await appendImportLog({
      action: "update",
      sku: skuLabel,
      success: false,
      message,
    }).catch(() => undefined);

    if (productInput && localProductId) {
      await updateLocalProduct(localProductId, {
        errorMessage: message,
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: false,
        message,
        details: isApiloApiError(error) ? error.details : undefined,
      },
      { status },
    );
  }
}

type PutItem = ReturnType<typeof buildApiloPutPayload>[number];
type MetadataPutItem = ReturnType<typeof buildApiloMetadataPutPayload>[number];
type PatchItem = ReturnType<typeof buildApiloPatchPayload>[number];

async function updateWithFallback(
  payload: PutItem[] | MetadataPutItem[] | PatchItem[],
  updateScope: ProductUpdateScope,
  dryRun: boolean,
): Promise<{
  result:
    | Awaited<ReturnType<typeof updateWarehouseProducts>>
    | Awaited<ReturnType<typeof patchWarehouseProducts>>;
  fallbackUsed: boolean;
}> {
  try {
    const result =
      updateScope === "quick"
        ? await patchWarehouseProducts(payload as PatchItem[], { dryRun })
        : await updateWarehouseProducts(payload as PutItem[], { dryRun });
    return { result, fallbackUsed: false };
  } catch (error) {
    if (dryRun || payload.length < 2 || !isApiloApiError(error) || error.status < 500) {
      throw error;
    }

    let updated = 0;
    for (const item of payload) {
      const singleResult =
        updateScope === "quick"
          ? await patchWarehouseProducts([item as PatchItem], { dryRun: false })
          : await updateWarehouseProducts([item as PutItem], { dryRun: false });
      if ("dryRun" in singleResult) {
        throw new Error("Otrzymano dry-run dla aktualizacji produkcyjnej.");
      }
      updated += singleResult.updated ?? singleResult.changes ?? 1;
    }

    return {
      result: updateScope === "quick" ? { changes: updated } : { updated },
      fallbackUsed: true,
    };
  }
}

async function importWithFallback(
  payload: Awaited<ReturnType<typeof buildApiloPayload>>,
  dryRun: boolean,
): Promise<ImportWithFallbackResult> {
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

    // Bezpieczny fallback: zachowujemy kluczowe dane produktu,
    // ale normalizujemy nazwy do prostego ASCII i limitów długości.
    const safeItem: WarehouseItem = {
      ...item,
      name: truncate(normalizeForApilo(item.name), 80),
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

async function buildVariantDiagnostics(
  product: ProductFormInput | null,
  sourceError: unknown,
): Promise<VariantDiagnostic[] | null> {
  if (!product || !isApiloApiError(sourceError) || sourceError.status < 500) {
    return null;
  }

  const payload = buildApiloPayload(product);
  if (payload.length < 2) {
    return null;
  }

  const diagnostics: VariantDiagnostic[] = [];

  for (const item of payload) {
    try {
      await createWarehouseProduct([item], { dryRun: false });
      diagnostics.push({ sku: item.sku, ok: true });
    } catch (error) {
      diagnostics.push({
        sku: item.sku,
        ok: false,
        details: isApiloApiError(error) ? error.details : undefined,
        message: error instanceof Error ? error.message : "Import wariantu nie powiódł się.",
      });
    }
  }

  return diagnostics;
}

function formatDiagnosticsMessage(
  diagnostics: VariantDiagnostic[] | null,
): string | null {
  if (!diagnostics || diagnostics.length === 0) {
    return null;
  }

  const failed = diagnostics.filter((item) => !item.ok);
  if (failed.length === 0) {
    return "Apilo zwróciło błąd dla importu grupowego, ale każdy wariant osobno przeszedł poprawnie.";
  }

  const list = failed.map((item) => item.sku).join(", ");
  return `Warianty blokujące import: ${list}.`;
}
