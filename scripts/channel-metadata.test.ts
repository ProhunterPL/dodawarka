import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChannelMetadataFromCsvColumns,
  countFilledChannelMetadata,
  formatChannelMetadataLines,
  hasChannelMetadataContent,
  mergeChannelMetadata,
  pruneChannelMetadata,
  updateChannelMetadata,
} from "../src/lib/product/channel-metadata";

describe("channel metadata helpers", () => {
  it("detects filled metadata entries", () => {
    assert.equal(hasChannelMetadataContent({}), false);
    assert.equal(hasChannelMetadataContent({ notes: "  " }), false);
    assert.equal(hasChannelMetadataContent({ marketplaceCategory: "Odzież" }), true);
  });

  it("updates and prunes metadata by selected channels", () => {
    let map = updateChannelMetadata(undefined, "allegro", {
      notes: "Notatka Allegro",
    });
    map = updateChannelMetadata(map, "shoper", {
      marketplaceCategory: "T-shirty",
    });

    assert.equal(countFilledChannelMetadata(map, ["allegro", "shoper"]), 2);

    const pruned = pruneChannelMetadata(map, ["allegro"]);
    assert.deepEqual(pruned, {
      allegro: { notes: "Notatka Allegro" },
    });
  });

  it("merges metadata per channel field", () => {
    const merged = mergeChannelMetadata(
      { allegro: { notes: "Z CSV" } },
      { allegro: { marketplaceCategory: "Odzież" }, shoper: { notes: "Shoper" } },
    );

    assert.deepEqual(merged, {
      allegro: { notes: "Z CSV", marketplaceCategory: "Odzież" },
      shoper: { notes: "Shoper" },
    });
  });

  it("builds metadata from CSV column names", () => {
    const metadata = buildChannelMetadataFromCsvColumns({
      allegroCategory: "Odzież / T-shirty",
      allegroNotes: "Sprawdź zdjęcia",
      shoperListingTitle: "T-shirt Incore",
    });

    assert.deepEqual(metadata, {
      allegro: {
        marketplaceCategory: "Odzież / T-shirty",
        notes: "Sprawdź zdjęcia",
      },
      shoper: {
        listingTitle: "T-shirt Incore",
      },
    });
  });

  it("formats summary lines for selected channels", () => {
    const lines = formatChannelMetadataLines(
      {
        allegro: {
          marketplaceCategory: "Odzież",
          notes: "OK",
        },
      },
      { allegro: "Allegro", shoper: "Shoper" },
      ["allegro", "shoper"],
    );

    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? "", /Allegro:.*kategoria: Odzież/);
    assert.match(lines[0] ?? "", /notatki: OK/);
  });
});
