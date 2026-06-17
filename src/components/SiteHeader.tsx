import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Dodawarka Apilo
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Dashboard
          </Link>
          <Link
            href="/products"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Katalog
          </Link>
          <Link
            href="/products/new"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Dodaj produkt
          </Link>
          <Link
            href="/products/batch"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Batch CSV
          </Link>
          <Link
            href="/products/import"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Import Koszulker
          </Link>
          <Link
            href="/products/ean"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            EAN CSV
          </Link>
        </nav>
      </div>
    </header>
  );
}
