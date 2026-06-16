"use client";

import {
  getChannelMetadata,
  pruneChannelMetadata,
  updateChannelMetadata,
} from "@/lib/product/channel-metadata";
import {
  CHANNEL_LABELS,
  getFieldsForChannel,
  SALES_CHANNELS,
} from "@/lib/product/channels";
import type { ChannelMetadataEntry, ChannelMetadataMap } from "@/lib/product/types";

interface ChannelMetadataPanelProps {
  selected: string[];
  metadata: ChannelMetadataMap | undefined;
  onSelectedChange: (channels: string[]) => void;
  onMetadataChange: (metadata: ChannelMetadataMap) => void;
}

const inputClassName =
  "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export function ChannelMetadataPanel({
  selected,
  metadata,
  onSelectedChange,
  onMetadataChange,
}: ChannelMetadataPanelProps) {
  function toggle(channelId: string) {
    if (selected.includes(channelId)) {
      const nextSelected = selected.filter((id) => id !== channelId);
      onSelectedChange(nextSelected);
      onMetadataChange(pruneChannelMetadata(metadata, nextSelected));
      return;
    }

    onSelectedChange([...selected, channelId]);
  }

  function updateField(
    channelId: string,
    key: keyof ChannelMetadataEntry,
    value: string,
  ) {
    onMetadataChange(updateChannelMetadata(metadata, channelId, { [key]: value }));
  }

  return (
    <div className="space-y-4">
      {SALES_CHANNELS.map((channel) => {
        const checked = selected.includes(channel.id);
        const entry = getChannelMetadata(metadata, channel.id);
        const fields = getFieldsForChannel(channel.id);

        return (
          <article
            key={channel.id}
            className={`rounded-2xl border p-4 transition ${
              checked
                ? "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(channel.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{channel.label}</span>
                <span className="text-sm text-zinc-500">
                  {channel.required
                    ? "Wymaga mapowania kategorii/parametrów w panelu Apilo"
                    : "Notatki pomagają przy ręcznej synchronizacji w Apilo"}
                </span>
              </span>
            </label>

            {checked ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className={`block space-y-2 text-sm ${
                      field.multiline ? "md:col-span-2" : ""
                    }`}
                  >
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {field.label}
                    </span>
                    {field.multiline ? (
                      <textarea
                        rows={3}
                        className={inputClassName}
                        value={entry[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          updateField(channel.id, field.key, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        className={inputClassName}
                        value={entry[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          updateField(channel.id, field.key, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function ChannelMetadataSummary({
  selected,
  metadata,
}: {
  selected: string[];
  metadata: ChannelMetadataMap | undefined;
}) {
  const lines = selected
    .map((channelId) => {
      const entry = getChannelMetadata(metadata, channelId);
      const label = CHANNEL_LABELS[channelId] ?? channelId;
      const parts = [
        entry.marketplaceCategory?.trim(),
        entry.parameters?.trim(),
        entry.listingTitle?.trim(),
        entry.notes?.trim(),
      ].filter(Boolean);

      if (parts.length === 0) {
        return null;
      }

      return { label, text: parts.join(" · ") };
    })
    .filter((line): line is { label: string; text: string } => line !== null);

  if (lines.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Brak notatek kanałowych — uzupełnij je przed synchronizacją w Apilo.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {lines.map((line) => (
        <li key={line.label}>
          <span className="font-medium">{line.label}:</span> {line.text}
        </li>
      ))}
    </ul>
  );
}
