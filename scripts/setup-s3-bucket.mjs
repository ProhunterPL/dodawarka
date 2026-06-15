import { readFileSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

async function main() {
  loadEnv();

  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Uzupełnij AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY w .env.local");
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  let bucketExists = true;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket istnieje: ${bucket}`);
  } catch {
    bucketExists = false;
  }

  if (!bucketExists) {
    console.log(`Tworzę bucket: ${bucket} (${region})…`);
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
        CreateBucketConfiguration:
          region === "us-east-1" ? undefined : { LocationConstraint: region },
      }),
    );
    console.log("Bucket utworzony.");
  }

  console.log("Konfiguruję publiczny odczyt tylko dla incore-products/* …");
  await client.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    }),
  );

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadProductImages",
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/incore-products/*`],
      },
    ],
  };

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    }),
  );

  const publicBaseUrl =
    process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    `https://${bucket}.s3.${region}.amazonaws.com`;

  console.log("");
  console.log("S3 gotowy do uploadu zdjęć produktów.");
  console.log("Publiczny URL bazowy:", publicBaseUrl);
  console.log("Prefix obiektów: incore-products/");
  console.log("");
  console.log("Upewnij się, że IAM user ma uprawnienie s3:PutObject do tego bucketa.");
}

main().catch((error) => {
  console.error("Błąd konfiguracji S3:", error instanceof Error ? error.message : error);
  process.exit(1);
});
