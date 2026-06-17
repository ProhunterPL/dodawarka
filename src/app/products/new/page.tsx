import { NewProductClient } from "@/components/NewProductClient";
import { buildProductFormFromRecord } from "@/lib/product/local-product";
import {
  applyTemplateProduct,
  productFromSnapshot,
} from "@/lib/product/template";
import { getLocalProduct } from "@/lib/storage/local-store";
import { getTemplate } from "@/lib/storage/template-store";
import type { ProductFormInput } from "@/lib/product/types";

interface NewProductPageProps {
  searchParams: Promise<{ template?: string; from?: string }>;
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const params = await searchParams;
  let initialProduct: ProductFormInput | undefined;
  let subtitle = "Uzupełnij dane, sprawdź payload i wyślij do Apilo (lub użyj dry-run).";

  if (params.template) {
    const template = await getTemplate(params.template);
    if (template) {
      initialProduct = applyTemplateProduct(template);
      subtitle = `Wczytano szablon: ${template.name}. Uzupełnij nazwę/SKU i wyślij.`;
    }
  } else if (params.from) {
    const record = await getLocalProduct(params.from);
    if (record) {
      const snapshot = record.formSnapshot ?? buildProductFormFromRecord(record);
      initialProduct = productFromSnapshot(snapshot);
      subtitle = `Duplikat produktu: ${record.groupName}. SKU i EAN zostały wyczyszczone.`;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Nowy produkt
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dodaj produkt</h1>
      </div>
      <NewProductClient serverInitialProduct={initialProduct} subtitle={subtitle} />
    </main>
  );
}
