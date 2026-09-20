import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed-data.js";
import { assignConversation, createOpportunity, createStore, listContacts, listConversations, listOpportunities, moveOpportunity, sendMessage } from "./services.js";
import type { SessionUser } from "@echat/shared";

const user = (organizationId: string, role: SessionUser["role"] = "AGENT"): SessionUser => ({ id: `${organizationId}-agent`, organizationId, name: "Agente", email: `${organizationId}@local`, role, avatar: "AG" , sessionId: "session" });

describe("tenant isolation", () => {
  it("org A does not see contacts from org B", () => {
    const state = createSeedState(); state.contacts.push({ ...state.contacts[0], id: "foreign", organizationId: "org-b" });
    expect(listContacts(createStore(state), user("org-acme")).every((item) => item.organizationId === "org-acme")).toBe(true);
  });
  it("org A does not see conversations or opportunities from org B", () => {
    const state = createSeedState(); state.conversations.push({ ...state.conversations[0], id: "foreign-conv", organizationId: "org-b" }); state.opportunities.push({ ...state.opportunities[0], id: "foreign-opp", organizationId: "org-b" });
    const store = createStore(state); expect(listConversations(store, user("org-acme")).some((item) => item.id === "foreign-conv")).toBe(false); expect(listOpportunities(store, user("org-acme")).some((item) => item.id === "foreign-opp")).toBe(false);
  });
});

describe("core workflows", () => {
  it("sends, assigns, creates and moves within the tenant", async () => {
    const store = createStore(createSeedState()); const actor = user("org-acme", "ADMIN");
    await sendMessage(store, actor, "conv-maria", { body: "Posso enviar a proposta?" });
    expect(store.state.conversations[0].messages.at(-1)?.body).toContain("proposta");
    assignConversation(store, actor, "conv-maria", "user-admin"); expect(store.state.conversations[0].assignedToId).toBe("user-admin");
    const opportunity = createOpportunity(store, actor, { title: "Novo contrato", contactId: "contact-maria", value: 4200 }); moveOpportunity(store, actor, opportunity.id, { stage: "NEGOTIATION" }); expect(opportunity.stage).toBe("NEGOTIATION");
  });
  it("rejects an invalid stage and cross-tenant record", () => {
    const store = createStore(createSeedState()); expect(() => moveOpportunity(store, user("org-acme"), "opp-alpha", { stage: "NOT_A_STAGE" })).toThrow(); expect(() => moveOpportunity(store, user("org-b"), "opp-alpha", { stage: "WON" })).toThrow(/não encontrado/);
  });
  it("keeps agent assignment inside the agent role boundary", () => {
    const store = createStore(createSeedState());
    expect(() => assignConversation(store, user("org-acme"), "conv-maria", "user-owner")).toThrow(/não pode gerenciar/);
    expect(() => assignConversation(store, user("org-acme"), "conv-maria", "user-fernanda")).not.toThrow();
  });
});
