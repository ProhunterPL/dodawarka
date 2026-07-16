import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { listItemToDetail, parseListingHtml } from "../src/lib/scrape/teamprinted/parser";
import { teamPrintedDetailToProductForm } from "../src/lib/scrape/teamprinted/map-to-form";

const fixture = readFileSync(
  path.join(process.cwd(), "scripts/fixtures/teamprinted-listing.html"),
  "utf8",
);

describe("parseListingHtml TeamPrinted", () => {
  it("extracts all store cards with prices and ids", () => {
    const items = parseListingHtml(fixture);
    assert.equal(items.length, 12);
    assert.ok(items.every((item) => item.productId && item.title && item.price !== "0.00"));
    assert.ok(items.some((item) => /bahrain/i.test(item.title) || /bahrain/i.test(item.slug)));
    assert.ok(items.some((item) => item.productId === "48278"));
  });

  it("maps listing item to form with SKUs and sizes", () => {
    const items = parseListingHtml(fixture);
    const womanJacket = items.find((item) => item.productId === "48278");
    assert.ok(womanJacket);
    const detail = listItemToDetail(womanJacket!);
    const form = teamPrintedDetailToProductForm(detail);
    assert.equal(form.variants.length, 5);
    assert.match(form.variants[0]?.sku ?? "", /^P/);
    assert.ok(form.priceWithTax);
    assert.ok(form.imageUrls[0]?.includes("sp_48278"));
  });
});
