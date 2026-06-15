import { ProductWizard } from "@/components/ProductWizard";

export default function NewProductPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Nowy produkt
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dodaj produkt</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Uzupełnij dane, sprawdź payload i wyślij do Apilo (lub użyj dry-run).
        </p>
      </div>
      <ProductWizard />
    </main>
  );
}
