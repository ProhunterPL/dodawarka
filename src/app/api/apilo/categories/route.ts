import { NextResponse } from "next/server";
import { getAllCategories, isApiloApiError } from "@/lib/apilo/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase().trim() ?? "";

    const categories = await getAllCategories();
    const filtered = query
      ? categories.filter((category) =>
          category.name.toLowerCase().includes(query),
        )
      : categories;

    return NextResponse.json({ categories: filtered, total: filtered.length });
  } catch (error) {
    const status = isApiloApiError(error) ? error.status : 500;
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać kategorii z Apilo.",
        details: isApiloApiError(error) ? error.details : undefined,
      },
      { status },
    );
  }
}
