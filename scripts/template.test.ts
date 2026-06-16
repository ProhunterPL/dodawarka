import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripProductIdentifiers } from "../src/lib/product/template";
import { TEST_PRODUCT } from "../src/lib/product/test-product";

describe("stripProductIdentifiers", () => {
  it("clears sku, ean and variant identifiers", () => {
    const stripped = stripProductIdentifiers(TEST_PRODUCT);
    assert.equal(stripped.sku, "");
    assert.equal(stripped.ean, "");
    assert.equal(stripped.variants.every((variant) => variant.sku === ""), true);
    assert.equal(stripped.variants.every((variant) => !variant.ean), true);
    assert.equal(stripped.variants.length, TEST_PRODUCT.variants.length);
    assert.equal(stripped.description, TEST_PRODUCT.description);
  });
});
