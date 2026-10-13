import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ChatwootProvider } from "./providers.js";
import { externalInboxFromPayload, selectChatwootWebhookCandidate, type WebhookCandidate } from "./webhook-routing.js";

const candidate = (inboxId: string): WebhookCandidate => ({
  integration: { providerInboxId: inboxId },
  provider: { verifyWebhook: () => true },
});

describe("Chatwoot webhook candidate routing", () => {
  it("routes a signed delivery between same-account integrations sharing one secret", () => {
    const firstProvider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", accountId: "same-account", inboxId: "inbox-a", token: "local-token", webhookSecret: "shared-test-secret" });
    const secondProvider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", accountId: "same-account", inboxId: "inbox-b", token: "local-token", webhookSecret: "shared-test-secret" });
    const first = { integration: { providerInboxId: "inbox-a" }, provider: firstProvider };
    const second = { integration: { providerInboxId: "inbox-b" }, provider: secondProvider };
    const rawBody = JSON.stringify({ event: "message_created", account: { id: "same-account" }, conversation: { inbox_id: "inbox-b" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac("sha256", "shared-test-secret").update(`${timestamp}.${rawBody}`).digest("hex")}`;
    expect(selectChatwootWebhookCandidate([first, second], { "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, rawBody, JSON.parse(rawBody))).toBe(second);
  });

  it("uses the payload inbox to disambiguate integrations sharing account and secret", () => {
    const first = candidate("inbox-a");
    const second = candidate("inbox-b");
    expect(selectChatwootWebhookCandidate([first, second], {}, "{}", { conversation: { inbox_id: "inbox-b" } })).toBe(second);
    expect(externalInboxFromPayload({ conversation: { inbox: { id: 17 } } })).toBe("17");
  });

  it("rejects an ambiguous delivery when the inbox is absent", () => {
    const first = candidate("inbox-a");
    const second = candidate("inbox-b");
    expect(selectChatwootWebhookCandidate([first, second], {}, "{}", { account: { id: "same" } })).toBeNull();
  });

  it("rejects duplicate candidates for the same inbox", () => {
    const first = candidate("inbox-a");
    const second = candidate("inbox-a");
    expect(selectChatwootWebhookCandidate([first, second], {}, "{}", { inbox_id: "inbox-a" })).toBeNull();
  });
});
