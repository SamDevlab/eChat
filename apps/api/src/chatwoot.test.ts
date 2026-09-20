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
});
