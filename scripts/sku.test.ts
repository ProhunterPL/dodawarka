import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSkuPrefix } from "../src/lib/product/sku";
import { TEST_PRODUCT, TEST_PRODUCT_WOMEN } from "../src/lib/product/test-product";

describe("generateSkuPrefix gender codes", () => {
  it("uses M for męska/męski product names", () => {
    assert.match(
      generateSkuPrefix({
        ...TEST_PRODUCT,
        groupName: "Koszulka męska T-shirt EARN YOUR REPS czarny",
      }),
      /^TM/,
    );
  });

  it("uses D for damska product names", () => {
    assert.match(generateSkuPrefix(TEST_PRODUCT_WOMEN), /^TD/);
  });
});
