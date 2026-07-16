/**
 * Batch: scrape Koszulker → allocate EAN → append MojeGS1 → import do Apilo.
 *
 * Usage:
 *   npx tsx scripts/import-koszulker-catalog.mts --dry-run
 *   npx tsx scripts/import-koszulker-catalog.mts --limit 1
 *   npx tsx scripts/import-koszulker-catalog.mts
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { allocateGtinsForProducts } from "../src/lib/ean/pool.ts";
import {
  appendProductsToGs1Xlsx,
  getGs1ImportTemplatePath,
} from "../src/lib/ean/gs1-template.ts";
import type { ProductFormInput } from "../src/lib/product/types.ts";

const BASE = process.env.IMPORT_BASE_URL ?? "http://localhost:3000";
const LIST_URL = "https://incoresports.koszulker.pl/";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipEan = args.has("--skip-ean");
const skipImport = args.has("--skip-import");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

interface ListItem {
  productId: string;
  title: string;
  productUrl: string;
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Mode: dryRun=${dryRun} skipEan=${skipEan} skipImport=${skipImport} limit=${limit ?? "all"}`);

  const listRes = await fetch(
    `${BASE}/api/scrape/koszulker?action=list&url=${encodeURIComponent(LIST_URL)}`,
  );
  const listJson = (await listRes.json()) as {
    ok: boolean;
    items?: ListItem[];
    error?: string;
  };
  if (!listJson.ok || !listJson.items?.length) {
    throw new Error(`Listing failed: ${listJson.error ?? listRes.status}`);
  }

  let urls = listJson.items.map((item) => item.productUrl);
  if (limit && Number.isFinite(limit)) {
    urls = urls.slice(0, limit);
  }
  console.log(`Listing: ${listJson.items.length} products, scraping ${urls.length}…`);

  const scrapeRes = await fetch(`${BASE}/api/scrape/koszulker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, defaultQuantity: 10 }),
  });
  const scrapeJson = (await scrapeRes.json()) as {
    ok: boolean;
    items?: Array<{
      url: string;
      error?: string;
      product?: ProductFormInput;
      detail?: { title?: string; color?: string; gender?: string; sizes?: string[] };
    }>;
    error?: string;
  };
  if (!scrapeJson.ok || !scrapeJson.items) {
    throw new Error(`Scrape failed: ${scrapeJson.error ?? scrapeRes.status}`);
  }

  const products: ProductFormInput[] = [];
  for (const item of scrapeJson.items) {
    if (item.error || !item.product) {
      console.error(`  FAIL scrape ${item.url}: ${item.error}`);
      continue;
    }
    const p = item.product;
    console.log(
      `  OK ${p.sku} | ${p.groupName.slice(0, 60)} | sizes=${p.variants.map((v) => v.size).join(",")} | imgs=${p.imageUrls.length}`,
    );
    products.push(p);
  }

  if (products.length === 0) {
    throw new Error("Brak produktów po scrapie.");
  }

  const allocation = allocateGtinsForProducts(products);
  console.log(`EAN assigned: ${allocation.assignedCount}, next free: ${allocation.nextGtin}`);

  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const snapshotPath = path.join(process.cwd(), "data", "koszulker-import-batch.json");
  writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        dryRun,
        products: allocation.products,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`Snapshot: ${snapshotPath}`);

  if (!skipEan && !dryRun) {
    const buffer = appendProductsToGs1Xlsx(allocation.products);
    const xlsxPath = getGs1ImportTemplatePath();
    writeFileSync(xlsxPath, buffer);
    console.log(`GS1 appended → ${xlsxPath}`);
  } else if (dryRun) {
    console.log("GS1: skipped (dry-run)");
  }

  if (skipImport) {
    console.log("Import skipped.");
    return;
  }

  const results: Array<{ sku: string; ok: boolean; message: string; ids?: number[] }> = [];

  for (const product of allocation.products) {
    process.stdout.write(`Import ${product.sku}… `);
    const res = await fetch(`${BASE}/api/apilo/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, dryRun }),
    });
    const raw = await res.text();
    let data: {
      success?: boolean;
      message?: string;
      apiloProductIds?: number[];
      validation?: { issues?: Array<{ message: string; severity: string }> };
      channelNote?: string;
    };
    try {
      data = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      console.log(`HTTP ${res.status} non-JSON`);
      results.push({ sku: product.sku, ok: false, message: raw.slice(0, 200) });
      continue;
    }

    if (!data.success) {
      const issues = data.validation?.issues
        ?.filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ");
      const msg = data.message ?? issues ?? `HTTP ${res.status}`;
      console.log(`FAIL: ${msg}`);
      results.push({ sku: product.sku, ok: false, message: msg });
      continue;
    }

    const ids = data.apiloProductIds ?? [];
    console.log(`OK ids=${ids.join(",") || "(dry-run)"}`);
    results.push({
      sku: product.sku,
      ok: true,
      message: data.channelNote ?? "ok",
      ids,
    });
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone: ${ok} ok, ${fail} fail (of ${results.length})`);
  writeFileSync(
    path.join(process.cwd(), "data", "koszulker-import-results.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), dryRun, results }, null, 2),
    "utf-8",
  );

  if (fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
