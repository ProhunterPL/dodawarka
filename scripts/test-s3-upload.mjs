import { readFileSync } from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const key = "incore-products/test/setup-check.png";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: png,
    ContentType: "image/png",
  }),
);

const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
const response = await fetch(url);
console.log("Upload OK:", url);
console.log("Public GET:", response.status, response.headers.get("content-type"));
