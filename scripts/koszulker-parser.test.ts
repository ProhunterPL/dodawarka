import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { koszulkerDetailToProductForm } from "../src/lib/scrape/koszulker/map-to-form.ts";
import { parseListingHtml, parseProductHtml } from "../src/lib/scrape/koszulker/parser.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const homeHtml = readFileSync(path.join(root, "fixtures", "koszulker-home.html"), "utf8");
const productHtml = readFileSync(path.join(root, "fixtures", "koszulker-product.html"), "utf8");

test("parseListingHtml extracts products from homepage", () => {
  const items = parseListingHtml(homeHtml);
  assert.ok(items.length >= 20, `expected many items, got ${items.length}`);
  const first = items[0];
  assert.equal(first?.productId, "3105");
  assert.match(first?.productUrl ?? "", /3105_incore_sports_mini/);
  assert.equal(first?.price, "79.00");
});

test("parseProductHtml extracts detail fields", () => {
  const detail = parseProductHtml(
    productHtml,
    "https://incoresports.koszulker.pl/mezczyzna/projekty/3105_incore_sports_mini__orange_",
  );
  assert.ok(detail);
  assert.equal(detail.productId, "3105");
  assert.equal(detail.title, "Incore Sports mini (orange)");
  assert.equal(detail.price, "79.00");
  assert.equal(detail.color, "czarny");
  assert.deepEqual(detail.sizes, ["S", "M", "L", "XL", "XXL"]);
  assert.ok(detail.imageUrls[0]?.includes("3105_1.jpg"));
  assert.match(detail.descriptionText, /Tank top/i);
});

test("koszulkerDetailToProductForm maps to ProductFormInput", () => {
  const detail = parseProductHtml(
    productHtml,
    "https://incoresports.koszulker.pl/mezczyzna/projekty/3105_incore_sports_mini__orange_",
  );
  assert.ok(detail);
  const product = koszulkerDetailToProductForm(detail);
  assert.equal(product.priceWithTax, "79.00");
  assert.equal(product.variants.length, 5);
  assert.ok(product.imageUrls.length > 0);
  assert.ok(product.description.includes("Tank top"));
  assert.ok(product.variants.every((variant) => variant.sku.length > 0));
});
