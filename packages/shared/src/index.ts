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

export const channelTypeSchema = z.enum(["WHATSAPP", "WEBCHAT", "EMAIL", "INSTAGRAM"]);
export type ChannelType = z.infer<typeof channelTypeSchema>;

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
  status: "CONNECTED" | "ATTENTION";
  conversations: number;
}

export interface Message {
  organizationId?: string;
  id: string;
  externalId?: string;
  conversationId: string;
  sender: "CONTACT" | "AGENT" | "SYSTEM";
  authorName: string;
  body: string;
  createdAt: string;
  internal?: boolean;
}

export interface Conversation {
  id: string;
  organizationId: string;
  contactId: string;
  channelId: string;
  externalId?: string;
  status: ConversationStatus;
  assignedToId?: string;
  unread: number;
  lastMessage: string;
  lastMessageAt: string;
  messages: Message[];
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
}

export interface NormalizedWebhookEvent {
  externalEventId: string;
  externalAccountId: string;
  externalConversationId: string;
  externalMessageId?: string;
  body: string;
  createdAt: string;
  sender: "CONTACT" | "AGENT";
  authorName: string;
}
