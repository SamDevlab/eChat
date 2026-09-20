import { randomUUID } from "node:crypto";
import type { Contact, Conversation, DemoState, Message, Opportunity, OpportunityStage, Role, SessionUser } from "@echat/shared";
import { createOpportunitySchema, moveOpportunitySchema, sendMessageSchema } from "@echat/shared";
import { createMessagingProvider } from "./providers.js";

export class DomainError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export interface Store {
  state: DemoState;
  processedWebhookIds: Set<string>;
}

export const createStore = (state: DemoState): Store => ({ state, processedWebhookIds: new Set() });
const orgFilter = <T extends { organizationId: string }>(user: SessionUser, items: T[]) => items.filter((item) => item.organizationId === user.organizationId);
const byId = <T extends { id: string }>(items: T[], id: string) => items.find((item) => item.id === id);

export const listContacts = (store: Store, user: SessionUser): Contact[] => orgFilter(user, store.state.contacts);
export const listConversations = (store: Store, user: SessionUser): Conversation[] => orgFilter(user, store.state.conversations);
export const listOpportunities = (store: Store, user: SessionUser): Opportunity[] => orgFilter(user, store.state.opportunities);

const requireOrgRecord = <T extends { id: string; organizationId: string }>(user: SessionUser, items: T[], id: string, label: string): T => {
  const item = byId(items, id);
  if (!item || item.organizationId !== user.organizationId) throw new DomainError(404, `${label} não encontrado`);
  return item;
};

export const getConversation = (store: Store, user: SessionUser, id: string) => {
  const conversation = requireOrgRecord(user, store.state.conversations, id, "Conversa");
  const contact = requireOrgRecord(user, store.state.contacts, conversation.contactId, "Contato");
  return { conversation, contact, channel: store.state.channels.find((channel) => channel.id === conversation.channelId) };
};

export const assignConversation = (store: Store, user: SessionUser, id: string, assignedToId: string | undefined) => {
  const conversation = requireOrgRecord(user, store.state.conversations, id, "Conversa");
  if (assignedToId) {
    const target = requireOrgRecord(user, store.state.users, assignedToId, "Atendente");
    if (user.role === "AGENT" && target.role !== "AGENT" && target.id !== user.id) throw new DomainError(403, "Agente não pode gerenciar Owner ou Admin");
  }
  conversation.assignedToId = assignedToId;
  return conversation;
};

export const sendMessage = async (store: Store, user: SessionUser, conversationId: string, input: unknown) => {
  const payload = sendMessageSchema.parse(input);
  const conversation = requireOrgRecord(user, store.state.conversations, conversationId, "Conversa");
  const message = await createMessagingProvider().sendMessage({ conversationId, body: payload.body, internal: payload.internal });
  conversation.messages.push({ ...message, authorName: user.name, sender: "AGENT" });
  conversation.lastMessage = payload.body;
  conversation.lastMessageAt = message.createdAt;
  return message;
};

const canManageCrm = (role: Role) => role === "OWNER" || role === "ADMIN" || role === "AGENT";
export const createOpportunity = (store: Store, user: SessionUser, input: unknown) => {
  if (!canManageCrm(user.role)) throw new DomainError(403, "Sem permissão para criar oportunidade");
  const payload = createOpportunitySchema.parse(input);
  const contact = requireOrgRecord(user, store.state.contacts, payload.contactId, "Contato");
  const opportunity: Opportunity = { id: randomUUID(), organizationId: user.organizationId, title: payload.title, contactId: contact.id, company: contact.company, value: payload.value, stage: payload.stage, ownerId: user.id, source: "Inbox", lastActivity: "agora", note: "Criada a partir do fluxo comercial." };
  store.state.opportunities.push(opportunity);
  contact.opportunities += 1;
  return opportunity;
};

export const moveOpportunity = (store: Store, user: SessionUser, id: string, input: unknown) => {
  if (!canManageCrm(user.role)) throw new DomainError(403, "Sem permissão para mover oportunidade");
  const payload = moveOpportunitySchema.parse(input);
  const opportunity = requireOrgRecord(user, store.state.opportunities, id, "Oportunidade");
  const stage = store.state.stages.find((item) => item.organizationId === user.organizationId && item.key === payload.stage);
  if (!stage) throw new DomainError(422, "Etapa inválida para esta organização");
  opportunity.stage = payload.stage;
  opportunity.lastActivity = "agora";
  return opportunity;
};

export const processWebhook = (store: Store, user: SessionUser, eventId: string, payload: unknown) => {
  if (!eventId) throw new DomainError(400, "Evento sem idempotency key");
  if (store.processedWebhookIds.has(eventId)) return { processed: false, duplicate: true };
  const body = payload as { event?: string; conversation_id?: number | string; conversation?: { id?: number | string }; content?: string; message?: { content?: string } };
  const conversationId = String(body.conversation?.id ?? body.conversation_id ?? "");
  const content = body.content ?? body.message?.content;
  if (body.event === "message_created" && conversationId && content) {
    const conversation = requireOrgRecord(user, store.state.conversations, conversationId, "Conversa");
    const normalized: Message = { id: `webhook-${eventId}`, conversationId: conversation.id, sender: "CONTACT", authorName: "Chatwoot", body: content, createdAt: new Date().toISOString() };
    conversation.messages.push(normalized);
    conversation.lastMessage = normalized.body;
    conversation.lastMessageAt = normalized.createdAt;
  }
  store.processedWebhookIds.add(eventId);
  return { processed: true, duplicate: false };
};
