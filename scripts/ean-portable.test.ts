import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGs1MojeGs1DataRow,
  exportProductsToGs1Xlsx,
  parseGs1MojeGs1Xlsx,
} from "../src/lib/ean/gs1-template.ts";
import { allocateGtinsForProducts, buildEan13FromBase12 } from "../src/lib/ean/pool.ts";
import { applyEanImportToProducts, exportProductsToGs1XlsxWithPool } from "../src/lib/ean/portable.ts";
import type { ProductFormInput } from "../src/lib/product/types.ts";

const sampleProduct: ProductFormInput = {
  groupName: "Incore Sports mini tank top męski czarny",
  name: "Incore Sports mini tank top męski czarny",
  sku: "PMTX-ISM-IS-S",
  ean: "",
  priceWithTax: "79.00",
  tax: "23",
  quantity: 10,
  weight: 0.1,
  unit: "szt.",
  description: "Tank top męski\n\nŹródło: https://incoresports.koszulker.pl/test",
  shortDescription: "Tank top",
  categoryIds: [25],
  categoryLabel: "Koszulki",
  imageUrls: ["https://incoresports.koszulker.pl/images/products/products_mini/3105_1.jpg"],
  status: "draft",
  variants: [
    { size: "S", sku: "PMTX-ISM-IS-S", quantity: 10 },
    { size: "M", sku: "PMTX-ISM-IS-M", quantity: 10 },
  ],
  selectedChannels: [],
};

test("buildGs1MojeGs1DataRow matches MojeGS1 column layout", () => {
  const row = buildGs1MojeGs1DataRow(sampleProduct, sampleProduct.variants[0]);
  assert.equal(row[0], "Produkt do sprzedaży detalicznej/online (GTIN-13, GTIN-12, GTIN-8)");
  assert.match(String(row[1]), /Incore Sports/);
  assert.equal(row[6], "Incore Sports mini tank top męski czarny S");
  assert.equal(row[7], "");
  assert.equal(row[9], "szt");
  assert.equal(row[14], 10001352);
  assert.equal(row[21], "PMTX-ISM-IS-S");
  assert.equal(row[19], sampleProduct.imageUrls[0]);
});

test("exportProductsToGs1Xlsx preserves MojeGS1 header rows", () => {
  const { buffer, allocation } = exportProductsToGs1XlsxWithPool([sampleProduct]);
  const parsed = parseGs1MojeGs1Xlsx(buffer);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]?.sku, "PMTX-ISM-IS-S");
  assert.equal(parsed.rows[1]?.sku, "PMTX-ISM-IS-M");
  assert.match(parsed.rows[0]?.ean ?? "", /^\d{13}$/);
  assert.match(parsed.rows[1]?.ean ?? "", /^\d{13}$/);
  assert.equal(allocation.assignedCount, 2);
});

test("allocateGtinsForProducts assigns kolejne numery z puli", () => {
  const result = allocateGtinsForProducts([sampleProduct], {
    extraUsedGtins: [],
    nextBase12: "590605868900",
  });
  assert.equal(result.assignedCount, 2);
  assert.equal(result.products[0]?.variants[0]?.ean, buildEan13FromBase12("590605868900"));
  assert.equal(result.products[0]?.variants[1]?.ean, buildEan13FromBase12("590605868901"));
});

test("roundtrip: export with GTIN and import back to products", () => {
  const withEan: ProductFormInput = {
    ...sampleProduct,
    variants: sampleProduct.variants.map((variant, index) => ({
      ...variant,
      ean: index === 0 ? "5906058689547" : "5906058689554",
    })),
  };

  const buffer = exportProductsToGs1Xlsx([withEan]);
  const imported = applyEanImportToProducts([sampleProduct], {
    xlsxBase64: buffer.toString("base64"),
  });

  assert.equal(imported.products[0]?.variants[0]?.ean, "5906058689547");
  assert.equal(imported.products[0]?.variants[1]?.ean, "5906058689554");
});
