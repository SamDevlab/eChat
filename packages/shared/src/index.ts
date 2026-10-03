import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "ADMIN", "AGENT"]);
export type Role = z.infer<typeof roleSchema>;

export const conversationStatusSchema = z.enum(["OPEN", "WAITING", "RESOLVED"]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const opportunityStageSchema = z.enum([
  "NEW_LEAD",
  "CONTACTED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);
export type OpportunityStage = z.infer<typeof opportunityStageSchema>;

export const channelTypeSchema = z.enum(["WHATSAPP", "WEBCHAT", "EMAIL", "INSTAGRAM", "UNKNOWN"]);
export type ChannelType = z.infer<typeof channelTypeSchema>;
export const supportedChannelTypeSchema = z.enum(["WHATSAPP", "INSTAGRAM", "EMAIL"]);
export type SupportedChannelType = z.infer<typeof supportedChannelTypeSchema>;
export const providerTypeSchema = z.enum(["CHATWOOT", "MOCK"]);
export type ProviderType = z.infer<typeof providerTypeSchema>;
export const messageDirectionSchema = z.enum(["INBOUND", "OUTBOUND"]);
export type MessageDirection = z.infer<typeof messageDirectionSchema>;
export const messageTypeSchema = z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "FILE"]);
export type MessageType = z.infer<typeof messageTypeSchema>;
export const deliveryStatusSchema = z.enum(["PENDING", "SENT", "DELIVERED", "READ", "FAILED"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export interface ProviderContext {
  organizationId: string;
  channelConnectionId: string;
  channelType: ChannelType;
  providerType: ProviderType;
  externalAccountId: string;
  externalInboxId?: string;
}

export interface ProviderCapabilities {
  SEND_TEXT: boolean;
  SEND_MEDIA: boolean;
  RECEIVE_MEDIA: boolean;
  DELIVERY_STATUS: boolean;
  READ_STATUS: boolean;
  THREADING: boolean;
  TEMPLATES: boolean;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: "ACTIVE" | "INVITED" | "DISABLED";
}

export interface Contact {
  id: string;
  organizationId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  tags: string[];
  ownerId: string;
  lastConversationAt: string;
  opportunities: number;
  notes: string;
}

export interface Channel {
  id: string;
  organizationId: string;
  name: string;
  type: ChannelType;
  providerType?: ProviderType;
  status: "CONNECTED" | "ATTENTION";
  conversations: number;
}

export interface Message {
  organizationId?: string;
  id: string;
  externalId?: string;
  externalMessageId?: string;
  conversationId: string;
  channelType?: ChannelType;
  providerType?: ProviderType;
  direction?: MessageDirection;
  senderIdentity?: string;
  recipientIdentity?: string;
  sender: "CONTACT" | "AGENT" | "SYSTEM";
  authorName: string;
  body: string;
  messageType?: MessageType;
  deliveryStatus?: DeliveryStatus;
  providerCreatedAt?: string;
  attachments?: Attachment[];
  createdAt: string;
  internal?: boolean;
}

export interface Attachment {
  id: string;
  messageId: string;
  externalUrl?: string;
  mimeType: string;
  filename?: string;
  size?: number;
  providerAssetId?: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  contactId: string;
  channelId: string;
  externalId?: string;
  externalConversationId?: string;
  channelType?: ChannelType;
  providerType?: ProviderType;
  channelConnectionId?: string;
  status: ConversationStatus;
  assignedToId?: string;
  unread: number;
  lastMessage: string;
  lastMessageAt: string;
  messages: Message[];
}

export interface ContactIdentity {
  id: string;
  organizationId: string;
  contactId: string;
  channelType: ChannelType;
  providerType: ProviderType;
  channelConnectionId: string;
  externalContactId: string;
  address?: string;
  username?: string;
  phone?: string;
  email?: string;
}

export interface PipelineStage {
  id: string;
  organizationId: string;
  name: string;
  key: OpportunityStage;
  order: number;
  color: string;
}

export interface Opportunity {
  id: string;
  organizationId: string;
  title: string;
  contactId: string;
  pipelineId?: string;
  stageId?: string;
  company: string;
  value: number;
  stage: OpportunityStage;
  ownerId: string;
  source: string;
  lastActivity: string;
  note: string;
}

export interface DemoState {
  organization: { id: string; name: string; plan: string };
  users: User[];
  contacts: Contact[];
  channels: Channel[];
  conversations: Conversation[];
  stages: PipelineStage[];
  opportunities: Opportunity[];
}

export interface SessionUser extends User {
  sessionId: string;
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), password: z.string().min(8).max(200), organizationName: z.string().trim().min(2).max(160) });
export const inviteSchema = z.object({ email: z.string().email(), role: roleSchema });
export const acceptInviteSchema = z.object({ name: z.string().trim().min(2).max(120), password: z.string().min(8).max(200) });
export const organizationSettingsSchema = z.object({ name: z.string().trim().min(2).max(160).optional(), timezone: z.string().min(1).max(100).optional(), onboardingStep: z.enum(["COMPANY", "TEAM", "CHANNEL", "DONE"]).optional(), onboardingCompleted: z.boolean().optional() });
export const integrationSchema = z.object({ id: z.string().optional(), provider: z.enum(["mock", "chatwoot"]), displayName: z.string().trim().min(2).max(120), baseUrl: z.string().url(), externalAccountId: z.string().trim().min(1).max(100), providerInboxId: z.string().trim().max(100).optional(), channelType: channelTypeSchema.optional(), apiToken: z.string().max(1000), webhookSecret: z.string().max(1000).optional() });
export const memberUpdateSchema = z.object({ role: roleSchema.optional(), status: z.enum(["ACTIVE", "DISABLED"]).optional() });

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().optional().default(false),
});

export const assignConversationSchema = z.object({ assignedToId: z.string().min(1).nullable().optional() });
export const updateConversationStatusSchema = z.object({ status: conversationStatusSchema });

export const moveOpportunitySchema = z.object({
  stage: opportunityStageSchema,
});

export const createOpportunitySchema = z.object({
  title: z.string().trim().min(2),
  contactId: z.string().min(1),
  value: z.number().nonnegative(),
  stage: opportunityStageSchema.default("NEW_LEAD"),
});

export interface MessagingProvider {
  readonly name: string;
  readonly providerType: ProviderType;
  capabilities(context: ProviderContext): ProviderCapabilities;
  sendMessage(input: { conversationId: string; externalConversationId?: string; body: string; internal?: boolean }): Promise<NormalizedOutgoingMessage>;
  normalizeConversation(input: unknown): Conversation;
  normalizeMessage(input: unknown): Message;
  normalizeContact(input: unknown): Contact;
  verifyWebhook?(headers: Record<string, string | undefined>, rawBody: string): boolean;
  normalizeWebhook?(input: unknown): NormalizedWebhookEvent[];
}

export interface NormalizedOutgoingMessage {
  externalId?: string;
  body: string;
  createdAt: string;
  sender: "AGENT";
  authorName: string;
  internal?: boolean;
  messageType?: MessageType;
  deliveryStatus?: DeliveryStatus;
}

export interface NormalizedWebhookEvent {
  externalEventId: string;
  externalAccountId: string;
  externalConversationId: string;
  externalMessageId?: string;
  channelType?: ChannelType;
  providerType?: ProviderType;
  messageType?: MessageType;
  direction?: MessageDirection;
  body: string;
  createdAt: string;
  sender: "CONTACT" | "AGENT";
  authorName: string;
}
