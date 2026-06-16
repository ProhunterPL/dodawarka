import Link from "next/link";
import { listImportLogs, listLocalProducts } from "@/lib/storage/local-store";
import { ApiloStatusBadge } from "@/components/ApiloStatusBadge";
import { canUpdateInApilo } from "@/lib/product/local-product";

export default async function DashboardPage() {
  const [products, logs] = await Promise.all([listLocalProducts(), listImportLogs()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Incore Sports
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dodawarka do Apilo
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Dodaj produkt raz do centralnego katalogu Apilo, a następnie
            zsynchronizuj kanały w panelu Apilo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Dodaj produkt
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Katalog
          </Link>
          <Link
            href="/products/batch"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Batch CSV
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Status API Apilo</h2>
          <ApiloStatusBadge />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Historia importów</h2>
        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Brak wpisów. Wykonaj dry-run lub import produktu testowego.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {logs.slice(0, 15).map((log) => (
              <li key={log.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {log.action === "dry-run"
                      ? "Dry-run"
                      : log.action === "update"
                        ? "Aktualizacja"
                        : "Import"}{" "}
                    — {log.sku}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {log.message}
                  </p>
                  {log.apiloProductIds?.length ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      ID Apilo: {log.apiloProductIds.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span
                    className={`rounded-full px-3 py-1 ${
                      log.success
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {log.success ? "OK" : "Błąd"}
                  </span>
                  <time className="text-zinc-500">
                    {new Date(log.timestamp).toLocaleString("pl-PL")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Ostatnio dodane produkty</h2>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Brak zapisanych produktów. Zacznij od produktu testowego Earn Your
            Reps.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {products.slice(0, 10).map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {product.groupName}
                  </p>
                  <p className="text-sm text-zinc-500">SKU: {product.sku}</p>
                  {product.apiloProductIds?.length ? (
                    <p className="text-xs text-zinc-500">
                      ID Apilo: {product.apiloProductIds.join(", ")}
                    </p>
                  ) : null}
                  {product.errorMessage ? (
                    <p className="mt-1 line-clamp-2 text-sm text-red-600 dark:text-red-400">
                      {product.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {canUpdateInApilo(product) ? (
                    <Link
                      href={`/products/${product.id}/edit`}
                      className="rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Aktualizuj
                    </Link>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1 ${
                      product.importStatus === "success" || product.importStatus === "updated"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : product.importStatus === "error"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    {product.importStatus}
                  </span>
                  <time className="text-zinc-500">
                    {new Date(product.createdAt).toLocaleString("pl-PL")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
