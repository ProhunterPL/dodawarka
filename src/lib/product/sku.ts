import type { ProductFormInput } from "./types";

const COLOR_CODES: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(czarny|czarna|black)\b/i, code: "C" },
  { pattern: /\b(bialy|biała|biala|white)\b/i, code: "W" },
  { pattern: /\b(szary|grey|gray)\b/i, code: "G" },
  { pattern: /\b(czerwony|red)\b/i, code: "R" },
  { pattern: /\b(niebieski|blue)\b/i, code: "B" },
  { pattern: /\b(zielony|green)\b/i, code: "N" },
];

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function codeForTypeAndGender(text: string): string {
  const n = normalize(text);
  const type = /\b(t-shirt|tshirt|koszulka)\b/.test(n) ? "T" : "P";
  const gender = /\b(meski|meska|męski|męska|male|men)\b/.test(n)
    ? "M"
    : /\b(damski|damska|zenski|zenska|żeński|żeńska|female|women)\b/.test(n)
      ? "D"
      : "U";
  const color = COLOR_CODES.find((item) => item.pattern.test(n))?.code ?? "X";
  return `${type}${gender}${color}`;
}

function acronymFromPhrase(text: string, fallback: string, max = 3): string {
  const stop = new Set([
    "koszulka",
    "tshirt",
    "t",
    "shirt",
    "meska",
    "meski",
    "męska",
    "męski",
    "damska",
    "damski",
    "czarny",
    "czarna",
    "bialy",
    "biala",
    "black",
    "white",
    "incore",
    "sports",
  ]);
  const words = normalize(text)
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 1 && !stop.has(w));
  const code = words.slice(0, max).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return code || fallback;
}

function brandCode(text: string): string {
  const n = normalize(text);
  if (n.includes("incore") && n.includes("sports")) {
    return "IS";
  }
  return acronymFromPhrase(text, "BR", 2);
}

function pickDefaultSize(product: ProductFormInput): string {
  if (product.variants.some((v) => v.size.toUpperCase() === "S")) {
    return "S";
  }
  return product.variants[0]?.size?.toUpperCase() || "S";
}

export function generateSkuPrefix(product: ProductFormInput): string {
  const source = `${product.groupName} ${product.name}`;
  const tgc = codeForTypeAndGender(source);
  const line = acronymFromPhrase(source, "PRD", 3);
  const brand = brandCode(source);
  return `${tgc}-${line}-${brand}`.toUpperCase();
}

export function generateSkus(product: ProductFormInput): ProductFormInput {
  const prefix = generateSkuPrefix(product);
  if (product.variants.length === 0) {
    return {
      ...product,
      sku: `${prefix}-${pickDefaultSize(product)}`,
    };
  }

  return {
    ...product,
    sku: `${prefix}-${pickDefaultSize(product)}`,
    variants: product.variants.map((variant) => ({
      ...variant,
      sku: `${prefix}-${variant.size.toUpperCase()}`,
    })),
  };
}
