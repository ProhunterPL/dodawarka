import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const host = process.env.APILO_HOST.replace(/\/$/, "");
const tokens = JSON.parse(readFileSync("data/apilo-tokens.json", "utf-8"));
const suffix = Date.now().toString().slice(-8);
const allowWrite = process.env.APILO_ALLOW_WRITE_TESTS === "true";

if (!allowWrite) {
  console.error(
    "Blokada bezpieczeństwa: APILO_ALLOW_WRITE_TESTS=true jest wymagane do uruchomienia bisecta.",
  );
  process.exit(1);
}

const base = {
  name: `Koszulka test ${suffix}`,
  sku: `RCASE-${suffix}`,
  quantity: 10,
  priceWithTax: "79.00",
  tax: 23,
  status: 0,
};

const steps = [
  {
    name: "1-base",
    item: { ...base, sku: `${base.sku}-1` },
  },
  {
    name: "2-groupName",
    item: {
      ...base,
      sku: `${base.sku}-2`,
      groupName: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny",
    },
  },
  {
    name: "3-category",
    item: {
      ...base,
      sku: `${base.sku}-3`,
      categories: [25],
    },
  },
  {
    name: "4-ean",
    item: {
      ...base,
      sku: `${base.sku}-4`,
      ean: "5906058689547",
    },
  },
  {
    name: "5-weight-unit",
    item: {
      ...base,
      sku: `${base.sku}-5`,
      weight: 0.1,
      unit: "KG",
    },
  },
  {
    name: "6-descriptions",
    item: {
      ...base,
      sku: `${base.sku}-6`,
      description: "Koszulka INCORE SPORTS Earn Your Reps - test importu.",
      shortDescription: "Koszulka INCORE SPORTS Earn Your Reps",
    },
  },
  {
    name: "7-originalCode",
    item: {
      ...base,
      sku: `${base.sku}-7`,
      originalCode: `RCASE-OC-${suffix}`,
    },
  },
  {
    name: "8-all-real-like",
    item: {
      ...base,
      sku: `${base.sku}-8`,
      originalCode: `RCASE-OC2-${suffix}`,
      groupName: "Koszulka T-shirt bawełniana EARN YOUR REPS Incore Sports czarny",
      categories: [25],
      ean: "5906058689547",
      weight: 0.1,
      unit: "KG",
      description: "Koszulka INCORE SPORTS Earn Your Reps - test importu.",
      shortDescription: "Koszulka INCORE SPORTS Earn Your Reps",
      images: {
        "img-1":
          "https://incore-sports-apilo.s3.eu-central-1.amazonaws.com/incore-products/test/setup-check.png",
      },
    },
  },
];

for (const step of steps) {
  const response = await fetch(`${host}/rest/api/warehouse/product/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify([step.item]),
  });
  const body = await response.text();
  console.log(`\n[${step.name}] status=${response.status} sku=${step.item.sku}`);
  console.log(body);
}
