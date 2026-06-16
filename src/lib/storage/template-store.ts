import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ProductFormInput, ProductTemplate } from "@/lib/product/types";
import { buildTemplateFromProduct } from "@/lib/product/template";
import { TEST_PRODUCT } from "@/lib/product/test-product";

const TEMPLATES_FILE = path.join(process.cwd(), "data", "templates.json");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.dirname(TEMPLATES_FILE), { recursive: true });
}

async function readTemplates(): Promise<ProductTemplate[]> {
  try {
    const raw = await fs.readFile(TEMPLATES_FILE, "utf-8");
    return JSON.parse(raw) as ProductTemplate[];
  } catch {
    const seed = buildTemplateFromProduct(
      TEST_PRODUCT,
      "Koszulka Incore (Earn Your Reps)",
      "Domyślny szablon koszulki z wariantami XS–3XL, kategoria T-shirt.",
    );
    const entry: ProductTemplate = {
      ...seed,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await ensureDataDir();
    await fs.writeFile(TEMPLATES_FILE, JSON.stringify([entry], null, 2), "utf-8");
    return [entry];
  }
}

async function writeTemplates(templates: ProductTemplate[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
}

export async function listTemplates(): Promise<ProductTemplate[]> {
  const templates = await readTemplates();
  return templates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getTemplate(id: string): Promise<ProductTemplate | null> {
  const templates = await readTemplates();
  return templates.find((template) => template.id === id) ?? null;
}

export async function saveTemplate(
  input: Omit<ProductTemplate, "id" | "createdAt">,
): Promise<ProductTemplate> {
  const templates = await readTemplates();
  const entry: ProductTemplate = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  templates.unshift(entry);
  await writeTemplates(templates);
  return entry;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<ProductTemplate, "name" | "description" | "product">>,
): Promise<ProductTemplate | null> {
  const templates = await readTemplates();
  const index = templates.findIndex((template) => template.id === id);
  if (index < 0) {
    return null;
  }

  const updated: ProductTemplate = {
    ...templates[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  templates[index] = updated;
  await writeTemplates(templates);
  return updated;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const templates = await readTemplates();
  const next = templates.filter((template) => template.id !== id);
  if (next.length === templates.length) {
    return false;
  }
  await writeTemplates(next);
  return true;
}

export async function saveTemplateFromProduct(
  product: ProductFormInput,
  name: string,
  description?: string,
): Promise<ProductTemplate> {
  return saveTemplate(buildTemplateFromProduct(product, name, description));
}
