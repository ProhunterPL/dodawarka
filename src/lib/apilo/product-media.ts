import type { ApiloWarehouseProductMedia } from "./types";

/** Konwersja mediów z Apilo na format PUT (`img-1`, `img-2`, …). */
export function mediaToPutImages(
  media: ApiloWarehouseProductMedia[],
): Record<string, string> | undefined {
  if (media.length === 0) {
    return undefined;
  }

  const sorted = [...media].sort((left, right) => {
    if (left.isMain !== right.isMain) {
      return right.isMain - left.isMain;
    }
    return left.id - right.id;
  });

  return Object.fromEntries(
    sorted.map((item, index) => [`img-${index + 1}`, item.link]),
  );
}
