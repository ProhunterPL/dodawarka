import Link from "next/link";
import { listLocalProducts } from "@/lib/storage/local-store";
import { ApiloStatusBadge } from "@/components/ApiloStatusBadge";

export default async function DashboardPage() {
  const products = await listLocalProducts();

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
        <Link
          href="/products/new"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Dodaj produkt
        </Link>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Status API Apilo</h2>
          <ApiloStatusBadge />
        </div>
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
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
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
