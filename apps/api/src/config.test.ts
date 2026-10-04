import { describe, expect, it } from "vitest";
import { isValidIntegrationEncryptionKey } from "./crypto.js";
import { loadRuntimeConfig } from "./config.js";

const productionEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgres://echat:password@db:5432/echat",
  APP_URL: "https://echat.example.com",
  SESSION_SECRET: "a".repeat(64),
  INTEGRATION_ENCRYPTION_KEY: "0".repeat(64),
  ...overrides,
});

describe("production runtime configuration", () => {
  it("accepts a complete HTTPS configuration", () => {
    expect(loadRuntimeConfig(productionEnv())).toMatchObject({ appUrl: "https://echat.example.com", databaseUrl: "postgres://echat:password@db:5432/echat" });
  });

  it("rejects a weak session secret", () => {
    expect(() => loadRuntimeConfig(productionEnv({ SESSION_SECRET: "short" }))).toThrow("SESSION_SECRET");
  });

  it("rejects an HTTP application origin", () => {
    expect(() => loadRuntimeConfig(productionEnv({ APP_URL: "http://echat.example.com" }))).toThrow("HTTPS");
  });

  it("rejects an invalid integration encryption key", () => {
    expect(() => loadRuntimeConfig(productionEnv({ INTEGRATION_ENCRYPTION_KEY: "not-a-key" }))).toThrow("INTEGRATION_ENCRYPTION_KEY");
    expect(isValidIntegrationEncryptionKey("0".repeat(64))).toBe(true);
    expect(isValidIntegrationEncryptionKey(Buffer.alloc(32, 7).toString("base64"))).toBe(true);
  });

  it("labels the pilot database and refuses a test label for another database", () => {
    expect(loadRuntimeConfig({ DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/echat_test" })).toMatchObject({ databaseName: "echat_test", databaseEnvironment: "TEST" });
    expect(() => loadRuntimeConfig({ DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/echat_dev", DATABASE_ENV: "TEST" })).toThrow("echat_test");
  });
});
