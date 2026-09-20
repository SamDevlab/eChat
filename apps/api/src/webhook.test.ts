import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ChatwootProvider, MockMessagingProvider } from "./providers.js";

describe("messaging provider webhook contracts", () => {
  it("normalizes an official message_created-shaped event", () => {
    const events = new MockMessagingProvider().normalizeWebhook?.({ event: "message_created", id: 42, account: { id: 7 }, conversation: { id: 99, contact: { name: "Maria" } }, message: { id: 123, content: "Olá", message_type: "incoming" } });
    expect(events).toEqual([expect.objectContaining({ externalEventId: "42", externalAccountId: "7", externalConversationId: "99", externalMessageId: "123", body: "Olá", sender: "CONTACT" })]);
  });

  it("verifies Chatwoot's documented HMAC signature without a user session", () => {
    const secret = "test-webhook-secret"; process.env.CHATWOOT_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ event: "message_created" }); const timestamp = String(Math.floor(Date.now() / 1000)); const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
    expect(new ChatwootProvider().verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, body)).toBe(true);
    expect(new ChatwootProvider().verifyWebhook?.({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": "sha256=bad" }, body)).toBe(false);
    delete process.env.CHATWOOT_WEBHOOK_SECRET;
  });
});
