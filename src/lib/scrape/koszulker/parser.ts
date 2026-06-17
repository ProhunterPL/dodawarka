import type { KoszulkerListItem, KoszulkerProductDetail } from "./types";

const BASE_URL = "https://incoresports.koszulker.pl";

export function resolveKoszulkerUrl(pathOrUrl: string, baseUrl = BASE_URL): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function extractGenderFromPath(url: string): KoszulkerListItem["gender"] {
  if (/\/mezczyzna\//i.test(url)) {
    return "mezczyzna";
  }
  if (/\/kobieta\//i.test(url)) {
    return "kobieta";
  }
  return "unknown";
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8592;/g, "←");
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function parsePrice(raw: string): string {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  const value = match?.[1] ?? "0";
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function buildImageUrl(relativePath: string, baseUrl = BASE_URL): string {
  if (!relativePath) {
    return "";
  }
  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath;
  }
  return resolveKoszulkerUrl(relativePath, baseUrl);
}

export function parseListingHtml(html: string, baseUrl = BASE_URL): KoszulkerListItem[] {
  const items: KoszulkerListItem[] = [];
  const blockPattern =
    /<div class="miniaturka[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*name="(\d+)"[^>]*alt="([^"]*)"[\s\S]*?<span class="miniaturka_title\s*">([^<]*)<\/span>[\s\S]*?<span class="miniaturka_cena\s*">([^<]*)<\/span>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(html)) !== null) {
    const [, href, imagePath, productId, altTitle, title, priceRaw] = match;
    const productUrl = resolveKoszulkerUrl(href, baseUrl);
    items.push({
      productId,
      title: decodeHtmlEntities(title.trim() || altTitle.trim()),
      price: parsePrice(priceRaw),
      imageUrl: buildImageUrl(imagePath, baseUrl),
      productUrl,
      gender: extractGenderFromPath(productUrl),
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.productId)) {
      return false;
    }
    seen.add(item.productId);
    return true;
  });
}

function extractTagContent(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractSizes(html: string): string[] {
  const selectMatch = html.match(/<select[^>]*id="select_size"[^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    return [];
  }

  const sizes: string[] = [];
  const optionPattern = /<option[^>]*value="(\d+)"[^>]*>([^<]*)<\/option>/gi;
  let optionMatch: RegExpExecArray | null;
  while ((optionMatch = optionPattern.exec(selectMatch[1])) !== null) {
    const [, value, label] = optionMatch;
    if (!value || value === "0") {
      continue;
    }
    const size = decodeHtmlEntities(label.trim());
    if (size) {
      sizes.push(size);
    }
  }
  return sizes;
}

function extractGarmentType(html: string): { garmentType: string; garmentFit?: string } {
  const selected = html.match(
    /piktogramy_picker_new_on[\s\S]*?<div class="">([^<]*)<\/div>[\s\S]*?<div class="smaller">([^<]*)<\/div>/i,
  );
  if (selected) {
    return {
      garmentType: decodeHtmlEntities(selected[1].trim()),
      garmentFit: decodeHtmlEntities(selected[2].trim()) || undefined,
    };
  }

  const h2 = extractTagContent(html, /<div class="product_description">[\s\S]*?<h2>([^<]*)<\/h2>/i);
  return { garmentType: h2 };
}

function extractColor(html: string): string {
  const colorMatch = html.match(
    /infoText_colorpicker_new(?:_on)?\s*">([^<]+)<\/span>/i,
  );
  return decodeHtmlEntities(colorMatch?.[1]?.trim() ?? "");
}

function extractImages(html: string, productId: string, baseUrl = BASE_URL): string[] {
  const urls: string[] = [];

  const imgBlock = html.match(
    /<div class="img_show relative" name="\d+"[^>]*img1="([^"]*)"[^>]*img2="([^"]*)"/i,
  );
  if (imgBlock) {
    for (const imageRef of [imgBlock[1], imgBlock[2]].filter((value): value is string => Boolean(value))) {
      const path = imageRef.startsWith("/")
        ? imageRef
        : `/images/products/products_mini/${imageRef}`;
      const url = buildImageUrl(path, baseUrl);
      if (url) {
        urls.push(url);
      }
    }
  }

  if (urls.length === 0) {
    const ogImage = extractTagContent(html, /<meta property="og:image" content="([^"]+)"/i);
    if (ogImage) {
      urls.push(buildImageUrl(ogImage, baseUrl));
    }
  }

  if (urls.length === 0) {
    const lazyImage = extractTagContent(
      html,
      new RegExp(`name="${productId}"[^>]*(?:data-src|src)="([^"]+)"`, "i"),
    );
    if (lazyImage) {
      urls.push(buildImageUrl(lazyImage, baseUrl));
    }
  }

  return [...new Set(urls)];
}

export function parseProductHtml(
  html: string,
  sourceUrl: string,
  baseUrl = BASE_URL,
): KoszulkerProductDetail | null {
  const productId =
    extractTagContent(html, /<input[^>]*name="id_prod"[^>]*value="(\d+)"/i) ||
    extractTagContent(html, /<div class="img_show relative" name="(\d+)"/i);

  if (!productId) {
    return null;
  }

  const title =
    extractTagContent(html, /<h1 class="product_title_h1">([^<]*)<\/h1>/i) ||
    extractTagContent(html, /<input[^>]*name="nazwa"[^>]*value="([^"]*)"/i);

  const priceRaw = extractTagContent(html, /<p class="prod_cena_new upper">([^<]*)</i);
  const descriptionHtml =
    extractTagContent(html, /<div class="product_description">([\s\S]*?)<\/div>/i) || "";
  const extraDescription =
    extractTagContent(html, /<div class="product_opis[\s\S]*?<h3>([^<]*)<\/h3>/i) ||
    stripHtml(extractTagContent(html, /<div class="product_opis[\s\S]*?">([\s\S]*?)<\/div>/i));

  const descriptionText = stripHtml(descriptionHtml);
  const { garmentType, garmentFit } = extractGarmentType(html);
  const color = extractColor(html);
  const sizes = extractSizes(html);
  const imageUrls = extractImages(html, productId, baseUrl);
  const apiloTyp = extractTagContent(html, /<input[^>]*name="typ"[^>]*value="([^"]*)"/i);
  const gender = extractGenderFromPath(sourceUrl);

  const shortParts = [garmentType, garmentFit, color].filter(Boolean);
  const shortDescription = shortParts.join(", ").slice(0, 256);

  return {
    productId,
    title: decodeHtmlEntities(title.trim()),
    price: parsePrice(priceRaw),
    imageUrl: imageUrls[0] ?? "",
    productUrl: resolveKoszulkerUrl(sourceUrl, baseUrl),
    gender,
    garmentType,
    garmentFit,
    color,
    sizes,
    descriptionHtml,
    descriptionText,
    shortDescription,
    extraDescription: decodeHtmlEntities(extraDescription.trim()),
    imageUrls,
    apiloTyp,
    sourceUrl: resolveKoszulkerUrl(sourceUrl, baseUrl),
  };
}
