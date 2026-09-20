import { createHash } from "node:crypto";
import { assignConversationSchema, createOpportunitySchema, moveOpportunitySchema, sendMessageSchema, updateConversationStatusSchema, type OpportunityStage, type Role, type SessionUser } from "@echat/shared";
import type { MessagingProvider, NormalizedWebhookEvent } from "@echat/shared";
import { Repositories } from "./repositories.js";

export class DomainError extends Error { constructor(public readonly status: number, message: string) { super(message); } }
const canManageCrm = (role: Role) => role === "OWNER" || role === "ADMIN" || role === "AGENT";

export class DomainServices {
  constructor(private readonly repositories: Repositories, private readonly provider: MessagingProvider) {}

  async bootstrap(user: SessionUser) {
    const [organization, users, contacts, channels, conversations, stages, opportunities] = await Promise.all([
      this.repositories.getOrganization(user.organizationId), this.repositories.listUsers(user.organizationId), this.repositories.listContacts(user.organizationId), this.repositories.listChannels(user.organizationId), this.repositories.listConversations(user.organizationId), this.repositories.listStages(user.organizationId), this.repositories.listOpportunities(user.organizationId),
    ]);
    return { organization, user, users, contacts, channels, conversations, stages, opportunities };
  }

  listContacts(user: SessionUser) { return this.repositories.listContacts(user.organizationId); }
  listConversations(user: SessionUser) { return this.repositories.listConversations(user.organizationId); }
  listOpportunities(user: SessionUser) { return this.repositories.listOpportunities(user.organizationId); }
  getConversation(user: SessionUser, id: string) { return this.repositories.getConversation(user.organizationId, id).then((value) => { if (!value) throw new DomainError(404, "Conversa não encontrada"); return value; }); }

  async assignConversation(user: SessionUser, id: string, input: unknown) {
    const payload = assignConversationSchema.parse(input); const conversation = await this.repositories.getConversationRow(user.organizationId, id); if (!conversation) throw new DomainError(404, "Conversa não encontrada");
    if (payload.assignedToId) {
      const target = await this.repositories.findMember(user.organizationId, payload.assignedToId); if (!target) throw new DomainError(404, "Atendente não encontrado");
      const targetRole = target.member.role as Role; if (user.role === "AGENT" && targetRole !== "AGENT" && payload.assignedToId !== user.id) throw new DomainError(403, "Agente não pode gerenciar Owner ou Admin");
    }
    const result = await this.repositories.updateConversationAssignment(user.organizationId, id, payload.assignedToId ?? null); if (!result) throw new DomainError(404, "Conversa não encontrada"); return result.conversation;
  }

  async updateConversationStatus(user: SessionUser, id: string, input: unknown) {
    const payload = updateConversationStatusSchema.parse(input); const result = await this.repositories.updateConversationStatus(user.organizationId, id, payload.status); if (!result) throw new DomainError(404, "Conversa não encontrada"); return result.conversation;
  }

  async sendMessage(user: SessionUser, conversationId: string, input: unknown) {
    const payload = sendMessageSchema.parse(input); const conversation = await this.repositories.getConversationRow(user.organizationId, conversationId); if (!conversation) throw new DomainError(404, "Conversa não encontrada");
    let external: Awaited<ReturnType<MessagingProvider["sendMessage"]>>;
    try { external = await this.provider.sendMessage({ conversationId, externalConversationId: conversation.externalId ?? undefined, body: payload.body, internal: payload.internal }); } catch (error) { throw new DomainError(502, error instanceof Error ? error.message : "Falha no provider de mensagens"); }
    return this.repositories.insertOutgoingMessage({ organizationId: user.organizationId, conversationId, externalId: external.externalId, body: external.body, authorName: user.name, createdAt: new Date(external.createdAt), internal: payload.internal });
  }

  async createOpportunity(user: SessionUser, input: unknown) {
    if (!canManageCrm(user.role)) throw new DomainError(403, "Sem permissão para criar oportunidade");
    const payload = createOpportunitySchema.parse(input); const result = await this.repositories.createOpportunity({ organizationId: user.organizationId, actorId: user.id, title: payload.title, contactId: payload.contactId, value: payload.value, stageKey: payload.stage }); if (!result) throw new DomainError(422, "Contato ou etapa inválida para esta organização"); return result;
  }

  async moveOpportunity(user: SessionUser, id: string, input: unknown) {
    if (!canManageCrm(user.role)) throw new DomainError(403, "Sem permissão para mover oportunidade");
    const payload = moveOpportunitySchema.parse(input); const result = await this.repositories.moveOpportunity({ organizationId: user.organizationId, actorId: user.id, opportunityId: id, stageKey: payload.stage }); if (result === null) throw new DomainError(404, "Oportunidade não encontrada"); if (result === undefined) throw new DomainError(422, "Etapa inválida para esta organização"); return result;
  }

  async processWebhook(input: { integrationAccountId: string; organizationId: string; provider: string; eventId: string; rawBody: string; payload: unknown }): Promise<{ processed: boolean; duplicate: boolean }> {
    if (!input.eventId) throw new DomainError(400, "Evento sem idempotency key");
    const events = this.provider.normalizeWebhook?.(input.payload); if (!events) throw new DomainError(422, "Provider não suporta webhook");
    const claimed = await this.repositories.claimWebhookEvent({ organizationId: input.organizationId, integrationAccountId: input.integrationAccountId, provider: input.provider, externalEventId: input.eventId, payloadHash: createHash("sha256").update(input.rawBody).digest("hex") });
    if (!claimed) return { processed: false, duplicate: true };
    try {
      for (const event of events) await this.persistWebhookEvent(input.organizationId, event);
      await this.repositories.completeWebhookEvent(input.integrationAccountId, input.eventId);
      return { processed: true, duplicate: false };
    } catch (error) { throw error instanceof DomainError ? error : new DomainError(422, "Evento Chatwoot inválido"); }
  }

  private async persistWebhookEvent(organizationId: string, event: NormalizedWebhookEvent) {
    const conversation = await this.repositories.findConversationByExternalId(organizationId, event.externalConversationId); if (!conversation) throw new DomainError(404, "Conversa externa não encontrada");
    if (event.externalMessageId && await this.repositories.findMessageByExternalId(organizationId, event.externalMessageId)) return;
    if (event.sender === "CONTACT") await this.repositories.insertInboundMessage({ organizationId, conversationId: conversation.id, externalId: event.externalMessageId, body: event.body, authorName: event.authorName, createdAt: new Date(event.createdAt) });
  }
}
