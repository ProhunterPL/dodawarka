import type { TeamPrintedListItem, TeamPrintedProductDetail } from "./types";

export const BASE_URL = "https://teamprinted.pl";
export const DEFAULT_STORE_PATH = "/s/incore-sports-store/";
export const DEFAULT_APPAREL_SIZES = ["XS", "S", "M", "L", "XL"] as const;

export function resolveTeamPrintedUrl(pathOrUrl: string, baseUrl = BASE_URL): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parsePrice(raw: string): string {
  const normalized = raw.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  const value = match?.[1] ?? "0";
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function attr(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1]?.trim() ?? "";
}

function innerText(block: string, className: string): string {
  const match = block.match(
    new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)</(?:p|div|span|h2)>`, "i"),
  );
  return decodeHtmlEntities((match?.[1] ?? "").replace(/<[^>]+>/g, "").trim());
}

function extractColorNames(block: string): string[] {
  const names = [...block.matchAll(/class="tp-swt"[^>]*title="([^"]+)"/gi)].map((m) =>
    decodeHtmlEntities(m[1] ?? "").trim(),
  );
  return [...new Set(names.filter(Boolean))];
}

function extractColorHexes(dataColors: string): string[] {
  return dataColors
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^#[0-9a-f]{3,8}$/i.test(token));
}

function parseCard(block: string, baseUrl: string): TeamPrintedListItem | null {
  const href = attr(block, "href");
  if (!href || !/\/store\//i.test(href)) {
    return null;
  }

  const productUrl = resolveTeamPrintedUrl(href, baseUrl);
  const idMatch = productUrl.match(/\/(\d+)\/?$/);
  const slugMatch = productUrl.match(/\/store\/[^/]+\/([^/]+)\/\d+/i);
  const productId = idMatch?.[1] ?? "";
  if (!productId) {
    return null;
  }

  const imgTag = block.match(/<img[^>]*>/i)?.[0] ?? "";
  const title =
    innerText(block, "tp-name") ||
    decodeHtmlEntities(attr(block, "data-name")) ||
    decodeHtmlEntities(attr(imgTag, "alt"));

  const imagePath = attr(imgTag, "src");
  const price = parsePrice(attr(block, "data-price") || innerText(block, "tp-now"));
  const compareAtPrice = parsePrice(innerText(block, "tp-was"));

  return {
    productId,
    slug: slugMatch?.[1] ?? productId,
    title: title.trim(),
    price,
    compareAtPrice,
    category: innerText(block, "tp-eyebrow"),
    imageUrl: imagePath ? resolveTeamPrintedUrl(imagePath, baseUrl) : "",
    productUrl,
    colorNames: extractColorNames(block),
    colorHexes: extractColorHexes(attr(block, "data-colors")),
  };
}

export function parseListingHtml(
  html: string,
  baseUrl = BASE_URL,
): TeamPrintedListItem[] {
  const cards = [...html.matchAll(/<a\b[^>]*class="[^"]*\btp-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi)];
  const items: TeamPrintedListItem[] = [];
  const seen = new Set<string>();

  for (const match of cards) {
    const item = parseCard(match[0] ?? "", baseUrl);
    if (!item || seen.has(item.productId)) {
      continue;
    }
    seen.add(item.productId);
    items.push(item);
  }

  return items;
}

export function isComingSoonDetailPage(html: string): boolean {
  return /<title>[^<]*Wkrótce/i.test(html) || /coming\s*soon/i.test(html);
}

export function listItemToDetail(item: TeamPrintedListItem): TeamPrintedProductDetail {
  const colorLine =
    item.colorNames.length > 0
      ? `Dostępne kolory: ${item.colorNames.join(", ")}.`
      : item.colorHexes.length > 0
        ? `Dostępne kolory (HEX): ${item.colorHexes.join(", ")}.`
        : "";

  const descriptionText = [
    item.title,
    item.category ? `Kategoria sklepu: ${item.category}.` : "",
    colorLine,
    item.compareAtPrice !== "0.00"
      ? `Cena katalogowa / HURT: ${item.price} zł (było ${item.compareAtPrice} zł).`
      : `Cena: ${item.price} zł.`,
    `Źródło: ${item.productUrl}`,
    "Uwaga: strona szczegółów TeamPrinted zwraca obecnie „Wkrótce” — dane z listingu sklepu.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ...item,
    sizes: [...DEFAULT_APPAREL_SIZES],
    descriptionText,
    shortDescription: `${item.title} — Incore Sports / TeamPrinted`.slice(0, 256),
    imageUrls: item.imageUrl ? [item.imageUrl] : [],
    sourceUrl: item.productUrl,
    detailAvailable: false,
  };
}
