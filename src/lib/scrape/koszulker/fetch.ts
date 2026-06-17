import { parseListingHtml, parseProductHtml, resolveKoszulkerUrl } from "./parser";
import type { KoszulkerListItem, KoszulkerProductDetail } from "./types";

const DEFAULT_LIST_URL = "https://incoresports.koszulker.pl/";
const FETCH_TIMEOUT_MS = 20_000;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pl-PL,pl;q=0.9",
};

export async function fetchKoszulkerHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveKoszulkerUrl(url), {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} przy pobieraniu ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchKoszulkerListing(
  listUrl = DEFAULT_LIST_URL,
): Promise<KoszulkerListItem[]> {
  const html = await fetchKoszulkerHtml(listUrl);
  return parseListingHtml(html, new URL(resolveKoszulkerUrl(listUrl)).origin);
}

export async function fetchKoszulkerProduct(
  productUrl: string,
): Promise<KoszulkerProductDetail> {
  const resolvedUrl = resolveKoszulkerUrl(productUrl);
  const html = await fetchKoszulkerHtml(resolvedUrl);
  const product = parseProductHtml(html, resolvedUrl);

  if (!product) {
    throw new Error(`Nie udało się sparsować produktu: ${resolvedUrl}`);
  }

  return product;
}

export async function fetchKoszulkerProducts(
  productUrls: string[],
): Promise<Array<{ url: string; product?: KoszulkerProductDetail; error?: string }>> {
  const results: Array<{ url: string; product?: KoszulkerProductDetail; error?: string }> = [];

  for (const url of productUrls) {
    try {
      const product = await fetchKoszulkerProduct(url);
      results.push({ url, product });
    } catch (error) {
      results.push({
        url,
        error: error instanceof Error ? error.message : "Nieznany błąd pobierania",
      });
    }
  }

  return results;
}
