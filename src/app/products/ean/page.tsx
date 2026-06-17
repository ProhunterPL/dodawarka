import { EanPortablePanel } from "@/components/EanPortablePanel";

export default function EanPortablePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Kody EAN
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">EAN — eksport i import MojeGS1</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Eksport w formacie szablonu GS1 (<code>ean_koszulki_warianty_uzupelnione.xlsx</code>).
          Przy eksporcie nadajemy kolejne GTIN z puli (na podstawie plików w <code>kody_ean/</code>),
          a w GS1 tylko zatwierdzasz import.
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Pobierz produkty z Koszulker (strona Import Koszulker).</li>
          <li>Eksportuj do MojeGS1 (XLSX) — GTIN nadawane automatycznie, jeden wiersz na wariant.</li>
          <li>Zaimportuj plik w portalu GS1 (MojeGS1) i zatwierdź.</li>
          <li>Opcjonalnie: importuj XLSX z powrotem do dodawarki i otwórz produkt w kreatorze Apilo.</li>
        </ol>
      </div>
      <EanPortablePanel />
    </main>
  );
}
