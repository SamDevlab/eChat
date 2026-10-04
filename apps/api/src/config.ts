import { isValidIntegrationEncryptionKey } from "./crypto.js";

export type RuntimeConfig = {
  nodeEnv: string;
  databaseUrl?: string;
  databaseName?: string;
  databaseEnvironment: string;
  appUrl: string;
  publicAppUrl?: string;
  sessionSecret: string;
};

const originFromEnv = (value: string | undefined, name: string, requireHttps: boolean): string => {
  if (!value?.trim()) throw new Error(`${name} é obrigatório`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} deve ser uma origem HTTP(S) válida`);
  }
  if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} deve conter somente uma origem HTTP(S)`);
  }
  if (requireHttps && parsed.protocol !== "https:") throw new Error(`${name} deve usar HTTPS em produção`);
  return parsed.origin;
};

export const loadRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const nodeEnv = env.NODE_ENV ?? "development";
  const production = nodeEnv === "production";
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  let databaseName: string | undefined;
  if (databaseUrl) {
    try { databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, "")); }
    catch { throw new Error("DATABASE_URL deve ser uma URL PostgreSQL válida"); }
  }
  const databaseEnvironment = env.DATABASE_ENV?.trim().toUpperCase() || (databaseName === "echat_test" ? "TEST" : production ? "PRODUCTION" : "UNCLASSIFIED");
  if (!["TEST", "DEVELOPMENT", "PRODUCTION", "UNCLASSIFIED"].includes(databaseEnvironment)) throw new Error("DATABASE_ENV deve ser TEST, DEVELOPMENT ou PRODUCTION");
  if (databaseEnvironment === "TEST" && databaseName !== "echat_test") throw new Error("DATABASE_ENV=TEST exige um banco chamado echat_test");
  if (production && databaseEnvironment !== "PRODUCTION") throw new Error("NODE_ENV=production exige DATABASE_ENV=PRODUCTION");
  const appUrl = originFromEnv(env.APP_URL ?? (production ? undefined : "http://localhost:5173"), "APP_URL", production);
  const sessionSecret = env.SESSION_SECRET ?? "development-only-change-me";
  const publicAppUrl = env.PUBLIC_APP_URL?.trim() ? originFromEnv(env.PUBLIC_APP_URL, "PUBLIC_APP_URL", production) : undefined;

  if (production) {
    if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório em produção");
    if (sessionSecret.length < 32 || /development-only-change-me|change-me-in-production/i.test(sessionSecret)) {
      throw new Error("SESSION_SECRET deve ser um segredo forte em produção");
    }
    if (!isValidIntegrationEncryptionKey(env.INTEGRATION_ENCRYPTION_KEY)) {
      throw new Error("INTEGRATION_ENCRYPTION_KEY deve ter exatamente 32 bytes (64 hex ou base64)");
    }
  }

  return { nodeEnv, databaseUrl, databaseName, databaseEnvironment, appUrl, publicAppUrl, sessionSecret };
};
