import { NextResponse } from "next/server";
import { isS3Configured } from "@/lib/storage/s3-config";
import { uploadImageToS3 } from "@/lib/storage/s3";

export async function GET() {
  return NextResponse.json({
    configured: isS3Configured(),
    maxSizeMb: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
}

export async function POST(request: Request) {
  if (!isS3Configured()) {
    return NextResponse.json(
      {
        message:
          "Upload S3 nie jest skonfigurowany. Uzupełnij zmienne AWS w .env.local.",
      },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Brak pliku w polu file." },
        { status: 400 },
      );
    }

    const uploaded = await uploadImageToS3(file);

    return NextResponse.json({
      success: true,
      ...uploaded,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Upload do S3 nie powiódł się.",
      },
      { status: 400 },
    );
  }
}
