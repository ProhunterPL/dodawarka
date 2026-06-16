import { NextResponse } from "next/server";
import {
  deleteTemplate,
  getTemplate,
  listTemplates,
  saveTemplateFromProduct,
  updateTemplate,
} from "@/lib/storage/template-store";
import type { ProductFormInput } from "@/lib/product/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json(
        { success: false, message: "Nie znaleziono szablonu." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, template });
  }

  const templates = await listTemplates();
  return NextResponse.json({ success: true, templates });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    product?: ProductFormInput;
  };

  if (!body.name?.trim() || !body.product) {
    return NextResponse.json(
      { success: false, message: "Wymagane: name i product." },
      { status: 400 },
    );
  }

  const template = await saveTemplateFromProduct(
    body.product,
    body.name,
    body.description,
  );

  return NextResponse.json({
    success: true,
    template,
    message: `Zapisano szablon „${template.name}".`,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string;
    product?: ProductFormInput;
  };

  if (!body.id) {
    return NextResponse.json(
      { success: false, message: "Brak id szablonu." },
      { status: 400 },
    );
  }

  const template = await updateTemplate(body.id, {
    name: body.name?.trim(),
    description: body.description?.trim(),
    product: body.product,
  });

  if (!template) {
    return NextResponse.json(
      { success: false, message: "Nie znaleziono szablonu." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, template });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, message: "Brak id szablonu." },
      { status: 404 },
    );
  }

  const deleted = await deleteTemplate(id);
  if (!deleted) {
    return NextResponse.json(
      { success: false, message: "Nie znaleziono szablonu." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, message: "Szablon usunięty." });
}
