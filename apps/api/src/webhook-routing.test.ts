import { describe, expect, it } from "vitest";
import { externalInboxFromPayload, selectChatwootWebhookCandidate, type WebhookCandidate } from "./webhook-routing.js";

const candidate = (inboxId: string): WebhookCandidate => ({
  integration: { providerInboxId: inboxId },
  provider: { verifyWebhook: () => true },
});

describe("Chatwoot webhook candidate routing", () => {
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
