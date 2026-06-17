function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadGs1CatalogCsv(filename?: string) {
  const query = filename ? `?action=export-gs1&filename=${encodeURIComponent(filename)}` : "?action=export-gs1";
  const response = await fetch(`/api/ean/portable${query}`);
  if (!response.ok) {
    const data = (await response.json()) as { message?: string };
    throw new Error(data.message ?? "Nie udało się wyeksportować katalogu GS1.");
  }
  const csv = await response.text();
  downloadBlob(filename?.replace(/\.xlsx$/i, ".csv") ?? "gs1-katalog.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export async function downloadProductEanTemplateXlsx(
  products: import("@/lib/product/types").ProductFormInput[],
  filename = "ean_import_mojegs1.xlsx",
): Promise<{
  products: import("@/lib/product/types").ProductFormInput[];
  assignedCount: number;
  nextGtin: string | null;
}> {
  const response = await fetch("/api/ean/portable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "export-products", products }),
  });
  const data = (await response.json()) as {
    success: boolean;
    xlsxBase64?: string;
    filename?: string;
    products?: import("@/lib/product/types").ProductFormInput[];
    assignedCount?: number;
    nextGtin?: string | null;
    message?: string;
  };
  if (!response.ok || !data.success || !data.xlsxBase64 || !data.products) {
    throw new Error(data.message ?? "Nie udało się wyeksportować szablonu MojeGS1.");
  }
  const bytes = Uint8Array.from(atob(data.xlsxBase64), (char) => char.charCodeAt(0));
  downloadBlob(data.filename ?? filename, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  return {
    products: data.products,
    assignedCount: data.assignedCount ?? 0,
    nextGtin: data.nextGtin ?? null,
  };
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
