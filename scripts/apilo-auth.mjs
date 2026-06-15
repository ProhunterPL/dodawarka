import { readFileSync } from "fs";
import { promises as fs } from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), "data", "apilo-tokens.json");

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

function readStoredRefreshToken() {
  try {
    const stored = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    return stored.refreshToken ?? null;
  } catch {
    return null;
  }
}

async function main() {
  loadEnv();

  const host = process.env.APILO_HOST?.replace(/\/$/, "");
  const clientId = process.env.APILO_CLIENT_ID;
  const clientSecret = process.env.APILO_CLIENT_SECRET;
  const authorizationCode = process.env.APILO_AUTHORIZATION_CODE;
  const envRefreshToken = process.env.APILO_REFRESH_TOKEN;
  const storedRefreshToken = readStoredRefreshToken();

  if (!host || !clientId || !clientSecret) {
    throw new Error("Uzupełnij APILO_HOST, APILO_CLIENT_ID i APILO_CLIENT_SECRET w .env.local");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  async function requestToken(grantType, token) {
    const response = await fetch(`${host}/rest/auth/token/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ grantType, token }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? `Błąd autoryzacji (${response.status})`);
    }
    return body;
  }

  const attempts = [
    storedRefreshToken
      ? { label: "data/apilo-tokens.json", grantType: "refresh_token", token: storedRefreshToken }
      : null,
    envRefreshToken
      ? { label: "APILO_REFRESH_TOKEN", grantType: "refresh_token", token: envRefreshToken }
      : null,
    authorizationCode
      ? { label: "APILO_AUTHORIZATION_CODE", grantType: "authorization_code", token: authorizationCode }
      : null,
  ].filter(Boolean);

  let body = null;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log(`Próba autoryzacji przez ${attempt.label}…`);
      body = await requestToken(attempt.grantType, attempt.token);
      break;
    } catch (error) {
      lastError = error;
      console.warn(
        `Nieudane (${attempt.label}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!body) {
    throw lastError ?? new Error("Brak dostępnej metody autoryzacji.");
  }

  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(body, null, 2), "utf-8");

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
  console.log("Zaktualizuj w .env.local:");
  console.log(`APILO_REFRESH_TOKEN=${body.refreshToken}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
