import { KoszulkerImportPanel } from "@/components/KoszulkerImportPanel";
import { TeamPrintedImportPanel } from "@/components/TeamPrintedImportPanel";

export default function ImportProductsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Import zewnętrzny
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Import ze sklepów</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Pobierz produkty z Koszulker lub TeamPrinted Incore Store i prześlij je do Apilo
          przez kreator (z EAN z katalogu GS1).
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Koszulker</h2>
        <KoszulkerImportPanel />
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <h2 className="text-xl font-semibold">TeamPrinted — Incore Sports Store</h2>
        <TeamPrintedImportPanel />
      </section>
    </main>
  );
}
