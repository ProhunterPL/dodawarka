import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { detectCsvDelimiter, parseCsvRows } from "../src/lib/batch/csv";
import { parseBatchCsv } from "../src/lib/batch/rows-to-products";

describe("detectCsvDelimiter", () => {
  it("prefers semicolon for Polish Excel export", () => {
    assert.equal(detectCsvDelimiter("a;b;c"), ";");
  });

  it("supports comma separated files", () => {
    assert.equal(detectCsvDelimiter("a,b,c"), ",");
  });
});

describe("parseCsvRows", () => {
  it("parses quoted fields with delimiter inside", () => {
    const rows = parseCsvRows('groupName;description\n"Grupa A";"Opis; z przecinkiem"');
    assert.equal(rows.length, 2);
    assert.equal(rows[1]?.[1], "Opis; z przecinkiem");
  });
});

describe("parseBatchCsv", () => {
  it("groups variants by groupName", () => {
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "batch-import.csv",
    );
    const csv = readFileSync(templatePath, "utf-8");
    const preview = parseBatchCsv(csv);

    assert.equal(preview.parseErrors.length, 0);
    assert.equal(preview.groupCount, 1);
    assert.equal(preview.products[0]?.variants.length, 5);
    assert.deepEqual(
      preview.products[0]?.variants.map((variant) => variant.size),
      ["XS", "S", "M", "L", "XL"],
    );
    assert.equal(
      preview.products[0]?.channelMetadata?.allegro?.marketplaceCategory,
      "Odzież / T-shirty",
    );
    assert.equal(
      preview.products[0]?.channelMetadata?.shoper?.listingTitle,
      "T-shirt Incore Sports",
    );
  });

  it("reports missing groupName", () => {
    const preview = parseBatchCsv(
      "groupName;sku;priceWithTax;tax;categoryIds\n;SKU-1;10;23;25",
    );
    assert.ok(preview.parseErrors.some((error) => error.message.includes("groupName")));
  });
});
