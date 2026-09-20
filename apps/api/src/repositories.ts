import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@echat/db";
import { authSessions, channels, contactTags, contacts, conversations, integrationAccounts, messages, opportunities, opportunityActivities, organizationMembers, organizations, pipelineStages, pipelines, tags, users, webhookEvents } from "@echat/db";
import type { Contact, Conversation, Message, Opportunity, OpportunityStage, PipelineStage, Role, SessionUser, User } from "@echat/shared";

const role = (value: string): Role => value === "OWNER" || value === "ADMIN" ? value : "AGENT";
const stageKey = (value: string): OpportunityStage => value as OpportunityStage;
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export type AuthenticatedRecord = { sessionId: string; user: SessionUser; expiresAt: Date };
export type IntegrationRecord = { id: string; organizationId: string; provider: string; externalAccountId: string; status: string; baseUrl: string | null; credentialRef: string | null };

const toUser = (row: { id: string; name: string; email: string; avatar: string }, organizationId: string, membershipRole: string): User => ({ id: row.id, organizationId, name: row.name, email: row.email, role: role(membershipRole), avatar: row.avatar });
const toContact = (row: typeof contacts.$inferSelect, tagNames: string[], opportunityCount: number): Contact => ({ id: row.id, organizationId: row.organizationId, name: row.name, company: row.company, phone: row.phone, email: row.email, tags: tagNames, ownerId: row.ownerId, lastConversationAt: iso(row.lastConversationAt), opportunities: opportunityCount, notes: row.notes });
const toMessage = (row: typeof messages.$inferSelect): Message => ({ id: row.id, organizationId: row.organizationId, externalId: row.externalId ?? undefined, conversationId: row.conversationId, sender: row.sender as Message["sender"], authorName: row.authorName, body: row.body, createdAt: iso(row.createdAt), internal: row.internal });
const toStage = (row: typeof pipelineStages.$inferSelect): PipelineStage => ({ id: row.id, organizationId: row.organizationId, name: row.name, key: stageKey(row.key), order: row.position, color: row.color });

export class Repositories {
  constructor(private readonly db: Database) {}

  async authenticate(email: string): Promise<{ userId: string; passwordHash: string; user: SessionUser } | null> {
    const rows = await this.db.select({ user: users, member: organizationMembers }).from(users).innerJoin(organizationMembers, eq(organizationMembers.userId, users.id)).where(and(eq(users.email, email), eq(organizationMembers.status, "ACTIVE"))).limit(1);
    const row = rows[0];
    return row ? { userId: row.user.id, passwordHash: row.user.passwordHash, user: { ...toUser(row.user, row.member.organizationId, row.member.role), sessionId: "" } } : null;
  }

  async createSession(input: { id: string; userId: string; organizationId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(authSessions).values(input);
  }

  async findSession(tokenHash: string): Promise<AuthenticatedRecord | null> {
    const rows = await this.db.select({ session: authSessions, user: users, member: organizationMembers }).from(authSessions).innerJoin(users, eq(users.id, authSessions.userId)).innerJoin(organizationMembers, and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, authSessions.organizationId))).where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()), eq(organizationMembers.status, "ACTIVE"))).limit(1);
    const row = rows[0];
    if (!row) return null;
    await this.db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.id, row.session.id));
    return { sessionId: row.session.id, expiresAt: row.session.expiresAt, user: { ...toUser(row.user, row.member.organizationId, row.member.role), sessionId: row.session.id } };
  }

  async revokeSession(sessionId: string): Promise<void> { await this.db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, sessionId)); }

  async getOrganization(organizationId: string) {
    const row = (await this.db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1))[0];
    if (!row) throw new Error("Organização não encontrada");
    return { id: row.id, name: row.name, plan: row.plan };
  }

  async listUsers(organizationId: string): Promise<User[]> {
    const rows = await this.db.select({ user: users, member: organizationMembers }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, "ACTIVE")));
    return rows.map(({ user, member }) => toUser(user, organizationId, member.role));
  }

  private async tagMap(organizationId: string): Promise<Map<string, string[]>> {
    const rows = await this.db.select({ contactId: contactTags.contactId, name: tags.name }).from(contactTags).innerJoin(tags, eq(tags.id, contactTags.tagId)).where(eq(contactTags.organizationId, organizationId));
    const map = new Map<string, string[]>();
    for (const row of rows) map.set(row.contactId, [...(map.get(row.contactId) ?? []), row.name]);
    return map;
  }

  async listContacts(organizationId: string): Promise<Contact[]> {
    const [rows, opportunitiesRows, tagsByContact] = await Promise.all([
      this.db.select().from(contacts).where(eq(contacts.organizationId, organizationId)),
      this.db.select({ contactId: opportunities.contactId }).from(opportunities).where(eq(opportunities.organizationId, organizationId)),
      this.tagMap(organizationId),
    ]);
    const counts = new Map<string, number>(); for (const item of opportunitiesRows) counts.set(item.contactId, (counts.get(item.contactId) ?? 0) + 1);
    return rows.map((row) => toContact(row, tagsByContact.get(row.id) ?? [], counts.get(row.id) ?? 0));
  }

  async getContact(organizationId: string, contactId: string): Promise<Contact | null> { return (await this.listContacts(organizationId)).find((item) => item.id === contactId) ?? null; }

  async listChannels(organizationId: string) {
    const rows = await this.db.select().from(channels).where(eq(channels.organizationId, organizationId));
    return rows.map((row) => ({ id: row.id, organizationId: row.organizationId, name: row.name, type: row.type as "WHATSAPP" | "WEBCHAT" | "EMAIL" | "INSTAGRAM", status: row.status as "CONNECTED" | "ATTENTION", conversations: row.conversations }));
  }

  async listConversations(organizationId: string): Promise<Conversation[]> {
    const rows = await this.db.select().from(conversations).where(eq(conversations.organizationId, organizationId)).orderBy(desc(conversations.lastMessageAt));
    return this.withMessages(organizationId, rows);
  }

  private async withMessages(organizationId: string, rows: typeof conversations.$inferSelect[]): Promise<Conversation[]> {
    const ids = rows.map((row) => row.id); const messageRows = ids.length ? await this.db.select().from(messages).where(and(eq(messages.organizationId, organizationId), inArray(messages.conversationId, ids))).orderBy(messages.createdAt) : [];
    const grouped = new Map<string, Message[]>(); for (const row of messageRows) grouped.set(row.conversationId, [...(grouped.get(row.conversationId) ?? []), toMessage(row)]);
    return rows.map((row) => ({ id: row.id, organizationId: row.organizationId, contactId: row.contactId, channelId: row.channelId, externalId: row.externalId ?? undefined, status: row.status as Conversation["status"], assignedToId: row.assignedToId ?? undefined, unread: row.unread, lastMessage: row.lastMessage, lastMessageAt: iso(row.lastMessageAt), messages: grouped.get(row.id) ?? [] }));
  }

  async getConversation(organizationId: string, id: string): Promise<{ conversation: Conversation; contact: Contact; channel: Awaited<ReturnType<Repositories["listChannels"]>>[number] } | null> {
    const row = (await this.db.select().from(conversations).where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, id))).limit(1))[0];
    if (!row) return null;
    const [conversation] = await this.withMessages(organizationId, [row]); const contact = await this.getContact(organizationId, row.contactId); const channel = (await this.listChannels(organizationId)).find((item) => item.id === row.channelId);
    return contact && channel ? { conversation, contact, channel } : null;
  }

  async getConversationRow(organizationId: string, id: string) { return (await this.db.select().from(conversations).where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, id))).limit(1))[0] ?? null; }

  async findMember(organizationId: string, userId: string) { return (await this.db.select({ user: users, member: organizationMembers }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId), eq(organizationMembers.status, "ACTIVE"))).limit(1))[0] ?? null; }

  async updateConversationAssignment(organizationId: string, conversationId: string, assignedToId: string | null) {
    await this.db.update(conversations).set({ assignedToId, updatedAt: new Date() }).where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)));
    return this.getConversation(organizationId, conversationId);
  }

  async updateConversationStatus(organizationId: string, conversationId: string, status: "OPEN" | "WAITING" | "RESOLVED") {
    await this.db.update(conversations).set({ status, updatedAt: new Date() }).where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)));
    return this.getConversation(organizationId, conversationId);
  }

  async insertOutgoingMessage(input: { organizationId: string; conversationId: string; externalId?: string; body: string; authorName: string; createdAt: Date; internal: boolean }) {
    return this.db.transaction(async (tx) => {
      const row = { id: randomUUID(), organizationId: input.organizationId, conversationId: input.conversationId, externalId: input.externalId ?? null, sender: "AGENT", authorName: input.authorName, body: input.body, internal: input.internal, createdAt: input.createdAt };
      await tx.insert(messages).values(row);
      await tx.update(conversations).set({ lastMessage: input.body, lastMessageAt: input.createdAt, updatedAt: new Date() }).where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.id, input.conversationId)));
      return toMessage(row);
    });
  }

  async listStages(organizationId: string): Promise<PipelineStage[]> { return (await this.db.select().from(pipelineStages).where(eq(pipelineStages.organizationId, organizationId)).orderBy(pipelineStages.position)).map(toStage); }

  async listOpportunities(organizationId: string): Promise<Opportunity[]> {
    const rows = await this.db.select({ opportunity: opportunities, stage: pipelineStages }).from(opportunities).innerJoin(pipelineStages, and(eq(pipelineStages.id, opportunities.stageId), eq(pipelineStages.organizationId, organizationId))).where(eq(opportunities.organizationId, organizationId)).orderBy(desc(opportunities.updatedAt));
    return rows.map(({ opportunity, stage }) => ({ id: opportunity.id, organizationId: opportunity.organizationId, title: opportunity.title, contactId: opportunity.contactId, pipelineId: opportunity.pipelineId, stageId: opportunity.stageId, company: opportunity.company, value: Number(opportunity.value), stage: stageKey(stage.key), ownerId: opportunity.ownerId, source: opportunity.source, lastActivity: opportunity.lastActivity, note: opportunity.note }));
  }

  async getOpportunity(organizationId: string, id: string) { return (await this.listOpportunities(organizationId)).find((item) => item.id === id) ?? null; }

  async createOpportunity(input: { organizationId: string; actorId: string; title: string; contactId: string; value: number; stageKey: OpportunityStage }) {
    return this.db.transaction(async (tx) => {
      const contact = (await tx.select().from(contacts).where(and(eq(contacts.organizationId, input.organizationId), eq(contacts.id, input.contactId))).limit(1)) [0];
      const stage = (await tx.select().from(pipelineStages).where(and(eq(pipelineStages.organizationId, input.organizationId), eq(pipelineStages.key, input.stageKey))).orderBy(pipelineStages.position).limit(1))[0];
      if (!contact || !stage) return null;
      const idValue = randomUUID();
      await tx.insert(opportunities).values({ id: idValue, organizationId: input.organizationId, title: input.title, contactId: contact.id, company: contact.company, value: input.value.toFixed(2), pipelineId: stage.pipelineId, stageId: stage.id, ownerId: input.actorId, source: "Inbox", lastActivity: "agora", note: "Criada a partir do fluxo comercial." });
      await tx.insert(opportunityActivities).values({ id: randomUUID(), organizationId: input.organizationId, opportunityId: idValue, actorId: input.actorId, type: "CREATED", detail: "Oportunidade criada" });
      return { id: idValue, organizationId: input.organizationId, title: input.title, contactId: contact.id, pipelineId: stage.pipelineId, stageId: stage.id, company: contact.company, value: input.value, stage: stageKey(stage.key), ownerId: input.actorId, source: "Inbox", lastActivity: "agora", note: "Criada a partir do fluxo comercial." } satisfies Opportunity;
    });
  }

  async moveOpportunity(input: { organizationId: string; actorId: string; opportunityId: string; stageKey: OpportunityStage }) {
    return this.db.transaction(async (tx) => {
      const current = (await tx.select().from(opportunities).where(and(eq(opportunities.organizationId, input.organizationId), eq(opportunities.id, input.opportunityId))).limit(1))[0];
      if (!current) return null;
      const stage = (await tx.select().from(pipelineStages).where(and(eq(pipelineStages.organizationId, input.organizationId), eq(pipelineStages.pipelineId, current.pipelineId), eq(pipelineStages.key, input.stageKey))).limit(1))[0];
      if (!stage) return undefined;
      await tx.update(opportunities).set({ stageId: stage.id, lastActivity: "agora", updatedAt: new Date() }).where(and(eq(opportunities.organizationId, input.organizationId), eq(opportunities.id, input.opportunityId)));
      await tx.insert(opportunityActivities).values({ id: randomUUID(), organizationId: input.organizationId, opportunityId: input.opportunityId, actorId: input.actorId, type: "STAGE_MOVED", detail: `Movida para ${stage.name}` });
      return { id: current.id, organizationId: current.organizationId, title: current.title, contactId: current.contactId, pipelineId: current.pipelineId, stageId: stage.id, company: current.company, value: Number(current.value), stage: stageKey(stage.key), ownerId: current.ownerId, source: current.source, lastActivity: "agora", note: current.note } satisfies Opportunity;
    });
  }

  async findIntegration(provider: string, externalAccountId: string): Promise<IntegrationRecord | null> {
    const row = (await this.db.select().from(integrationAccounts).where(and(eq(integrationAccounts.provider, provider), eq(integrationAccounts.externalAccountId, externalAccountId), eq(integrationAccounts.status, "ACTIVE"))).limit(1))[0];
    return row ? { id: row.id, organizationId: row.organizationId, provider: row.provider, externalAccountId: row.externalAccountId, status: row.status, baseUrl: row.baseUrl, credentialRef: row.credentialRef } : null;
  }

  async claimWebhookEvent(input: { organizationId: string; integrationAccountId: string; provider: string; externalEventId: string; payloadHash: string }): Promise<boolean> {
    const inserted = await this.db.insert(webhookEvents).values({ id: randomUUID(), ...input }).onConflictDoNothing({ target: [webhookEvents.integrationAccountId, webhookEvents.externalEventId] }).returning({ id: webhookEvents.id });
    return inserted.length === 1;
  }

  async completeWebhookEvent(integrationAccountId: string, externalEventId: string): Promise<void> { await this.db.update(webhookEvents).set({ processedAt: new Date() }).where(and(eq(webhookEvents.integrationAccountId, integrationAccountId), eq(webhookEvents.externalEventId, externalEventId))); }

  async findConversationByExternalId(organizationId: string, externalId: string) { return (await this.db.select().from(conversations).where(and(eq(conversations.organizationId, organizationId), eq(conversations.externalId, externalId))).limit(1))[0] ?? null; }
  async findMessageByExternalId(organizationId: string, externalId: string) { return (await this.db.select().from(messages).where(and(eq(messages.organizationId, organizationId), eq(messages.externalId, externalId))).limit(1))[0] ?? null; }
  async insertInboundMessage(input: { organizationId: string; conversationId: string; externalId?: string; body: string; authorName: string; createdAt: Date }) {
    return this.db.transaction(async (tx) => {
      if (input.externalId) { const existing = await tx.select().from(messages).where(and(eq(messages.organizationId, input.organizationId), eq(messages.externalId, input.externalId))).limit(1); if (existing.length) return toMessage(existing[0]); }
      const row = { id: randomUUID(), organizationId: input.organizationId, conversationId: input.conversationId, externalId: input.externalId ?? null, sender: "CONTACT", authorName: input.authorName, body: input.body, internal: false, createdAt: input.createdAt };
      await tx.insert(messages).values(row);
      await tx.update(conversations).set({ lastMessage: input.body, lastMessageAt: input.createdAt, updatedAt: new Date() }).where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.id, input.conversationId)));
      return toMessage(row);
    });
  }
}
