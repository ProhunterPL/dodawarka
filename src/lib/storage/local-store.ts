import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ImportLogEntry, LocalProductRecord, ProductFormInput } from "@/lib/product/types";

const PRODUCTS_FILE = path.join(process.cwd(), "data", "products.json");
const LOGS_FILE = path.join(process.cwd(), "data", "import-logs.json");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.dirname(PRODUCTS_FILE), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function listLocalProducts(): Promise<LocalProductRecord[]> {
  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  return products.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getLocalProduct(id: string): Promise<LocalProductRecord | null> {
  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  return products.find((product) => product.id === id) ?? null;
}

export async function saveLocalProduct(
  record: Omit<LocalProductRecord, "id" | "createdAt">,
): Promise<LocalProductRecord> {
  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  const entry: LocalProductRecord = {
    ...record,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  products.unshift(entry);
  await writeJsonFile(PRODUCTS_FILE, products);
  return entry;
}

export async function updateLocalProduct(
  id: string,
  patch: Partial<Omit<LocalProductRecord, "id" | "createdAt">>,
): Promise<LocalProductRecord | null> {
  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  const index = products.findIndex((product) => product.id === id);
  if (index < 0) {
    return null;
  }

  const updated: LocalProductRecord = {
    ...products[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  products[index] = updated;
  await writeJsonFile(PRODUCTS_FILE, products);
  return updated;
}

export async function appendImportLog(
  entry: Omit<ImportLogEntry, "id" | "timestamp">,
): Promise<ImportLogEntry> {
  const logs = await readJsonFile<ImportLogEntry[]>(LOGS_FILE, []);
  const full: ImportLogEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  logs.unshift(full);
  await writeJsonFile(LOGS_FILE, logs.slice(0, 200));
  return full;
}

export async function listKnownSkus(): Promise<string[]> {
  const products = await listLocalProducts();
  const skus = new Set<string>();

  for (const product of products) {
    if (product.importStatus !== "success" && product.importStatus !== "updated") {
      continue;
    }

    for (const part of product.sku.split(",")) {
      const normalized = part.trim();
      if (normalized) {
        skus.add(normalized);
      }
    }

    for (const variantSku of product.variantSkus ?? []) {
      const normalized = variantSku.trim();
      if (normalized) {
        skus.add(normalized);
      }
    }
  }

  return [...skus];
}

export async function listImportLogs(): Promise<ImportLogEntry[]> {
  const logs = await readJsonFile<ImportLogEntry[]>(LOGS_FILE, []);
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function clearLocalSkuLocks(): Promise<{ unlocked: number }> {
  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  let unlocked = 0;

  const updated = products.map((product) => {
    if (product.importStatus !== "success" && product.importStatus !== "updated") {
      return product;
    }

    unlocked += 1;
    return {
      ...product,
      importStatus: "draft" as const,
      errorMessage: "Lokalna blokada SKU została ręcznie wyczyszczona.",
    };
  });

  await writeJsonFile(PRODUCTS_FILE, updated);
  return { unlocked };
}

function collectRecordSkus(product: LocalProductRecord): string[] {
  const skus = new Set<string>();
  for (const part of product.sku.split(",")) {
    const normalized = part.trim();
    if (normalized) {
      skus.add(normalized.toUpperCase());
    }
  }
  for (const variantSku of product.variantSkus ?? []) {
    const normalized = variantSku.trim();
    if (normalized) {
      skus.add(normalized.toUpperCase());
    }
  }
  return [...skus];
}

export async function clearSkuLocksForSkus(skus: string[]): Promise<{ unlocked: number }> {
  const targets = new Set(
    skus.map((sku) => sku.trim().toUpperCase()).filter(Boolean),
  );

  if (targets.size === 0) {
    return { unlocked: 0 };
  }

  const products = await readJsonFile<LocalProductRecord[]>(PRODUCTS_FILE, []);
  let unlocked = 0;

  const updated = products.map((product) => {
    if (product.importStatus !== "success" && product.importStatus !== "updated") {
      return product;
    }

    const overlaps = collectRecordSkus(product).some((sku) => targets.has(sku));
    if (!overlaps) {
      return product;
    }

    unlocked += 1;
    return {
      ...product,
      importStatus: "draft" as const,
      errorMessage: "Selektywnie odblokowano SKU z bieżącego formularza.",
    };
  });

  await writeJsonFile(PRODUCTS_FILE, updated);
  return { unlocked };
}
