import { NextResponse } from "next/server";
import {
  createWarehouseProduct,
  isApiloApiError,
} from "@/lib/apilo/client";
import { buildApiloPayload, validateProductInput } from "@/lib/product/validation";
import type { ProductFormInput } from "@/lib/product/types";
import { appendImportLog, saveLocalProduct } from "@/lib/storage/local-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      product: ProductFormInput;
      dryRun?: boolean;
    };

    const validation = validateProductInput(body.product);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, validation },
        { status: 422 },
      );
    }

    const payload = buildApiloPayload(body.product);
    const dryRun =
      body.dryRun === true || process.env.APILO_DRY_RUN === "true";

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
          "Tryb dry-run — produkt nie został wysłany do Apilo. Zweryfikuj payload przed importem.",
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
      },
      { status },
    );
  }
}
