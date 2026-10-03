import { describe, expect, it } from "vitest";
import { qualifyChatwootReadOnly, type ReadOnlyChatwootProvider } from "./live-qualification.js";

const provider = (overrides: Partial<ReadOnlyChatwootProvider> = {}): ReadOnlyChatwootProvider => ({
  async testConnection() { return { accountId: "77", name: "Pilot" }; },
  async listInboxes() { return [{ id: "88", name: "Pilot inbox" }]; },
  async listContacts() { return { items: [{ id: "10" }], hasNextPage: false }; },
  async listConversations() { return { items: [{ channelExternalId: "88" }], hasNextPage: false }; },
  async listWebhooks() { return [{ id: "w1", url: "https://pilot.example/api/v1/webhooks/chatwoot", subscriptions: ["message_created"] }]; },
  ...overrides,
});

describe("read-only Chatwoot pilot qualification", () => {
  it("passes account, inbox and webhook checks without mutations", async () => {
    const report = await qualifyChatwootReadOnly(provider(), {
      expectedAccountId: "77",
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
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
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
    });
    expect(report.pass).toBe(false);
    expect(report.accountMatch).toBe(false);
  });

  it("fails a strict webhook gate without registering anything", async () => {
    let listCalls = 0;
    const report = await qualifyChatwootReadOnly(provider({
      async listWebhooks() {
        listCalls += 1;
        return [{ id: "w1", url: "https://other.example/webhook", subscriptions: ["message_created"] }];
      },
    }), {
      expectedAccountId: "77",
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
    });
    expect(listCalls).toBe(1);
    expect(report.pass).toBe(false);
    expect(report.webhookMatch).toBe("FAIL");
  });

  it("checks the configured inbox directly even when its conversation page is empty", async () => {
    const report = await qualifyChatwootReadOnly(provider({
      async listConversations() { return { items: [], hasNextPage: false }; },
    }), {
      expectedAccountId: "77",
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
    });
    expect(report.pass).toBe(true);
    expect(report.inboxMatch).toBe("PASS");
    expect(report.conversationsOnFirstPage).toBe(0);
  });

  it("requires the expected webhook to subscribe to message_created", async () => {
    const report = await qualifyChatwootReadOnly(provider({
      async listWebhooks() { return [{ id: "w1", url: "https://pilot.example/api/v1/webhooks/chatwoot", subscriptions: ["conversation_created"] }]; },
    }), {
      expectedAccountId: "77",
      expectedInboxId: "88",
      expectedWebhookUrl: "https://pilot.example/api/v1/webhooks/chatwoot",
    });
    expect(report.webhookMatch).toBe("FAIL");
    expect(report.pass).toBe(false);
  });
});
