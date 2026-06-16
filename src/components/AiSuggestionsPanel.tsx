"use client";

import type { AiProductSuggestions } from "@/lib/ai/types";

interface AiSuggestionsPanelProps {
  suggestions: AiProductSuggestions | null;
  loading?: boolean;
  onRequest?: () => void;
  onApply?: () => void;
}

export function AiSuggestionsPanel({
  suggestions,
  loading = false,
  onRequest,
  onApply,
}: AiSuggestionsPanelProps) {
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-violet-950 dark:text-violet-100">
            Asystent AI (OpenAI)
          </h3>
          <p className="mt-1 text-sm text-violet-800 dark:text-violet-300">
            Uzupełnia braki w opisie, kategorii i innych polach na podstawie błędów Apilo.
          </p>
        </div>
        {onRequest ? (
          <button
            type="button"
            onClick={onRequest}
            disabled={loading}
            className="rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Analizuję…" : "Popraw z AI"}
          </button>
        ) : null}
      </div>

      {suggestions ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-violet-900 dark:text-violet-200">{suggestions.summary}</p>
          <ul className="space-y-2">
            {suggestions.suggestions.map((item, index) => (
              <li
                key={`${item.field}-${index}`}
                className="rounded-xl border border-violet-200 bg-white/70 p-3 text-sm dark:border-violet-800 dark:bg-black/20"
              >
                <p className="font-medium">{item.field}</p>
                <p className="mt-1 break-words text-zinc-700 dark:text-zinc-300">
                  {formatValue(item.value)}
                </p>
                <p className="mt-1 text-zinc-500">{item.reason}</p>
              </li>
            ))}
          </ul>
          {onApply && suggestions.suggestions.length > 0 ? (
            <button
              type="button"
              onClick={onApply}
              className="rounded-full border border-violet-400 px-4 py-2 text-sm font-medium text-violet-900 dark:text-violet-100"
            >
              Zastosuj poprawki AI
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return value.join(", ");
    }
    return JSON.stringify(value, null, 2);
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
