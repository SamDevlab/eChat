import { describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness } from "./readiness.js";

describe("database readiness", () => {
  it("is ready when required tables resolve", async () => {
    const tables = ["organizations", "users", "organization_members", "contacts", "channels", "conversations", "messages", "contact_identities", "integration_accounts", "webhook_events", "auth_sessions", "organization_invites", "pipelines", "pipeline_stages", "opportunities", "opportunity_activities", "opportunity_conversations"];
    const client = { unsafe: vi.fn().mockResolvedValue([Object.fromEntries(tables.map((table) => [table, `public.${table}`]))]) };
    await expect(checkDatabaseReadiness(client)).resolves.toBe(true);
  });

  it("is not ready when the schema is incomplete or unavailable", async () => {
    await expect(checkDatabaseReadiness({ unsafe: vi.fn().mockResolvedValue([{ organizations: "public.organizations", integration_accounts: null }]) })).resolves.toBe(false);
    await expect(checkDatabaseReadiness({ unsafe: vi.fn().mockRejectedValue(new Error("database unavailable")) })).rejects.toThrow("database unavailable");
  });
});
