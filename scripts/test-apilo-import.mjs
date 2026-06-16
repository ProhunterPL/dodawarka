import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const host = process.env.APILO_HOST.replace(/\/$/, "");
const tokens = JSON.parse(readFileSync("data/apilo-tokens.json", "utf-8"));
const suffix = Date.now().toString().slice(-6);
const allowWrite = process.env.APILO_ALLOW_WRITE_TESTS === "true";

if (!allowWrite) {
  console.error(
    "Blokada bezpieczeństwa: ustaw APILO_ALLOW_WRITE_TESTS=true, aby wysłać testowy produkt do Apilo.",
  );
  process.exit(1);
}

const payload = [
  {
    name: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny S",
    sku: `TMCS-EYR-IS-S-TEST-${suffix}`,
    quantity: 10,
    priceWithTax: "79.00",
    tax: 23,
    status: 0,
    groupName: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny",
    categories: [25],
    ean: "5906058689547",
    weight: 0.1,
    unit: "KG",
    description: "Koszulka INCORE SPORTS Earn Your Reps - test importu.",
    shortDescription: "Koszulka INCORE SPORTS Earn Your Reps",
    originalCode: `TMCS-EYR-IS-S-TEST-${suffix}`,
    images: {
      "img-1":
        "https://incore-sports-apilo.s3.eu-central-1.amazonaws.com/incore-products/test/setup-check.png",
    },
  },
];

const response = await fetch(`${host}/rest/api/warehouse/product/`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokens.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
console.log("Status:", response.status);
console.log(body);

if (!response.ok) {
  process.exit(1);
}
