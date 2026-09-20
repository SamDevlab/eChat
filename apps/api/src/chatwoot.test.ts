import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatwootProvider } from "./providers.js";

describe("Chatwoot adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends through the account/conversation endpoint and normalizes the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 123, content: "Resposta", created_at: "2026-09-20T12:00:00.000Z" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new ChatwootProvider({ baseUrl: "https://chatwoot.example/", token: "secret-token", accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" });
    expect(fetchMock).toHaveBeenCalledWith("https://chatwoot.example/api/v1/accounts/77/conversations/88/messages", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ api_access_token: "secret-token" }), body: JSON.stringify({ content: "Resposta", message_type: "outgoing", private: false }) }));
    expect(result).toEqual(expect.objectContaining({ externalId: "123", body: "Resposta", sender: "AGENT" }));
  });

  it("turns provider failures into controlled errors without leaking the token", async () => {
    const token = "very-secret-token"; vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })));
    await expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token, accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" })).rejects.toThrow("HTTP 403");
    try { await new ChatwootProvider({ baseUrl: "https://chatwoot.example", token, accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" }); } catch (error) { expect(String(error)).not.toContain(token); }
  });

  it.each([401, 403, 500])("handles HTTP %s as a controlled provider failure", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status })));
    await expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" })).rejects.toThrow(`HTTP ${status}`);
  });

  it("handles a provider timeout without waiting for the real timeout", async () => {
    const timeout = new Error("aborted"); timeout.name = "AbortError"; vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" })).rejects.toThrow("Timeout");
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" }).sendMessage({ conversationId: "local", externalConversationId: "88", body: "Resposta" })).rejects.toThrow("Resposta inválida");
  });

  it("qualifies the account and reads paginated contacts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 77, name: "Pilot account" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 10, name: "Maria", email: "maria@local", phone_number: "+5511" }], meta: { current_page: 1, count: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" });
    await expect(provider.testConnection()).resolves.toEqual({ accountId: "77", name: "Pilot account" });
    await expect(provider.listContacts(1)).resolves.toEqual({ items: [{ externalId: "10", name: "Maria", email: "maria@local", phone: "+5511", company: "" }], hasNextPage: false });
    expect(fetchMock.mock.calls[0][0]).toBe("https://chatwoot.example/api/v1/accounts/77");
    expect(fetchMock.mock.calls[1][0]).toBe("https://chatwoot.example/api/v1/accounts/77/contacts?page=1");
  });

  it("imports conversation details and registers the webhook", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 88, status: "open", meta: { sender: { id: 10 }, channel: "Channel::WebWidget" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 88, status: "open", meta: { sender: { id: 10 }, channel: "Channel::WebWidget" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá" }, messages: [{ id: 9, content: "Olá", message_type: "incoming", created_at: 1_700_000_000, sender: { name: "Maria" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "webhook-1", secret: "generated-webhook-secret" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" });
    const result = await provider.listConversationsWithMessages!(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ externalId: "88", contactExternalId: "10", channelType: "WEBCHAT", lastMessage: "Olá", messages: [expect.objectContaining({ externalId: "9", sender: "CONTACT", body: "Olá" })] }));
    await expect(provider.registerWebhook!("https://pilot.example/api/v1/webhooks/chatwoot")).resolves.toEqual({ id: "webhook-1", secret: "generated-webhook-secret" });
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "eChat", url: "https://pilot.example/api/v1/webhooks/chatwoot", subscriptions: ["message_created"] }) }));
  });

  it("verifies a timestamped webhook signature with the integration secret", () => {
    const secret = "webhook-secret"; const timestamp = String(Math.floor(Date.now() / 1000)); const rawBody = JSON.stringify({ event: "message_created" }); const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77", webhookSecret: secret });
    expect(provider.verifyWebhook({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": signature }, rawBody)).toBe(true);
    expect(provider.verifyWebhook({ "x-chatwoot-timestamp": timestamp, "x-chatwoot-signature": "sha256=bad" }, rawBody)).toBe(false);
  });

  it("reads existing webhooks without exposing credentials in the adapter result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 12, url: "https://pilot.example/api/v1/webhooks/chatwoot" }]), { status: 200 })));
    await expect(new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "secret", accountId: "77" }).listWebhooks()).resolves.toEqual([{ id: "12", url: "https://pilot.example/api/v1/webhooks/chatwoot", secret: undefined }]);
  });
});
