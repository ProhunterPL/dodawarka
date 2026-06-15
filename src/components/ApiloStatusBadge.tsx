"use client";

import { useEffect, useState } from "react";

interface StatusResponse {
  ok: boolean;
  message: string;
  dryRun?: boolean;
}

export function ApiloStatusBadge() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/apilo/status");
        const data = (await response.json()) as StatusResponse;
        if (!cancelled) {
          setStatus(data);
        }
      } catch {
        if (!cancelled) {
          setStatus({ ok: false, message: "Błąd połączenia z backendem." });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        Sprawdzanie…
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          status?.ok
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        {status?.ok ? "Połączono" : "Błąd"}
      </span>
      {status?.dryRun ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Dry-run
        </span>
      ) : null}
      <span className="text-sm text-zinc-500">{status?.message}</span>
    </div>
  );
}
