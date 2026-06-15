"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AiSuggestionsPanel } from "@/components/AiSuggestionsPanel";
import { ChannelChecklist } from "@/components/ChannelChecklist";
import { CategoryPicker } from "@/components/CategoryPicker";
import { applyAiSuggestions } from "@/lib/ai/apply-suggestions";
import type { AiProductSuggestions } from "@/lib/ai/types";
import { APILO_NEXT_STEPS } from "@/lib/product/channels";
import { TEST_PRODUCT } from "@/lib/product/test-product";
import type { ProductFormInput, ProductVariantInput, ValidationIssue } from "@/lib/product/types";
import { buildApiloPayload, validateProductInput } from "@/lib/product/validation";

type Step = "form" | "preview" | "result";

interface ImportResult {
  success: boolean;
  dryRun?: boolean;
  payload?: unknown[];
  apiloProductIds?: number[];
  channelNote?: string;
  message?: string;
  validation?: { issues: ValidationIssue[] };
  aiSuggestions?: AiProductSuggestions | null;
  details?: unknown;
}

const inputClassName =
  "w-full rounded-xl border border-zinc-300 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-950";

export function ProductWizard() {
  const [step, setStep] = useState<Step>("form");
  const [product, setProduct] = useState<ProductFormInput>(TEST_PRODUCT);
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiProductSuggestions | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const validation = useMemo(() => validateProductInput(product), [product]);
  const previewPayload = useMemo(() => buildApiloPayload(product), [product]);
  const hasValidationIssues = validation.issues.length > 0;

  async function requestAiFixes(context?: {
    apiloError?: { message: string; status?: number; details?: unknown };
  }) {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          validationIssues: validation.issues,
          apiloError: context?.apiloError,
        }),
      });
      const data = (await response.json()) as {
        suggestions?: AiProductSuggestions | null;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "Nie udało się uzyskać sugestii AI.");
      }
      setAiSuggestions(data.suggestions ?? null);
    } catch (error) {
      setAiSuggestions({
        summary:
          error instanceof Error ? error.message : "Błąd asystenta AI.",
        suggestions: [],
      });
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiFixes() {
    if (!aiSuggestions?.suggestions.length) {
      return;
    }
    setProduct((current) => applyAiSuggestions(current, aiSuggestions.suggestions));
    setAiSuggestions(null);
    setStep("form");
    setResult(null);
  }

  function updateField<K extends keyof ProductFormInput>(
    key: K,
    value: ProductFormInput[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
  }

  function updateVariant(index: number, patch: Partial<ProductVariantInput>) {
    setProduct((current) => ({
      ...current,
      variants: current.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    }));
  }

  async function submitImport() {
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/apilo/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, dryRun }),
      });
      const data = (await response.json()) as ImportResult;
      setResult(data);
      if (data.aiSuggestions) {
        setAiSuggestions(data.aiSuggestions);
      } else if (!data.success) {
        void requestAiFixes({
          apiloError: {
            message: data.message ?? "Import nieudany",
            details: data.details,
          },
        });
      }
      setStep("result");
    } catch (error) {
      setResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Nie udało się wysłać produktu.",
      });
      setStep("result");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "preview") {
    return (
      <div className="space-y-6">
        <ValidationPanel issues={validation.issues} />
        {(hasValidationIssues || aiSuggestions) && (
          <AiSuggestionsPanel
            suggestions={aiSuggestions}
            loading={aiLoading}
            onRequest={() => void requestAiFixes()}
            onApply={applyAiFixes}
          />
        )}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium">Podgląd payloadu Apilo</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">
            {JSON.stringify(previewPayload, null, 2)}
          </pre>
        </section>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Wróć do formularza
          </button>
          <button
            type="button"
            disabled={!validation.valid || submitting}
            onClick={() => void submitImport()}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting
              ? "Wysyłanie…"
              : dryRun
                ? "Uruchom dry-run"
                : "Wyślij do Apilo"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="space-y-6">
        <section
          className={`rounded-2xl border p-6 ${
            result.success
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          }`}
        >
          <h2 className="text-lg font-medium">
            {result.success ? "Import zakończony" : "Import nieudany"}
          </h2>
          <p className="mt-2 text-sm">
            {result.channelNote ?? result.message ?? "Sprawdź szczegóły poniżej."}
          </p>
          {result.apiloProductIds?.length ? (
            <p className="mt-2 text-sm">
              ID produktu w Apilo: {result.apiloProductIds.join(", ")}
            </p>
          ) : null}
        </section>

        {result.payload ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium">Payload (dry-run)</h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">
              {JSON.stringify(result.payload, null, 2)}
            </pre>
          </section>
        ) : null}

        {!result.success ? (
          <AiSuggestionsPanel
            suggestions={aiSuggestions}
            loading={aiLoading}
            onRequest={() =>
              void requestAiFixes({
                apiloError: {
                  message: result.message ?? "Import nieudany",
                  details: result.details,
                },
              })
            }
            onApply={applyAiFixes}
          />
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="font-medium">Kolejne kroki w Apilo</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {APILO_NEXT_STEPS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep("form");
              setResult(null);
            }}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Edytuj produkt
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setProduct(TEST_PRODUCT)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Wczytaj produkt testowy
        </button>
        <label className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Tryb dry-run (bez wysyłki do Apilo)
        </label>
      </div>

      <ValidationPanel issues={validation.issues} />

      {(hasValidationIssues || aiSuggestions) && (
        <AiSuggestionsPanel
          suggestions={aiSuggestions}
          loading={aiLoading}
          onRequest={() => void requestAiFixes()}
          onApply={applyAiFixes}
        />
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Dane podstawowe</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nazwa grupy produktu">
            <input
              className={inputClassName}
              value={product.groupName}
              onChange={(e) => updateField("groupName", e.target.value)}
            />
          </Field>
          <Field label="Nazwa wariantu / produktu">
            <input
              className={inputClassName}
              value={product.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </Field>
          <Field label="SKU główne">
            <input
              className={inputClassName}
              value={product.sku}
              onChange={(e) => updateField("sku", e.target.value)}
            />
          </Field>
          <Field label="EAN">
            <input
              className={inputClassName}
              value={product.ean}
              onChange={(e) => updateField("ean", e.target.value)}
            />
          </Field>
          <Field label="Cena brutto">
            <input
              className={inputClassName}
              value={product.priceWithTax}
              onChange={(e) => updateField("priceWithTax", e.target.value)}
            />
          </Field>
          <Field label="VAT (%)">
            <input
              className={inputClassName}
              value={product.tax}
              onChange={(e) => updateField("tax", e.target.value)}
            />
          </Field>
          <Field label="Stan magazynowy (bez wariantów)">
            <input
              type="number"
              className={inputClassName}
              value={product.quantity}
              onChange={(e) => updateField("quantity", Number(e.target.value))}
            />
          </Field>
          <Field label="Waga (kg)">
            <input
              type="number"
              step="0.01"
              className={inputClassName}
              value={product.weight}
              onChange={(e) => updateField("weight", Number(e.target.value))}
            />
          </Field>
          <Field label="Status">
            <select
              className={inputClassName}
              value={product.status}
              onChange={(e) =>
                updateField("status", e.target.value as ProductFormInput["status"])
              }
            >
              <option value="draft">Szkic (nieaktywny)</option>
              <option value="active">Aktywny</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Opisy</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Opis krótki">
            <input
              className={inputClassName}
              value={product.shortDescription}
              onChange={(e) => updateField("shortDescription", e.target.value)}
            />
          </Field>
          <Field label="Opis długi">
            <textarea
              rows={8}
              className={inputClassName}
              value={product.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Warianty rozmiarów</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2">Rozmiar</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Stan</th>
                <th className="px-3 py-2">EAN</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant, index) => (
                <tr key={variant.size} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="px-3 py-2 font-medium">{variant.size}</td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClassName}
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, { sku: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className={inputClassName}
                      value={variant.quantity}
                      onChange={(e) =>
                        updateVariant(index, { quantity: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClassName}
                      value={variant.ean ?? ""}
                      onChange={(e) => updateVariant(index, { ean: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Zdjęcia (URL)</h2>
        <div className="mt-4 space-y-3">
          {product.imageUrls.map((url, index) => (
            <input
              key={`image-${index}`}
              className={inputClassName}
              value={url}
              onChange={(e) => {
                const next = [...product.imageUrls];
                next[index] = e.target.value;
                updateField("imageUrls", next);
              }}
              placeholder="https://..."
            />
          ))}
          <button
            type="button"
            onClick={() => updateField("imageUrls", [...product.imageUrls, ""])}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Dodaj URL zdjęcia
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Kategoria Apilo</h2>
        <div className="mt-4">
          <CategoryPicker
            value={product.categoryIds}
            label={product.categoryLabel}
            onValueChange={(ids) => updateField("categoryIds", ids)}
            onLabelChange={(label) => updateField("categoryLabel", label)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Kanały docelowe</h2>
        <p className="mt-1 text-sm text-zinc-500">
          W MVP synchronizacja odbywa się w panelu Apilo po utworzeniu produktu.
        </p>
        <div className="mt-4">
          <ChannelChecklist
            selected={product.selectedChannels}
            onChange={(channels) => updateField("selectedChannels", channels)}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!validation.valid}
          onClick={() => setStep("preview")}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Podgląd payloadu
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        Walidacja OK — brak błędów blokujących.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {issues.map((issue, index) => (
        <p
          key={`${issue.field}-${index}`}
          className={`text-sm ${
            issue.severity === "error" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
          }`}
        >
          [{issue.severity}] {issue.field}: {issue.message}
        </p>
      ))}
    </div>
  );
}
