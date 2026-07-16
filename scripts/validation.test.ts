import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractApiloProductIds,
  findDuplicateSkus,
  formatApiloErrorDetails,
  parseApiloTax,
  resolveApiloProductNameForPut,
} from "../src/lib/apilo/product-utils";
import {
  buildApiloPatchPayload,
  buildApiloPayload,
  buildApiloPutPayload,
  validateProductInput,
} from "../src/lib/product/validation";
import { TEST_PRODUCT } from "../src/lib/product/test-product";

describe("parseApiloTax", () => {
  it("parses integer VAT", () => {
    assert.equal(parseApiloTax("23"), 23);
  });

  it("parses decimal-looking VAT as number", () => {
    assert.equal(parseApiloTax("23,0"), 23);
  });
});

describe("buildApiloPutPayload", () => {
  it("includes apilo id and integer tax for PUT", () => {
    const payload = buildApiloPutPayload(TEST_PRODUCT, {
      "TMCS-EYR-IS-XS": 1001,
    });
    assert.equal(payload.length, 1);
    assert.equal(payload[0]?.id, 1001);
    assert.equal(typeof payload[0]?.tax, "number");
    assert.equal(payload[0]?.tax, 23);
    assert.equal(payload[0]?.sku, "TMCS-EYR-IS-XS");
  });
});

describe("buildApiloPatchPayload", () => {
  it("sends only quick fields for PATCH", () => {
    const payload = buildApiloPatchPayload(TEST_PRODUCT, {
      "TMCS-EYR-IS-S": 2002,
    });
    const item = payload.find((entry) => entry.sku === "TMCS-EYR-IS-S");
    assert.ok(item);
    assert.equal(item?.id, 2002);
    assert.equal(item?.quantity, 10);
    assert.equal(typeof item?.tax, "number");
    assert.equal(item?.tax, 23);
    assert.equal("name" in (item ?? {}), false);
  });
});

describe("extractApiloProductIds", () => {
  it("reads array response", () => {
    assert.deepEqual(extractApiloProductIds([{ id: 1 }, { id: 2 }]), [1, 2]);
  });
});

describe("findDuplicateSkus", () => {
  it("detects duplicates case-insensitively", () => {
    assert.deepEqual(findDuplicateSkus(["ABC", "abc", "DEF"]), ["abc"]);
  });
});

describe("formatApiloErrorDetails", () => {
  it("formats nested Apilo errors", () => {
    const text = formatApiloErrorDetails({
      message: "Validation error",
      errors: [{ field: "tax", message: "Invalid value of tax" }],
    });
    assert.match(text ?? "", /Invalid value of tax/);
  });
});

describe("validateProductInput", () => {
  it("requires categoryIds from Apilo picker", () => {
    const result = validateProductInput({
      ...TEST_PRODUCT,
      categoryIds: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.field === "categoryIds"));
  });

  it("flags duplicate SKUs across variants", () => {
    const result = validateProductInput({
      ...TEST_PRODUCT,
      variants: [
        { size: "S", sku: "DUP-1", quantity: 1 },
        { size: "M", sku: "dup-1", quantity: 1 },
      ],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.message.includes("Zduplikowany SKU")));
  });
});

describe("resolveApiloProductNameForPut", () => {
  it("keeps valid existing name", () => {
    const name = resolveApiloProductNameForPut(
      "Koszulka EYR czarny M",
      "Koszulka EYR czarny M",
    );
    assert.equal(name, "Koszulka EYR czarny M");
  });

  it("uses preferred name when existing is too long", () => {
    const corrupted = "X".repeat(200);
    const preferred = "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny M";
    assert.equal(resolveApiloProductNameForPut(corrupted, preferred), preferred);
  });

  it("uses preferred name when existing is tripled", () => {
    const preferred =
      "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny XL";
    const corrupted = preferred.repeat(3);
    assert.equal(resolveApiloProductNameForPut(corrupted, preferred), preferred);
  });
});

describe("buildApiloPayload", () => {
  it("sends tax as number", () => {
    const payload = buildApiloPayload(TEST_PRODUCT);
    assert.equal(typeof payload[0]?.tax, "number");
    assert.equal(payload[0]?.tax, 23);
  });

  it("sets unit and omits attributes/groupName on CREATE payload", () => {
    const payload = buildApiloPayload(TEST_PRODUCT);
    assert.equal(payload[0]?.unit, "szt.");
    assert.equal(payload[0]?.attributes, undefined);
    assert.equal(payload[0]?.groupName, undefined);
    assert.match(payload[0]?.name ?? "", /\bXS$/);
    assert.equal(
      (payload[0]?.name.match(/EARN YOUR REPS/gi) ?? []).length,
      1,
    );
  });

  it("includes category ids", () => {
    const payload = buildApiloPayload(TEST_PRODUCT);
    assert.deepEqual(payload[0]?.categories, [25]);
  });
});
