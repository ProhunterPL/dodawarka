import { NextResponse } from "next/server";
import {
  fetchKoszulkerListing,
  fetchKoszulkerProduct,
  fetchKoszulkerProducts,
} from "@/lib/scrape/koszulker/fetch";
import { koszulkerDetailToProductForm } from "@/lib/scrape/koszulker/map-to-form";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "list";
  const url = searchParams.get("url") ?? "https://incoresports.koszulker.pl/";

  try {
    if (action === "list") {
      const items = await fetchKoszulkerListing(url);
      return NextResponse.json({ ok: true, items, sourceUrl: url });
    }

    if (action === "product") {
      if (!searchParams.get("url")) {
        return NextResponse.json(
          { ok: false, error: "Brak parametru url dla produktu." },
          { status: 400 },
        );
      }

      const detail = await fetchKoszulkerProduct(url);
      const product = koszulkerDetailToProductForm(detail);
      return NextResponse.json({ ok: true, detail, product });
    }

    return NextResponse.json(
      { ok: false, error: `Nieznana akcja: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Błąd pobierania z Koszulker",
      },
      { status: 502 },
    );
  }
}

interface BatchBody {
  urls?: string[];
  defaultQuantity?: number;
}

export async function POST(request: Request) {
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Niepoprawny JSON." }, { status: 400 });
  }

  const urls = body.urls?.filter((item) => item.trim()) ?? [];
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: "Podaj co najmniej jeden URL produktu." }, { status: 400 });
  }

  if (urls.length > 30) {
    return NextResponse.json(
      { ok: false, error: "Maksymalnie 30 produktów na raz." },
      { status: 400 },
    );
  }

  try {
    const results = await fetchKoszulkerProducts(urls);
    const items = results.map((entry) => ({
      url: entry.url,
      error: entry.error,
      detail: entry.product,
      product: entry.product
        ? koszulkerDetailToProductForm(entry.product, {
            defaultQuantity: body.defaultQuantity,
          })
        : undefined,
    }));

    return NextResponse.json({
      ok: true,
      items,
      successCount: items.filter((item) => item.product).length,
      errorCount: items.filter((item) => item.error).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Błąd batch importu",
      },
      { status: 502 },
    );
  }
}
