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
  name: "Test API Apilo",
  sku: `BIS-${suffix}`,
  quantity: 1,
  priceWithTax: "79.00",
  tax: 23,
  status: 0,
};

const cases = [
  { name: "minimal", payload: [{ ...base, sku: `${base.sku}-A` }] },
  {
    name: "with-group",
    payload: [{ ...base, sku: `${base.sku}-B`, groupName: "Test Group" }],
  },
  {
    name: "with-category",
    payload: [{ ...base, sku: `${base.sku}-C`, categories: [25] }],
  },
  {
    name: "with-description",
    payload: [
      {
        ...base,
        sku: `${base.sku}-D`,
        description: "Opis testowy",
        shortDescription: "Krótki opis",
      },
    ],
  },
  {
    name: "with-images",
    payload: [
      {
        ...base,
        sku: `${base.sku}-E`,
        images: {
          "img-1":
            "https://incore-sports-apilo.s3.eu-central-1.amazonaws.com/incore-products/test/setup-check.png",
        },
      },
    ],
  },
];

for (const test of cases) {
  const response = await fetch(`${host}/rest/api/warehouse/product/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(test.payload),
  });

  const body = await response.text();
  console.log(`\n[${test.name}] status=${response.status}`);
  console.log(body);
}
