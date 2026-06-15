export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET &&
      process.env.AWS_REGION,
  );
}

export function getS3Config(): S3Config {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Brak konfiguracji S3. Uzupełnij AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID i AWS_SECRET_ACCESS_KEY.",
    );
  }

  const publicBaseUrl =
    process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    `https://${bucket}.s3.${region}.amazonaws.com`;

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function isOurS3Url(url: string): boolean {
  if (!isS3Configured()) {
    return false;
  }

  try {
    const base = getS3Config().publicBaseUrl;
    return url.startsWith(base);
  } catch {
    return false;
  }
}
