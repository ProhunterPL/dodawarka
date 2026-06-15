import { readFileSync } from "fs";
import { promises as fs } from "fs";
import path from "path";

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

  const host = process.env.APILO_HOST?.replace(/\/$/, "");
  const clientId = process.env.APILO_CLIENT_ID;
  const clientSecret = process.env.APILO_CLIENT_SECRET;
  const authorizationCode = process.env.APILO_AUTHORIZATION_CODE;

  if (!host || !clientId || !clientSecret || !authorizationCode) {
    throw new Error("Uzupełnij APILO_HOST, APILO_CLIENT_ID, APILO_CLIENT_SECRET i APILO_AUTHORIZATION_CODE w .env.local");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${host}/rest/auth/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grantType: "authorization_code",
      token: authorizationCode,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    console.error("Błąd autoryzacji:", body);
    process.exit(1);
  }

  const tokenFile = path.join(process.cwd(), "data", "apilo-tokens.json");
  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(body, null, 2), "utf-8");

  const connection = await fetch(`${host}/rest/api/`, {
    headers: {
      Authorization: `Bearer ${body.accessToken}`,
      Accept: "application/json",
    },
  });

  console.log("Autoryzacja OK");
  console.log("Access token wygasa:", body.accessTokenExpireAt);
  console.log("Refresh token wygasa:", body.refreshTokenExpireAt);
  console.log("Połączenie:", connection.status, await connection.text());
  console.log("Tokeny zapisane w data/apilo-tokens.json");
  console.log("");
  console.log("Opcjonalnie dodaj do .env.local (na przyszłość):");
  console.log(`APILO_REFRESH_TOKEN=${body.refreshToken}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
