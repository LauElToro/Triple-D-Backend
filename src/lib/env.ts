function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    return fallback ?? "";
  }
  return value;
}

/** Primary app origin (first entry if WEB_APP_URL is a CORS allowlist). */
function primaryWebAppUrl(): string {
  const raw = required("WEB_APP_URL", "http://localhost:3000");
  return raw.split(",")[0]?.trim() || "http://localhost:3000";
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  apiUrl: required("API_URL", "http://localhost:4000"),
  webAppUrl: primaryWebAppUrl(),

  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  accessTokenTtlSeconds: Number(required("ACCESS_TOKEN_TTL_SECONDS", "7200")),
  refreshTokenTtlSeconds: Number(required("REFRESH_TOKEN_TTL_SECONDS", "1209600")),

  apiKeyPepper: required("API_KEY_PEPPER", "dev-pepper"),

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",

  gmailUser: process.env.GMAIL_USER ?? "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Triple D <no-reply@example.com>",

  diditApiKey: process.env.DIDIT_API_KEY ?? "",
  diditWebhookSecret: process.env.DIDIT_WEBHOOK_SECRET ?? "",
  diditWorkflowId: process.env.DIDIT_WORKFLOW_ID ?? "",
  diditBaseUrl: process.env.DIDIT_BASE_URL ?? "https://verification.didit.me",

  arcaBaseUrl: required("ARCA_BASE_URL", "http://localhost:3000"),
  arcaApiKey: required("ARCA_API_KEY", "dev-local-key"),

  isProd: process.env.NODE_ENV === "production",
};
