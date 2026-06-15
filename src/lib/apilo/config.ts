function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak wymaganej zmiennej środowiskowej: ${name}`);
  }
  return value;
}

export function getApiloConfig() {
  return {
    host: requireEnv("APILO_HOST").replace(/\/$/, ""),
    clientId: requireEnv("APILO_CLIENT_ID"),
    clientSecret: requireEnv("APILO_CLIENT_SECRET"),
    authorizationCode: process.env.APILO_AUTHORIZATION_CODE ?? "",
    refreshToken: process.env.APILO_REFRESH_TOKEN ?? "",
    dryRun: process.env.APILO_DRY_RUN === "true",
  };
}

export function getApiloHost(): string {
  return getApiloConfig().host;
}
