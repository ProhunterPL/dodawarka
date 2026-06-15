import { NextResponse } from "next/server";
import { suggestProductFixes } from "@/lib/ai/suggest-product-fixes";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import {
  createWarehouseProduct,
  isApiloApiError,
} from "@/lib/apilo/client";
import { buildApiloPayload, validateProductInput } from "@/lib/product/validation";
import type { ProductFormInput } from "@/lib/product/types";
import { appendImportLog, saveLocalProduct } from "@/lib/storage/local-store";

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

    const validation = validateProductInput(body.product);
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
    // Checkbox w UI ma pierwszeństwo; env APILO_DRY_RUN to tylko domyślna wartość.
    const dryRun =
      typeof body.dryRun === "boolean"
        ? body.dryRun
        : process.env.APILO_DRY_RUN === "true";

    const result = await createWarehouseProduct(payload, { dryRun });

    if ("dryRun" in result && result.dryRun) {
      await appendImportLog({
        action: "dry-run",
        sku: body.product.sku,
        success: true,
        message: "Wygenerowano payload bez wysyłki do Apilo.",
      });

      await saveLocalProduct({
        groupName: body.product.groupName,
        sku: body.product.sku || body.product.variants[0]?.sku || "unknown",
        status: body.product.status,
        importStatus: "dry-run",
      });

      return NextResponse.json({
        success: true,
        dryRun: true,
        payload: result.payload,
        validation,
        channelNote:
          "Tryb dry-run — produkt nie został wysłany do Apilo. Odznacz „dry-run” i wyślij ponownie.",
      });
    }

    const apiloProductIds =
      "products" in result
        ? result.products
            .map((product) => product.id)
            .filter((id): id is number => typeof id === "number")
        : [];

    await appendImportLog({
      action: "import",
      sku: body.product.sku || body.product.variants[0]?.sku || "unknown",
      success: true,
      message: "Produkt utworzony w Apilo.",
      apiloProductIds,
    });

    await saveLocalProduct({
      groupName: body.product.groupName,
      sku: body.product.sku || body.product.variants[0]?.sku || "unknown",
      status: body.product.status,
      apiloProductIds,
      importStatus: "success",
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      apiloProductIds,
      products: "products" in result ? result.products : [],
      validation,
      channelNote:
        "Produkt dodany do Apilo. Sprawdź/potwierdź synchronizację kanałów w panelu Apilo.",
    });
  } catch (error) {
    const status = isApiloApiError(error) ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Import do Apilo nie powiódł się.";

    const apiloError = isApiloApiError(error)
      ? { message, status: error.status, details: error.details }
      : { message, status };

    let aiSuggestions = null;
    if (productInput) {
      aiSuggestions = await maybeSuggestFixes(productInput, { apiloError });
    }

    await appendImportLog({
      action: "import",
      sku: "unknown",
      success: false,
      message,
    }).catch(() => undefined);

    return NextResponse.json(
      {
        success: false,
        message,
        details: isApiloApiError(error) ? error.details : undefined,
        aiSuggestions,
      },
      { status },
    );
  }
}
