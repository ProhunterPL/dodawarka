"use client";

import { useState } from "react";
import type { ApiloCategory } from "@/lib/apilo/types";

interface CategoryPickerProps {
  value: number[];
  label: string;
  onValueChange: (ids: number[]) => void;
  onLabelChange: (label: string) => void;
}

export function CategoryPicker({
  value,
  label,
  onValueChange,
  onLabelChange,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<ApiloCategory[]>([]);
  const [query, setQuery] = useState(label);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadCategories(search = "") {
    setLoading(true);
    setError(null);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/apilo/categories${params}`);
      const data = (await response.json()) as {
        categories?: ApiloCategory[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "Nie udało się pobrać kategorii.");
      }
      setCategories(data.categories ?? []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania kategorii.");
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(category: ApiloCategory) {
    onValueChange([Number(category.id)]);
    onLabelChange(category.name);
    setQuery(category.name);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onLabelChange(event.target.value);
          }}
          placeholder="Szukaj kategorii Apilo, np. T-shirt"
          className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={() => void loadCategories(query)}
          className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700"
        >
          {loading ? "Ładowanie…" : loaded ? "Szukaj" : "Pobierz kategorie"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {value.length > 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Wybrana kategoria ID: {value.join(", ")} ({label})
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          Wybierz kategorię z listy lub dopasuj ręcznie po imporcie w Apilo.
        </p>
      )}

      <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {categories.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            {loading
              ? "Pobieranie kategorii…"
              : loaded
                ? "Brak wyników."
                : "Kliknij „Pobierz kategorie”, aby załadować listę z Apilo."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {categories.slice(0, 30).map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => selectCategory(category)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span>{category.name}</span>
                  <span className="text-zinc-400">#{category.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
