import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createDatabase, authSessions, channels, contactIdentities, contacts, conversations, integrationAccounts, messages, opportunities, opportunityActivities, opportunityConversations, organizationMembers, organizations, pipelineStages, pipelines, users, webhookEvents } from "@echat/db";
import { MockMessagingProvider } from "./providers.js";
import { hashPassword, hashSessionToken } from "./auth.js";
import { Repositories } from "./repositories.js";
import { DomainServices } from "./services.js";
import type { SessionUser } from "@echat/shared";
import { eq, inArray } from "drizzle-orm";

process.env.INTEGRATION_ENCRYPTION_KEY ??= "0".repeat(64);

const databaseUrl = process.env.DATABASE_URL_TEST;
const dbRuntime = databaseUrl ? createDatabase(databaseUrl) : null;
if (!databaseUrl) console.warn("POSTGRES_INTEGRATION_TESTS=BLOCKED_NO_TEST_DATABASE");
const ids = { orgA: "integration-org-a", orgB: "integration-org-b", userA: "integration-user-a", userB: "integration-user-b", contactA: "integration-contact-a", contactB: "integration-contact-b", channelA: "integration-channel-a", channelB: "integration-channel-b", conversationA: "integration-conversation-a", conversationB: "integration-conversation-b", pipelineA: "integration-pipeline-a", stageA: "integration-stage-a", stageB: "integration-stage-b", opportunityA: "integration-opportunity-a", integrationA: "integration-account-a", integrationConnectionB: "integration-account-b", integrationOrgB: "integration-account-org-b", integrationChatwoot: "integration-account-chatwoot" };
const actor = (organizationId: string, id: string): SessionUser => ({ id, organizationId, name: "Integration Agent", email: `${id}@local`, role: "AGENT", avatar: "IA", sessionId: "integration-session" });
const ownerActor = (organizationId: string, id: string): SessionUser => ({ ...actor(organizationId, id), role: "OWNER" });

describe.skipIf(!databaseUrl)("PostgreSQL production foundation", () => {
  if (!dbRuntime) return;
  const { db, client } = dbRuntime; const repositories = new Repositories(db); const services = new DomainServices(repositories, new MockMessagingProvider());
  beforeAll(async () => {
    await db.insert(organizations).values([{ id: ids.orgA, name: "Integration A", plan: "test" }, { id: ids.orgB, name: "Integration B", plan: "test" }]).onConflictDoNothing();
    await db.insert(users).values([{ id: ids.userA, email: "integration-a@local", name: "A", passwordHash: hashPassword("local-only"), avatar: "A" }, { id: ids.userB, email: "integration-b@local", name: "B", passwordHash: hashPassword("local-only"), avatar: "B" }]).onConflictDoNothing();
    await db.insert(organizationMembers).values([{ id: "integration-member-a", organizationId: ids.orgA, userId: ids.userA, role: "AGENT", status: "ACTIVE" }, { id: "integration-member-b", organizationId: ids.orgB, userId: ids.userB, role: "AGENT", status: "ACTIVE" }]).onConflictDoNothing();
    await db.insert(integrationAccounts).values({ id: ids.integrationA, organizationId: ids.orgA, provider: "mock", externalAccountId: "integration-account", status: "ACTIVE", metadata: {} }).onConflictDoNothing();
    await db.insert(channels).values([{ id: ids.channelA, organizationId: ids.orgA, integrationAccountId: ids.integrationA, providerType: "MOCK", name: "Test A", type: "WEBCHAT", status: "CONNECTED", conversations: 0 }, { id: ids.channelB, organizationId: ids.orgB, name: "Test B", type: "WEBCHAT", status: "CONNECTED", conversations: 0 }]).onConflictDoNothing();
    await db.insert(contacts).values([{ id: ids.contactA, organizationId: ids.orgA, name: "Contact A", company: "A", phone: "", email: "a@local", ownerId: ids.userA, notes: "", lastConversationAt: new Date() }, { id: ids.contactB, organizationId: ids.orgB, name: "Contact B", company: "B", phone: "", email: "b@local", ownerId: ids.userB, notes: "", lastConversationAt: new Date() }]).onConflictDoNothing();
    await db.insert(conversations).values([{ id: ids.conversationA, organizationId: ids.orgA, externalId: "external-a", channelConnectionId: ids.integrationA, channelType: "WEBCHAT", providerType: "MOCK", contactId: ids.contactA, channelId: ids.channelA, status: "OPEN", assignedToId: ids.userA, unread: 0, lastMessage: "initial", lastMessageAt: new Date() }, { id: ids.conversationB, organizationId: ids.orgB, externalId: "external-b", contactId: ids.contactB, channelId: ids.channelB, status: "OPEN", assignedToId: ids.userB, unread: 0, lastMessage: "initial", lastMessageAt: new Date() }]).onConflictDoNothing();
    await db.insert(pipelines).values({ id: ids.pipelineA, organizationId: ids.orgA, name: "Test pipeline" }).onConflictDoNothing(); await db.insert(pipelineStages).values([{ id: ids.stageA, organizationId: ids.orgA, pipelineId: ids.pipelineA, name: "Novo", key: "NEW_LEAD", position: 1, color: "teal" }, { id: ids.stageB, organizationId: ids.orgA, pipelineId: ids.pipelineA, name: "Negociação", key: "NEGOTIATION", position: 2, color: "amber" }]).onConflictDoNothing();
    await db.insert(opportunities).values({ id: ids.opportunityA, organizationId: ids.orgA, title: "Test opp", contactId: ids.contactA, company: "A", value: "10.00", pipelineId: ids.pipelineA, stageId: ids.stageA, ownerId: ids.userA, source: "test", lastActivity: "now", note: "test" }).onConflictDoNothing();
  });
  afterAll(async () => { await db.delete(webhookEvents).where(inArray(webhookEvents.integrationAccountId, [ids.integrationA, ids.integrationConnectionB, ids.integrationOrgB, ids.integrationChatwoot])); await db.delete(authSessions).where(inArray(authSessions.userId, [ids.userA, ids.userB])); await db.delete(opportunityActivities).where(eq(opportunityActivities.organizationId, ids.orgA)); await db.delete(messages).where(inArray(messages.organizationId, [ids.orgA, ids.orgB])); await db.delete(opportunities).where(eq(opportunities.organizationId, ids.orgA)); await db.delete(conversations).where(inArray(conversations.organizationId, [ids.orgA, ids.orgB])); await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, ids.orgA)); await db.delete(pipelines).where(eq(pipelines.organizationId, ids.orgA)); await db.delete(contacts).where(inArray(contacts.organizationId, [ids.orgA, ids.orgB])); await db.delete(channels).where(inArray(channels.organizationId, [ids.orgA, ids.orgB])); await db.delete(integrationAccounts).where(inArray(integrationAccounts.id, [ids.integrationA, ids.integrationConnectionB, ids.integrationOrgB, ids.integrationChatwoot])); await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, [ids.orgA, ids.orgB])); await db.delete(users).where(inArray(users.id, [ids.userA, ids.userB])); await db.delete(organizations).where(inArray(organizations.id, [ids.orgA, ids.orgB])); await client.end(); });
  it("persists sessions and rejects cross-tenant records", async () => { const token = "opaque-integration-token"; const tokenHash = hashSessionToken(token); const sessionId = "integration-session-row"; await repositories.createSession({ id: sessionId, userId: ids.userA, organizationId: ids.orgA, tokenHash, expiresAt: new Date(Date.now() + 60_000) }); expect((await repositories.findSession(tokenHash))?.user.organizationId).toBe(ids.orgA); expect((await repositories.listContacts(ids.orgA)).map((item) => item.id)).toContain(ids.contactA); expect((await repositories.listContacts(ids.orgA)).map((item) => item.id)).not.toContain(ids.contactB); await repositories.revokeSession(sessionId); expect(await repositories.findSession(tokenHash)).toBeNull(); });
  it("persists message, CRM activity, opportunity linkage, and inbound webhook idempotency", async () => { const message = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "persisted" }); expect((await repositories.listConversations(ids.orgA)).find((item) => item.id === ids.conversationA)?.messages.some((item) => item.body === "persisted")).toBe(true); const moved = await services.moveOpportunity(actor(ids.orgA, ids.userA), ids.opportunityA, { stage: "NEGOTIATION" }); expect(moved.stage).toBe("NEGOTIATION"); expect((await db.select().from(opportunityActivities).where(eq(opportunityActivities.opportunityId, ids.opportunityA))).length).toBeGreaterThan(0); await services.linkOpportunityConversation(ownerActor(ids.orgA, ids.userA), ids.opportunityA, ids.conversationA); expect((await db.select().from(opportunityConversations).where(eq(opportunityConversations.opportunityId, ids.opportunityA)))).toHaveLength(1); const payload = { event: "message_created", id: "integration-event-1", account: { id: "integration-account" }, conversation: { id: "external-a" }, message: { id: "integration-message-1", content: "inbound" } }; const first = await services.processWebhook({ integrationAccountId: ids.integrationA, organizationId: ids.orgA, provider: "mock", eventId: "integration-event-1", rawBody: JSON.stringify(payload), payload }); const second = await services.processWebhook({ integrationAccountId: ids.integrationA, organizationId: ids.orgA, provider: "mock", eventId: "integration-event-1", rawBody: JSON.stringify(payload), payload }); expect(first).toEqual({ processed: true, duplicate: false }); expect(second).toEqual({ processed: false, duplicate: true }); expect((await db.select().from(messages).where(eq(messages.externalId, "integration-message-1")))).toHaveLength(1); expect(message.body).toBe("persisted"); });
  it("encrypts, rotates, and keeps integration credentials tenant-scoped", async () => { const result = await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwoot, provider: "chatwoot", displayName: "Pilot Chatwoot", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-account", apiToken: "integration-secret-token", webhookSecret: "integration-webhook-secret" }); expect(result).not.toHaveProperty("apiToken"); const firstRow = (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0]; expect(firstRow.credentialCiphertext).toBeTruthy(); expect(firstRow.credentialCiphertext).not.toContain("integration-secret-token"); expect(firstRow.webhookSecretCiphertext).toBeTruthy(); await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwoot, provider: "chatwoot", displayName: "Pilot Chatwoot", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-account", apiToken: "rotated-secret-token", webhookSecret: "rotated-webhook-secret" }); const rotatedRow = (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0]; expect(rotatedRow.credentialCiphertext).not.toBe(firstRow.credentialCiphertext); expect(rotatedRow.credentialCiphertext).not.toContain("rotated-secret-token"); expect(await repositories.getIntegration(ids.orgB, ids.integrationChatwoot)).toBeNull(); });
  it("qualifies, synchronizes, and re-synchronizes Chatwoot records idempotently", async () => {
    process.env.PUBLIC_APP_URL = "https://pilot.example";
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/v1/accounts/chatwoot-account")) return new Response(JSON.stringify({ id: "chatwoot-account", name: "Pilot Chatwoot" }), { status: 200 });
      if (input.endsWith("/api/v1/accounts/chatwoot-account/webhooks")) return new Response(JSON.stringify({ id: "webhook-1", secret: "generated-webhook-secret" }), { status: 200 });
      if (input.includes("/contacts?")) return new Response(JSON.stringify({ payload: [{ id: "cw-contact-1", name: "Contato Sincronizado", email: "sync@example.test", phone_number: "+5511999999999" }], meta: { current_page: 1, count: 1 } }), { status: 200 });
      if (input.endsWith("/conversations?status=all&sort=-last_activity_at&page=1")) return new Response(JSON.stringify({ payload: [{ id: "cw-conversation-1", status: "open", meta: { sender: { id: "cw-contact-1" }, channel: "Channel::Whatsapp" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá do Chatwoot" } }] }), { status: 200 });
      if (input.endsWith("/conversations/cw-conversation-1")) return new Response(JSON.stringify({ id: "cw-conversation-1", status: "open", meta: { sender: { id: "cw-contact-1" }, channel: "Channel::Whatsapp" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá do Chatwoot" }, messages: [{ id: "cw-message-1", content: "Olá do Chatwoot", message_type: "incoming", created_at: 1_700_000_000, sender: { name: "Contato Sincronizado" } }] }), { status: 200 });
      throw new Error(`unexpected test URL: ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    await services.testIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    await services.testIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    const first = await services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    const second = await services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    expect(first.imported).toBe(1); expect(second.imported).toBe(1); expect(fetchMock.mock.calls.filter(([input, init]) => String(input).endsWith("/api/v1/accounts/chatwoot-account/webhooks") && (init as RequestInit | undefined)?.method === "POST")).toHaveLength(1); expect((await repositories.listContacts(ids.orgA)).filter((item) => item.email === "sync@example.test")).toHaveLength(1); expect((await repositories.listConversations(ids.orgA)).filter((item) => item.externalId === "cw-conversation-1")).toHaveLength(1); expect((await db.select().from(messages).where(eq(messages.externalId, "cw-message-1")))).toHaveLength(1); expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.lastSyncStatus).toBe("SUCCESS"); expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.webhookRegistrationId).toBe("webhook-1"); expect((await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0].webhookSecretCiphertext).toBeTruthy();
    vi.unstubAllGlobals();
    delete process.env.PUBLIC_APP_URL;
  });
  it("rejects unknown integrations and preserves data when the provider is down", async () => {
    await expect(services.testIntegration(ownerActor(ids.orgA, ids.userA), "integration-does-not-exist")).rejects.toMatchObject({ status: 404 });
    await db.update(conversations).set({ channelConnectionId: ids.integrationChatwoot, channelType: "WHATSAPP", providerType: "CHATWOOT" }).where(eq(conversations.id, ids.conversationA));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider down")));
    await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "não enviar" })).rejects.toMatchObject({ status: 502 });
    await expect(services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot)).rejects.toMatchObject({ status: 502 });
    expect((await repositories.listConversations(ids.orgA)).some((item) => item.externalId === "cw-conversation-1")).toBe(true);
    expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.lastSyncStatus).toBe("FAILED");
    vi.unstubAllGlobals();
  });
  it("proves tenant and connection scoped external mappings in PostgreSQL", async () => {
    await db.insert(integrationAccounts).values([
      { id: ids.integrationConnectionB, organizationId: ids.orgA, provider: "mock", externalAccountId: "integration-account-b", status: "ACTIVE", metadata: {} },
      { id: ids.integrationOrgB, organizationId: ids.orgB, provider: "mock", externalAccountId: "integration-account-org-b", status: "ACTIVE", metadata: {} },
    ]).onConflictDoNothing();
    const connections = [
      { organizationId: ids.orgA, id: ids.integrationA, ownerId: ids.userA },
      { organizationId: ids.orgA, id: ids.integrationConnectionB, ownerId: ids.userA },
      { organizationId: ids.orgB, id: ids.integrationOrgB, ownerId: ids.userB },
    ];
    const contactsByConnection = new Map<string, string>();
    for (const connection of connections) {
      const contact = await repositories.upsertSyncedContact({ organizationId: connection.organizationId, channelConnectionId: connection.id, externalId: "same-external-contact", name: connection.id, email: `${connection.id}@local`, phone: "", ownerId: connection.ownerId });
      contactsByConnection.set(connection.id, contact.id);
      const identity = await repositories.upsertExternalContactIdentity({ organizationId: connection.organizationId, contactId: contact.id, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalContactId: "same-external-contact", email: contact.email });
      expect(identity.channelConnectionId).toBe(connection.id);
      expect((await repositories.upsertExternalContactIdentity({ organizationId: connection.organizationId, contactId: contact.id, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalContactId: "same-external-contact", email: contact.email })).id).toBe(identity.id);
    }
    expect(new Set(contactsByConnection.values()).size).toBe(3);
    expect((await db.select().from(contactIdentities).where(eq(contactIdentities.externalContactId, "same-external-contact"))).length).toBe(3);

    const conversationsByConnection = new Map<string, string>();
    const messagesByConnection = new Map<string, Awaited<ReturnType<Repositories["upsertSyncedMessage"]>>>();
    for (const connection of connections) {
      const channel = await repositories.upsertSyncedChannel({ organizationId: connection.organizationId, integrationAccountId: connection.id, externalId: "same-external-channel", name: connection.id, type: "WHATSAPP", providerType: "MOCK" });
      const conversationId = await repositories.upsertSyncedConversation({ organizationId: connection.organizationId, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalId: "same-external-conversation", contactId: contactsByConnection.get(connection.id)!, channelId: channel.id, status: "OPEN", lastMessage: "same", lastMessageAt: new Date() });
      conversationsByConnection.set(connection.id, conversationId);
      expect(await repositories.upsertSyncedConversation({ organizationId: connection.organizationId, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalId: "same-external-conversation", contactId: contactsByConnection.get(connection.id)!, channelId: channel.id, status: "OPEN", lastMessage: "same", lastMessageAt: new Date() })).toBe(conversationId);
      const message = await repositories.upsertSyncedMessage({ organizationId: connection.organizationId, conversationId, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalId: "same-external-message", sender: connection.id === ids.integrationConnectionB ? "AGENT" : "CONTACT", authorName: connection.id, body: "same", createdAt: new Date(), messageType: "TEXT", deliveryStatus: connection.id === ids.integrationConnectionB ? "SENT" : "DELIVERED" });
      messagesByConnection.set(connection.id, message);
      expect((await repositories.upsertSyncedMessage({ organizationId: connection.organizationId, conversationId, channelConnectionId: connection.id, channelType: "WHATSAPP", providerType: "MOCK", externalId: "same-external-message", sender: connection.id === ids.integrationConnectionB ? "AGENT" : "CONTACT", authorName: connection.id, body: "same", createdAt: new Date(), messageType: "TEXT", deliveryStatus: connection.id === ids.integrationConnectionB ? "SENT" : "DELIVERED" })).id).toBe(message.id);
    }
    expect(new Set(conversationsByConnection.values()).size).toBe(3);
    expect(new Set([...messagesByConnection.values()].map((message) => message.id)).size).toBe(3);
    expect(messagesByConnection.get(ids.integrationA)?.direction).toBe("INBOUND");
    expect(messagesByConnection.get(ids.integrationA)?.deliveryStatus).toBe("DELIVERED");
    expect(messagesByConnection.get(ids.integrationConnectionB)?.direction).toBe("OUTBOUND");
    expect(messagesByConnection.get(ids.integrationConnectionB)?.deliveryStatus).toBe("SENT");
    expect((await repositories.findConversationByExternalId(ids.orgA, "same-external-conversation", ids.integrationA))?.id).toBe(conversationsByConnection.get(ids.integrationA));
    expect((await repositories.findConversationByExternalId(ids.orgA, "same-external-conversation", ids.integrationConnectionB))?.id).toBe(conversationsByConnection.get(ids.integrationConnectionB));
    expect(await repositories.findConversationByExternalId(ids.orgA, "same-external-conversation", ids.integrationOrgB)).toBeNull();
    expect((await repositories.findConversationByExternalId(ids.orgB, "same-external-conversation", ids.integrationOrgB))?.id).toBe(conversationsByConnection.get(ids.integrationOrgB));
    expect((await repositories.findMessageByExternalId(ids.orgA, "same-external-message", ids.integrationA))?.id).toBe(messagesByConnection.get(ids.integrationA)?.id);
    expect(await repositories.findMessageByExternalId(ids.orgA, "same-external-message", ids.integrationOrgB)).toBeNull();
  });
  it("releases a failed webhook claim and processes the retry once", async () => {
    const payload = { event: "message_created", id: "integration-retry-event", account: { id: "chatwoot-account" }, conversation: { id: "external-a" }, message: { id: "integration-retry-message", content: "retry" } };
    const insertSpy = vi.spyOn(repositories, "insertInboundMessage").mockRejectedValueOnce(new Error("transient database failure"));
    await expect(services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "mock", eventId: "integration-retry-event", rawBody: JSON.stringify(payload), payload, providerInstance: new MockMessagingProvider() })).rejects.toMatchObject({ status: 422 });
    insertSpy.mockRestore();
    await expect(services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "mock", eventId: "integration-retry-event", rawBody: JSON.stringify(payload), payload, providerInstance: new MockMessagingProvider() })).resolves.toEqual({ processed: true, duplicate: false });
    await expect(services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "mock", eventId: "integration-retry-event", rawBody: JSON.stringify(payload), payload, providerInstance: new MockMessagingProvider() })).resolves.toEqual({ processed: false, duplicate: true });
    expect((await db.select().from(messages).where(eq(messages.externalId, "integration-retry-message")))).toHaveLength(1);
  });
});
