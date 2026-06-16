import { parseBatchCsv } from "@/lib/batch/rows-to-products";
import type { BatchImportResult } from "@/lib/batch/types";
import { importProductToApilo } from "@/lib/apilo/import-product";
import { collectProductSkus } from "@/lib/apilo/product-utils";
import { listKnownSkus } from "@/lib/storage/local-store";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "preview" | "import";
    csv?: string;
    dryRun?: boolean;
  };

  const csv = body.csv?.trim();
  if (!csv) {
    return NextResponse.json(
      { success: false, message: "Brak treści CSV." },
      { status: 400 },
    );
  }

  const preview = parseBatchCsv(csv);

  if (body.action === "preview" || !body.action) {
    return NextResponse.json({
      success: preview.parseErrors.length === 0,
      preview,
    });
  }

  if (body.action !== "import") {
    return NextResponse.json(
      { success: false, message: "Nieznana akcja batch." },
      { status: 400 },
    );
  }

  if (preview.parseErrors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Napraw błędy parsowania CSV przed importem.",
        preview,
      },
      { status: 422 },
    );
  }

  const dryRun =
    typeof body.dryRun === "boolean"
      ? body.dryRun
      : process.env.APILO_DRY_RUN === "true";

  const knownSkus = dryRun ? [] : await listKnownSkus();
  const blockedSkus = new Set(knownSkus.map((sku) => sku.toUpperCase()));
  const batchResult: BatchImportResult = {
    totalGroups: preview.products.length,
    successCount: 0,
    failedCount: 0,
    dryRun,
    results: [],
  };

  for (const product of preview.products) {
    const result = await importProductToApilo(product, {
      dryRun,
      blockedSkus: [...blockedSkus],
    });

    if (result.success) {
      batchResult.successCount += 1;
      for (const sku of collectProductSkus(product)) {
        blockedSkus.add(sku.toUpperCase());
      }
    } else {
      batchResult.failedCount += 1;
    }

    batchResult.results.push({
      groupName: product.groupName,
      sku: result.sku,
      success: result.success,
      message: result.message,
      dryRun: result.dryRun,
      apiloProductIds: result.apiloProductIds,
      validationIssues: result.validationIssues,
      fallbackUsed: result.fallbackUsed,
    });
  }

  return NextResponse.json({
    success: batchResult.failedCount === 0,
    batch: batchResult,
    preview,
  });
}
