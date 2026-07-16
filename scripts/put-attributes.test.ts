import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APILO_PUT_ATTRIBUTE_TYPE_IDS,
  buildIndexedApiloAttributesForPut,
  indexedAttributesToRecord,
} from "../src/lib/apilo/put-attributes.ts";

describe("buildIndexedApiloAttributesForPut", () => {
  it("fills producer at index 3 and unit slot defaults", () => {
    const values = buildIndexedApiloAttributesForPut({
      shortDescription: "Krótki",
      description: "Długi",
    });

    assert.deepEqual(APILO_PUT_ATTRIBUTE_TYPE_IDS, [1, 4, 10, 13]);
    assert.equal(values[0], "Krótki");
    assert.equal(values[1], "Długi");
    assert.equal(values[2], "3");
    assert.equal(values[3], "Incore Sports");
  });

  it("maps indexed values to record for preview", () => {
    const record = indexedAttributesToRecord(["a", "b", "3", "Incore Sports"]);
    assert.deepEqual(record, {
      "1": "a",
      "4": "b",
      "10": "3",
      "13": "Incore Sports",
    });
  });
});
