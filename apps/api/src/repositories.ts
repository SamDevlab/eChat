import { and, count, desc, eq, gt, ilike, inArray, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@echat/db";
import { authSessions, channels, contactIdentities, contactTags, contacts, conversations, integrationAccounts, messages, opportunities, opportunityActivities, organizationInvites, opportunityConversations, organizationMembers, organizations, pipelineStages, pipelines, tags, users, webhookEvents } from "@echat/db";
import type { ChannelType, Contact, ContactIdentity, Conversation, DeliveryStatus, Message, MessageType, Opportunity, OpportunityStage, PipelineStage, ProviderType, Role, SessionUser, User } from "@echat/shared";

const role = (value: string): Role => value === "OWNER" || value === "ADMIN" ? value : "AGENT";
const stageKey = (value: string): OpportunityStage => value as OpportunityStage;
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export type AuthenticatedRecord = { sessionId: string; user: SessionUser; expiresAt: Date };
export type IntegrationRecord = { id: string; organizationId: string; provider: string; providerType: ProviderType; displayName: string; externalAccountId: string; providerInboxId: string | null; channelType: ChannelType; status: string; baseUrl: string | null; credentialRef: string | null; credentialCiphertext: string | null; credentialIv: string | null; credentialTag: string | null; credentialVersion: number | null; webhookSecretCiphertext: string | null; webhookSecretIv: string | null; webhookSecretTag: string | null; webhookSecretVersion: number | null; webhookRegistrationId: string | null; lastCheckAt: Date | null; lastErrorCode: string | null; lastErrorAt: Date | null; lastSyncStartedAt: Date | null; lastSyncCompletedAt: Date | null; lastSyncAt: Date | null; lastSyncStatus: string | null; lastSyncError: string | null };

const toUser = (row: { id: string; name: string; email: string; avatar: string }, organizationId: string, membershipRole: string): User => ({ id: row.id, organizationId, name: row.name, email: row.email, role: role(membershipRole), avatar: row.avatar });
const toContact = (row: typeof contacts.$inferSelect, tagNames: string[], opportunityCount: number): Contact => ({ id: row.id, organizationId: row.organizationId, name: row.name, company: row.company, phone: row.phone, email: row.email, tags: tagNames, ownerId: row.ownerId, lastConversationAt: iso(row.lastConversationAt), opportunities: opportunityCount, notes: row.notes });
const toMessage = (row: typeof messages.$inferSelect): Message => ({ id: row.id, organizationId: row.organizationId, externalId: row.externalId ?? undefined, externalMessageId: row.externalId ?? undefined, conversationId: row.conversationId, channelType: (row.channelType as ChannelType | null) ?? undefined, providerType: (row.providerType as ProviderType | null) ?? undefined, direction: row.direction as Message["direction"], senderIdentity: row.senderIdentity ?? undefined, recipientIdentity: row.recipientIdentity ?? undefined, sender: row.sender as Message["sender"], authorName: row.authorName, body: row.body, messageType: row.messageType as MessageType, deliveryStatus: row.deliveryStatus as DeliveryStatus, providerCreatedAt: row.providerCreatedAt ? iso(row.providerCreatedAt) : undefined, createdAt: iso(row.createdAt), internal: row.internal });
const toStage = (row: typeof pipelineStages.$inferSelect): PipelineStage => ({ id: row.id, organizationId: row.organizationId, name: row.name, key: stageKey(row.key), order: row.position, color: row.color });
const toIntegration = (row: typeof integrationAccounts.$inferSelect): IntegrationRecord => ({ id: row.id, organizationId: row.organizationId, provider: row.provider, providerType: row.providerType as ProviderType, displayName: row.displayName, externalAccountId: row.externalAccountId, providerInboxId: row.providerInboxId, channelType: row.channelType as ChannelType, status: row.status, baseUrl: row.baseUrl, credentialRef: row.credentialRef, credentialCiphertext: row.credentialCiphertext, credentialIv: row.credentialIv, credentialTag: row.credentialTag, credentialVersion: row.credentialVersion, webhookSecretCiphertext: row.webhookSecretCiphertext, webhookSecretIv: row.webhookSecretIv, webhookSecretTag: row.webhookSecretTag, webhookSecretVersion: row.webhookSecretVersion, webhookRegistrationId: row.webhookRegistrationId, lastCheckAt: row.lastCheckAt, lastErrorCode: row.lastErrorCode, lastErrorAt: row.lastErrorAt, lastSyncStartedAt: row.lastSyncStartedAt, lastSyncCompletedAt: row.lastSyncCompletedAt, lastSyncAt: row.lastSyncAt, lastSyncStatus: row.lastSyncStatus, lastSyncError: row.lastSyncError });

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
    return { id: row.id, name: row.name, plan: row.plan, timezone: row.timezone, onboardingStep: row.onboardingStep, onboardingCompleted: row.onboardingCompleted };
  }

  async createOrganizationWithOwner(input: { name: string; email: string; passwordHash: string; userName: string; session: { id: string; tokenHash: string; expiresAt: Date } }) {
    return this.db.transaction(async (tx) => {
      const organizationId = randomUUID(); const userId = randomUUID(); const pipelineId = `${organizationId}-pipeline-default`;
      await tx.insert(organizations).values({ id: organizationId, name: input.name, plan: "Plano piloto", timezone: "America/Sao_Paulo", onboardingStep: "COMPANY", onboardingCompleted: false });
      await tx.insert(users).values({ id: userId, email: input.email, name: input.userName, passwordHash: input.passwordHash, avatar: input.userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "OW" });
      await tx.insert(organizationMembers).values({ id: randomUUID(), organizationId, userId, role: "OWNER", status: "ACTIVE" });
      await tx.insert(pipelines).values({ id: pipelineId, organizationId, name: "Vendas" });
      const stages = [{ key: "NEW_LEAD", name: "Novo lead", color: "teal" }, { key: "CONTACTED", name: "Contato realizado", color: "blue" }, { key: "PROPOSAL", name: "Proposta", color: "violet" }, { key: "NEGOTIATION", name: "Negociação", color: "amber" }, { key: "WON", name: "Ganho", color: "green" }, { key: "LOST", name: "Perdido", color: "red" }];
      for (const [index, stage] of stages.entries()) await tx.insert(pipelineStages).values({ id: `${organizationId}-stage-${stage.key}`, organizationId, pipelineId, name: stage.name, key: stage.key, position: index + 1, color: stage.color });
      await tx.insert(authSessions).values({ id: input.session.id, userId, organizationId, tokenHash: input.session.tokenHash, expiresAt: input.session.expiresAt });
      return { organizationId, userId, pipelineId };
    });
  }

  async updateOrganization(organizationId: string, input: { name?: string; timezone?: string; onboardingStep?: string; onboardingCompleted?: boolean }) {
    await this.db.update(organizations).set({ ...input }).where(eq(organizations.id, organizationId));
    return this.getOrganization(organizationId);
  }

  async listUsers(organizationId: string): Promise<User[]> {
    const rows = await this.db.select({ user: users, member: organizationMembers }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, "ACTIVE")));
    return rows.map(({ user, member }) => toUser(user, organizationId, member.role));
  }

  async listMembers(organizationId: string) {
    const rows = await this.db.select({ member: organizationMembers, user: users }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(eq(organizationMembers.organizationId, organizationId)).orderBy(organizationMembers.createdAt);
    return rows.map(({ member, user }) => ({ id: member.id, organizationId, userId: user.id, name: user.name, email: user.email, avatar: user.avatar, role: role(member.role), status: member.status as "ACTIVE" | "INVITED" | "DISABLED", createdAt: iso(member.createdAt) }));
  }

  async getMember(organizationId: string, userId: string) { return (await this.listMembers(organizationId)).find((member) => member.userId === userId) ?? null; }
  async countActiveOwners(organizationId: string) { return Number((await this.db.select({ count: count() }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.role, "OWNER"), eq(organizationMembers.status, "ACTIVE"))))[0]?.count ?? 0); }
  async updateMember(organizationId: string, userId: string, input: { role?: Role; status?: "ACTIVE" | "DISABLED" }) { await this.db.update(organizationMembers).set(input).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))); return this.getMember(organizationId, userId); }

  async findUserByEmail(email: string) { return (await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1))[0] ?? null; }
  async findAnyActiveMember(organizationId: string) { return (await this.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, "ACTIVE"))).orderBy(organizationMembers.createdAt).limit(1))[0] ?? null; }

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

  async searchContacts(organizationId: string, query: string, page = 1, pageSize = 25) {
    const normalized = query.trim(); const filter = normalized ? and(eq(contacts.organizationId, organizationId), or(ilike(contacts.name, `%${normalized}%`), ilike(contacts.company, `%${normalized}%`), ilike(contacts.email, `%${normalized}%`))) : eq(contacts.organizationId, organizationId);
    const [rows, total] = await Promise.all([this.db.select().from(contacts).where(filter).orderBy(contacts.name).limit(pageSize).offset((page - 1) * pageSize), this.db.select({ count: count() }).from(contacts).where(filter)]);
    const all = await this.listContacts(organizationId); const byId = new Map(all.map((item) => [item.id, item]));
    return { items: rows.map((row) => byId.get(row.id)).filter((item): item is Contact => Boolean(item)), total: Number(total[0]?.count ?? 0), page, pageSize };
  }

  async getContact(organizationId: string, contactId: string): Promise<Contact | null> { return (await this.listContacts(organizationId)).find((item) => item.id === contactId) ?? null; }

  async listChannels(organizationId: string) {
    const rows = await this.db.select().from(channels).where(eq(channels.organizationId, organizationId));
    return rows.map((row) => ({ id: row.id, organizationId: row.organizationId, integrationAccountId: row.integrationAccountId ?? undefined, name: row.name, type: row.type as ChannelType, providerType: row.providerType ? row.providerType as ProviderType : undefined, status: row.status as "CONNECTED" | "ATTENTION", conversations: row.conversations }));
  }

  async listConversations(organizationId: string): Promise<Conversation[]> {
    const rows = await this.db.select().from(conversations).where(eq(conversations.organizationId, organizationId)).orderBy(desc(conversations.lastMessageAt));
    return this.withMessages(organizationId, rows);
  }

  async searchConversations(organizationId: string, input: { query?: string; status?: string; assignedToId?: string; channelId?: string; page?: number; pageSize?: number }) {
    const page = input.page ?? 1; const pageSize = input.pageSize ?? 25; const filters = [eq(conversations.organizationId, organizationId)];
    if (input.status && ["OPEN", "WAITING", "RESOLVED"].includes(input.status)) filters.push(eq(conversations.status, input.status));
    if (input.assignedToId === "mine") filters.push(isNull(conversations.assignedToId));
    if (input.assignedToId && input.assignedToId !== "mine" && input.assignedToId !== "unassigned") filters.push(eq(conversations.assignedToId, input.assignedToId));
    if (input.assignedToId === "unassigned") filters.push(isNull(conversations.assignedToId));
    if (input.channelId) filters.push(eq(conversations.channelId, input.channelId));
    const normalized = input.query?.trim(); if (normalized) filters.push(or(ilike(conversations.lastMessage, `%${normalized}%`), ilike(conversations.externalId, `%${normalized}%`))!);
    const where = and(...filters); const [rows, total] = await Promise.all([this.db.select().from(conversations).where(where).orderBy(desc(conversations.lastMessageAt)).limit(pageSize).offset((page - 1) * pageSize), this.db.select({ count: count() }).from(conversations).where(where)]);
    return { items: await this.withMessages(organizationId, rows), total: Number(total[0]?.count ?? 0), page, pageSize };
  }

  private async withMessages(organizationId: string, rows: typeof conversations.$inferSelect[]): Promise<Conversation[]> {
    const ids = rows.map((row) => row.id); const messageRows = ids.length ? await this.db.select().from(messages).where(and(eq(messages.organizationId, organizationId), inArray(messages.conversationId, ids))).orderBy(messages.createdAt) : [];
    const grouped = new Map<string, Message[]>(); for (const row of messageRows) grouped.set(row.conversationId, [...(grouped.get(row.conversationId) ?? []), toMessage(row)]);
    return rows.map((row) => ({ id: row.id, organizationId: row.organizationId, contactId: row.contactId, channelId: row.channelId, externalId: row.externalId ?? undefined, externalConversationId: row.externalId ?? undefined, channelType: row.channelType as ChannelType | undefined, providerType: row.providerType as ProviderType | undefined, channelConnectionId: row.channelConnectionId ?? undefined, status: row.status as Conversation["status"], assignedToId: row.assignedToId ?? undefined, unread: row.unread, lastMessage: row.lastMessage, lastMessageAt: iso(row.lastMessageAt), messages: grouped.get(row.id) ?? [] }));
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

  async insertOutgoingMessage(input: { organizationId: string; conversationId: string; channelConnectionId?: string; channelType?: ChannelType; providerType?: ProviderType; externalId?: string; body: string; authorName: string; createdAt: Date; internal: boolean; senderIdentity?: string; recipientIdentity?: string; deliveryStatus?: DeliveryStatus }) {
    return this.db.transaction(async (tx) => {
      const row = { id: randomUUID(), organizationId: input.organizationId, conversationId: input.conversationId, channelConnectionId: input.channelConnectionId ?? null, channelType: input.channelType ?? null, providerType: input.providerType ?? null, externalId: input.externalId ?? null, direction: "OUTBOUND", senderIdentity: input.senderIdentity ?? null, recipientIdentity: input.recipientIdentity ?? null, sender: "AGENT", authorName: input.authorName, body: input.body, messageType: "TEXT", deliveryStatus: input.deliveryStatus ?? "SENT", providerCreatedAt: input.createdAt, internal: input.internal, createdAt: input.createdAt };
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

  async linkOpportunityConversation(input: { organizationId: string; opportunityId: string; conversationId: string }) {
    const valid = await this.db.select({ opportunityId: opportunities.id, conversationId: conversations.id }).from(opportunities).innerJoin(conversations, and(eq(conversations.id, input.conversationId), eq(conversations.organizationId, input.organizationId))).where(and(eq(opportunities.id, input.opportunityId), eq(opportunities.organizationId, input.organizationId))).limit(1);
    if (!valid.length) return null;
    await this.db.insert(opportunityConversations).values({ id: randomUUID(), ...input }).onConflictDoNothing({ target: [opportunityConversations.opportunityId, opportunityConversations.conversationId] });
    return { opportunityId: input.opportunityId, conversationId: input.conversationId };
  }

  async upsertSyncedContact(input: { organizationId: string; channelConnectionId?: string; externalId: string; name: string; email: string; phone: string; ownerId: string }) {
    const scopedExternalId = input.channelConnectionId ? `${input.channelConnectionId}:${input.externalId}` : input.externalId; const existing = (await this.db.select().from(contacts).where(and(eq(contacts.organizationId, input.organizationId), or(eq(contacts.externalId, scopedExternalId), eq(contacts.externalId, input.externalId)))).limit(1))[0];
    if (existing) { const updated = await this.db.update(contacts).set({ name: input.name || "Contato Chatwoot", email: input.email, phone: input.phone, updatedAt: new Date() }).where(and(eq(contacts.organizationId, input.organizationId), eq(contacts.id, existing.id))).returning(); return updated[0]; }
    const row = await this.db.insert(contacts).values({ id: `contact-${input.organizationId}-${scopedExternalId}`, organizationId: input.organizationId, externalId: scopedExternalId, name: input.name || "Contato Chatwoot", company: "", phone: input.phone, email: input.email, ownerId: input.ownerId, notes: "Importado do Chatwoot", lastConversationAt: new Date() }).returning();
    return row[0];
  }
  async upsertExternalContactIdentity(input: { organizationId: string; contactId: string; channelConnectionId: string; channelType: ChannelType; providerType: ProviderType; externalContactId: string; address?: string; username?: string; phone?: string; email?: string }): Promise<ContactIdentity> {
    const row = await this.db.insert(contactIdentities).values({ id: `identity-${input.organizationId}-${input.channelConnectionId}-${input.externalContactId}`, organizationId: input.organizationId, contactId: input.contactId, channelConnectionId: input.channelConnectionId, channelType: input.channelType, providerType: input.providerType, externalContactId: input.externalContactId, address: input.address ?? null, username: input.username ?? null, phone: input.phone ?? null, email: input.email ?? null }).onConflictDoUpdate({ target: [contactIdentities.organizationId, contactIdentities.channelConnectionId, contactIdentities.externalContactId], set: { contactId: input.contactId, channelType: input.channelType, providerType: input.providerType, address: input.address ?? null, username: input.username ?? null, phone: input.phone ?? null, email: input.email ?? null, updatedAt: new Date() } }).returning();
    const saved = row[0]; return { id: saved.id, organizationId: saved.organizationId, contactId: saved.contactId, channelConnectionId: saved.channelConnectionId, channelType: saved.channelType as ChannelType, providerType: saved.providerType as ProviderType, externalContactId: saved.externalContactId, address: saved.address ?? undefined, username: saved.username ?? undefined, phone: saved.phone ?? undefined, email: saved.email ?? undefined };
  }
  async listContactIdentities(organizationId: string, contactId: string): Promise<ContactIdentity[]> { const rows = await this.db.select().from(contactIdentities).where(and(eq(contactIdentities.organizationId, organizationId), eq(contactIdentities.contactId, contactId))); return rows.map((row) => ({ id: row.id, organizationId: row.organizationId, contactId: row.contactId, channelConnectionId: row.channelConnectionId, channelType: row.channelType as ChannelType, providerType: row.providerType as ProviderType, externalContactId: row.externalContactId, address: row.address ?? undefined, username: row.username ?? undefined, phone: row.phone ?? undefined, email: row.email ?? undefined })); }
  async upsertSyncedChannel(input: { organizationId: string; integrationAccountId: string; externalId: string; name: string; type: ChannelType; providerType: ProviderType }) {
    const row = await this.db.insert(channels).values({ id: `channel-${input.organizationId}-${input.integrationAccountId}-${input.externalId}`, organizationId: input.organizationId, integrationAccountId: input.integrationAccountId, externalId: input.externalId, name: input.name, type: input.type, providerType: input.providerType, status: "CONNECTED", conversations: 0 }).onConflictDoUpdate({ target: [channels.organizationId, channels.integrationAccountId, channels.externalId], set: { integrationAccountId: input.integrationAccountId, name: input.name, type: input.type, providerType: input.providerType, status: "CONNECTED", updatedAt: new Date() } }).returning();
    return row[0];
  }
  async upsertSyncedConversation(input: { organizationId: string; channelConnectionId: string; channelType: ChannelType; providerType: ProviderType; externalId: string; contactId: string; channelId: string; status: string; assignedToId?: string; lastMessage: string; lastMessageAt: Date }) {
    const existing = (await this.db.select().from(conversations).where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.channelConnectionId, input.channelConnectionId), eq(conversations.externalId, input.externalId))).limit(1))[0];
    if (existing) { await this.db.update(conversations).set({ channelConnectionId: input.channelConnectionId, channelType: input.channelType, providerType: input.providerType, contactId: input.contactId, channelId: input.channelId, status: input.status, assignedToId: input.assignedToId ?? null, lastMessage: input.lastMessage, lastMessageAt: input.lastMessageAt, updatedAt: new Date() }).where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.id, existing.id))); return existing.id; }
    const row = await this.db.insert(conversations).values({ id: `conversation-${input.organizationId}-${input.channelConnectionId}-${input.externalId}`, organizationId: input.organizationId, externalId: input.externalId, channelConnectionId: input.channelConnectionId, channelType: input.channelType, providerType: input.providerType, contactId: input.contactId, channelId: input.channelId, status: input.status, assignedToId: input.assignedToId ?? null, unread: 0, lastMessage: input.lastMessage, lastMessageAt: input.lastMessageAt }).returning({ id: conversations.id });
    return row[0].id;
  }
  async upsertSyncedMessage(input: { organizationId: string; conversationId: string; channelConnectionId: string; channelType: ChannelType; providerType: ProviderType; externalId?: string; sender: "CONTACT" | "AGENT" | "SYSTEM"; authorName: string; body: string; createdAt: Date; internal?: boolean; messageType?: MessageType; deliveryStatus?: DeliveryStatus }) {
    const direction = input.sender === "AGENT" ? "OUTBOUND" : "INBOUND"; const values = { id: `message-${input.organizationId}-${input.channelConnectionId}-${input.externalId ?? randomUUID()}`, organizationId: input.organizationId, conversationId: input.conversationId, channelConnectionId: input.channelConnectionId, channelType: input.channelType, providerType: input.providerType, externalId: input.externalId ?? null, direction, senderIdentity: null, recipientIdentity: null, sender: input.sender, authorName: input.authorName, body: input.body, messageType: input.messageType ?? "TEXT", deliveryStatus: input.deliveryStatus ?? (direction === "OUTBOUND" ? "SENT" : "DELIVERED"), providerCreatedAt: input.createdAt, internal: input.internal ?? false, createdAt: input.createdAt };
    if (input.externalId) { const row = await this.db.insert(messages).values(values).onConflictDoUpdate({ target: [messages.organizationId, messages.channelConnectionId, messages.externalId], set: { body: input.body, authorName: input.authorName, sender: input.sender, direction, messageType: input.messageType ?? "TEXT", deliveryStatus: input.deliveryStatus ?? (direction === "OUTBOUND" ? "SENT" : "DELIVERED"), createdAt: input.createdAt, providerCreatedAt: input.createdAt, internal: input.internal ?? false } }).returning(); return row[0]; }
    const row = await this.db.insert(messages).values(values).returning(); return row[0];
  }

  async listIntegrations(organizationId: string) { return (await this.db.select().from(integrationAccounts).where(eq(integrationAccounts.organizationId, organizationId)).orderBy(integrationAccounts.createdAt)).map(toIntegration); }
  async getIntegration(organizationId: string, id: string) { const row = (await this.db.select().from(integrationAccounts).where(and(eq(integrationAccounts.organizationId, organizationId), eq(integrationAccounts.id, id))).limit(1))[0]; return row ? toIntegration(row) : null; }
  async saveIntegration(input: { id: string; organizationId: string; provider: string; providerType: ProviderType; channelType: ChannelType; providerInboxId?: string | null; displayName: string; externalAccountId: string; baseUrl: string; credentialCiphertext: string; credentialIv: string; credentialTag: string; credentialVersion: number; webhookSecretCiphertext?: string | null; webhookSecretIv?: string | null; webhookSecretTag?: string | null; webhookSecretVersion?: number | null }) {
    const row = await this.db.insert(integrationAccounts).values({ ...input, providerInboxId: input.providerInboxId ?? null, status: "CONFIGURED", metadata: {} }).onConflictDoUpdate({ target: integrationAccounts.id, set: { providerType: input.providerType, channelType: input.channelType, providerInboxId: input.providerInboxId ?? null, displayName: input.displayName, externalAccountId: input.externalAccountId, baseUrl: input.baseUrl, credentialCiphertext: input.credentialCiphertext, credentialIv: input.credentialIv, credentialTag: input.credentialTag, credentialVersion: input.credentialVersion, webhookSecretCiphertext: input.webhookSecretCiphertext ?? null, webhookSecretIv: input.webhookSecretIv ?? null, webhookSecretTag: input.webhookSecretTag ?? null, webhookSecretVersion: input.webhookSecretVersion ?? null, status: "CONFIGURED", lastErrorCode: null, lastErrorAt: null, updatedAt: new Date() } }).returning();
    return toIntegration(row[0]);
  }
  async updateIntegration(organizationId: string, id: string, input: Record<string, unknown>) { await this.db.update(integrationAccounts).set(input).where(and(eq(integrationAccounts.organizationId, organizationId), eq(integrationAccounts.id, id))); return this.getIntegration(organizationId, id); }
  async deleteIntegration(organizationId: string, id: string) { await this.db.delete(integrationAccounts).where(and(eq(integrationAccounts.organizationId, organizationId), eq(integrationAccounts.id, id))); }

  async createInvite(input: { id: string; organizationId: string; email: string; role: Role; tokenHash: string; expiresAt: Date; createdBy: string }) { const row = await this.db.insert(organizationInvites).values(input).returning(); return row[0]; }
  async listInvites(organizationId: string) { return this.db.select().from(organizationInvites).where(eq(organizationInvites.organizationId, organizationId)).orderBy(desc(organizationInvites.createdAt)); }
  async findInviteByHash(tokenHash: string) { return (await this.db.select().from(organizationInvites).where(eq(organizationInvites.tokenHash, tokenHash)).limit(1))[0] ?? null; }
  async revokeInvite(organizationId: string, id: string) { await this.db.update(organizationInvites).set({ revokedAt: new Date() }).where(and(eq(organizationInvites.organizationId, organizationId), eq(organizationInvites.id, id), isNull(organizationInvites.acceptedAt))); }
  async acceptInviteAtomic(input: { tokenHash: string; name: string; passwordHash?: string; existingUserId?: string; session: { id: string; tokenHash: string; expiresAt: Date } }) {
    return this.db.transaction(async (tx) => {
      const invite = (await tx.select().from(organizationInvites).where(and(eq(organizationInvites.tokenHash, input.tokenHash), isNull(organizationInvites.acceptedAt), isNull(organizationInvites.revokedAt), gt(organizationInvites.expiresAt, new Date()))).limit(1))[0];
      if (!invite) return null;
      let user = input.existingUserId ? (await tx.select().from(users).where(eq(users.id, input.existingUserId)).limit(1))[0] : (await tx.select().from(users).where(eq(users.email, invite.email)).limit(1))[0];
      if (!user) {
        if (!input.passwordHash) throw new Error("Senha necessária");
        const userId = randomUUID(); await tx.insert(users).values({ id: userId, email: invite.email, name: input.name, passwordHash: input.passwordHash, avatar: input.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AG" });
        user = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0];
      }
      await tx.insert(organizationMembers).values({ id: randomUUID(), organizationId: invite.organizationId, userId: user.id, role: invite.role, status: "ACTIVE" }).onConflictDoUpdate({ target: [organizationMembers.organizationId, organizationMembers.userId], set: { role: invite.role, status: "ACTIVE", updatedAt: new Date() } });
      await tx.update(organizationInvites).set({ acceptedAt: new Date() }).where(eq(organizationInvites.id, invite.id));
      await tx.insert(authSessions).values({ id: input.session.id, userId: user.id, organizationId: invite.organizationId, tokenHash: input.session.tokenHash, expiresAt: input.session.expiresAt });
      return { invite, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar }, organizationId: invite.organizationId };
    });
  }

  async findIntegration(provider: string, externalAccountId: string): Promise<IntegrationRecord | null> {
    const row = (await this.db.select().from(integrationAccounts).where(and(eq(integrationAccounts.provider, provider), eq(integrationAccounts.externalAccountId, externalAccountId), inArray(integrationAccounts.status, ["ACTIVE", "CONNECTED"]))).limit(1))[0];
    return row ? toIntegration(row) : null;
  }
  async findIntegrationByExternalAccountId(externalAccountId: string) { const row = (await this.db.select().from(integrationAccounts).where(and(eq(integrationAccounts.provider, "chatwoot"), eq(integrationAccounts.externalAccountId, externalAccountId), inArray(integrationAccounts.status, ["ACTIVE", "CONNECTED"]))).limit(1))[0]; return row ? toIntegration(row) : null; }

  async claimWebhookEvent(input: { organizationId: string; integrationAccountId: string; provider: string; externalEventId: string; payloadHash: string }): Promise<boolean> {
    const inserted = await this.db.insert(webhookEvents).values({ id: randomUUID(), ...input }).onConflictDoNothing({ target: [webhookEvents.integrationAccountId, webhookEvents.externalEventId] }).returning({ id: webhookEvents.id });
    return inserted.length === 1;
  }

  async completeWebhookEvent(integrationAccountId: string, externalEventId: string): Promise<void> { await this.db.update(webhookEvents).set({ processedAt: new Date() }).where(and(eq(webhookEvents.integrationAccountId, integrationAccountId), eq(webhookEvents.externalEventId, externalEventId))); }
  async releaseWebhookEvent(organizationId: string, integrationAccountId: string, externalEventId: string): Promise<void> { await this.db.delete(webhookEvents).where(and(eq(webhookEvents.organizationId, organizationId), eq(webhookEvents.integrationAccountId, integrationAccountId), eq(webhookEvents.externalEventId, externalEventId), isNull(webhookEvents.processedAt))); }

  async findConversationByExternalId(organizationId: string, externalId: string, channelConnectionId?: string) { return (await this.db.select().from(conversations).where(and(eq(conversations.organizationId, organizationId), ...(channelConnectionId ? [eq(conversations.channelConnectionId, channelConnectionId)] : []), eq(conversations.externalId, externalId))).limit(1))[0] ?? null; }
  async findMessageByExternalId(organizationId: string, externalId: string, channelConnectionId?: string) { return (await this.db.select().from(messages).where(and(eq(messages.organizationId, organizationId), ...(channelConnectionId ? [eq(messages.channelConnectionId, channelConnectionId)] : []), eq(messages.externalId, externalId))).limit(1))[0] ?? null; }
  async insertInboundMessage(input: { organizationId: string; conversationId: string; channelConnectionId?: string; channelType?: ChannelType; providerType?: ProviderType; externalId?: string; body: string; authorName: string; createdAt: Date; messageType?: MessageType; deliveryStatus?: DeliveryStatus }) {
    return this.db.transaction(async (tx) => {
      if (input.externalId) { const existing = await tx.select().from(messages).where(and(eq(messages.organizationId, input.organizationId), ...(input.channelConnectionId ? [eq(messages.channelConnectionId, input.channelConnectionId)] : []), eq(messages.externalId, input.externalId))).limit(1); if (existing.length) return toMessage(existing[0]); }
      const row = { id: randomUUID(), organizationId: input.organizationId, conversationId: input.conversationId, channelConnectionId: input.channelConnectionId ?? null, channelType: input.channelType ?? null, providerType: input.providerType ?? null, externalId: input.externalId ?? null, direction: "INBOUND", senderIdentity: null, recipientIdentity: null, sender: "CONTACT", authorName: input.authorName, body: input.body, messageType: input.messageType ?? "TEXT", deliveryStatus: input.deliveryStatus ?? "DELIVERED", providerCreatedAt: input.createdAt, internal: false, createdAt: input.createdAt };
      await tx.insert(messages).values(row);
      await tx.update(conversations).set({ lastMessage: input.body, lastMessageAt: input.createdAt, updatedAt: new Date() }).where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.id, input.conversationId)));
      return toMessage(row);
    });
  }
}
