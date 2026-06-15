import { getApiloConfig } from "./config";
import {
  readStoredTokens,
  updateEnvRefreshToken,
  writeStoredTokens,
} from "./token-store";
import type {
  ApiloApiError,
  ApiloCategoriesResponse,
  ApiloCreateProductsResponse,
  ApiloTokenResponse,
  ApiloWarehouseProductPayload,
} from "./types";

type GrantType = "authorization_code" | "refresh_token";

async function requestToken(
  grantType: GrantType,
  token: string,
): Promise<ApiloTokenResponse> {
  const config = getApiloConfig();
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(`${config.host}/rest/auth/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ grantType, token }),
  });

  if (!response.ok) {
    const details = await safeJson(response);
    throw createApiError("Autoryzacja Apilo nie powiodła się", response.status, details);
  }

  const tokens = (await response.json()) as ApiloTokenResponse;
  await writeStoredTokens(tokens);
  await updateEnvRefreshToken(tokens.refreshToken);
  return tokens;
}

export async function authenticate(): Promise<ApiloTokenResponse> {
  const stored = await readStoredTokens();
  if (stored?.refreshToken) {
    try {
      return await refreshToken(stored.refreshToken);
    } catch {
      // fall through to authorization_code
    }
  }

  const config = getApiloConfig();
  if (config.refreshToken) {
    try {
      return await refreshToken(config.refreshToken);
    } catch {
      // fall through
    }
  }

  if (!config.authorizationCode) {
    throw new Error(
      "Brak ważnego tokenu. Uruchom: npm run apilo:auth (wymaga świeżego APILO_AUTHORIZATION_CODE w .env.local).",
    );
  }

  return requestToken("authorization_code", config.authorizationCode);
}

export async function refreshToken(
  refreshTokenValue?: string,
): Promise<ApiloTokenResponse> {
  const config = getApiloConfig();
  const stored = await readStoredTokens();
  const token =
    refreshTokenValue ?? stored?.refreshToken ?? config.refreshToken;

  if (!token) {
    return authenticate();
  }

  return requestToken("refresh_token", token);
}

async function getAccessToken(): Promise<string> {
  const stored = await readStoredTokens();
  if (stored?.accessToken) {
    const expiresAt = new Date(stored.accessTokenExpireAt).getTime();
    if (expiresAt > Date.now() + 60_000) {
      return stored.accessToken;
    }
  }

  const tokens = await refreshToken();
  return tokens.accessToken;
}

async function apiloFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getApiloConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(`${config.host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    const tokens = await refreshToken();
    const retry = await fetch(`${config.host}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!retry.ok) {
      const details = await safeJson(retry);
      throw createApiError("Błąd API Apilo po odświeżeniu tokenu", retry.status, details);
    }

    if (retry.status === 204) {
      return undefined as T;
    }

    return (await retry.json()) as T;
  }

  if (!response.ok) {
    const details = await safeJson(response);
    throw createApiError("Błąd API Apilo", response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function testConnection(): Promise<{ ok: boolean; content?: string }> {
  const data = await apiloFetch<{ content?: string }>("/rest/api/");
  return { ok: true, content: data.content };
}

export async function getWhoami(): Promise<Record<string, unknown>> {
  return apiloFetch<Record<string, unknown>>("/rest/api/whoami/");
}

export async function getCategories(
  offset = 0,
  limit = 512,
): Promise<ApiloCategoriesResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return apiloFetch<ApiloCategoriesResponse>(
    `/rest/api/warehouse/category/?${params.toString()}`,
  );
}

export async function getAllCategories(): Promise<ApiloCategoriesResponse["categories"]> {
  const all: ApiloCategoriesResponse["categories"] = [];
  let offset = 0;
  const limit = 512;

  while (true) {
    const page = await getCategories(offset, limit);
    all.push(...page.categories);
    if (page.categories.length < limit) {
      break;
    }
    offset += limit;
    if (offset >= page.totalCount) {
      break;
    }
  }

  return all;
}

export async function createWarehouseProduct(
  products: ApiloWarehouseProductPayload[],
  options?: { dryRun?: boolean },
): Promise<ApiloCreateProductsResponse | { dryRun: true; payload: ApiloWarehouseProductPayload[] }> {
  const dryRun = options?.dryRun ?? getApiloConfig().dryRun;

  if (dryRun) {
    return { dryRun: true, payload: products };
  }

  return apiloFetch<ApiloCreateProductsResponse>("/rest/api/warehouse/product/", {
    method: "POST",
    body: JSON.stringify(products),
  });
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

function createApiError(
  message: string,
  status: number,
  details?: unknown,
): ApiloApiError & Error {
  const error = new Error(message) as ApiloApiError & Error;
  error.status = status;
  error.details = details;
  return error;
}

export function isApiloApiError(error: unknown): error is ApiloApiError & Error {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as ApiloApiError).status === "number"
  );
}
