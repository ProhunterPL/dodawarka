import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMetadataFixes,
  MENS_SHIRTS_CATEGORY_IDS,
  normalizeMensShirtsCategoryIds,
} from "../src/lib/product/metadata-fix";
import { TEST_PRODUCT } from "../src/lib/product/test-product";
import { buildApiloMetadataPutPayload } from "../src/lib/apilo/metadata-payload";

describe("normalizeMensShirtsCategoryIds", () => {
  it("upgrades bare Odzież (25) to full mens shirts path", () => {
    assert.deepEqual(normalizeMensShirtsCategoryIds([25]), [...MENS_SHIRTS_CATEGORY_IDS]);
  });

  it("keeps existing leaf category", () => {
    assert.deepEqual(normalizeMensShirtsCategoryIds([25, 43, 49]), [25, 43, 49]);
  });
});

describe("applyMetadataFixes", () => {
  it("sets unit and category defaults", () => {
    const fixed = applyMetadataFixes({
      ...TEST_PRODUCT,
      unit: "KG",
      categoryIds: [25],
    });

    assert.equal(fixed.unit, "szt.");
    assert.deepEqual(fixed.categoryIds, [...MENS_SHIRTS_CATEGORY_IDS]);
  });

  it("upgrades bare Odzież (25) to womens shirts path for damskie products", () => {
    const fixed = applyMetadataFixes({
      ...TEST_PRODUCT,
      groupName: "Koszulka damska T-shirt EARN YOUR REPS czarna",
      name: "Koszulka damska T-shirt EARN YOUR REPS czarna S",
      categoryIds: [25],
      categoryLabel: "Odzież / Dla niej",
    });

    assert.equal(fixed.unit, "szt.");
    assert.deepEqual(fixed.categoryIds, [25, 46, 52]);
    assert.match(fixed.categoryLabel, /Koszulki damskie/i);
  });
});

describe("buildApiloMetadataPutPayload", () => {
  it("sends PUT with metadata fields for mapped variants", () => {
    const payload = buildApiloMetadataPutPayload(TEST_PRODUCT, {
      "TMCS-EYR-IS-XS": 2290,
    });

    assert.equal(payload.length, 1);
    assert.equal(payload[0]?.unit, "szt.");
    const attributes = payload[0]?.attributes;
    assert.ok(Array.isArray(attributes));
    assert.equal(attributes?.[3], "Incore Sports");
    assert.deepEqual(payload[0]?.categories, [...MENS_SHIRTS_CATEGORY_IDS]);
    assert.equal(payload[0]?.tax, 23);
  });
});
