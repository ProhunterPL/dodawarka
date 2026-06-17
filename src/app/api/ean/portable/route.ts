import { NextResponse } from "next/server";
import {
  applyEanImportToProducts,
  exportGs1CatalogToCsv,
  parseEanAssignmentInput,
} from "@/lib/ean/portable";
import { exportProductsToGs1XlsxWithPool } from "@/lib/ean/portable";
import { exportProductsToGs1Xlsx } from "@/lib/ean/gs1-template";
import { listGs1CatalogEntries, listGs1Workbooks } from "@/lib/ean/gs1";
import type { ProductFormInput } from "@/lib/product/types";

export const dynamic = "force-dynamic";

function csvAttachmentResponse(filename: string, content: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function xlsxAttachmentResponse(filename: string, buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "info";

  try {
    if (action === "info") {
      const files = listGs1Workbooks();
      return NextResponse.json({
        success: true,
        files,
        selectedFile: files[0] ?? null,
        importTemplate: "ean_koszulki_warianty_uzupelnione.xlsx",
      });
    }

    if (action === "export-gs1") {
      const filename = searchParams.get("filename") ?? undefined;
      const entries = listGs1CatalogEntries(filename);
      const sourceName = filename?.replace(/\.xlsx$/i, "") ?? "gs1-katalog";
      const csv = exportGs1CatalogToCsv(entries);
      return csvAttachmentResponse(`${sourceName}.csv`, csv);
    }

    if (action === "export-template") {
      const buffer = exportProductsToGs1Xlsx([]);
      return xlsxAttachmentResponse("ean_szablon_mojegs1.xlsx", buffer);
    }

    return NextResponse.json(
      { success: false, message: `Nieznana akcja: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Błąd eksportu EAN",
      },
      { status: 400 },
    );
  }
}

interface PortablePostBody {
  action?: "export-products" | "import" | "apply";
  products?: ProductFormInput[];
  csv?: string;
  xlsxBase64?: string;
  filename?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PortablePostBody;
    const action = body.action ?? "import";

    if (action === "export-products") {
      const products = body.products ?? [];
      if (products.length === 0) {
        return NextResponse.json(
          { success: false, message: "Brak produktów do eksportu." },
          { status: 400 },
        );
      }
      const { buffer, allocation } = exportProductsToGs1XlsxWithPool(products);
      const rowCount = allocation.products.reduce(
        (sum, product) => sum + Math.max(product.variants.length, 1),
        0,
      );
      return NextResponse.json({
        success: true,
        filename: "ean_import_mojegs1.xlsx",
        xlsxBase64: buffer.toString("base64"),
        products: allocation.products,
        assignedCount: allocation.assignedCount,
        nextGtin: allocation.nextGtin,
        rowCount,
      });
    }

    if (action === "import") {
      const result = parseEanAssignmentInput({
        csv: body.csv,
        xlsxBase64: body.xlsxBase64,
      });
      if (result.errors.some((error) => error.row === 0)) {
        return NextResponse.json(
          { success: false, message: result.errors[0]?.message, ...result },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        ...result,
        assignedCount: result.rows.filter((row) => row.ean).length,
      });
    }

    if (action === "apply") {
      const products = body.products ?? [];
      if (products.length === 0) {
        return NextResponse.json(
          { success: false, message: "Brak produktów do uzupełnienia EAN." },
          { status: 400 },
        );
      }

      const { products: updated, importResult } = applyEanImportToProducts(products, {
        csv: body.csv,
        xlsxBase64: body.xlsxBase64,
      });
      if (importResult.errors.some((error) => error.row === 0)) {
        return NextResponse.json(
          {
            success: false,
            message: importResult.errors[0]?.message,
            ...importResult,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        products: updated,
        ...importResult,
        assignedCount: importResult.rows.filter((row) => row.ean).length,
      });
    }

    return NextResponse.json(
      { success: false, message: `Nieznana akcja: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Błąd operacji EAN",
      },
      { status: 400 },
    );
  }
}
