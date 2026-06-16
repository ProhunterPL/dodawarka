import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductWizard } from "@/components/ProductWizard";
import {
  buildProductFormFromRecord,
  canUpdateInApilo,
  resolveApiloIdsBySku,
} from "@/lib/product/local-product";
import { getLocalProduct } from "@/lib/storage/local-store";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const record = await getLocalProduct(id);

  if (!record) {
    notFound();
  }

  const apiloIdsBySku = resolveApiloIdsBySku(record);
  const canUpdate = canUpdateInApilo(record);
  const initialProduct = buildProductFormFromRecord(record);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Aktualizacja produktu
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{record.groupName}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Edytuj dane i wyślij zmiany do Apilo (PUT — pełna aktualizacja lub PATCH — cena/stan).
        </p>
        {!canUpdate ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Ten wpis nie ma zapisanych ID Apilo — użyj „Dodaj produkt” do pierwszego importu.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          ID Apilo: {Object.values(apiloIdsBySku).join(", ")}
        </p>
      </div>
      <ProductWizard
        mode="update"
        localProductId={record.id}
        initialProduct={initialProduct}
        apiloIdsBySku={apiloIdsBySku}
        canUpdate={canUpdate}
      />
      <Link
        href="/"
        className="text-sm text-zinc-500 underline-offset-4 hover:underline"
      >
        ← Wróć do dashboardu
      </Link>
    </main>
  );
}
