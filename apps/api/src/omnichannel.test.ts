import { describe, expect, it } from "vitest";
import { ChatwootProvider } from "./providers.js";

describe("omnichannel provider contract", () => {
  it.each(["WHATSAPP", "INSTAGRAM", "EMAIL"] as const)("keeps %s as a channel independent from Chatwoot", (channelType) => {
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77", channelType });
    expect(provider.providerType).toBe("CHATWOOT");
    expect(provider.capabilities({ organizationId: "org-a", channelConnectionId: "connection-a", channelType, providerType: "CHATWOOT", externalAccountId: "77" })).toEqual(expect.objectContaining({ SEND_TEXT: true, THREADING: true }));
  });

  it("does not advertise unsupported media or delivery capabilities", () => {
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77", channelType: "WHATSAPP" });
    expect(provider.capabilities({ organizationId: "org-a", channelConnectionId: "connection-a", channelType: "WHATSAPP", providerType: "CHATWOOT", externalAccountId: "77" })).toEqual(expect.objectContaining({ SEND_MEDIA: false, RECEIVE_MEDIA: false, DELIVERY_STATUS: false, READ_STATUS: false }));
  });
});
