"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AiSuggestionsPanel } from "@/components/AiSuggestionsPanel";
import { ChannelMetadataPanel, ChannelMetadataSummary } from "@/components/ChannelMetadataPanel";
import { CategoryPicker } from "@/components/CategoryPicker";
import { ImageUploader } from "@/components/ImageUploader";
import { applyAiSuggestions } from "@/lib/ai/apply-suggestions";
import { downloadProductEanTemplateXlsx } from "@/lib/ean/download-client";
import type { AiProductSuggestions } from "@/lib/ai/types";
import { APILO_NEXT_STEPS } from "@/lib/product/channels";
import { generateSkus } from "@/lib/product/sku";
import { stripProductIdentifiers } from "@/lib/product/template";
import { collectProductSkus } from "@/lib/apilo/product-utils";
import {
  DEFAULT_VARIANT_SIZES,
  TEST_PRODUCT,
  TEST_PRODUCT_WOMEN,
} from "@/lib/product/test-product";
import type { ProductFormInput, ProductUpdateScope, ProductVariantInput, ValidationIssue } from "@/lib/product/types";
import { applyMetadataFixes, describeMetadataFix } from "@/lib/product/metadata-fix";
import {
  buildApiloMetadataPreview,
  buildApiloMetadataPutPayload,
} from "@/lib/apilo/metadata-payload";
import {
  buildApiloPatchPayload,
  buildApiloPayload,
  buildApiloPutPayload,
  validateProductInput,
} from "@/lib/product/validation";

type Step = "form" | "preview" | "result";

interface ImportResult {
  success: boolean;
  dryRun?: boolean;
  payload?: unknown[];
  metadataPreview?: import("@/lib/apilo/metadata-payload").ApiloMetadataPreviewItem[];
  apiloProductIds?: number[];
  updateScope?: ProductUpdateScope;
  updatedCount?: number;
  channelNote?: string;
  message?: string;
  validation?: { issues: ValidationIssue[] };
  aiSuggestions?: AiProductSuggestions | null;
  details?: unknown;
}

interface ProductWizardProps {
  mode?: "create" | "update";
  localProductId?: string;
  initialProduct?: ProductFormInput;
  apiloIdsBySku?: Record<string, number>;
  canUpdate?: boolean;
}

interface ProductTemplateOption {
  id: string;
  name: string;
}

const inputClassName =
  "w-full rounded-xl border border-zinc-300 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-950";

export function ProductWizard({
  mode = "create",
  localProductId,
  initialProduct,
  apiloIdsBySku: initialApiloIds = {},
  canUpdate = true,
}: ProductWizardProps = {}) {
  const isUpdateMode = mode === "update";
  const [step, setStep] = useState<Step>("form");
  const [product, setProduct] = useState<ProductFormInput>(
    initialProduct ?? TEST_PRODUCT,
  );
  const [apiloIdsBySku] = useState<Record<string, number>>(initialApiloIds);
  const [updateScope, setUpdateScope] = useState<ProductUpdateScope>("full");
  const [dryRun, setDryRun] = useState(isUpdateMode ? false : true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiProductSuggestions | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [requireImages, setRequireImages] = useState(false);
  const [eanLoading, setEanLoading] = useState(false);
  const [eanMessage, setEanMessage] = useState<string | null>(null);
  const [unlockingSkus, setUnlockingSkus] = useState(false);
  const [skuLockMessage, setSkuLockMessage] = useState<string | null>(null);
  const [eanFiles, setEanFiles] = useState<string[]>([]);
  const [selectedEanFile, setSelectedEanFile] = useState("");
  const [templates, setTemplates] = useState<ProductTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [metadataFixMessage, setMetadataFixMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/uploads")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        setRequireImages(Boolean(data.configured));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/ean/gs1")
      .then((response) => response.json())
      .then((data: { files?: string[]; selectedFile?: string | null }) => {
        const files = data.files ?? [];
        setEanFiles(files);
        setSelectedEanFile(data.selectedFile ?? files[0] ?? "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isUpdateMode) {
      return;
    }
    void fetch("/api/templates")
      .then((response) => response.json())
      .then((data: { templates?: ProductTemplateOption[] }) => {
        setTemplates(data.templates ?? []);
      })
      .catch(() => undefined);
  }, [isUpdateMode]);

  const validation = useMemo(
    () =>
      validateProductInput(
        { ...product, apiloIdsBySku },
        {
          requireImages:
            isUpdateMode && (updateScope === "quick" || updateScope === "metadata")
              ? false
              : requireImages,
          updateMode: isUpdateMode,
          ownSkus: isUpdateMode ? Object.keys(apiloIdsBySku) : undefined,
        },
      ),
    [product, requireImages, isUpdateMode, updateScope, apiloIdsBySku],
  );
  const previewPayload = useMemo(() => {
    if (isUpdateMode) {
      if (updateScope === "quick") {
        return buildApiloPatchPayload({ ...product, apiloIdsBySku }, apiloIdsBySku);
      }
      if (updateScope === "metadata") {
        return {
          zmienianeMetadane: buildApiloMetadataPreview({ ...product, apiloIdsBySku }, apiloIdsBySku),
          pelnyPutDoApilo: buildApiloMetadataPutPayload(
            { ...product, apiloIdsBySku },
            apiloIdsBySku,
          ),
        };
      }
      return buildApiloPutPayload({ ...product, apiloIdsBySku }, apiloIdsBySku);
    }
    return buildApiloPayload(product);
  }, [product, isUpdateMode, updateScope, apiloIdsBySku]);
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

  function removeVariant(index: number) {
    setProduct((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== index),
    }));
  }

  function addVariant(size: string) {
    setProduct((current) => {
      if (current.variants.some((variant) => variant.size === size)) {
        return current;
      }
      const skuPrefix =
        current.variants[0]?.sku.replace(/-(XS|S|M|L|XL|2XL|3XL)$/i, "") ||
        current.sku.replace(/-(XS|S|M|L|XL|2XL|3XL)$/i, "");

      return {
        ...current,
        variants: [
          ...current.variants,
          {
            size,
            sku: skuPrefix ? `${skuPrefix}-${size}` : "",
            quantity: 0,
          },
        ],
      };
    });
  }

  async function autofillEansFromGs1() {
    setEanLoading(true);
    setEanMessage(null);
    try {
      const response = await fetch("/api/ean/gs1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          filename: selectedEanFile || undefined,
        }),
      });
      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        mainEan?: string | null;
        variantEans?: Record<string, string>;
        matchedRows?: Array<{ size: string | null; ean: string; name: string }>;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Nie udało się wczytać EAN z pliku GS1.");
      }

      setProduct((current) => ({
        ...current,
        ean: data.mainEan ?? current.ean,
        variants: current.variants.map((variant) => ({
          ...variant,
          ean: data.variantEans?.[variant.size.toUpperCase()] ?? variant.ean,
        })),
      }));

      setEanMessage(
        data.matchedRows?.length
          ? `Uzupełniono EAN dla ${data.matchedRows.length} wariantów z pliku GS1.`
          : "Nie znaleziono dopasowań po nazwie/rozmiarze w pliku GS1.",
      );
    } catch (error) {
      setEanMessage(error instanceof Error ? error.message : "Błąd importu EAN.");
    } finally {
      setEanLoading(false);
    }
  }

  async function submitImport(options?: { updateScopeOverride?: ProductUpdateScope; dryRunOverride?: boolean }) {
    const scope = options?.updateScopeOverride ?? updateScope;
    const runDry = options?.dryRunOverride ?? dryRun;

    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/apilo/products", {
        method: isUpdateMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: { ...product, apiloIdsBySku },
          dryRun: runDry,
          ...(isUpdateMode
            ? {
                apiloIdsBySku,
                updateScope: scope,
                localProductId,
              }
            : {}),
        }),
      });
      const raw = await response.text();
      const data = (
        raw.trim() ? JSON.parse(raw) : { success: false, message: `HTTP ${response.status}` }
      ) as ImportResult;
      setResult(data);
      if (data.success && scope === "metadata") {
        setProduct((current) => applyMetadataFixes(current));
        setMetadataFixMessage("Metadane zostały poprawione w Apilo i zapisane lokalnie.");
      }
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

  async function clearSkuLocks() {
    setUnlockingSkus(true);
    setSkuLockMessage(null);
    try {
      const skus = collectProductSkus(product);
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: skus.length > 0 ? "clearSkuLocksFor" : "clearSkuLocks",
          skus,
        }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Nie udało się wyczyścić blokady SKU.");
      }
      setSkuLockMessage(data.message ?? "Wyczyszczono blokadę SKU.");
    } catch (error) {
      setSkuLockMessage(
        error instanceof Error ? error.message : "Nie udało się wyczyścić blokady SKU.",
      );
    } finally {
      setUnlockingSkus(false);
    }
  }

  async function loadTemplate(templateId: string) {
    if (!templateId) {
      return;
    }
    try {
      const response = await fetch(`/api/templates?id=${encodeURIComponent(templateId)}`);
      const data = (await response.json()) as {
        template?: { id: string; name: string; product: ProductFormInput };
      };
      if (!response.ok || !data.template) {
        throw new Error("Nie udało się wczytać szablonu.");
      }
      setProduct(stripProductIdentifiers(data.template.product));
      setTemplateMessage(`Wczytano szablon: ${data.template.name}`);
    } catch (error) {
      setTemplateMessage(
        error instanceof Error ? error.message : "Błąd wczytywania szablonu.",
      );
    }
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) {
      setTemplateMessage("Podaj nazwę szablonu.");
      return;
    }

    setSavingTemplate(true);
    setTemplateMessage(null);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          product,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        template?: { id: string; name: string };
      };
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Nie udało się zapisać szablonu.");
      }
      if (data.template) {
        setTemplates((current) => [
          data.template!,
          ...current.filter((item) => item.id !== data.template!.id),
        ]);
        setSelectedTemplateId(data.template.id);
      }
      setTemplateName("");
      setTemplateMessage(data.message ?? "Zapisano szablon.");
    } catch (error) {
      setTemplateMessage(
        error instanceof Error ? error.message : "Błąd zapisu szablonu.",
      );
    } finally {
      setSavingTemplate(false);
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
          <h2 className="text-lg font-medium">Metadane kanałów (notatki)</h2>
          <div className="mt-3">
            <ChannelMetadataSummary
              selected={product.selectedChannels}
              metadata={product.channelMetadata}
            />
          </div>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium">
            Podgląd payloadu Apilo ({isUpdateMode ? updateScope.toUpperCase() : "CREATE"})
          </h2>
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
            disabled={!validation.valid || submitting || (isUpdateMode && !canUpdate)}
            onClick={() => void submitImport()}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting
              ? "Wysyłanie…"
              : dryRun
                ? "Uruchom dry-run"
                : isUpdateMode
                  ? "Aktualizuj w Apilo"
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
            {result.success
              ? isUpdateMode
                ? "Aktualizacja zakończona"
                : "Import zakończony"
              : isUpdateMode
                ? "Aktualizacja nieudana"
                : "Import nieudany"}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {result.channelNote ?? result.message ?? "Sprawdź szczegóły poniżej."}
          </p>
          {result.details ? (
            <pre className="mt-3 overflow-x-auto rounded-xl bg-red-950/10 p-3 text-xs text-red-900 dark:text-red-200">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          ) : null}
          {result.apiloProductIds?.length ? (
            <p className="mt-2 text-sm">
              ID produktu w Apilo: {result.apiloProductIds.join(", ")}
            </p>
          ) : null}
        </section>

        {result.metadataPreview?.length ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="font-medium text-emerald-950 dark:text-emerald-100">
              Zmieniane metadane (podsumowanie)
            </h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">
              {JSON.stringify(result.metadataPreview, null, 2)}
            </pre>
          </section>
        ) : null}

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

        {result.success ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium">Notatki kanałów do synchronizacji</h3>
            <div className="mt-3">
              <ChannelMetadataSummary
                selected={product.selectedChannels}
                metadata={product.channelMetadata}
              />
            </div>
          </section>
        ) : null}

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
      {isUpdateMode ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          Tryb aktualizacji — zmiany trafią do istniejących produktów w Apilo (ID:{" "}
          {Object.values(apiloIdsBySku).join(", ") || "brak"}).
        </div>
      ) : null}
      {isUpdateMode && canUpdate ? (
        <section
          id="metadata-fix"
          className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"
        >
          <h3 className="font-medium text-emerald-950 dark:text-emerald-100">
            Napraw metadane w Apilo
          </h3>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
            Wyśle PUT dla wszystkich wariantów: jednostka (<code>unit</code>, np.{" "}
            <code>szt.</code>), kategorie (<code>categories</code>) i producent (
            <code>PATCH /product/attributes/</code>, atrybut <code>13</code>). Opisy, ceny i
            pobrane z Apilo i nie zostaną nadpisane (w tym zdjęcia). Pole{" "}
            <code>groupName</code> jest pomijane — Apilo błędnie skleja je z nazwą przy PUT.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-900 dark:text-emerald-100">
            {describeMetadataFix(product).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting || !validation.valid}
              onClick={() =>
                void submitImport({ updateScopeOverride: "metadata", dryRunOverride: false })
              }
              className="rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-200 dark:text-emerald-950"
            >
              {submitting ? "Wysyłanie…" : "Napraw metadane w Apilo"}
            </button>
            <button
              type="button"
              disabled={submitting || !validation.valid}
              onClick={() => {
                setUpdateScope("metadata");
                setStep("preview");
              }}
              className="rounded-full border border-emerald-400 px-5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:text-emerald-100"
            >
              Podgląd payloadu metadanych
            </button>
          </div>
        </section>
      ) : null}
      {metadataFixMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {metadataFixMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {!isUpdateMode ? (
          <>
            <button
              type="button"
              onClick={() => setProduct(TEST_PRODUCT)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Wczytaj EYR męskie
            </button>
            <button
              type="button"
              onClick={() => setProduct(TEST_PRODUCT_WOMEN)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Wczytaj EYR damskie
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setProduct((current) => generateSkus(current))}
          className="rounded-full border border-purple-300 bg-purple-50 px-4 py-2 text-sm text-purple-900 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
        >
          Generuj SKU automatycznie
        </button>
        <button
          type="button"
          onClick={() => void clearSkuLocks()}
          disabled={unlockingSkus}
          className="rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-900 disabled:opacity-60 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
        >
          {unlockingSkus
            ? "Czyszczenie blokady SKU…"
            : "Odblokuj SKU z formularza"}
        </button>
        {!isUpdateMode && templates.length > 0 ? (
          <label className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
            <span>Szablon:</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTemplateId(value);
                void loadTemplate(value);
              }}
              className="rounded-md border border-violet-200 bg-white px-2 py-0.5 text-sm dark:border-violet-900 dark:bg-zinc-950"
            >
              <option value="">— wybierz —</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Tryb dry-run (bez wysyłki do Apilo)
        </label>
        {isUpdateMode ? (
          <label className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <span>Zakres:</span>
            <select
              value={updateScope}
              onChange={(event) =>
                setUpdateScope(event.target.value as ProductUpdateScope)
              }
              className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-sm dark:border-blue-900 dark:bg-zinc-950"
            >
              <option value="full">Pełna (PUT — nazwa, opisy, zdjęcia)</option>
              <option value="quick">Szybka (PATCH — cena, stan, VAT)</option>
              <option value="metadata">Metadane (PUT + PATCH — jednostka, kategoria, producent)</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => void autofillEansFromGs1()}
          disabled={eanLoading || eanFiles.length === 0}
          className="rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
        >
          {eanLoading ? "Wczytywanie EAN z GS1…" : "Wczytaj EAN z pliku GS1"}
        </button>
        <button
          type="button"
          onClick={() =>
            void downloadProductEanTemplateXlsx([product])
              .then((result) => {
                setProduct(result.products[0] ?? product);
                setEanMessage(
                  result.assignedCount > 0
                    ? `Wyeksportowano MojeGS1 i nadano ${result.assignedCount} GTIN z puli.`
                    : "Wyeksportowano MojeGS1 (XLSX).",
                );
              })
              .catch((error) => {
                setEanMessage(error instanceof Error ? error.message : "Błąd eksportu EAN.");
              })
          }
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Eksportuj MojeGS1 (XLSX)
        </button>
        {!dryRun ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Wysyłka do Apilo włączona
          </span>
        ) : null}
      </div>
      {eanMessage ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          {eanMessage}
        </p>
      ) : null}
      {skuLockMessage ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          {skuLockMessage}
        </p>
      ) : null}
      {templateMessage ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          {templateMessage}
        </p>
      ) : null}
      {!isUpdateMode ? (
        <section className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <h3 className="text-sm font-medium text-violet-900 dark:text-violet-200">
            Zapisz bieżący formularz jako szablon
          </h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className={`${inputClassName} max-w-sm`}
              placeholder="Nazwa szablonu, np. Koszulka Incore"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <button
              type="button"
              disabled={savingTemplate}
              onClick={() => void saveAsTemplate()}
              className="rounded-full border border-violet-300 bg-white px-4 py-2 text-sm dark:border-violet-900 dark:bg-zinc-950"
            >
              {savingTemplate ? "Zapisywanie…" : "Zapisz szablon"}
            </button>
            <Link
              href="/products"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Katalog produktów
            </Link>
          </div>
        </section>
      ) : null}
      <div className="max-w-xl">
        <Field label="Plik GS1 (kody_ean)">
          <select
            className={inputClassName}
            value={selectedEanFile}
            onChange={(e) => setSelectedEanFile(e.target.value)}
            disabled={eanFiles.length === 0}
          >
            {eanFiles.length === 0 ? (
              <option value="">Brak plików .xlsx w katalogu kody_ean</option>
            ) : null}
            {eanFiles.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </Field>
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
        <div className="mt-3 flex flex-wrap gap-2">
          {DEFAULT_VARIANT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => addVariant(size)}
              disabled={product.variants.some((variant) => variant.size === size)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              Dodaj {size}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2">Rozmiar</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Stan</th>
                <th className="px-3 py-2">EAN</th>
                {isUpdateMode ? <th className="px-3 py-2">ID Apilo</th> : null}
                <th className="px-3 py-2">Akcje</th>
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
                  {isUpdateMode ? (
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {apiloIdsBySku[variant.sku.trim()] ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-300"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Zdjęcia produktu</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Zalecany sposób: upload na S3 (publiczny URL dla Apilo). Linki OneDrive nie działają
          jako bezpośrednie obrazy.
        </p>
        <div className="mt-4">
          <ImageUploader
            urls={product.imageUrls}
            onChange={(urls) => updateField("imageUrls", urls)}
          />
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
        <h2 className="text-lg font-medium">Kanały docelowe i metadane</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Zaznacz kanały i zapisz notatki (kategoria, parametry, tytuł). Publikacja nadal
          odbywa się ręcznie w panelu Apilo — te dane są podpowiedzią operacyjną.
        </p>
        <div className="mt-4">
          <ChannelMetadataPanel
            selected={product.selectedChannels}
            metadata={product.channelMetadata}
            onSelectedChange={(channels) => updateField("selectedChannels", channels)}
            onMetadataChange={(channelMetadata) =>
              updateField("channelMetadata", channelMetadata)
            }
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!validation.valid || (isUpdateMode && !canUpdate)}
          onClick={() => setStep("preview")}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isUpdateMode ? "Podgląd aktualizacji" : "Podgląd payloadu"}
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
