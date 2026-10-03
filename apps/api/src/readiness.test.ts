import { describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness } from "./readiness.js";

describe("database readiness", () => {
  it("is ready when required tables resolve", async () => {
    const client = { unsafe: vi.fn().mockResolvedValue([{ organizations: "public.organizations", integration_accounts: "public.integration_accounts" }]) };
    await expect(checkDatabaseReadiness(client)).resolves.toBe(true);
  });

  it("is not ready when the schema is incomplete or unavailable", async () => {
    await expect(checkDatabaseReadiness({ unsafe: vi.fn().mockResolvedValue([{ organizations: null, integration_accounts: null }]) })).resolves.toBe(false);
    await expect(checkDatabaseReadiness({ unsafe: vi.fn().mockRejectedValue(new Error("database unavailable")) })).rejects.toThrow("database unavailable");
  });
});
