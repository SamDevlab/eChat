import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ChannelType, Contact, Conversation, Message, MessageType, MessagingProvider, NormalizedOutgoingMessage, NormalizedWebhookEvent, ProviderCapabilities, ProviderContext, ProviderType, SupportedChannelType } from "@echat/shared";

export type ProviderErrorCode = "AUTHENTICATION_ERROR" | "FORBIDDEN" | "RATE_LIMITED" | "TIMEOUT" | "PROVIDER_UNAVAILABLE" | "INVALID_RESPONSE" | "UNSUPPORTED_CHANNEL" | "CONFIGURATION_ERROR" | "PROVIDER_ERROR";
export class ProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly status?: number) { super(message); this.name = "ProviderError"; }
}
export type ChatwootProviderConfig = { baseUrl: string; token: string; accountId: string; inboxId?: string; channelType?: ChannelType; webhookSecret?: string };
export type SyncContact = { externalId: string; name: string; email: string; phone: string; company: string; address?: string; username?: string };
export type SyncConversation = { externalId: string; contactExternalId: string; channelExternalId: string; channelName: string; channelType: SupportedChannelType; status: "OPEN" | "WAITING" | "RESOLVED"; assignedToExternalId?: string; lastMessage: string; lastMessageAt: string; messages: SyncMessage[] };
export type SyncMessage = { externalId?: string; sender: "CONTACT" | "AGENT" | "SYSTEM"; authorName: string; body: string; createdAt: string; internal?: boolean; messageType?: MessageType; deliveryStatus?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" };
export interface IntegrationMessagingProvider extends MessagingProvider {
  testConnection(): Promise<{ accountId: string; name?: string }>;
  listInboxes?(): Promise<Array<{ id: string; name: string; channelType?: string }>>;
  listContacts(page: number): Promise<{ items: SyncContact[]; hasNextPage: boolean }>;
  listConversations(page: number): Promise<{ items: SyncConversation[]; hasNextPage: boolean }>;
  listConversationsWithMessages?(page: number): Promise<{ items: SyncConversation[]; hasNextPage: boolean }>;
  listWebhooks?(): Promise<Array<{ id: string; url: string; secret?: string; subscriptions: string[] }>>;
  registerWebhook?(url: string): Promise<{ id: string; secret?: string }>;
}

const messageResponseSchema = z.object({ id: z.union([z.string(), z.number()]), content: z.string(), created_at: z.union([z.string(), z.number()]).optional(), message_type: z.union([z.string(), z.number()]).optional() });
const accountResponseSchema = z.object({ id: z.union([z.string(), z.number()]), name: z.string().optional() });
const webhookIdentitySchema = z.object({ id: z.union([z.string(), z.number()]).nullish(), name: z.string().nullish(), email: z.string().nullish(), phone_number: z.string().nullish() }).nullish();
const webhookInboxSchema = z.object({ id: z.union([z.string(), z.number()]).nullish(), name: z.string().nullish(), channel_type: z.string().nullish() }).nullish();
const webhookSchema = z.object({
  event: z.string(), id: z.union([z.string(), z.number()]).optional(), account: z.object({ id: z.union([z.string(), z.number()]) }).optional(), account_id: z.union([z.string(), z.number()]).optional(),
  conversation: z.object({ id: z.union([z.string(), z.number()]), inbox_id: z.union([z.string(), z.number()]).nullish(), status: z.string().nullish(), channel: z.string().nullish(), contact: webhookIdentitySchema, inbox: webhookInboxSchema, meta: z.object({ sender: webhookIdentitySchema, channel: z.string().nullish() }).nullish() }).nullish(),
  conversation_id: z.union([z.string(), z.number()]).optional(), inbox: webhookInboxSchema,
  message: z.object({ id: z.union([z.string(), z.number()]).optional(), content: z.string().optional(), message_type: z.union([z.string(), z.number()]).optional(), created_at: z.union([z.string(), z.number()]).optional(), private: z.boolean().optional(), sender: webhookIdentitySchema }).optional(),
  content: z.string().nullish(), message_type: z.union([z.string(), z.number()]).nullish(), created_at: z.union([z.string(), z.number()]).nullish(), private: z.boolean().nullish(), sender: webhookIdentitySchema,
});
const messageSchema = z.object({ organizationId: z.string().optional(), id: z.string(), externalId: z.string().optional(), conversationId: z.string(), sender: z.enum(["CONTACT", "AGENT", "SYSTEM"]), authorName: z.string(), body: z.string(), createdAt: z.string(), internal: z.boolean().optional() });
const conversationSchema = z.object({ id: z.string(), organizationId: z.string(), contactId: z.string(), channelId: z.string(), externalId: z.string().optional(), status: z.enum(["OPEN", "WAITING", "RESOLVED"]), assignedToId: z.string().optional(), unread: z.number(), lastMessage: z.string(), lastMessageAt: z.string(), messages: z.array(messageSchema) });
const contactSchema = z.object({ id: z.string(), organizationId: z.string(), name: z.string(), company: z.string(), phone: z.string(), email: z.string(), tags: z.array(z.string()), ownerId: z.string(), lastConversationAt: z.string(), opportunities: z.number(), notes: z.string(), identities: z.array(z.object({ channelType: z.enum(["WHATSAPP", "WEBCHAT", "EMAIL", "INSTAGRAM", "UNKNOWN"]), phone: z.string().optional(), email: z.string().optional(), username: z.string().optional() })).default([]) });

const isoFromExternal = (value: string | number | undefined): string => { if (value === undefined) return new Date().toISOString(); const numeric = typeof value === "number" || /^\d+$/.test(value) ? Number(value) : NaN; return Number.isFinite(numeric) ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString() : new Date(value).toISOString(); };
const normalizeExternal = (input: unknown): string => { if (typeof input === "string" || typeof input === "number") return String(input); throw new Error("Identificador externo inválido"); };
const isOutgoingMessage = (value: unknown): boolean => value === "outgoing" || value === 1 || value === "1";

export class MockMessagingProvider implements MessagingProvider {
  readonly name = "mock";
  readonly providerType: ProviderType = "MOCK";
  capabilities(_context: ProviderContext): ProviderCapabilities { return { SEND_TEXT: true, SEND_MEDIA: false, RECEIVE_MEDIA: false, DELIVERY_STATUS: false, READ_STATUS: false, THREADING: true, TEMPLATES: false }; }
  async sendMessage(input: { conversationId: string; body: string; internal?: boolean }): Promise<NormalizedOutgoingMessage> { return { body: input.body, createdAt: new Date().toISOString(), sender: "AGENT", authorName: "", internal: input.internal }; }
  normalizeConversation(input: unknown): Conversation { return conversationSchema.parse(input); }
  normalizeMessage(input: unknown): Message { return messageSchema.parse(input); }
  normalizeContact(input: unknown): Contact { return contactSchema.parse(input); }
  verifyWebhook(): boolean { return true; }
  normalizeWebhook(input: unknown): NormalizedWebhookEvent[] {
    const parsed = webhookSchema.parse(input); if (parsed.event !== "message_created") return [];
    const externalAccountId = normalizeExternal(parsed.account?.id ?? parsed.account_id ?? "mock"); const externalConversationId = normalizeExternal(parsed.conversation?.id ?? parsed.conversation_id ?? "");
    const body = parsed.content ?? parsed.message?.content ?? ""; if (!externalConversationId || !body) return [];
    const messageType = String(parsed.message?.message_type ?? "incoming");
    return [{ externalEventId: normalizeExternal(parsed.id ?? `${externalConversationId}:${body}`), externalAccountId, externalConversationId, externalMessageId: parsed.message?.id === undefined ? undefined : normalizeExternal(parsed.message.id), providerType: "MOCK", messageType: "TEXT", direction: messageType === "outgoing" ? "OUTBOUND" : "INBOUND", body, createdAt: new Date().toISOString(), sender: messageType === "outgoing" ? "AGENT" : "CONTACT", authorName: parsed.message?.sender?.name ?? parsed.sender?.name ?? parsed.conversation?.contact?.name ?? "Chatwoot" }];
  }
}

export class ChatwootProvider implements MessagingProvider {
  readonly name = "chatwoot";
  readonly providerType: ProviderType = "CHATWOOT";
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly accountId: string;
  private readonly inboxId?: string;
  private readonly channelTypeHint?: ChannelType;
  private readonly webhookSecret?: string;
  constructor(config: ChatwootProviderConfig = { baseUrl: process.env.CHATWOOT_BASE_URL ?? "", token: process.env.CHATWOOT_API_TOKEN ?? "", accountId: process.env.CHATWOOT_ACCOUNT_ID ?? "", webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET }) { this.baseUrl = config.baseUrl.replace(/\/$/, ""); this.token = config.token; this.accountId = config.accountId; this.inboxId = config.inboxId; this.channelTypeHint = config.channelType; this.webhookSecret = config.webhookSecret; }
  capabilities(_context: ProviderContext): ProviderCapabilities { return { SEND_TEXT: true, SEND_MEDIA: false, RECEIVE_MEDIA: false, DELIVERY_STATUS: false, READ_STATUS: false, THREADING: true, TEMPLATES: false }; }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    if (!this.baseUrl || !this.token || !this.accountId) throw new ProviderError("CONFIGURATION_ERROR", "Chatwoot não configurado");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", api_access_token: this.token, ...(init.headers ?? {}) }, signal: controller.signal });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        const code: ProviderErrorCode = response.status === 401 ? "AUTHENTICATION_ERROR" : response.status === 403 ? "FORBIDDEN" : response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR";
        throw new ProviderError(code, `Chatwoot respondeu HTTP ${response.status}`, response.status);
      }
      return body;
    } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new ProviderError("TIMEOUT", "Timeout ao consultar Chatwoot"); throw error; } finally { clearTimeout(timeout); }
  }

  async testConnection() { try { const account = accountResponseSchema.parse(await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}`)); return { accountId: normalizeExternal(account.id), name: account.name }; } catch (error) { if (error instanceof ProviderError) throw error; throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); } }

  async listContacts(page: number) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/contacts?page=${page}`); if (!Array.isArray(body?.payload)) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); const payload = body.payload; return { items: payload.map((item: any) => ({ externalId: String(item.id ?? item.identifier), name: String(item.name ?? "Contato Chatwoot"), email: String(item.email ?? ""), phone: String(item.phone_number ?? ""), company: String(item.company?.name ?? ""), address: typeof item.identifier === "string" ? item.identifier : undefined })), hasNextPage: Number(body?.meta?.current_page ?? page) < Math.ceil(Number(body?.meta?.count ?? payload.length) / 15) }; }

  async listInboxes() { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/inboxes`); if (!Array.isArray(body?.payload)) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); return body.payload.map((item: any) => ({ id: String(item.id), name: String(item.name ?? "Inbox Chatwoot"), channelType: typeof item.channel_type === "string" ? item.channel_type : undefined })); }

  async listConversations(page: number) { const inboxFilter = this.inboxId ? `&inbox_id=${encodeURIComponent(this.inboxId)}` : ""; const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations?status=all&page=${page}${inboxFilter}`); const payload = Array.isArray(body?.data?.payload) ? body.data.payload : Array.isArray(body?.payload) ? body.payload : undefined; if (!payload) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); return { items: payload.map((item: any) => ({ externalId: String(item.id), contactExternalId: String(item.meta?.sender?.id ?? item.contact?.id ?? item.meta?.sender?.identifier ?? `conversation-${item.id}`), channelExternalId: String(item.inbox_id ?? item.meta?.channel ?? "chatwoot"), channelName: String(item.inbox?.name ?? item.meta?.channel ?? "Chatwoot"), channelType: this.channelType(item.meta?.channel ?? item.inbox?.channel_type), status: this.conversationStatus(item.status), assignedToExternalId: item.assignee?.id ? String(item.assignee.id) : undefined, lastMessage: String(item.last_non_activity_message?.content ?? item.last_message?.content ?? ""), lastMessageAt: isoFromExternal(item.last_activity_at ?? item.timestamp), messages: [] })), hasNextPage: payload.length > 0 }; }

  private channelType(value: unknown): SupportedChannelType { const text = String(value ?? "").toLowerCase(); if (text.includes("whatsapp")) return "WHATSAPP"; if (text.includes("webwidget") || text.includes("web_widget")) return "WEBCHAT"; if (text.includes("instagram")) return "INSTAGRAM"; if (text.includes("email")) return "EMAIL"; throw new ProviderError("UNSUPPORTED_CHANNEL", `Canal Chatwoot não suportado: ${text || "desconhecido"}`); }
  private conversationStatus(value: unknown): "OPEN" | "WAITING" | "RESOLVED" { const text = String(value ?? "open").toLowerCase(); return text === "resolved" ? "RESOLVED" : text === "pending" || text === "snoozed" ? "WAITING" : "OPEN"; }

  async getConversationDetails(externalId: string) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations/${encodeURIComponent(externalId)}`); if (!body || !Array.isArray(body.messages)) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); const messages = body.messages; return { externalId: String(body?.id ?? externalId), contactExternalId: String(body?.meta?.sender?.id ?? body?.contact?.id ?? `conversation-${externalId}`), channelExternalId: String(body?.inbox_id ?? body?.meta?.channel ?? "chatwoot"), channelName: String(body?.inbox?.name ?? body?.meta?.channel ?? "Chatwoot"), channelType: this.channelType(body?.meta?.channel ?? body?.inbox?.channel_type), status: this.conversationStatus(body?.status), assignedToExternalId: body?.assignee?.id ? String(body.assignee.id) : undefined, lastMessage: String(body?.last_non_activity_message?.content ?? ""), lastMessageAt: isoFromExternal(body?.last_activity_at ?? body?.timestamp), messages: messages.map((message: any) => ({ externalId: message.id === undefined ? undefined : String(message.id), sender: isOutgoingMessage(message.message_type) ? "AGENT" : "CONTACT", authorName: String(message.sender?.name ?? "Chatwoot"), body: String(message.content ?? ""), createdAt: isoFromExternal(message.created_at), internal: Boolean(message.private), messageType: "TEXT", deliveryStatus: isOutgoingMessage(message.message_type) ? "SENT" : "DELIVERED" })) } satisfies SyncConversation; }
  async listConversationsWithMessages(page: number) { const result = await this.listConversations(page); const items = []; for (const conversation of result.items) items.push(await this.getConversationDetails(conversation.externalId)); return { items, hasNextPage: result.hasNextPage }; }
  async listWebhooks() { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/webhooks`); const payload = Array.isArray(body?.payload) ? body.payload : Array.isArray(body?.payload?.webhooks) ? body.payload.webhooks : Array.isArray(body?.webhooks) ? body.webhooks : Array.isArray(body) ? body : undefined; if (!payload) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); return payload.map((item: any) => ({ id: String(item.id), url: String(item.url ?? ""), secret: typeof item.secret === "string" ? item.secret : undefined, subscriptions: Array.isArray(item.subscriptions) ? item.subscriptions.map(String) : [] })); }
  async registerWebhook(url: string) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/webhooks`, { method: "POST", body: JSON.stringify({ name: "eChat", url, subscriptions: ["message_created"] }) }); const webhook = body?.payload?.webhook ?? body?.webhook ?? body; const id = webhook?.id; if (id === undefined || id === null || String(id).length === 0) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); return { id: String(id), secret: typeof webhook?.secret === "string" ? webhook.secret : undefined }; }

  async sendMessage(input: { conversationId: string; externalConversationId?: string; body: string; internal?: boolean }): Promise<NormalizedOutgoingMessage> {
    if (!this.baseUrl || !this.token || !this.accountId || !input.externalConversationId) throw new ProviderError("CONFIGURATION_ERROR", "Chatwoot não configurado para enviar mensagens");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations/${encodeURIComponent(input.externalConversationId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json", api_access_token: this.token }, body: JSON.stringify({ content: input.body, message_type: "outgoing", private: input.internal ?? false }), signal: controller.signal });
      const raw: unknown = await response.json().catch(() => undefined);
      if (!response.ok) { const code: ProviderErrorCode = response.status === 401 ? "AUTHENTICATION_ERROR" : response.status === 403 ? "FORBIDDEN" : response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR"; throw new ProviderError(code, `Chatwoot respondeu HTTP ${response.status}`, response.status); }
      const parsed = messageResponseSchema.parse(raw);
      return { externalId: normalizeExternal(parsed.id), body: parsed.content, createdAt: isoFromExternal(parsed.created_at), sender: "AGENT", authorName: "", internal: input.internal };
    } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new ProviderError("TIMEOUT", "Timeout ao enviar mensagem para Chatwoot"); if (error instanceof z.ZodError) throw new ProviderError("INVALID_RESPONSE", "Resposta inválida do Chatwoot"); if (error instanceof ProviderError) throw new ProviderError(error.code, error.message.replace(this.token, "[redacted]"), error.status); throw error instanceof Error ? new ProviderError("PROVIDER_ERROR", error.message.replace(this.token, "[redacted]")) : new ProviderError("PROVIDER_ERROR", "Falha ao enviar mensagem para Chatwoot"); } finally { clearTimeout(timeout); }
  }

  normalizeConversation(input: unknown): Conversation { return conversationSchema.parse(input); }
  normalizeMessage(input: unknown): Message { return messageSchema.parse(input); }
  normalizeContact(input: unknown): Contact { return contactSchema.parse(input); }
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean {
    const secret = this.webhookSecret; const timestamp = headers["x-chatwoot-timestamp"]; const signature = headers["x-chatwoot-signature"];
    if (!secret || !timestamp || !signature?.startsWith("sha256=")) return false;
    const timestampSeconds = Number(timestamp); if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`; return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
  normalizeWebhook(input: unknown): NormalizedWebhookEvent[] {
    const parsed = webhookSchema.parse(input); if (parsed.event !== "message_created") return [];
    const externalAccountId = normalizeExternal(parsed.account?.id ?? parsed.account_id ?? this.accountId); const externalConversationId = normalizeExternal(parsed.conversation?.id ?? parsed.conversation_id ?? ""); const body = parsed.content ?? parsed.message?.content ?? "";
    if (!externalConversationId || !body) return [];
    const rawMessageType = parsed.message?.message_type ?? parsed.message_type ?? "incoming";
    const outgoing = isOutgoingMessage(rawMessageType);
    const rawChannelType = parsed.conversation?.inbox?.channel_type ?? parsed.inbox?.channel_type ?? parsed.conversation?.channel ?? parsed.conversation?.meta?.channel ?? this.channelTypeHint;
    const channelType = rawChannelType ? this.channelType(rawChannelType) : undefined;
    const externalMessageId = parsed.message?.id ?? parsed.id;
    const externalContactId = parsed.conversation?.meta?.sender?.id ?? parsed.conversation?.contact?.id ?? parsed.message?.sender?.id ?? parsed.sender?.id;
    const externalChannelId = parsed.conversation?.inbox?.id ?? parsed.conversation?.inbox_id ?? parsed.inbox?.id ?? this.inboxId;
    const channelName = parsed.conversation?.inbox?.name ?? parsed.inbox?.name;
    const rawStatus = parsed.conversation?.status;
    return [{ externalEventId: normalizeExternal(parsed.id ?? `${externalConversationId}:${createHash("sha256").update(body).digest("hex")}`), externalAccountId, externalConversationId, externalMessageId: externalMessageId === undefined ? undefined : normalizeExternal(externalMessageId), externalContactId: externalContactId == null ? undefined : normalizeExternal(externalContactId), externalChannelId: externalChannelId == null ? undefined : normalizeExternal(externalChannelId), channelName: channelName ?? undefined, channelType, status: rawStatus ? this.conversationStatus(rawStatus) : undefined, providerType: "CHATWOOT", messageType: "TEXT", direction: outgoing ? "OUTBOUND" : "INBOUND", body, createdAt: isoFromExternal(parsed.message?.created_at ?? parsed.created_at ?? undefined), sender: outgoing ? "AGENT" : "CONTACT", authorName: parsed.message?.sender?.name ?? parsed.sender?.name ?? parsed.conversation?.meta?.sender?.name ?? parsed.conversation?.contact?.name ?? "Chatwoot" }];
  }
}

export const createMessagingProvider = (): MessagingProvider => process.env.MESSAGING_PROVIDER === "chatwoot" ? new ChatwootProvider() : new MockMessagingProvider();
