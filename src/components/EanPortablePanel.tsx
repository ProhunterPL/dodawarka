"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductFormInput } from "@/lib/product/types";
import {
  downloadGs1CatalogCsv,
  downloadProductEanTemplateXlsx,
  readFileAsBase64,
} from "@/lib/ean/download-client";

interface EanPortablePanelProps {
  initialProducts?: ProductFormInput[];
  onProductsUpdated?: (products: ProductFormInput[]) => void;
  compact?: boolean;
}

export function EanPortablePanel({
  initialProducts = [],
  onProductsUpdated,
  compact = false,
}: EanPortablePanelProps) {
  const [gs1Files, setGs1Files] = useState<string[]>([]);
  const [selectedGs1File, setSelectedGs1File] = useState("");
  const [products, setProducts] = useState<ProductFormInput[]>(initialProducts);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/ean/portable?action=info")
      .then((response) => response.json())
      .then((data: { success?: boolean; files?: string[]; selectedFile?: string }) => {
        if (data.files) {
          setGs1Files(data.files);
          setSelectedGs1File(data.selectedFile ?? data.files[0] ?? "");
        }
      })
      .catch(() => {
        setGs1Files([]);
      });
  }, []);

  useEffect(() => {
    if (initialProducts.length > 0) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  const exportGs1 = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await downloadGs1CatalogCsv(selectedGs1File || undefined);
      setMessage("Wyeksportowano katalog GS1 do CSV (podgląd kodów).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd eksportu GS1.");
    } finally {
      setLoading(false);
    }
  }, [selectedGs1File]);

  const exportProducts = useCallback(async () => {
    if (products.length === 0) {
      setError("Brak produktów do eksportu. Najpierw pobierz produkty z Koszulker.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await downloadProductEanTemplateXlsx(products);
      setProducts(result.products);
      onProductsUpdated?.(result.products);
      setMessage(
        result.assignedCount > 0
          ? `Wyeksportowano ${products.length} produktów do MojeGS1 (XLSX). Nadano ${result.assignedCount} nowych GTIN z puli.${result.nextGtin ? ` Następny wolny: ${result.nextGtin}.` : ""}`
          : `Wyeksportowano ${products.length} produktów do MojeGS1 (XLSX). Wszystkie warianty miały już GTIN.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd eksportu szablonu.");
    } finally {
      setLoading(false);
    }
  }, [products]);

  const applyXlsxFile = useCallback(
    async (file: File) => {
      if (products.length === 0) {
        setError("Brak produktów — najpierw pobierz produkty z Koszulker.");
        return;
      }

      setLoading(true);
      setError(null);
      setMessage(null);
      setImportFileName(file.name);

      try {
        const xlsxBase64 = await readFileAsBase64(file);
        const response = await fetch("/api/ean/portable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply",
            products,
            xlsxBase64,
          }),
        });
        const data = (await response.json()) as {
          success: boolean;
          products?: ProductFormInput[];
          assignedCount?: number;
          errors?: Array<{ row: number; message: string }>;
          message?: string;
        };

        if (!response.ok || !data.success || !data.products) {
          throw new Error(data.message ?? "Nie udało się zaimportować EAN z XLSX.");
        }

        setProducts(data.products);
        onProductsUpdated?.(data.products);

        const errorNote =
          data.errors && data.errors.length > 0
            ? ` Ostrzeżenia: ${data.errors.length} wierszy z błędami.`
            : "";
        setMessage(
          `Zaimportowano EAN z ${file.name} (${data.assignedCount ?? 0} wierszy z GTIN).${errorNote}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd importu EAN.");
      } finally {
        setLoading(false);
      }
    },
    [onProductsUpdated, products],
  );

  return (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-8"}>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Eksport szablonu MojeGS1 (XLSX)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Format jak <code>ean_koszulki_warianty_uzupelnione.xlsx</code> — arkusz MojeGS1, jeden
          wiersz na wariant. Przy eksporcie nadajemy kolejne GTIN z puli (na podstawie plików w{" "}
          <code>kody_ean/</code>). Kolumna <code>Symbol wewnętrzny</code> = SKU. Produkty:{" "}
          {products.length}.
        </p>
        <button
          type="button"
          onClick={() => void exportProducts()}
          disabled={loading || products.length === 0}
          className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Eksportuj do MojeGS1 (XLSX)
        </button>
      </section>

      {!compact ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium">Podgląd katalogu GS1</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Opcjonalnie: eksport istniejącego pliku z <code>kody_ean/</code> do CSV (szybki podgląd
            kodów).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedGs1File}
              onChange={(event) => setSelectedGs1File(event.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              disabled={gs1Files.length === 0}
            >
              {gs1Files.length === 0 ? (
                <option value="">Brak plików .xlsx w kody_ean/</option>
              ) : (
                gs1Files.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void exportGs1()}
              disabled={loading || gs1Files.length === 0}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Podgląd GS1 → CSV
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Import EAN z MojeGS1 (XLSX)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Wgraj plik XLSX po eksporcie (GTIN już nadane) lub po zatwierdzeniu w GS1. Dopasowanie po
          kolumnie <code>Symbol wewnętrzny</code> (SKU).
        </p>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={loading || products.length === 0}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void applyXlsxFile(file);
            }
            event.target.value = "";
          }}
          className="mt-4 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-orange-500"
        />
        {importFileName ? (
          <p className="mt-2 text-xs text-zinc-500">Ostatni plik: {importFileName}</p>
        ) : null}
      </section>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
