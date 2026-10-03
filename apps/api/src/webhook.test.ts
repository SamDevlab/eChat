import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ChatwootProvider, MockMessagingProvider } from "./providers.js";

describe("messaging provider webhook contracts", () => {
  it("normalizes an official message_created-shaped event", () => {
    const events = new MockMessagingProvider().normalizeWebhook?.({ event: "message_created", id: 42, account: { id: 7 }, conversation: { id: 99, contact: { name: "Maria" } }, message: { id: 123, content: "Olá", message_type: "incoming" } });
    expect(events).toEqual([expect.objectContaining({ externalEventId: "42", externalAccountId: "7", externalConversationId: "99", externalMessageId: "123", body: "Olá", sender: "CONTACT" })]);
  });

  it("normalizes Chatwoot's root-level message fields and numeric outgoing type", () => {
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77", channelType: "WHATSAPP" });
    const events = provider.normalizeWebhook?.({ event: "message_created", id: 123, account: { id: 77 }, conversation: { id: 99 }, content: "Nota", message_type: 1, created_at: 1_700_000_000, private: true });
    expect(events).toEqual([expect.objectContaining({ externalEventId: "123", externalAccountId: "77", externalConversationId: "99", externalMessageId: "123", body: "Nota", direction: "OUTBOUND", sender: "AGENT", createdAt: "2023-11-14T22:13:20.000Z" })]);
  });

  it("verifies Chatwoot's documented HMAC signature without a user session", () => {
    const secret = "test-webhook-secret";
    const body = JSON.stringify({ event: "message_created" }); const timestamp = String(Math.floor(Date.now() / 1000)); const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77", webhookSecret: secret });
    expect(provider.verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, body)).toBe(true);
    expect(provider.verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, body + " ")).toBe(false);
    expect(provider.verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": "sha256=bad" }, body)).toBe(false);
    expect(provider.verifyWebhook?.({ "x-chatwoot-timestamp": String(Number(timestamp) - 301), "x-chatwoot-signature": signature }, body)).toBe(false);
    expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" }).verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, body)).toBe(false);
  });
});
