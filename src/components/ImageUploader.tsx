"use client";

import { useRef, useState } from "react";
import { isOneDriveUrl } from "@/lib/product/validation";

interface ImageUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

interface RecentImage {
  url: string;
  key: string;
  size?: number;
  lastModified?: string;
}

export function ImageUploader({ urls, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [s3Checked, setS3Checked] = useState(false);
  const [recentImages, setRecentImages] = useState<RecentImage[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  async function loadRecentImages() {
    setLoadingRecent(true);
    try {
      const response = await fetch("/api/uploads");
      const data = (await response.json()) as {
        configured?: boolean;
        recentImages?: RecentImage[];
      };
      setS3Checked(true);
      setConfigured(Boolean(data.configured));
      setRecentImages(data.recentImages ?? []);
    } catch {
      setS3Checked(true);
      setRecentImages([]);
    } finally {
      setLoadingRecent(false);
    }
  }

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
      await loadRecentImages();
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

  function moveUrl(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= urls.length) {
      return;
    }
    const next = [...urls];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    onChange(next);
  }

  function setAsMain(index: number) {
    if (index <= 0) {
      return;
    }
    const next = [...urls];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  function updateUrl(index: number, value: string) {
    const next = [...urls];
    next[index] = value;
    onChange(next);
  }

  function addExistingUrl(url: string) {
    if (urls.includes(url)) {
      return;
    }
    onChange([...urls, url]);
  }

  async function deleteFromS3(url: string, removeFromList = false) {
    setDeletingUrl(url);
    setError(null);
    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Usuwanie zdjęcia z S3 nie powiodło się.");
      }

      if (removeFromList) {
        onChange(urls.filter((item) => item !== url));
      }
      await loadRecentImages();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Usuwanie zdjęcia z S3 nie powiodło się.",
      );
    } finally {
      setDeletingUrl(null);
    }
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
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void loadRecentImages()}
            disabled={loadingRecent}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          >
            {loadingRecent ? "Sprawdzanie S3…" : "Pokaż bibliotekę S3"}
          </button>
        </div>
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

      {s3Checked && configured ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">Biblioteka zdjęć S3</h4>
            <button
              type="button"
              onClick={() => void loadRecentImages()}
              disabled={loadingRecent}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            >
              {loadingRecent ? "Odświeżanie…" : "Odśwież"}
            </button>
          </div>
          {recentImages.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Brak zdjęć w `incore-products/` albo brak uprawnień listowania.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {recentImages.slice(0, 18).map((image) => (
                <li
                  key={image.key}
                  className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.key}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-2">
                    <p className="line-clamp-2 text-[11px] text-zinc-500">
                      {image.key}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addExistingUrl(image.url)}
                        className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Użyj
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteFromS3(image.url)}
                        disabled={deletingUrl === image.url}
                        className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-300"
                      >
                        {deletingUrl === image.url ? "Usuwanie…" : "Usuń z S3"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
                {index === 0 ? (
                  <p className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Zdjęcie główne
                  </p>
                ) : null}
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveUrl(index, -1)}
                    disabled={index === 0}
                    className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
                  >
                    W górę
                  </button>
                  <button
                    type="button"
                    onClick={() => moveUrl(index, 1)}
                    disabled={index === urls.length - 1}
                    className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
                  >
                    W dół
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsMain(index)}
                    disabled={index === 0}
                    className="rounded-full border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300"
                  >
                    Ustaw jako główne
                  </button>
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
                  >
                    Usuń z listy
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteFromS3(url, true)}
                    disabled={deletingUrl === url}
                    className="rounded-full border border-red-300 px-2.5 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                  >
                    {deletingUrl === url ? "Usuwanie…" : "Usuń z S3"}
                  </button>
                </div>
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
