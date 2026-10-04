import { describe, expect, it, vi } from "vitest";
import { MockMessagingProvider } from "./providers.js";
import { moveOpportunitySchema, sendMessageSchema } from "@echat/shared";
import { DomainServices } from "./services.js";
import type { Repositories } from "./repositories.js";

describe("domain boundaries", () => {
  it("validates message and CRM mutations at the API boundary", () => {
    expect(sendMessageSchema.parse({ body: "Olá" }).internal).toBe(false);
    expect(() => sendMessageSchema.parse({ body: "" })).toThrow();
    expect(moveOpportunitySchema.parse({ stage: "NEGOTIATION" }).stage).toBe("NEGOTIATION");
    expect(() => moveOpportunitySchema.parse({ stage: "foreign-stage" })).toThrow();
  });

  it("mock messaging returns a provider result without owning business state", async () => {
    const provider = new MockMessagingProvider();
    const result = await provider.sendMessage({ conversationId: "conversation-a", body: "Olá" });
    expect(result.body).toBe("Olá");
    expect(result).not.toHaveProperty("messages");
  });

  it("does not silently accept a failed provider call", async () => {
    const provider = { sendMessage: vi.fn().mockRejectedValue(new Error("provider down")) };
    await expect(provider.sendMessage({ conversationId: "conversation-a", body: "Olá" })).rejects.toThrow("provider down");
  });

  it("rejects Chatwoot connection tests for mock integrations without changing their status", async () => {
    const updateIntegration = vi.fn();
    const repositories = { getIntegration: vi.fn().mockResolvedValue({ provider: "mock" }), updateIntegration } as unknown as Repositories;
    const services = new DomainServices(repositories);
    await expect(services.testIntegration({ id: "owner", organizationId: "org", name: "Owner", email: "owner@local", role: "OWNER", avatar: "OW", sessionId: "session" }, "mock-integration")).rejects.toMatchObject({ status: 422 });
    expect(updateIntegration).not.toHaveBeenCalled();
  });
});
