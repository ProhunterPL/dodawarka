import { promises as fs } from "fs";
import path from "path";
import type { ApiloTokenResponse } from "./types";

const TOKEN_FILE = path.join(process.cwd(), "data", "apilo-tokens.json");

export async function readStoredTokens(): Promise<ApiloTokenResponse | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as ApiloTokenResponse;
  } catch {
    return null;
  }
}

export async function writeStoredTokens(tokens: ApiloTokenResponse): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function updateEnvRefreshToken(refreshToken: string): Promise<void> {
  process.env.APILO_REFRESH_TOKEN = refreshToken;
}
