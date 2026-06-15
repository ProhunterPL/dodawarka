import { NextResponse } from "next/server";
import { suggestProductFixes } from "@/lib/ai/suggest-product-fixes";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import type { ProductFormInput, ValidationIssue } from "@/lib/product/types";

export async function POST(request: Request) {
  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      { message: "Brak OPENAI_API_KEY w .env.local" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      product: ProductFormInput;
      validationIssues?: ValidationIssue[];
      apiloError?: {
        message: string;
        status?: number;
        details?: unknown;
      };
    };

    const suggestions = await suggestProductFixes({
      product: body.product,
      validationIssues: body.validationIssues,
      apiloError: body.apiloError,
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się wygenerować sugestii AI.",
      },
      { status: 500 },
    );
  }
}
