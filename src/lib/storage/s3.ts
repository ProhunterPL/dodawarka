import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getS3Config, isOurS3Url } from "./s3-config";

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

export interface StoredS3Image {
  url: string;
  key: string;
  size?: number;
  lastModified?: string;
}

function createS3Client() {
  const config = getS3Config();
  return {
    config,
    client: new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
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
  const { client } = createS3Client();

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

export async function listRecentImagesFromS3(
  limit = 30,
): Promise<StoredS3Image[]> {
  const { config, client } = createS3Client();

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: "incore-products/",
      MaxKeys: Math.max(1, Math.min(limit, 200)),
    }),
  );

  const items = response.Contents ?? [];
  return items
    .filter((item) => Boolean(item.Key) && !item.Key?.endsWith("/"))
    .sort((a, b) => {
      const aTime = a.LastModified?.getTime() ?? 0;
      const bTime = b.LastModified?.getTime() ?? 0;
      return bTime - aTime;
    })
    .map((item) => ({
      key: item.Key as string,
      url: `${config.publicBaseUrl}/${item.Key as string}`,
      size: item.Size,
      lastModified: item.LastModified?.toISOString(),
    }));
}

export function getS3KeyFromUrl(url: string): string | null {
  if (!isOurS3Url(url)) {
    return null;
  }
  const base = getS3Config().publicBaseUrl;
  const key = url.slice(base.length + 1);
  return key || null;
}

export async function deleteImageFromS3(
  target: { key?: string; url?: string },
): Promise<{ key: string }> {
  const key = target.key ?? (target.url ? getS3KeyFromUrl(target.url) : null);
  if (!key) {
    throw new Error("Nieprawidłowy klucz lub URL zdjęcia S3.");
  }

  if (!key.startsWith("incore-products/")) {
    throw new Error("Można usuwać tylko pliki z prefiksu incore-products/.");
  }

  const { config, client } = createS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
  return { key };
}
