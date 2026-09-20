import { pgTable, text, timestamp, integer, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";

const id = (name: string) => text(name).primaryKey();
const org = () => text("organization_id").notNull();

export const organizations = pgTable("organizations", {
  id: id("id"), name: text("name").notNull(), plan: text("plan").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const users = pgTable("users", {
  id: id("id"), organizationId: org(), name: text("name").notNull(), email: text("email").notNull(), passwordHash: text("password_hash").notNull(), role: text("role").notNull(), avatar: text("avatar").notNull(),
}, (table) => ({ emailPerOrg: uniqueIndex("users_org_email_idx").on(table.organizationId, table.email) }));
export const organizationMembers = pgTable("organization_members", { id: id("id"), organizationId: org(), userId: text("user_id").notNull(), role: text("role").notNull() });
export const contacts = pgTable("contacts", { id: id("id"), organizationId: org(), name: text("name").notNull(), company: text("company").notNull(), phone: text("phone").notNull(), email: text("email").notNull(), ownerId: text("owner_id").notNull(), notes: text("notes").notNull(), lastConversationAt: timestamp("last_conversation_at").notNull() });
export const channels = pgTable("channels", { id: id("id"), organizationId: org(), name: text("name").notNull(), type: text("type").notNull(), status: text("status").notNull() });
export const conversations = pgTable("conversations", { id: id("id"), organizationId: org(), contactId: text("contact_id").notNull(), channelId: text("channel_id").notNull(), status: text("status").notNull(), assignedToId: text("assigned_to_id"), unread: integer("unread").notNull(), lastMessage: text("last_message").notNull(), lastMessageAt: timestamp("last_message_at").notNull() });
export const messages = pgTable("messages", { id: id("id"), conversationId: text("conversation_id").notNull(), sender: text("sender").notNull(), authorName: text("author_name").notNull(), body: text("body").notNull(), internal: boolean("internal").default(false).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const pipelines = pgTable("pipelines", { id: id("id"), organizationId: org(), name: text("name").notNull() });
export const pipelineStages = pgTable("pipeline_stages", { id: id("id"), organizationId: org(), pipelineId: text("pipeline_id").notNull(), name: text("name").notNull(), key: text("key").notNull(), order: integer("order").notNull(), color: text("color").notNull() });
export const opportunities = pgTable("opportunities", { id: id("id"), organizationId: org(), title: text("title").notNull(), contactId: text("contact_id").notNull(), company: text("company").notNull(), value: numeric("value").notNull(), stage: text("stage").notNull(), ownerId: text("owner_id").notNull(), source: text("source").notNull(), lastActivity: text("last_activity").notNull(), note: text("note").notNull() });
export const opportunityActivities = pgTable("opportunity_activities", { id: id("id"), organizationId: org(), opportunityId: text("opportunity_id").notNull(), actorId: text("actor_id").notNull(), type: text("type").notNull(), detail: text("detail").notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const tags = pgTable("tags", { id: id("id"), organizationId: org(), name: text("name").notNull(), color: text("color").notNull() });
export const contactTags = pgTable("contact_tags", { id: id("id"), organizationId: org(), contactId: text("contact_id").notNull(), tagId: text("tag_id").notNull() });
export const integrationAccounts = pgTable("integration_accounts", { id: id("id"), organizationId: org(), provider: text("provider").notNull(), externalId: text("external_id").notNull(), status: text("status").notNull() });
