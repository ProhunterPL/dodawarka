import { NextResponse } from "next/server";
import {
  listGs1Workbooks,
  matchEansForProduct,
  readGs1Entries,
  resolveGs1Workbook,
} from "@/lib/ean/gs1";
import type { ProductFormInput } from "@/lib/product/types";

export async function GET() {
  try {
    const files = listGs1Workbooks();
    return NextResponse.json({
      success: true,
      files,
      selectedFile: files[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się odczytać katalogu kody_ean.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      product: ProductFormInput;
      filename?: string;
    };
    const workbookPath = resolveGs1Workbook(body.filename);
    const entries = readGs1Entries(workbookPath);
    const match = matchEansForProduct(body.product, entries);

    return NextResponse.json({
      success: true,
      sourceFile: workbookPath,
      totalRows: entries.length,
      ...match,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się wczytać pliku GS1.",
      },
      { status: 400 },
    );
  }
}
