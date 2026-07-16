import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mediaToPutImages } from "../src/lib/apilo/product-media.ts";

describe("mediaToPutImages", () => {
  it("maps main image first as img-1", () => {
    const images = mediaToPutImages([
      {
        id: 2,
        isMain: 0,
        productId: 2290,
        uuid: "b",
        extension: "png",
        link: "https://example.com/b.png",
      },
      {
        id: 1,
        isMain: 1,
        productId: 2290,
        uuid: "a",
        extension: "jpeg",
        link: "https://example.com/a.jpeg",
      },
    ]);

    assert.deepEqual(images, {
      "img-1": "https://example.com/a.jpeg",
      "img-2": "https://example.com/b.png",
    });
  });

  it("returns undefined for empty media", () => {
    assert.equal(mediaToPutImages([]), undefined);
  });
});
