import Link from "next/link";
import { canUpdateInApilo } from "@/lib/product/local-product";
import { CHANNEL_LABELS } from "@/lib/product/channels";
import {
  countFilledChannelMetadata,
  formatChannelMetadataLines,
} from "@/lib/product/channel-metadata";
import { listLocalProducts } from "@/lib/storage/local-store";
import { listTemplates } from "@/lib/storage/template-store";

export default async function ProductsCatalogPage() {
  const [products, templates] = await Promise.all([
    listLocalProducts(),
    listTemplates(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Katalog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Produkty i szablony</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Historia importów, duplikacja i szablony do szybkiego tworzenia kolejnych pozycji.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Nowy produkt
          </Link>
          <Link
            href="/products/batch"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Batch CSV
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Szablony ({templates.length})</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Szablon kopiuje opisy, kategorię i warianty — bez SKU/EAN. Po wczytaniu użyj „Generuj SKU”.
        </p>
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{template.name}</p>
                {template.description ? (
                  <p className="text-sm text-zinc-500">{template.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-zinc-500">
                  {template.product.variants.length} wariantów · kategoria{" "}
                  {template.product.categoryIds.join(", ")}
                </p>
              </div>
              <Link
                href={`/products/new?template=${template.id}`}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Użyj szablonu
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Historia produktów ({products.length})</h2>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Brak zapisanych produktów.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {products.map((product) => {
              const snapshot = product.formSnapshot;
              const selectedChannels = snapshot?.selectedChannels ?? [];
              const channelLines = formatChannelMetadataLines(
                snapshot?.channelMetadata,
                CHANNEL_LABELS,
                selectedChannels,
              );
              const filledChannels = countFilledChannelMetadata(
                snapshot?.channelMetadata,
                selectedChannels,
              );

              return (
              <li
                key={product.id}
                className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{product.groupName}</p>
                  <p className="text-sm text-zinc-500">SKU: {product.sku}</p>
                  {product.apiloProductIds?.length ? (
                    <p className="text-xs text-zinc-500">
                      ID Apilo: {product.apiloProductIds.join(", ")}
                    </p>
                  ) : null}
                  {selectedChannels.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Kanały: {selectedChannels.map((id) => CHANNEL_LABELS[id] ?? id).join(", ")}
                      {filledChannels > 0
                        ? ` · notatki: ${channelLines.join(" · ")}`
                        : " · brak notatek"}
                    </p>
                  ) : null}
                  {product.errorMessage ? (
                    <p className="mt-1 line-clamp-2 text-sm text-red-600 dark:text-red-400">
                      {product.errorMessage}
                    </p>
                  ) : null}
                  <time className="mt-1 block text-xs text-zinc-400">
                    {new Date(product.createdAt).toLocaleString("pl-PL")}
                  </time>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      product.importStatus === "success" ||
                      product.importStatus === "updated"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : product.importStatus === "error"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    {product.importStatus}
                  </span>
                  <Link
                    href={`/products/new?from=${product.id}`}
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    Duplikuj
                  </Link>
                  {canUpdateInApilo(product) ? (
                    <>
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                      >
                        Aktualizuj
                      </Link>
                      <Link
                        href={`/products/${product.id}/edit#metadata-fix`}
                        className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        Napraw metadane
                      </Link>
                    </>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
