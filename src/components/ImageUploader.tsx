"use client";

import { useRef, useState } from "react";
import { isOneDriveUrl } from "@/lib/product/validation";

interface ImageUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function ImageUploader({ urls, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const statusResponse = await fetch("/api/uploads");
      const status = (await statusResponse.json()) as { configured?: boolean };
      if (!status.configured) {
        throw new Error(
          "S3 nie jest skonfigurowany. Dodaj dane AWS do .env.local albo wklej bezpośredni URL zdjęcia.",
        );
      }

      const uploadedUrls: string[] = [];

      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as {
          url?: string;
          message?: string;
        };

        if (!response.ok || !data.url) {
          throw new Error(data.message ?? `Nie udało się wgrać pliku ${file.name}.`);
        }

        uploadedUrls.push(data.url);
      }

      onChange([...urls.filter((url) => url.trim()), ...uploadedUrls]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Błąd uploadu.",
      );
    } finally {
      setUploading(false);
    }
  }

  function removeUrl(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  function updateUrl(index: number, value: string) {
    const next = [...urls];
    next[index] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(event.dataTransfer.files);
        }}
      >
        <p className="text-sm font-medium">Przeciągnij zdjęcia lub wybierz z dysku</p>
        <p className="mt-1 text-xs text-zinc-500">
          JPG, PNG, WEBP, GIF — max 10 MB. Pliki trafiają na S3 z publicznym URL dla Apilo.
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {uploading ? "Wgrywanie…" : "Wybierz pliki"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => void uploadFiles(event.target.files)}
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {urls.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                {url.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Zdjęcie produktu ${index + 1}`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    Brak podglądu
                  </div>
                )}
              </div>
              <div className="space-y-2 p-3">
                <input
                  value={url}
                  onChange={(event) => updateUrl(index, event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                {isOneDriveUrl(url) ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Link OneDrive — wgraj plik na S3 zamiast tego URL-a.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeUrl(index)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Brak zdjęć. Wgraj pliki lub dodaj URL ręcznie.</p>
      )}

      <button
        type="button"
        onClick={() => onChange([...urls, ""])}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        Dodaj URL ręcznie
      </button>
    </div>
  );
}
