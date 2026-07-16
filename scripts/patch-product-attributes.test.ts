import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMetadataTextAttributePatches,
  buildTextAttributePatchItem,
} from "../src/lib/apilo/patch-product-attributes.ts";
import type { ApiloWarehouseProductAttribute } from "../src/lib/apilo/types.ts";

describe("buildTextAttributePatchItem", () => {
  it("uses definition id when attribute is missing", () => {
    const patch = buildTextAttributePatchItem(2302, 13, "Incore Sports");
    assert.deepEqual(patch, {
      id: 13,
      productId: 2302,
      type: 1,
      values: [{ value: "Incore Sports" }],
    });
  });

  it("uses instance id when attribute exists but value differs", () => {
    const existing: ApiloWarehouseProductAttribute = {
      id: 1954,
      productId: 2302,
      attributeTypeId: 13,
      type: 1,
      values: [{ id: 1954, value: "Old Brand" }],
    };
    const patch = buildTextAttributePatchItem(2302, 13, "Incore Sports", existing);
    assert.equal(patch?.id, 1954);
  });

  it("returns null when value already matches", () => {
    const existing: ApiloWarehouseProductAttribute = {
      id: 1954,
      productId: 2302,
      attributeTypeId: 13,
      type: 1,
      values: [{ id: 1954, value: "Incore Sports" }],
    };
    assert.equal(
      buildTextAttributePatchItem(2302, 13, "Incore Sports", existing),
      null,
    );
  });
});

describe("buildMetadataTextAttributePatches", () => {
  it("builds producer and delivery patches for empty attributes", () => {
    const patches = buildMetadataTextAttributePatches(2302, []);
    assert.equal(patches.length, 2);
    assert.equal(patches[0]?.id, 10);
    assert.equal(patches[1]?.id, 13);
  });
});
