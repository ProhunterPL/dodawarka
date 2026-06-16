import type { ChannelMetadataEntry, ChannelMetadataMap } from "@/lib/product/types";

export function getChannelMetadata(
  map: ChannelMetadataMap | undefined,
  channelId: string,
): ChannelMetadataEntry {
  return map?.[channelId] ?? {};
}

export function updateChannelMetadata(
  map: ChannelMetadataMap | undefined,
  channelId: string,
  patch: Partial<ChannelMetadataEntry>,
): ChannelMetadataMap {
  return {
    ...map,
    [channelId]: {
      ...map?.[channelId],
      ...patch,
    },
  };
}

export function pruneChannelMetadata(
  map: ChannelMetadataMap | undefined,
  selectedChannels: string[],
): ChannelMetadataMap {
  const selected = new Set(selectedChannels);
  const next: ChannelMetadataMap = {};

  for (const [channelId, entry] of Object.entries(map ?? {})) {
    if (selected.has(channelId)) {
      next[channelId] = entry;
    }
  }

  return next;
}

export function hasChannelMetadataContent(entry: ChannelMetadataEntry): boolean {
  return Boolean(
    entry.marketplaceCategory?.trim() ||
      entry.parameters?.trim() ||
      entry.listingTitle?.trim() ||
      entry.notes?.trim(),
  );
}

export function countFilledChannelMetadata(
  map: ChannelMetadataMap | undefined,
  selectedChannels: string[],
): number {
  return selectedChannels.filter((channelId) =>
    hasChannelMetadataContent(getChannelMetadata(map, channelId)),
  ).length;
}

export function formatChannelMetadataLines(
  map: ChannelMetadataMap | undefined,
  channelLabels: Record<string, string>,
  selectedChannels: string[],
): string[] {
  const lines: string[] = [];

  for (const channelId of selectedChannels) {
    const entry = getChannelMetadata(map, channelId);
    if (!hasChannelMetadataContent(entry)) {
      continue;
    }

    const label = channelLabels[channelId] ?? channelId;
    const parts: string[] = [];

    if (entry.marketplaceCategory?.trim()) {
      parts.push(`kategoria: ${entry.marketplaceCategory.trim()}`);
    }
    if (entry.parameters?.trim()) {
      parts.push(`parametry: ${entry.parameters.trim()}`);
    }
    if (entry.listingTitle?.trim()) {
      parts.push(`tytuł: ${entry.listingTitle.trim()}`);
    }
    if (entry.notes?.trim()) {
      parts.push(`notatki: ${entry.notes.trim()}`);
    }

    lines.push(`${label}: ${parts.join(" | ")}`);
  }

  return lines;
}

export function buildChannelMetadataFromCsvColumns(
  record: Record<string, string>,
): ChannelMetadataMap {
  const metadata: ChannelMetadataMap = {};

  const mappings: Array<{
    channelId: string;
    prefix: string;
  }> = [
    { channelId: "allegro", prefix: "allegro" },
    { channelId: "shoper", prefix: "shoper" },
  ];

  for (const { channelId, prefix } of mappings) {
    const entry: ChannelMetadataEntry = {};

    const category = record[`${prefix}Category`]?.trim();
    const parameters = record[`${prefix}Parameters`]?.trim();
    const listingTitle = record[`${prefix}ListingTitle`]?.trim();
    const notes = record[`${prefix}Notes`]?.trim();

    if (category) entry.marketplaceCategory = category;
    if (parameters) entry.parameters = parameters;
    if (listingTitle) entry.listingTitle = listingTitle;
    if (notes) entry.notes = notes;

    if (hasChannelMetadataContent(entry)) {
      metadata[channelId] = entry;
    }
  }

  return metadata;
}

export function mergeChannelMetadata(
  base: ChannelMetadataMap | undefined,
  patch: ChannelMetadataMap | undefined,
): ChannelMetadataMap {
  const result: ChannelMetadataMap = { ...base };

  for (const [channelId, entry] of Object.entries(patch ?? {})) {
    result[channelId] = {
      ...result[channelId],
      ...entry,
    };
  }

  return result;
}
