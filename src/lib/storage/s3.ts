import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getS3Config } from "./s3-config";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function buildObjectKey(filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFilename(filename) || "image.jpg";
  return `incore-products/${year}/${month}/${randomUUID()}-${safeName}`;
}

export interface UploadImageResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
}

export async function uploadImageToS3(
  file: File,
): Promise<UploadImageResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Dozwolone formaty: JPG, PNG, WEBP, GIF.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Maksymalny rozmiar pliku to 10 MB.");
  }

  const config = getS3Config();
  const key = buildObjectKey(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    url: `${config.publicBaseUrl}/${key}`,
    key,
    contentType: file.type,
    size: file.size,
  };
}
