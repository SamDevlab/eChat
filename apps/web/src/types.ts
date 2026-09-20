export type Role = "OWNER" | "ADMIN" | "AGENT";
export type StageKey = "NEW_LEAD" | "CONTACTED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export type ChannelType = "WHATSAPP" | "WEBCHAT" | "EMAIL" | "INSTAGRAM";
export type ConversationStatus = "OPEN" | "WAITING" | "RESOLVED";
export interface User { id: string; organizationId: string; name: string; email: string; role: Role; avatar: string; }
export interface Contact { id: string; organizationId: string; name: string; company: string; phone: string; email: string; tags: string[]; ownerId: string; lastConversationAt: string; opportunities: number; notes: string; }
export interface Channel { id: string; organizationId: string; name: string; type: ChannelType; status: "CONNECTED" | "ATTENTION"; conversations: number; }
export interface Message { id: string; conversationId: string; sender: "CONTACT" | "AGENT" | "SYSTEM"; authorName: string; body: string; createdAt: string; internal?: boolean; }
export interface Conversation { id: string; organizationId: string; contactId: string; channelId: string; status: ConversationStatus; assignedToId?: string; unread: number; lastMessage: string; lastMessageAt: string; messages: Message[]; }
export interface Stage { id: string; organizationId: string; name: string; key: StageKey; order: number; color: string; }
export interface Opportunity { id: string; organizationId: string; title: string; contactId: string; company: string; value: number; stage: StageKey; ownerId: string; source: string; lastActivity: string; note: string; }
export interface AppState { organization: { id: string; name: string; plan: string }; user: User; users: User[]; contacts: Contact[]; channels: Channel[]; conversations: Conversation[]; stages: Stage[]; opportunities: Opportunity[]; }
