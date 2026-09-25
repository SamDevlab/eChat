import { describe, expect, it } from "vitest";
import { qualifyChatwootReadOnly, type ReadOnlyChatwootProvider } from "./live-qualification.js";

const provider = (overrides: Partial<ReadOnlyChatwootProvider> = {}): ReadOnlyChatwootProvider => ({
  async testConnection() { return { accountId: "77", name: "Pilot" }; },
  async listContacts() { return { items: [{ id: "10" }], hasNextPage: false }; },
  async listConversations() { return { items: [{ channelExternalId: "88" }], hasNextPage: false }; },
  async listWebhooks() { return [{ id: "w1", url: "https://pilot.example/api/v1/webhooks/chatwoot" }]; },
  ...overrides,
});

describe("read-only Chatwoot pilot qualification", () => {
  it("passes account, inbox and webhook checks without mutations", async () => {
    const report = await qualifyChatwootReadOnly(provider(), {
      expectedAccountId: "77",
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
      requireWebhookMatch: true,
    });
    expect(report).toEqual(expect.objectContaining({
      pass: true,
      accountMatch: true,
      inboxMatch: "PASS",
      webhookMatch: "PASS",
      mode: "READ_ONLY",
    }));
  });

  it("fails when the live account does not match the configured account", async () => {
    const report = await qualifyChatwootReadOnly(provider({
      async testConnection() { return { accountId: "999" }; },
    }), {
      expectedAccountId: "77",
    });
    expect(report.pass).toBe(false);
    expect(report.accountMatch).toBe(false);
  });

  it("fails a strict webhook gate without registering anything", async () => {
    let listCalls = 0;
    const report = await qualifyChatwootReadOnly(provider({
      async listWebhooks() {
        listCalls += 1;
        return [{ id: "w1", url: "https://other.example/webhook" }];
      },
    }), {
      expectedAccountId: "77",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
      requireWebhookMatch: true,
    });
    expect(listCalls).toBe(1);
    expect(report.pass).toBe(false);
    expect(report.webhookMatch).toBe("FAIL");
  });

  it("reports an empty inbox page without falsely proving inbox mismatch", async () => {
    const report = await qualifyChatwootReadOnly(provider({
      async listConversations() { return { items: [], hasNextPage: false }; },
    }), {
      expectedAccountId: "77",
      expectedInboxId: "88",
    });
    expect(report.pass).toBe(true);
    expect(report.inboxMatch).toBe("EMPTY_PAGE");
  });
});
