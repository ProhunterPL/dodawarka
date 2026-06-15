import { NextResponse } from "next/server";
import { listImportLogs, listLocalProducts } from "@/lib/storage/local-store";

export async function GET() {
  const [products, logs] = await Promise.all([
    listLocalProducts(),
    listImportLogs(),
  ]);

  return NextResponse.json({ products, logs });
}
