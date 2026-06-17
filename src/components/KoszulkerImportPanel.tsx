"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductFormInput } from "@/lib/product/types";
import { EanPortablePanel } from "@/components/EanPortablePanel";

const STORAGE_KEY = "koszulker-import-product";
const DEFAULT_SOURCE = "https://incoresports.koszulker.pl/";

interface ListItem {
  productId: string;
  title: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  gender: string;
}

interface FetchedProduct {
  url: string;
  error?: string;
  product?: ProductFormInput;
  detail?: {
    title: string;
    garmentType: string;
    color: string;
    sizes: string[];
    imageUrls: string[];
    sourceUrl: string;
  };
}

function genderLabel(gender: string): string {
  if (gender === "mezczyzna") return "Mężczyzna";
  if (gender === "kobieta") return "Kobieta";
  return "—";
}

export function KoszulkerImportPanel() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FetchedProduct[]>([]);
  const [defaultQuantity, setDefaultQuantity] = useState(10);

  const loadListing = useCallback(async (url: string) => {
    setListLoading(true);
    setListError(null);
    setSelected(new Set());
    setFetched([]);

    try {
      const response = await fetch(
        `/api/scrape/koszulker?action=list&url=${encodeURIComponent(url)}`,
      );
      const data = (await response.json()) as {
        ok: boolean;
        items?: ListItem[];
        error?: string;
      };

      if (!response.ok || !data.ok || !data.items) {
        throw new Error(data.error ?? "Nie udało się pobrać listy produktów");
      }

      setItems(data.items);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Błąd listy produktów");
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListing(DEFAULT_SOURCE);
  }, [loadListing]);

  const allSelected = items.length > 0 && selected.size === items.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((item) => item.productUrl)));
  };

  const toggleOne = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const selectedUrls = useMemo(
    () => items.filter((item) => selected.has(item.productUrl)).map((item) => item.productUrl),
    [items, selected],
  );

  const fetchedProducts = useMemo(
    () =>
      fetched
        .map((entry) => entry.product)
        .filter((product): product is ProductFormInput => Boolean(product)),
    [fetched],
  );

  const handleEanProductsUpdated = (updated: ProductFormInput[]) => {
    const byGroup = new Map(updated.map((product) => [product.groupName, product]));
    setFetched((prev) =>
      prev.map((entry) => {
        if (!entry.product) {
          return entry;
        }
        const match = byGroup.get(entry.product.groupName);
        return match ? { ...entry, product: match } : entry;
      }),
    );
  };

  const fetchSelected = async () => {
    if (selectedUrls.length === 0) {
      return;
    }

    setFetching(true);
    setFetchError(null);

    try {
      const response = await fetch("/api/scrape/koszulker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: selectedUrls,
          defaultQuantity,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        items?: FetchedProduct[];
        error?: string;
      };

      if (!response.ok || !data.ok || !data.items) {
        throw new Error(data.error ?? "Nie udało się pobrać szczegółów produktów");
      }

      setFetched(data.items);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Błąd pobierania szczegółów");
    } finally {
      setFetching(false);
    }
  };

  const openInWizard = (product: ProductFormInput) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(product));
    router.push("/products/new?source=koszulker");
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">Źródło produktów</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Pobieramy listę ze sklepu Koszulker (np. subdomena Incore Sports). Zdjęcia są
          publicznymi URL-ami — możesz je zostawić lub przesłać na S3 w kreatorze.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            className="w-full flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="https://incoresports.koszulker.pl/"
          />
          <button
            type="button"
            onClick={() => void loadListing(sourceUrl)}
            disabled={listLoading}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {listLoading ? "Ładowanie…" : "Odśwież listę"}
          </button>
        </div>
        {listError ? <p className="mt-3 text-sm text-red-600">{listError}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Produkty na liście</h2>
            <p className="text-sm text-zinc-500">
              {listLoading ? "…" : `${items.length} pozycji`}
              {selected.size > 0 ? ` · zaznaczono ${selected.size}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span>Stan mag.:</span>
              <input
                type="number"
                min={0}
                value={defaultQuantity}
                onChange={(event) => setDefaultQuantity(Number(event.target.value) || 0)}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <button
              type="button"
              onClick={toggleAll}
              disabled={items.length === 0}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
            </button>
            <button
              type="button"
              onClick={() => void fetchSelected()}
              disabled={fetching || selectedUrls.length === 0}
              className="rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-500 disabled:opacity-50"
            >
              {fetching ? "Pobieranie…" : `Pobierz szczegóły (${selectedUrls.length})`}
            </button>
          </div>
        </div>

        {items.length === 0 && !listLoading ? (
          <p className="mt-6 text-sm text-zinc-500">Brak produktów na liście.</p>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-4 py-4">
                <input
                  type="checkbox"
                  checked={selected.has(item.productUrl)}
                  onChange={() => toggleOne(item.productUrl)}
                  className="mt-3 h-4 w-4"
                />
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-zinc-500">
                    ID {item.productId} · {genderLabel(item.gender)} · {item.price} zł
                  </p>
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Podgląd w sklepie
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {fetchError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {fetchError}
        </p>
      ) : null}

      {fetched.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium">Pobrane produkty</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Sprawdź dane i otwórz w kreatorze, aby dodać do Apilo (dry-run lub import).
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {fetched.map((entry) => (
              <li
                key={entry.url}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                {entry.error ? (
                  <p className="text-sm text-red-600">{entry.error}</p>
                ) : entry.product && entry.detail ? (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      {entry.detail.imageUrls[0] ? (
                        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                          <Image
                            src={entry.detail.imageUrls[0]}
                            alt={entry.detail.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      <div>
                        <p className="font-medium">{entry.product.groupName}</p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {entry.detail.garmentType}
                          {entry.detail.color ? ` · ${entry.detail.color}` : ""}
                          {entry.detail.sizes.length > 0
                            ? ` · rozmiary: ${entry.detail.sizes.join(", ")}`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {entry.product.priceWithTax} zł · {entry.product.imageUrls.length} zdjęć
                          · SKU: {entry.product.variants.map((v) => v.sku).join(", ") || entry.product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openInWizard(entry.product!)}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Otwórz w kreatorze
                      </button>
                      <Link
                        href={entry.detail.sourceUrl}
                        target="_blank"
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Źródło
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {fetchedProducts.length > 0 ? (
            <div className="mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
              <h3 className="text-base font-medium">Kody EAN — szablon MojeGS1</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Eksport XLSX jak <code>ean_koszulki_warianty_uzupelnione.xlsx</code>, uzupełnij GTIN,
                zaimportuj plik z powrotem.
              </p>
              <div className="mt-4">
                <EanPortablePanel
                  compact
                  initialProducts={fetchedProducts}
                  onProductsUpdated={handleEanProductsUpdated}
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export { STORAGE_KEY as KOSZULKER_IMPORT_STORAGE_KEY };
