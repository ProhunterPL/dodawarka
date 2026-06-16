"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BatchImportResult, BatchPreviewResult } from "@/lib/batch/types";
import { BATCH_CSV_COLUMNS } from "@/lib/batch/types";

type Step = "upload" | "preview" | "result";

export function BatchImportPanel() {
  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BatchPreviewResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!preview) {
      return null;
    }
    return `${preview.groupCount} grup produktów, ${preview.rowCount} wierszy CSV`;
  }, [preview]);

  async function loadFile(file: File) {
    const text = await file.text();
    setCsv(text);
    setError(null);
  }

  async function runPreview() {
    if (!csv.trim()) {
      setError("Wklej plik CSV lub wybierz plik.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csv }),
      });
      const data = (await response.json()) as {
        preview?: BatchPreviewResult;
        message?: string;
      };

      if (!response.ok || !data.preview) {
        throw new Error(data.message ?? "Nie udało się przetworzyć CSV.");
      }

      setPreview(data.preview);
      setStep("preview");
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Błąd podglądu CSV.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    if (!csv.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", csv, dryRun }),
      });
      const data = (await response.json()) as {
        batch?: BatchImportResult;
        preview?: BatchPreviewResult;
        message?: string;
      };

      if (data.preview) {
        setPreview(data.preview);
      }

      if (!response.ok || !data.batch) {
        throw new Error(data.message ?? "Import batch nie powiódł się.");
      }

      setBatchResult(data.batch);
      setStep("result");
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "Błąd importu batch.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "result" && batchResult) {
    return (
      <div className="space-y-6">
        <section
          className={`rounded-2xl border p-6 ${
            batchResult.failedCount === 0
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          }`}
        >
          <h2 className="text-lg font-medium">Import batch zakończony</h2>
          <p className="mt-2 text-sm">
            Sukces: {batchResult.successCount} / {batchResult.totalGroups}
            {batchResult.dryRun ? " (dry-run)" : ""}
            {batchResult.failedCount > 0
              ? ` — błędy: ${batchResult.failedCount}`
              : ""}
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="font-medium">Szczegóły per grupa</h3>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {batchResult.results.map((item) => (
              <li key={`${item.groupName}-${item.sku}`} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.groupName}</p>
                    <p className="text-sm text-zinc-500">SKU: {item.sku}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                      {item.message}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.success
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {item.success ? "OK" : "Błąd"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setBatchResult(null);
            }}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Nowy import
          </button>
          <Link
            href="/"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium">Podgląd importu</h2>
          <p className="mt-1 text-sm text-zinc-500">{summary}</p>

          {preview.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {preview.parseErrors.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-red-700 dark:text-red-300">
              {preview.parseErrors.map((issue) => (
                <li key={`${issue.row}-${issue.message}`}>
                  Wiersz {issue.row}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="font-medium">Grupy produktów ({preview.products.length})</h3>
          <div className="mt-4 space-y-4">
            {preview.products.map((product) => (
              <article
                key={product.groupName}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium">{product.groupName}</p>
                <p className="text-sm text-zinc-500">
                  Warianty:{" "}
                  {product.variants.length > 0
                    ? product.variants.map((variant) => variant.sku).join(", ")
                    : product.sku || "—"}
                </p>
                <p className="text-sm text-zinc-500">
                  Kategoria: {product.categoryIds.join(", ")} — {product.categoryLabel}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Wróć
          </button>
          <label className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
            />
            Dry-run
          </label>
          <button
            type="button"
            disabled={loading || preview.parseErrors.length > 0}
            onClick={() => void runImport()}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading
              ? "Importowanie…"
              : dryRun
                ? "Uruchom dry-run batch"
                : "Importuj batch do Apilo"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Plik CSV</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Jedna linia = jeden wariant (lub produkt bez rozmiaru). Wiersze z tym samym{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">groupName</code>{" "}
          łączą się w jedną grupę wariantów. Separator: średnik (Excel PL) lub przecinek.
        </p>
        <p className="mt-2 text-sm">
          <a
            href="/templates/batch-import.csv"
            download
            className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
          >
            Pobierz szablon CSV
          </a>
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
            Wybierz plik
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void loadFile(file);
                }
              }}
            />
          </label>
        </div>

        <textarea
          rows={12}
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          placeholder={`${BATCH_CSV_COLUMNS.join(";")}\n...`}
          className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="font-medium">Kolumny</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Wymagane: groupName, sku, priceWithTax, tax, categoryIds. Opcjonalne: name, size,
          ean, quantity, weight, unit, description, shortDescription, categoryLabel, imageUrls
          (adresy rozdzielone <code>|</code>), status (draft/active), selectedChannels (
          <code>shoper|allegro|...</code>). Metadane kanałów (wystarczy w pierwszym wierszu
          grupy): allegroCategory, allegroParameters, allegroListingTitle, allegroNotes,
          shoperCategory, shoperParameters, shoperListingTitle, shoperNotes.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || !csv.trim()}
          onClick={() => void runPreview()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Przetwarzanie…" : "Podgląd importu"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
