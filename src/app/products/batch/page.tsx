import { BatchImportPanel } from "@/components/BatchImportPanel";

export default function BatchImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Import zbiorczy
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Batch import CSV</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Wgraj plik CSV z wieloma produktami lub wariantami. Każda grupa trafia do Apilo
          osobno, z fallbackiem wariant po wariancie.
        </p>
      </div>
      <BatchImportPanel />
    </main>
  );
}
