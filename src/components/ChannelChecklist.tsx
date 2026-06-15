"use client";

import { SALES_CHANNELS } from "@/lib/product/channels";

interface ChannelChecklistProps {
  selected: string[];
  onChange: (channels: string[]) => void;
}

export function ChannelChecklist({ selected, onChange }: ChannelChecklistProps) {
  function toggle(channelId: string) {
    if (selected.includes(channelId)) {
      onChange(selected.filter((id) => id !== channelId));
      return;
    }
    onChange([...selected, channelId]);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SALES_CHANNELS.map((channel) => {
        const checked = selected.includes(channel.id);
        return (
          <label
            key={channel.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
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
                  ? "Wymaga dopasowania kategorii/parametrów w Apilo"
                  : "Synchronizacja przez panel Apilo"}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
