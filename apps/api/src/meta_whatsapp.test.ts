import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaWhatsAppProvider } from "./providers.js";

describe("WhatsApp Cloud API adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes inbound text messages into a tenant-ready conversation event", () => {
    const provider = new MetaWhatsAppProvider({ baseUrl: "https://graph.facebook.com/v23.0", accessToken: "token", phoneNumberId: "123" });
    const events = provider.normalizeWebhook?.({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { phone_number_id: "123" }, contacts: [{ profile: { name: "Maria" } }], messages: [{ from: "5511999999999", id: "wamid.1", timestamp: "1720000000", type: "text", text: { body: "Olá" } }] } }] }] });
    expect(events).toEqual([expect.objectContaining({ externalEventId: "wamid.1", externalAccountId: "123", externalConversationId: "meta:5511999999999", contactPhone: "5511999999999", body: "Olá", sender: "CONTACT", channelType: "WHATSAPP" })]);
  });

  it("verifies Meta's x-hub-signature-256 HMAC", () => {
    const secret = "app-secret"; const body = JSON.stringify({ object: "whatsapp_business_account" }); const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const provider = new MetaWhatsAppProvider({ baseUrl: "https://graph.facebook.com/v23.0", accessToken: "token", phoneNumberId: "123", appSecret: secret });
    expect(provider.verifyWebhook({ "x-hub-signature-256": signature }, body)).toBe(true);
    expect(provider.verifyWebhook({ "x-hub-signature-256": "sha256=bad" }, body)).toBe(false);
  });

  it("sends a text message to the contact phone number", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const result = await new MetaWhatsAppProvider({ baseUrl: "https://graph.facebook.com/v23.0", accessToken: "secret", phoneNumberId: "123" }).sendMessage({ conversationId: "local", recipientPhone: "+55 (11) 99999-9999", body: "Resposta" });
    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v23.0/123/messages", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer secret" }), body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: "5511999999999", type: "text", text: { preview_url: false, body: "Resposta" } }) }));
    expect(result).toEqual(expect.objectContaining({ externalId: "wamid.out", body: "Resposta", sender: "AGENT" }));
  });
});
