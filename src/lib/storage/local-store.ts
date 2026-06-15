import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ImportLogEntry, LocalProductRecord } from "@/lib/product/types";

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

export async function listImportLogs(): Promise<ImportLogEntry[]> {
  return readJsonFile<ImportLogEntry[]>(LOGS_FILE, []);
}
