import {
  DEFAULT_STORE_PATH,
  listItemToDetail,
  parseListingHtml,
  resolveTeamPrintedUrl,
} from "./parser";
import type { TeamPrintedListItem, TeamPrintedProductDetail } from "./types";

const FETCH_TIMEOUT_MS = 20_000;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pl-PL,pl;q=0.9",
};

export async function fetchTeamPrintedHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveTeamPrintedUrl(url), {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} przy pobieraniu ${url}`);
    }

    // TeamPrinted czasem podaje charset niezgodny z realnym UTF-8 body.
    const buffer = await response.arrayBuffer();
    return new TextDecoder("utf-8").decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTeamPrintedListing(
  listUrl = DEFAULT_STORE_PATH,
): Promise<TeamPrintedListItem[]> {
  const resolved = resolveTeamPrintedUrl(listUrl);
  const html = await fetchTeamPrintedHtml(resolved);
  return parseListingHtml(html, new URL(resolved).origin);
}

export async function fetchTeamPrintedProduct(
  productUrl: string,
  listItem?: TeamPrintedListItem,
): Promise<TeamPrintedProductDetail> {
  const resolvedUrl = resolveTeamPrintedUrl(productUrl);

  if (listItem) {
    return listItemToDetail({ ...listItem, productUrl: resolvedUrl });
  }

  const listing = await fetchTeamPrintedListing();
  const match = listing.find(
    (item) => item.productUrl === resolvedUrl || item.productId === resolvedUrl.match(/\/(\d+)\/?$/)?.[1],
  );

  if (!match) {
    throw new Error(`Nie znaleziono produktu na listingu TeamPrinted: ${resolvedUrl}`);
  }

  return listItemToDetail({ ...match, productUrl: resolvedUrl });
}

export async function fetchTeamPrintedProducts(
  productUrls: string[],
): Promise<Array<{ url: string; product?: TeamPrintedProductDetail; error?: string }>> {
  const listing = await fetchTeamPrintedListing();
  const byUrl = new Map(listing.map((item) => [item.productUrl, item]));
  const byId = new Map(listing.map((item) => [item.productId, item]));

  return productUrls.map((url) => {
    try {
      const resolved = resolveTeamPrintedUrl(url);
      const id = resolved.match(/\/(\d+)\/?$/)?.[1];
      const listItem = byUrl.get(resolved) ?? (id ? byId.get(id) : undefined);
      if (!listItem) {
        return { url, error: `Brak produktu na listingu: ${resolved}` };
      }
      return { url, product: listItemToDetail({ ...listItem, productUrl: resolved }) };
    } catch (error) {
      return {
        url,
        error: error instanceof Error ? error.message : "Nieznany błąd pobierania",
      };
    }
  });
}
