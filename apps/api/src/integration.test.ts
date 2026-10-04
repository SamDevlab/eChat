import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createDatabase, authSessions, channels, contactIdentities, contacts, conversations, integrationAccounts, messages, opportunities, opportunityActivities, opportunityConversations, organizationMembers, organizations, pipelineStages, pipelines, users, webhookEvents } from "@echat/db";
import { ChatwootProvider, MockMessagingProvider } from "./providers.js";
import { hashPassword, hashSessionToken } from "./auth.js";
import { Repositories } from "./repositories.js";
import { DomainServices } from "./services.js";
import type { SessionUser } from "@echat/shared";
import { and, eq, inArray } from "drizzle-orm";

process.env.INTEGRATION_ENCRYPTION_KEY ??= "0".repeat(64);

const databaseUrl = process.env.DATABASE_URL_TEST;
const dbRuntime = databaseUrl ? createDatabase(databaseUrl) : null;
if (!databaseUrl) console.warn("POSTGRES_INTEGRATION_TESTS=BLOCKED_NO_TEST_DATABASE");
const ids = { orgA: "integration-org-a", orgB: "integration-org-b", userA: "integration-user-a", userB: "integration-user-b", contactA: "integration-contact-a", contactB: "integration-contact-b", channelA: "integration-channel-a", channelB: "integration-channel-b", conversationA: "integration-conversation-a", conversationB: "integration-conversation-b", pipelineA: "integration-pipeline-a", stageA: "integration-stage-a", stageB: "integration-stage-b", opportunityA: "integration-opportunity-a", integrationA: "integration-account-a", integrationConnectionB: "integration-account-b", integrationOrgB: "integration-account-org-b", integrationChatwoot: "integration-account-chatwoot", integrationChatwootB: "integration-account-chatwoot-b", integrationChatwootInbound: "integration-account-chatwoot-inbound", channelChatwootB: "integration-channel-chatwoot-b", conversationChatwootB: "integration-conversation-chatwoot-b" };
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
    await db.insert(integrationAccounts).values([
      { id: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", providerType: "CHATWOOT", channelType: "UNKNOWN", externalAccountId: "chatwoot-account", providerInboxId: "cw-inbox-1", baseUrl: "https://chatwoot.example", status: "CONFIGURED", metadata: {} },
      { id: ids.integrationChatwootB, organizationId: ids.orgA, provider: "chatwoot", providerType: "CHATWOOT", channelType: "WHATSAPP", externalAccountId: "chatwoot-account-b", providerInboxId: "cw-inbox-b", baseUrl: "https://chatwoot-b.example", status: "CONFIGURED", metadata: {} },
      { id: ids.integrationChatwootInbound, organizationId: ids.orgA, provider: "chatwoot", providerType: "CHATWOOT", channelType: "UNKNOWN", externalAccountId: "chatwoot-inbound-account", providerInboxId: "cw-widget-inbox", baseUrl: "https://chatwoot.example", status: "CONFIGURED", metadata: {} },
    ]).onConflictDoNothing();
    await db.insert(channels).values([{ id: ids.channelA, organizationId: ids.orgA, integrationAccountId: ids.integrationA, providerType: "MOCK", name: "Test A", type: "WEBCHAT", status: "CONNECTED", conversations: 0 }, { id: ids.channelB, organizationId: ids.orgB, name: "Test B", type: "WEBCHAT", status: "CONNECTED", conversations: 0 }]).onConflictDoNothing();
    await db.insert(contacts).values([{ id: ids.contactA, organizationId: ids.orgA, name: "Contact A", company: "A", phone: "", email: "a@local", ownerId: ids.userA, notes: "", lastConversationAt: new Date() }, { id: ids.contactB, organizationId: ids.orgB, name: "Contact B", company: "B", phone: "", email: "b@local", ownerId: ids.userB, notes: "", lastConversationAt: new Date() }]).onConflictDoNothing();
    await db.insert(conversations).values([{ id: ids.conversationA, organizationId: ids.orgA, externalId: "external-a", channelConnectionId: ids.integrationA, channelType: "WEBCHAT", providerType: "MOCK", contactId: ids.contactA, channelId: ids.channelA, status: "OPEN", assignedToId: ids.userA, unread: 0, lastMessage: "initial", lastMessageAt: new Date() }, { id: ids.conversationB, organizationId: ids.orgB, externalId: "external-b", contactId: ids.contactB, channelId: ids.channelB, status: "OPEN", assignedToId: ids.userB, unread: 0, lastMessage: "initial", lastMessageAt: new Date() }]).onConflictDoNothing();
    await db.insert(pipelines).values({ id: ids.pipelineA, organizationId: ids.orgA, name: "Test pipeline" }).onConflictDoNothing(); await db.insert(pipelineStages).values([{ id: ids.stageA, organizationId: ids.orgA, pipelineId: ids.pipelineA, name: "Novo", key: "NEW_LEAD", position: 1, color: "teal" }, { id: ids.stageB, organizationId: ids.orgA, pipelineId: ids.pipelineA, name: "Negociação", key: "NEGOTIATION", position: 2, color: "amber" }]).onConflictDoNothing();
    await db.insert(opportunities).values({ id: ids.opportunityA, organizationId: ids.orgA, title: "Test opp", contactId: ids.contactA, company: "A", value: "10.00", pipelineId: ids.pipelineA, stageId: ids.stageA, ownerId: ids.userA, source: "test", lastActivity: "now", note: "test" }).onConflictDoNothing();
  });
  afterAll(async () => { await db.delete(webhookEvents).where(inArray(webhookEvents.integrationAccountId, [ids.integrationA, ids.integrationConnectionB, ids.integrationOrgB, ids.integrationChatwoot, ids.integrationChatwootB, ids.integrationChatwootInbound])); await db.delete(authSessions).where(inArray(authSessions.userId, [ids.userA, ids.userB])); await db.delete(opportunityActivities).where(eq(opportunityActivities.organizationId, ids.orgA)); await db.delete(messages).where(inArray(messages.organizationId, [ids.orgA, ids.orgB])); await db.delete(opportunities).where(eq(opportunities.organizationId, ids.orgA)); await db.delete(conversations).where(inArray(conversations.organizationId, [ids.orgA, ids.orgB])); await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, ids.orgA)); await db.delete(pipelines).where(eq(pipelines.organizationId, ids.orgA)); await db.delete(contacts).where(inArray(contacts.organizationId, [ids.orgA, ids.orgB])); await db.delete(channels).where(inArray(channels.organizationId, [ids.orgA, ids.orgB])); await db.delete(integrationAccounts).where(inArray(integrationAccounts.id, [ids.integrationA, ids.integrationConnectionB, ids.integrationOrgB, ids.integrationChatwoot, ids.integrationChatwootB, ids.integrationChatwootInbound])); await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, [ids.orgA, ids.orgB])); await db.delete(users).where(inArray(users.id, [ids.userA, ids.userB])); await db.delete(organizations).where(inArray(organizations.id, [ids.orgA, ids.orgB])); await client.end(); });
  it("persists sessions and rejects cross-tenant reads, sends, and assignments", async () => { const token = "opaque-integration-token"; const tokenHash = hashSessionToken(token); const sessionId = "integration-session-row"; await repositories.createSession({ id: sessionId, userId: ids.userA, organizationId: ids.orgA, tokenHash, expiresAt: new Date(Date.now() + 60_000) }); expect((await repositories.findSession(tokenHash))?.user.organizationId).toBe(ids.orgA); expect((await repositories.listContacts(ids.orgA)).map((item) => item.id)).toContain(ids.contactA); expect((await repositories.listContacts(ids.orgA)).map((item) => item.id)).not.toContain(ids.contactB); await expect(services.getConversation(actor(ids.orgA, ids.userA), ids.conversationB)).rejects.toMatchObject({ status: 404 }); await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationB, { body: "cross-tenant" }, "cross-tenant-send-key")).rejects.toMatchObject({ status: 404 }); await expect(services.assignConversation(actor(ids.orgA, ids.userA), ids.conversationA, { assignedToId: ids.userB })).rejects.toMatchObject({ status: 404 }); await repositories.revokeSession(sessionId); expect(await repositories.findSession(tokenHash)).toBeNull(); });
  it("persists messages and CRM links while supporting assignment, resolve, and reopen", async () => { const message = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "persisted" }, "integration-outgoing-key"); const replay = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "persisted" }, "integration-outgoing-key"); expect(replay.id).toBe(message.id); await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "different body" }, "integration-outgoing-key")).rejects.toMatchObject({ status: 409, message: "IDEMPOTENCY_KEY_REUSED" }); expect((await repositories.listConversations(ids.orgA)).find((item) => item.id === ids.conversationA)?.messages.some((item) => item.body === "persisted")).toBe(true); const assigned = await services.assignConversation(actor(ids.orgA, ids.userA), ids.conversationA, { assignedToId: ids.userA }); expect(assigned.assignedToId).toBe(ids.userA); const unassigned = await services.assignConversation(actor(ids.orgA, ids.userA), ids.conversationA, { assignedToId: null }); expect(unassigned.assignedToId).toBeUndefined(); await services.assignConversation(actor(ids.orgA, ids.userA), ids.conversationA, { assignedToId: ids.userA }); expect((await services.updateConversationStatus(actor(ids.orgA, ids.userA), ids.conversationA, { status: "RESOLVED" })).status).toBe("RESOLVED"); expect((await services.updateConversationStatus(actor(ids.orgA, ids.userA), ids.conversationA, { status: "OPEN" })).status).toBe("OPEN"); const moved = await services.moveOpportunity(actor(ids.orgA, ids.userA), ids.opportunityA, { stage: "NEGOTIATION" }); expect(moved.stage).toBe("NEGOTIATION"); expect((await db.select().from(opportunityActivities).where(eq(opportunityActivities.opportunityId, ids.opportunityA))).length).toBeGreaterThan(0); await services.linkOpportunityConversation(ownerActor(ids.orgA, ids.userA), ids.opportunityA, ids.conversationA); expect((await db.select().from(opportunityConversations).where(eq(opportunityConversations.opportunityId, ids.opportunityA)))).toHaveLength(1); const payload = { event: "message_created", id: "integration-event-1", account: { id: "integration-account" }, conversation: { id: "external-a" }, message: { id: "integration-message-1", content: "inbound" } }; const first = await services.processWebhook({ integrationAccountId: ids.integrationA, organizationId: ids.orgA, provider: "mock", eventId: "integration-event-1", rawBody: JSON.stringify(payload), payload }); const second = await services.processWebhook({ integrationAccountId: ids.integrationA, organizationId: ids.orgA, provider: "mock", eventId: "integration-event-1", rawBody: JSON.stringify(payload), payload }); expect(first).toEqual({ processed: true, duplicate: false }); expect(second).toEqual({ processed: false, duplicate: true }); expect((await db.select().from(messages).where(eq(messages.externalId, "integration-message-1")))).toHaveLength(1); expect((await db.select().from(messages).where(eq(messages.idempotencyKey, "integration-outgoing-key")))).toHaveLength(1); expect((await repositories.getConversation(ids.orgA, ids.conversationA))?.conversation.unread).toBe(1); expect((await services.markConversationRead(actor(ids.orgA, ids.userA), ids.conversationA)).unread).toBe(0); expect(message.body).toBe("persisted"); });
  it("filters Inbox conversations by assignment, status, unread, contact and message text", async () => {
    await db.update(contacts).set({ phone: "+1 555-0100" }).where(eq(contacts.id, ids.contactA));
    await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "historic searchable phrase", internal: true }, "search-message-key");
    await db.update(conversations).set({ lastMessage: "latest reply", unread: 2, status: "OPEN" }).where(eq(conversations.id, ids.conversationA));
    expect((await repositories.searchConversations(ids.orgA, { assignedToId: ids.userA })).items.map((item) => item.id)).toContain(ids.conversationA);
    expect((await repositories.searchConversations(ids.orgA, { assignedToId: "unassigned" })).items).toHaveLength(0);
    expect((await repositories.searchConversations(ids.orgA, { status: "OPEN" })).items.map((item) => item.id)).toContain(ids.conversationA);
    expect((await repositories.searchConversations(ids.orgA, { unreadOnly: true })).items.map((item) => item.id)).toContain(ids.conversationA);
    for (const query of ["Contact A", "+1 555-0100", "a@local", "historic searchable phrase"]) {
      expect((await repositories.searchConversations(ids.orgA, { query })).items.map((item) => item.id), query).toContain(ids.conversationA);
    }
  });  it("encrypts, rotates, and keeps integration credentials tenant-scoped", async () => { const result = await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwoot, provider: "chatwoot", displayName: "Pilot Chatwoot", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-account", providerInboxId: "cw-inbox-1", apiToken: "integration-secret-token", webhookSecret: "integration-webhook-secret" }); expect(result).not.toHaveProperty("apiToken"); expect(result.tokenConfigured).toBe(true); const firstRow = (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0]; expect(firstRow.credentialCiphertext).toBeTruthy(); expect(firstRow.credentialCiphertext).not.toContain("integration-secret-token"); expect(firstRow.webhookSecretCiphertext).toBeTruthy(); await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwoot, provider: "chatwoot", displayName: "Pilot Chatwoot", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-account", providerInboxId: "cw-inbox-1", apiToken: "" }); const retainedRow = (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0]; expect(retainedRow.credentialCiphertext).toBe(firstRow.credentialCiphertext); expect(retainedRow.webhookSecretCiphertext).toBe(firstRow.webhookSecretCiphertext); await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwoot, provider: "chatwoot", displayName: "Pilot Chatwoot", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-account", providerInboxId: "cw-inbox-1", apiToken: "rotated-secret-token", webhookSecret: "rotated-webhook-secret" }); const rotatedRow = (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0]; expect(rotatedRow.credentialCiphertext).not.toBe(firstRow.credentialCiphertext); expect(rotatedRow.credentialCiphertext).not.toContain("rotated-secret-token"); expect(await repositories.getIntegration(ids.orgB, ids.integrationChatwoot)).toBeNull(); });
  it("tests Chatwoot read-only, then activates its webhook explicitly before idempotent sync", async () => {
    process.env.PUBLIC_APP_URL = "https://pilot.example";
    let webhookPosts = 0;
    const fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/api/v1/accounts/chatwoot-account")) return new Response(JSON.stringify({ id: "chatwoot-account", name: "Pilot Chatwoot" }), { status: 200 });
      if (input.endsWith("/api/v1/accounts/chatwoot-account/inboxes")) return new Response(JSON.stringify({ payload: [{ id: "cw-inbox-1", name: "Pilot inbox", channel_type: "Channel::Whatsapp" }] }), { status: 200 });
      if (input.endsWith("/api/v1/accounts/chatwoot-account/webhooks")) {
        if (init?.method === "POST") { webhookPosts += 1; return new Response(JSON.stringify({ id: "webhook-1", secret: "generated-webhook-secret" }), { status: 200 }); }
        return new Response(JSON.stringify({ payload: [] }), { status: 200 });
      }
      if (input.includes("/contacts?")) return new Response(JSON.stringify({ payload: [{ id: "cw-contact-1", name: "Contato Sincronizado", email: "sync@example.test", phone_number: "+5511999999999" }], meta: { current_page: 1, count: 1 } }), { status: 200 });
      if (input.includes("/conversations?status=all&page=1&inbox_id=cw-inbox-1")) return new Response(JSON.stringify({ payload: [{ id: "cw-conversation-1", status: "open", inbox_id: "cw-inbox-1", meta: { sender: { id: "cw-contact-1" }, channel: "Channel::Whatsapp" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá do Chatwoot" } }] }), { status: 200 });
      if (input.includes("/conversations?status=all&page=2&inbox_id=cw-inbox-1")) return new Response(JSON.stringify({ payload: [] }), { status: 200 });
      if (input.endsWith("/conversations/cw-conversation-1")) return new Response(JSON.stringify({ id: "cw-conversation-1", status: "open", inbox_id: "cw-inbox-1", meta: { sender: { id: "cw-contact-1" }, channel: "Channel::Whatsapp" }, last_activity_at: 1_700_000_000, last_non_activity_message: { content: "Olá do Chatwoot" }, messages: [{ id: "cw-message-1", content: "Olá do Chatwoot", message_type: "incoming", created_at: 1_700_000_000, sender: { name: "Contato Sincronizado" } }] }), { status: 200 });
      throw new Error("unexpected test URL: " + input);
    });
    vi.stubGlobal("fetch", fetchMock);
    const firstTest = await services.testIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    expect(firstTest.result.mode).toBe("READ_ONLY");
    expect(firstTest.result.webhookMatch).toBe(false);
    await expect(services.activateWebhook(actor(ids.orgA, ids.userA), ids.integrationChatwoot, { confirm: true })).rejects.toMatchObject({ status: 403 });
    await services.testIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    expect(webhookPosts).toBe(0);
    await expect(services.activateWebhook(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot, {})).rejects.toMatchObject({ status: 400 });
    const activated = await services.activateWebhook(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot, { confirm: true });
    expect(activated.result.ok).toBe(true);
    const first = await services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    const second = await services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot);
    const syncWebhookPayload = { event: "message_created", id: "sync-webhook-event", account: { id: "chatwoot-account" }, conversation: { id: "cw-conversation-1" }, message: { id: "cw-message-1", content: "Olá do Chatwoot", message_type: "incoming", created_at: 1_700_000_000 } };
    const syncWebhookProvider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "integration-secret-token", accountId: "chatwoot-account", inboxId: "cw-inbox-1", channelType: "WHATSAPP" });
    const syncWebhook = await services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", eventId: "sync-webhook-delivery", rawBody: JSON.stringify(syncWebhookPayload), payload: syncWebhookPayload, providerInstance: syncWebhookProvider });
    expect(syncWebhook).toEqual({ processed: true, duplicate: false });
    expect(await services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", eventId: "sync-webhook-delivery", rawBody: JSON.stringify(syncWebhookPayload), payload: syncWebhookPayload, providerInstance: syncWebhookProvider })).toEqual({ processed: false, duplicate: true });
    await db.delete(messages).where(and(eq(messages.organizationId, ids.orgA), eq(messages.channelConnectionId, ids.integrationChatwoot), eq(messages.externalId, "cw-message-1")));
    const [raceSync, raceWebhook] = await Promise.all([
      services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot),
      services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", eventId: "sync-webhook-race-delivery", rawBody: JSON.stringify(syncWebhookPayload), payload: syncWebhookPayload, providerInstance: syncWebhookProvider }),
    ]);
    expect(raceSync.imported).toBe(1);
    expect(raceWebhook).toEqual({ processed: true, duplicate: false });
    expect(first.imported).toBe(1); expect(second.imported).toBe(1); expect(webhookPosts).toBe(1); expect((await repositories.listContacts(ids.orgA)).filter((item) => item.email === "sync@example.test")).toHaveLength(1); expect((await repositories.listConversations(ids.orgA)).filter((item) => item.externalId === "cw-conversation-1")).toHaveLength(1); expect((await db.select().from(messages).where(eq(messages.externalId, "cw-message-1")))).toHaveLength(1); expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.lastSyncStatus).toBe("SUCCESS"); expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.webhookRegistrationId).toBe("webhook-1"); expect((await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, ids.integrationChatwoot)))[0].webhookSecretCiphertext).toBeTruthy();
    vi.unstubAllGlobals();
    delete process.env.PUBLIC_APP_URL;
  });
  it("creates a new Chatwoot widget conversation from its first inbound webhook and deduplicates replays", async () => {
    await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwootInbound, provider: "chatwoot", displayName: "Website Widget", baseUrl: "https://chatwoot.example", externalAccountId: "chatwoot-inbound-account", providerInboxId: "cw-widget-inbox", channelType: "UNKNOWN", apiToken: "integration-widget-token" });
    const payload = {
      event: "message_created", id: "cw-widget-event", account: { id: "chatwoot-inbound-account" },
      conversation: { id: "cw-widget-conversation", inbox_id: "cw-widget-inbox", status: "open", meta: { sender: { id: "cw-widget-contact", name: "Widget Visitor" }, channel: "Channel::WebWidget" }, inbox: { id: "cw-widget-inbox", name: "Website Inbox", channel_type: "Channel::WebWidget" } },
      message: { id: "cw-widget-message", content: "First inbound from the widget", message_type: "incoming", created_at: 1_700_000_000, sender: { id: "cw-widget-contact", name: "Widget Visitor" } },
    };
    const provider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "integration-widget-token", accountId: "chatwoot-inbound-account", inboxId: "cw-widget-inbox", channelType: "UNKNOWN" });
    const input = { integrationAccountId: ids.integrationChatwootInbound, organizationId: ids.orgA, provider: "chatwoot", eventId: "cw-widget-delivery", rawBody: JSON.stringify(payload), payload, providerInstance: provider };
    expect(await services.processWebhook(input)).toEqual({ processed: true, duplicate: false });
    expect(await services.processWebhook(input)).toEqual({ processed: false, duplicate: true });
    expect(await services.processWebhook({ ...input, eventId: "cw-widget-delivery-replay" })).toEqual({ processed: true, duplicate: false });
    const imported = (await repositories.listConversations(ids.orgA)).filter((item) => item.externalId === "cw-widget-conversation");
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ channelType: "WEBCHAT", status: "OPEN", lastMessage: "First inbound from the widget" });
    expect(await db.select().from(messages).where(and(eq(messages.organizationId, ids.orgA), eq(messages.channelConnectionId, ids.integrationChatwootInbound), eq(messages.externalId, "cw-widget-message")))).toHaveLength(1);
    expect(await db.select().from(contactIdentities).where(and(eq(contactIdentities.organizationId, ids.orgA), eq(contactIdentities.channelConnectionId, ids.integrationChatwootInbound), eq(contactIdentities.externalContactId, "cw-widget-contact")))).toHaveLength(1);
  });
  it("rejects unknown integrations and preserves data when the provider is down", async () => {
    await expect(services.testIntegration(ownerActor(ids.orgA, ids.userA), "integration-does-not-exist")).rejects.toMatchObject({ status: 404 });
    await db.update(conversations).set({ channelConnectionId: ids.integrationChatwoot, channelType: "WHATSAPP", providerType: "CHATWOOT" }).where(eq(conversations.id, ids.conversationA));
    const fetchMock = vi.fn().mockRejectedValue(new Error("provider down")); vi.stubGlobal("fetch", fetchMock);
    process.env.ECHAT_OUTBOUND_MODE = "disabled";
    await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "não enviar" })).rejects.toMatchObject({ status: 403, message: "OUTBOUND_NOT_AUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.ECHAT_OUTBOUND_MODE = "pilot"; process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS = ids.integrationChatwoot + ":external-a";
    await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "falha controlada" })).rejects.toMatchObject({ status: 502 });
    await expect(services.syncIntegration(ownerActor(ids.orgA, ids.userA), ids.integrationChatwoot)).rejects.toMatchObject({ status: 502 });
    expect((await repositories.listConversations(ids.orgA)).some((item) => item.externalId === "cw-conversation-1")).toBe(true);
    expect((await repositories.getIntegration(ids.orgA, ids.integrationChatwoot))?.lastSyncStatus).toBe("FAILED");
    expect((await repositories.findIntegrationsByExternalAccountId("chatwoot-account")).map((integration) => integration.id)).toContain(ids.integrationChatwoot);
    vi.unstubAllGlobals();
    delete process.env.ECHAT_OUTBOUND_MODE; delete process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS;
  });
  it("routes allowlisted pilot sends by conversation integration and deduplicates retries and webhook echoes", async () => {
    const previousMode = process.env.ECHAT_OUTBOUND_MODE;
    const previousAllowlist = process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS;
    await services.saveIntegration(ownerActor(ids.orgA, ids.userA), { id: ids.integrationChatwootB, provider: "chatwoot", displayName: "Pilot Chatwoot B", baseUrl: "https://chatwoot-b.example", externalAccountId: "chatwoot-account-b", providerInboxId: "cw-inbox-b", apiToken: "integration-secret-token-b" });
    await db.update(integrationAccounts).set({ status: "CONNECTED" }).where(inArray(integrationAccounts.id, [ids.integrationChatwoot, ids.integrationChatwootB]));
    await db.update(channels).set({ integrationAccountId: ids.integrationChatwoot, providerType: "CHATWOOT", type: "WHATSAPP", status: "CONNECTED" }).where(eq(channels.id, ids.channelA));
    await db.insert(channels).values({ id: ids.channelChatwootB, organizationId: ids.orgA, integrationAccountId: ids.integrationChatwootB, providerType: "CHATWOOT", name: "Pilot inbox B", type: "WHATSAPP", status: "CONNECTED", conversations: 1 });
    await db.update(conversations).set({ channelConnectionId: ids.integrationChatwoot, channelType: "WHATSAPP", providerType: "CHATWOOT", externalId: "external-a" }).where(eq(conversations.id, ids.conversationA));
    await db.insert(conversations).values({ id: ids.conversationChatwootB, organizationId: ids.orgA, externalId: "external-b-pilot", channelConnectionId: ids.integrationChatwootB, channelType: "WHATSAPP", providerType: "CHATWOOT", contactId: ids.contactA, channelId: ids.channelChatwootB, status: "OPEN", assignedToId: ids.userA, unread: 0, lastMessage: "B initial", lastMessageAt: new Date() });
    process.env.ECHAT_OUTBOUND_MODE = "pilot";
    process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS = `${ids.integrationChatwoot}:external-a`;
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); requestedUrls.push(url);
      if (init?.method !== "POST") throw new Error("unexpected non-POST request");
      const conversationId = url.includes("chatwoot-account-b") ? "external-b-pilot" : "external-a";
      const account = url.includes("chatwoot-account-b") ? "chatwoot-account-b" : "chatwoot-account";
      return new Response(JSON.stringify({ id: `pilot-message-${account === "chatwoot-account-b" ? "b" : "a"}`, content: JSON.parse(String(init.body)).content, created_at: 1_700_000_000, message_type: "outgoing" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationChatwootB, { body: "bloqueada" }, "pilot-blocked-key")).rejects.toMatchObject({ status: 403, message: "OUTBOUND_NOT_AUTHORIZED" });
      expect(fetchMock).not.toHaveBeenCalled();

      const sentA = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "mensagem autorizada A" }, "pilot-send-key-a");
      const replayA = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationA, { body: "mensagem autorizada A" }, "pilot-send-key-a");
      expect(replayA.id).toBe(sentA.id);
      expect(sentA.externalId).toBe("pilot-message-a");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(requestedUrls[0]).toContain("https://chatwoot.example/api/v1/accounts/chatwoot-account/conversations/external-a/messages");

      process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS += `,${ids.integrationChatwootB}:external-b-pilot`;
      const sentB = await services.sendMessage(actor(ids.orgA, ids.userA), ids.conversationChatwootB, { body: "mensagem autorizada B" }, "pilot-send-key-b");
      expect(sentB.externalId).toBe("pilot-message-b");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(requestedUrls[1]).toContain("https://chatwoot-b.example/api/v1/accounts/chatwoot-account-b/conversations/external-b-pilot/messages");

      const echoPayload = { event: "message_created", id: "pilot-echo-event-a", account: { id: "chatwoot-account" }, conversation: { id: "external-a" }, message: { id: "pilot-message-a", content: "mensagem autorizada A", message_type: "outgoing", created_at: 1_700_000_000 } };
      const echoProvider = new ChatwootProvider({ baseUrl: "https://chatwoot.example", token: "integration-secret-token", accountId: "chatwoot-account", inboxId: "cw-inbox-1", channelType: "WHATSAPP" });
      expect(await services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", eventId: "pilot-echo-delivery-a", rawBody: JSON.stringify(echoPayload), payload: echoPayload, providerInstance: echoProvider })).toEqual({ processed: true, duplicate: false });
      expect((await db.select().from(messages).where(eq(messages.externalId, "pilot-message-a")))).toHaveLength(1);
      expect(await services.processWebhook({ integrationAccountId: ids.integrationChatwoot, organizationId: ids.orgA, provider: "chatwoot", eventId: "pilot-echo-delivery-a", rawBody: JSON.stringify(echoPayload), payload: echoPayload, providerInstance: echoProvider })).toEqual({ processed: false, duplicate: true });
    } finally {
      vi.unstubAllGlobals();
      if (previousMode === undefined) delete process.env.ECHAT_OUTBOUND_MODE; else process.env.ECHAT_OUTBOUND_MODE = previousMode;
      if (previousAllowlist === undefined) delete process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS; else process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS = previousAllowlist;
    }
  });
  it("proves tenant and connection scoped external mappings in PostgreSQL", async () => {
    await db.insert(integrationAccounts).values([
      { id: ids.integrationConnectionB, organizationId: ids.orgA, provider: "mock", externalAccountId: "integration-account-b", status: "ACTIVE", metadata: {} },
      { id: ids.integrationOrgB, organizationId: ids.orgB, provider: "chatwoot", providerType: "CHATWOOT", externalAccountId: "chatwoot-account", providerInboxId: "cw-inbox-1", baseUrl: "https://chatwoot.example", status: "CONNECTED", metadata: {} },
    ]).onConflictDoNothing();
    await db.update(integrationAccounts).set({ status: "CONNECTED" }).where(eq(integrationAccounts.id, ids.integrationChatwoot));
    expect(await repositories.findIntegrationsByExternalAccountId("chatwoot-account")).toHaveLength(2);
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
  it("loads a synthetic large Inbox page with 100 contacts, 200 conversations, and 2000 messages", async () => {
    const contactIds = Array.from({ length: 100 }, (_, i) => `large-fixture-contact-${String(i).padStart(3, "0")}`);
    const conversationIds = Array.from({ length: 200 }, (_, i) => `large-fixture-conversation-${String(i).padStart(3, "0")}`);
    await db.insert(contacts).values(contactIds.map((id, i) => ({ id, organizationId: ids.orgA, name: `Large fixture contact ${i}`, company: "Synthetic", phone: "", email: `large-fixture-${i}@local`, ownerId: ids.userA, notes: "", lastConversationAt: new Date() })));
    await db.insert(conversations).values(conversationIds.map((id, i) => ({ id, organizationId: ids.orgA, externalId: `large-fixture-conversation-${i}`, channelConnectionId: ids.integrationA, channelType: "WEBCHAT", providerType: "MOCK", contactId: contactIds[i % contactIds.length], channelId: ids.channelA, status: "OPEN", assignedToId: ids.userA, unread: 0, lastMessage: `large-fixture-conversation-${i}`, lastMessageAt: new Date(Date.now() - i * 1000) })));
    const messageRows = Array.from({ length: 2000 }, (_, i) => ({ id: `large-fixture-message-${i}`, organizationId: ids.orgA, conversationId: conversationIds[i % conversationIds.length], channelConnectionId: ids.integrationA, channelType: "WEBCHAT", providerType: "MOCK", externalId: `large-fixture-message-${i}`, idempotencyKey: null, direction: "INBOUND", senderIdentity: null, recipientIdentity: null, sender: "CONTACT", authorName: "Synthetic contact", body: `large-fixture-body-${i}`, messageType: "TEXT", deliveryStatus: "DELIVERED", providerCreatedAt: new Date(Date.now() - i * 1000), internal: false, createdAt: new Date(Date.now() - i * 1000) }));
    await db.insert(messages).values(messageRows);
    const page = await repositories.searchConversations(ids.orgA, { query: "large-fixture-conversation-", page: 1, pageSize: 250 });
    expect(page.total).toBe(200);
    expect(page.items).toHaveLength(200);
    expect(page.items.reduce((total, item) => total + item.messages.length, 0)).toBe(2000);
    expect((await db.select().from(contacts).where(inArray(contacts.id, contactIds)))).toHaveLength(100);
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
