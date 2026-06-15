import { NextResponse } from "next/server";
import { getWhoami, isApiloApiError, testConnection } from "@/lib/apilo/client";

export async function GET() {
  try {
    const connection = await testConnection();
    let whoami: Record<string, unknown> | null = null;

    try {
      whoami = await getWhoami();
    } catch {
      whoami = null;
    }

    return NextResponse.json({
      ok: true,
      message: connection.content ?? "Połączenie z Apilo działa.",
      whoami,
      dryRun: process.env.APILO_DRY_RUN === "true",
    });
  } catch (error) {
    const status = isApiloApiError(error) ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się połączyć z Apilo.",
      },
      { status },
    );
  }
}
