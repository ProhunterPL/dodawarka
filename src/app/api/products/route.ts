import { NextResponse } from "next/server";
import {
  clearLocalSkuLocks,
  clearSkuLocksForSkus,
  getLocalProduct,
  listImportLogs,
  listLocalProducts,
} from "@/lib/storage/local-store";
import { buildVariantApiloIds } from "@/lib/apilo/product-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const product = await getLocalProduct(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Nie znaleziono produktu." },
        { status: 404 },
      );
    }

    const apiloIdsBySku =
      product.variantApiloIds ??
      buildVariantApiloIds(product.variantSkus, product.apiloProductIds);

    return NextResponse.json({
      success: true,
      product,
      apiloIdsBySku,
    });
  }

  const [products, logs] = await Promise.all([
    listLocalProducts(),
    listImportLogs(),
  ]);

  return NextResponse.json({ products, logs });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    skus?: string[];
  };

  if (body.action === "clearSkuLocks") {
    const result = await clearLocalSkuLocks();
    return NextResponse.json({
      success: true,
      message: `Wyczyszczono lokalną blokadę SKU dla ${result.unlocked} wpisów.`,
      ...result,
    });
  }

  if (body.action === "clearSkuLocksFor") {
    const skus = Array.isArray(body.skus)
      ? body.skus.filter((sku): sku is string => typeof sku === "string")
      : [];
    const result = await clearSkuLocksForSkus(skus);
    return NextResponse.json({
      success: true,
      message: `Odblokowano SKU formularza w ${result.unlocked} wpisach historii.`,
      ...result,
    });
  }

  return NextResponse.json(
    { success: false, message: "Nieznana akcja." },
    { status: 400 },
  );
}
