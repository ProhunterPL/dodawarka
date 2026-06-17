import { KoszulkerImportPanel } from "@/components/KoszulkerImportPanel";

export default function ImportProductsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Import zewnętrzny
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Import z Koszulker</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Pobierz produkty ze sklepu Koszulker (zdjęcia, opisy, rozmiary) i prześlij je do
          Apilo przez kreator produktów.
        </p>
      </div>
      <KoszulkerImportPanel />
    </main>
  );
}
