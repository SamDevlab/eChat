export type Role = "OWNER" | "ADMIN" | "AGENT";
export type StageKey = "NEW_LEAD" | "CONTACTED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export type ChannelType = "WHATSAPP" | "WEBCHAT" | "EMAIL" | "INSTAGRAM";
export type ConversationStatus = "OPEN" | "WAITING" | "RESOLVED";
export interface User { id: string; organizationId: string; name: string; email: string; role: Role; avatar: string; }
export interface Contact { id: string; organizationId: string; name: string; company: string; phone: string; email: string; tags: string[]; ownerId: string; lastConversationAt: string; opportunities: number; notes: string; }
export interface Channel { id: string; organizationId: string; integrationAccountId?: string; name: string; type: ChannelType; status: "CONNECTED" | "ATTENTION"; conversations: number; }
export interface Message { id: string; conversationId: string; sender: "CONTACT" | "AGENT" | "SYSTEM"; authorName: string; body: string; createdAt: string; internal?: boolean; }
export interface Conversation { id: string; organizationId: string; contactId: string; channelId: string; status: ConversationStatus; assignedToId?: string; unread: number; lastMessage: string; lastMessageAt: string; messages: Message[]; }
export interface Stage { id: string; organizationId: string; name: string; key: StageKey; order: number; color: string; }
export interface Opportunity { id: string; organizationId: string; title: string; contactId: string; company: string; value: number; stage: StageKey; ownerId: string; source: string; lastActivity: string; note: string; }
export interface Member { id: string; organizationId: string; userId: string; name: string; email: string; avatar: string; role: Role; status: "ACTIVE" | "INVITED" | "DISABLED"; createdAt: string; }
export interface Invite { id: string; organizationId: string; email: string; role: Role; expiresAt: string; acceptedAt?: string | null; revokedAt?: string | null; createdAt: string; }
export interface Integration { id: string; organizationId: string; provider: "mock" | "chatwoot"; displayName: string; externalAccountId: string; status: "UNVERIFIED" | "CONNECTED" | "ERROR" | "ACTIVE"; baseUrl: string; webhookRegistrationId?: string | null; lastCheckAt?: string | null; lastErrorCode?: string | null; lastSyncStartedAt?: string | null; lastSyncCompletedAt?: string | null; lastSyncStatus?: "RUNNING" | "SUCCESS" | "FAILED" | null; lastSyncError?: string | null; }
export interface AppState { organization: { id: string; name: string; plan: string; timezone: string; onboardingStep: "COMPANY" | "TEAM" | "CHANNEL" | "DONE"; onboardingCompleted: boolean }; user: User; users: User[]; members: Member[]; invites: Invite[]; integrations: Integration[]; contacts: Contact[]; channels: Channel[]; conversations: Conversation[]; stages: Stage[]; opportunities: Opportunity[]; }
