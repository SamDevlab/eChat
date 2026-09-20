import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Contact, Conversation, Message, MessagingProvider, NormalizedOutgoingMessage, NormalizedWebhookEvent } from "@echat/shared";

export type ChatwootProviderConfig = { baseUrl: string; token: string; accountId: string; webhookSecret?: string };
export type SyncContact = { externalId: string; name: string; email: string; phone: string; company: string };
export type SyncConversation = { externalId: string; contactExternalId: string; channelExternalId: string; channelName: string; channelType: "WHATSAPP" | "WEBCHAT" | "EMAIL" | "INSTAGRAM"; status: "OPEN" | "WAITING" | "RESOLVED"; assignedToExternalId?: string; lastMessage: string; lastMessageAt: string; messages: SyncMessage[] };
export type SyncMessage = { externalId?: string; sender: "CONTACT" | "AGENT" | "SYSTEM"; authorName: string; body: string; createdAt: string; internal?: boolean };
export interface IntegrationMessagingProvider extends MessagingProvider {
  testConnection(): Promise<{ accountId: string; name?: string }>;
  listContacts(page: number): Promise<{ items: SyncContact[]; hasNextPage: boolean }>;
  listConversations(page: number): Promise<{ items: SyncConversation[]; hasNextPage: boolean }>;
  listConversationsWithMessages?(page: number): Promise<{ items: SyncConversation[]; hasNextPage: boolean }>;
  registerWebhook?(url: string): Promise<{ id: string }>;
}

const messageResponseSchema = z.object({ id: z.union([z.string(), z.number()]), content: z.string(), created_at: z.union([z.string(), z.number()]).optional(), message_type: z.union([z.string(), z.number()]).optional() });
const webhookSchema = z.object({ event: z.string(), id: z.union([z.string(), z.number()]).optional(), account: z.object({ id: z.union([z.string(), z.number()]) }).optional(), account_id: z.union([z.string(), z.number()]).optional(), conversation: z.object({ id: z.union([z.string(), z.number()]), contact: z.object({ name: z.string().optional() }).optional() }).optional(), conversation_id: z.union([z.string(), z.number()]).optional(), message: z.object({ id: z.union([z.string(), z.number()]).optional(), content: z.string().optional(), message_type: z.union([z.string(), z.number()]).optional(), sender: z.object({ name: z.string().optional() }).optional() }).optional(), content: z.string().optional(), sender: z.object({ name: z.string().optional() }).optional() });
const messageSchema = z.object({ organizationId: z.string().optional(), id: z.string(), externalId: z.string().optional(), conversationId: z.string(), sender: z.enum(["CONTACT", "AGENT", "SYSTEM"]), authorName: z.string(), body: z.string(), createdAt: z.string(), internal: z.boolean().optional() });
const conversationSchema = z.object({ id: z.string(), organizationId: z.string(), contactId: z.string(), channelId: z.string(), externalId: z.string().optional(), status: z.enum(["OPEN", "WAITING", "RESOLVED"]), assignedToId: z.string().optional(), unread: z.number(), lastMessage: z.string(), lastMessageAt: z.string(), messages: z.array(messageSchema) });
const contactSchema = z.object({ id: z.string(), organizationId: z.string(), name: z.string(), company: z.string(), phone: z.string(), email: z.string(), tags: z.array(z.string()), ownerId: z.string(), lastConversationAt: z.string(), opportunities: z.number(), notes: z.string() });

const isoFromExternal = (value: string | number | undefined): string => { if (value === undefined) return new Date().toISOString(); const numeric = typeof value === "number" || /^\d+$/.test(value) ? Number(value) : NaN; return Number.isFinite(numeric) ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString() : new Date(value).toISOString(); };
const normalizeExternal = (input: unknown): string => { if (typeof input === "string" || typeof input === "number") return String(input); throw new Error("Identificador externo inválido"); };

export class MockMessagingProvider implements MessagingProvider {
  readonly name = "mock";
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
    return [{ externalEventId: normalizeExternal(parsed.id ?? `${externalConversationId}:${body}`), externalAccountId, externalConversationId, externalMessageId: parsed.message?.id === undefined ? undefined : normalizeExternal(parsed.message.id), body, createdAt: new Date().toISOString(), sender: messageType === "outgoing" ? "AGENT" : "CONTACT", authorName: parsed.message?.sender?.name ?? parsed.sender?.name ?? parsed.conversation?.contact?.name ?? "Chatwoot" }];
  }
}

export class ChatwootProvider implements MessagingProvider {
  readonly name = "chatwoot";
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly accountId: string;
  private readonly webhookSecret?: string;
  constructor(config: ChatwootProviderConfig = { baseUrl: process.env.CHATWOOT_BASE_URL ?? "", token: process.env.CHATWOOT_API_TOKEN ?? "", accountId: process.env.CHATWOOT_ACCOUNT_ID ?? "", webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET }) { this.baseUrl = config.baseUrl.replace(/\/$/, ""); this.token = config.token; this.accountId = config.accountId; this.webhookSecret = config.webhookSecret; }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    if (!this.baseUrl || !this.token || !this.accountId) throw new Error("Chatwoot não configurado");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", api_access_token: this.token, ...(init.headers ?? {}) }, signal: controller.signal });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) throw Object.assign(new Error(`Chatwoot respondeu HTTP ${response.status}`), { status: response.status });
      return body;
    } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout ao consultar Chatwoot"); throw error; } finally { clearTimeout(timeout); }
  }

  async testConnection() { const account = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}`); return { accountId: String(account?.id ?? this.accountId), name: typeof account?.name === "string" ? account.name : undefined }; }

  async listContacts(page: number) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/contacts?page=${page}`); const payload = Array.isArray(body?.payload) ? body.payload : []; return { items: payload.map((item: any) => ({ externalId: String(item.id ?? item.identifier), name: String(item.name ?? "Contato Chatwoot"), email: String(item.email ?? ""), phone: String(item.phone_number ?? ""), company: String(item.company?.name ?? "") })), hasNextPage: Number(body?.meta?.current_page ?? page) < Math.ceil(Number(body?.meta?.count ?? payload.length) / 15) }; }

  async listConversations(page: number) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations?status=all&sort=-last_activity_at&page=${page}`); const payload = Array.isArray(body?.data?.payload) ? body.data.payload : Array.isArray(body?.payload) ? body.payload : []; return { items: payload.map((item: any) => ({ externalId: String(item.id), contactExternalId: String(item.meta?.sender?.id ?? item.contact?.id ?? item.meta?.sender?.identifier ?? `conversation-${item.id}`), channelExternalId: String(item.meta?.channel ?? item.inbox_id ?? "chatwoot"), channelName: String(item.inbox?.name ?? item.meta?.channel ?? "Chatwoot"), channelType: this.channelType(item.meta?.channel ?? item.inbox?.channel_type), status: this.conversationStatus(item.status), assignedToExternalId: item.assignee?.id ? String(item.assignee.id) : undefined, lastMessage: String(item.last_non_activity_message?.content ?? item.last_message?.content ?? ""), lastMessageAt: new Date(Number(item.last_activity_at ?? Date.now()) * (Number(item.last_activity_at ?? 0) < 10_000_000_000 ? 1000 : 1)).toISOString(), messages: [] })), hasNextPage: payload.length >= 25 }; }

  private channelType(value: unknown): "WHATSAPP" | "WEBCHAT" | "EMAIL" | "INSTAGRAM" { const text = String(value ?? "").toLowerCase(); return text.includes("whatsapp") ? "WHATSAPP" : text.includes("email") ? "EMAIL" : text.includes("instagram") ? "INSTAGRAM" : "WEBCHAT"; }
  private conversationStatus(value: unknown): "OPEN" | "WAITING" | "RESOLVED" { const text = String(value ?? "open").toLowerCase(); return text === "resolved" ? "RESOLVED" : text === "pending" || text === "snoozed" ? "WAITING" : "OPEN"; }

  async getConversationDetails(externalId: string) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations/${encodeURIComponent(externalId)}`); const messages = Array.isArray(body?.messages) ? body.messages : []; return { externalId: String(body?.id ?? externalId), contactExternalId: String(body?.meta?.sender?.id ?? body?.contact?.id ?? `conversation-${externalId}`), channelExternalId: String(body?.meta?.channel ?? body?.inbox_id ?? "chatwoot"), channelName: String(body?.inbox?.name ?? body?.meta?.channel ?? "Chatwoot"), channelType: this.channelType(body?.meta?.channel ?? body?.inbox?.channel_type), status: this.conversationStatus(body?.status), assignedToExternalId: body?.assignee?.id ? String(body.assignee.id) : undefined, lastMessage: String(body?.last_non_activity_message?.content ?? ""), lastMessageAt: new Date(Number(body?.last_activity_at ?? Date.now()) * (Number(body?.last_activity_at ?? 0) < 10_000_000_000 ? 1000 : 1)).toISOString(), messages: messages.map((message: any) => ({ externalId: message.id === undefined ? undefined : String(message.id), sender: String(message.message_type) === "outgoing" ? "AGENT" : "CONTACT", authorName: String(message.sender?.name ?? "Chatwoot"), body: String(message.content ?? ""), createdAt: new Date(Number(message.created_at ?? Date.now()) * (Number(message.created_at ?? 0) < 10_000_000_000 ? 1000 : 1)).toISOString(), internal: Boolean(message.private) })) } satisfies SyncConversation; }
  async listConversationsWithMessages(page: number) { const result = await this.listConversations(page); const items = []; for (const conversation of result.items) items.push(await this.getConversationDetails(conversation.externalId)); return { items, hasNextPage: result.hasNextPage }; }
  async registerWebhook(url: string) { const body = await this.request(`/api/v1/accounts/${encodeURIComponent(this.accountId)}/webhooks`, { method: "POST", body: JSON.stringify({ name: "eChat", url, subscriptions: ["message_created"] }) }); return { id: String(body?.id ?? body?.webhook?.id ?? "registered") }; }

  async sendMessage(input: { conversationId: string; externalConversationId?: string; body: string; internal?: boolean }): Promise<NormalizedOutgoingMessage> {
    if (!this.baseUrl || !this.token || !this.accountId || !input.externalConversationId) throw new Error("Chatwoot não configurado para enviar mensagens");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/accounts/${encodeURIComponent(this.accountId)}/conversations/${encodeURIComponent(input.externalConversationId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json", api_access_token: this.token }, body: JSON.stringify({ content: input.body, message_type: "outgoing", private: input.internal ?? false }), signal: controller.signal });
      const raw: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(`Chatwoot respondeu HTTP ${response.status}`);
      const parsed = messageResponseSchema.parse(raw);
      return { externalId: normalizeExternal(parsed.id), body: parsed.content, createdAt: isoFromExternal(parsed.created_at), sender: "AGENT", authorName: "", internal: input.internal };
    } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout ao enviar mensagem para Chatwoot"); if (error instanceof z.ZodError) throw new Error("Resposta inválida do Chatwoot"); throw error instanceof Error ? new Error(error.message.replace(this.token, "[redacted]")) : new Error("Falha ao enviar mensagem para Chatwoot"); } finally { clearTimeout(timeout); }
  }

  normalizeConversation(input: unknown): Conversation { return conversationSchema.parse(input); }
  normalizeMessage(input: unknown): Message { return messageSchema.parse(input); }
  normalizeContact(input: unknown): Contact { return contactSchema.parse(input); }
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean {
    const secret = this.webhookSecret ?? process.env.CHATWOOT_WEBHOOK_SECRET; const timestamp = headers["x-chatwoot-timestamp"]; const signature = headers["x-chatwoot-signature"];
    if (!secret || !timestamp || !signature?.startsWith("sha256=")) return false;
    const timestampSeconds = Number(timestamp); if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`; return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
  normalizeWebhook(input: unknown): NormalizedWebhookEvent[] {
    const parsed = webhookSchema.parse(input); if (parsed.event !== "message_created") return [];
    const externalAccountId = normalizeExternal(parsed.account?.id ?? parsed.account_id ?? this.accountId); const externalConversationId = normalizeExternal(parsed.conversation?.id ?? parsed.conversation_id ?? ""); const body = parsed.content ?? parsed.message?.content ?? "";
    if (!externalConversationId || !body) return [];
    const messageType = String(parsed.message?.message_type ?? "incoming");
    return [{ externalEventId: normalizeExternal(parsed.id ?? `${externalConversationId}:${createHash("sha256").update(body).digest("hex")}`), externalAccountId, externalConversationId, externalMessageId: parsed.message?.id === undefined ? undefined : normalizeExternal(parsed.message.id), body, createdAt: isoFromExternal(undefined), sender: messageType === "outgoing" ? "AGENT" : "CONTACT", authorName: parsed.message?.sender?.name ?? parsed.sender?.name ?? parsed.conversation?.contact?.name ?? "Chatwoot" }];
  }
}

export const createMessagingProvider = (): MessagingProvider => process.env.MESSAGING_PROVIDER === "chatwoot" ? new ChatwootProvider() : new MockMessagingProvider();
