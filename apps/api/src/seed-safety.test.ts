import { describe, expect, it } from "vitest";
import { assertDemoSeedAllowed } from "./seed-safety.js";

describe("demo seed safety", () => {
  it("requires explicit opt-in and the isolated echat_test database", () => {
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: "postgres://user:pass@localhost:5432/echat_test", DATABASE_ENV: "TEST" })).toThrow("ECHAT_ALLOW_DEMO_SEED=1");
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: "postgres://user:pass@localhost:5432/echat_dev", DATABASE_ENV: "TEST", ECHAT_ALLOW_DEMO_SEED: "1" })).toThrow("echat_test");
  });

  it("allows synthetic seed data only after explicit test-database opt-in", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "postgres://user:pass@localhost:5432/echat_test", DATABASE_ENV: "TEST", ECHAT_ALLOW_DEMO_SEED: "1" })).not.toThrow();
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "production", DATABASE_URL: "postgres://user:pass@localhost:5432/echat_test", DATABASE_ENV: "TEST", ECHAT_ALLOW_DEMO_SEED: "1" })).toThrow("NODE_ENV=production");
  });
});
