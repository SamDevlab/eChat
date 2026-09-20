import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = (name: string) => text(name).primaryKey();
const org = () => text("organization_id").notNull();
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: id("id"), name: text("name").notNull(), plan: text("plan").notNull(), timezone: text("timezone").notNull().default("America/Sao_Paulo"), onboardingStep: text("onboarding_step").notNull().default("COMPANY"), onboardingCompleted: boolean("onboarding_completed").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: id("id"), email: text("email").notNull(), name: text("name").notNull(), passwordHash: text("password_hash").notNull(), avatar: text("avatar").notNull(), ...timestamps(),
}, (table) => ({ emailUnique: uniqueIndex("users_email_unique").on(table.email) }));

export const organizationMembers = pgTable("organization_members", {
  id: id("id"), organizationId: org(), userId: text("user_id").notNull(), role: text("role").notNull(), status: text("status").notNull().default("ACTIVE"), ...timestamps(),
}, (table) => ({ membershipUnique: uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId), orgIndex: index("organization_members_org_idx").on(table.organizationId) }));

export const contacts = pgTable("contacts", {
  id: id("id"), organizationId: org(), externalId: text("external_id"), name: text("name").notNull(), company: text("company").notNull(), phone: text("phone").notNull(), email: text("email").notNull(), ownerId: text("owner_id").notNull(), notes: text("notes").notNull(), lastConversationAt: timestamp("last_conversation_at", { withTimezone: true }).notNull(), ...timestamps(),
}, (table) => ({ orgIndex: index("contacts_org_idx").on(table.organizationId), externalIndex: uniqueIndex("contacts_org_external_unique").on(table.organizationId, table.externalId) }));

export const channels = pgTable("channels", {
  id: id("id"), organizationId: org(), integrationAccountId: text("integration_account_id"), externalId: text("external_id"), name: text("name").notNull(), type: text("type").notNull(), status: text("status").notNull(), conversations: integer("conversations").notNull().default(0), ...timestamps(),
}, (table) => ({ orgIndex: index("channels_org_idx").on(table.organizationId), externalIndex: uniqueIndex("channels_org_external_unique").on(table.organizationId, table.externalId) }));

export const conversations = pgTable("conversations", {
  id: id("id"), organizationId: org(), externalId: text("external_id"), contactId: text("contact_id").notNull(), channelId: text("channel_id").notNull(), status: text("status").notNull(), assignedToId: text("assigned_to_id"), unread: integer("unread").notNull().default(0), lastMessage: text("last_message").notNull(), lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(), ...timestamps(),
}, (table) => ({ tenantStatusIndex: index("conversations_org_status_idx").on(table.organizationId, table.status), externalIndex: uniqueIndex("conversations_org_external_unique").on(table.organizationId, table.externalId) }));

export const messages = pgTable("messages", {
  id: id("id"), organizationId: org(), conversationId: text("conversation_id").notNull(), externalId: text("external_id"), sender: text("sender").notNull(), authorName: text("author_name").notNull(), body: text("body").notNull(), internal: boolean("internal").default(false).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tenantConversationIndex: index("messages_org_conversation_created_idx").on(table.organizationId, table.conversationId, table.createdAt), externalIndex: uniqueIndex("messages_org_external_unique").on(table.organizationId, table.externalId) }));

export const pipelines = pgTable("pipelines", {
  id: id("id"), organizationId: org(), name: text("name").notNull(), ...timestamps(),
}, (table) => ({ orgIndex: index("pipelines_org_idx").on(table.organizationId) }));

export const pipelineStages = pgTable("pipeline_stages", {
  id: id("id"), organizationId: org(), pipelineId: text("pipeline_id").notNull(), name: text("name").notNull(), key: text("key").notNull(), position: integer("position").notNull(), color: text("color").notNull(), ...timestamps(),
}, (table) => ({ pipelinePositionUnique: uniqueIndex("pipeline_stages_pipeline_position_unique").on(table.pipelineId, table.position), orgIndex: index("pipeline_stages_org_idx").on(table.organizationId) }));

export const opportunities = pgTable("opportunities", {
  id: id("id"), organizationId: org(), title: text("title").notNull(), contactId: text("contact_id").notNull(), company: text("company").notNull(), value: numeric("value", { precision: 12, scale: 2 }).notNull(), pipelineId: text("pipeline_id").notNull(), stageId: text("stage_id").notNull(), ownerId: text("owner_id").notNull(), source: text("source").notNull(), lastActivity: text("last_activity").notNull(), note: text("note").notNull(), ...timestamps(),
}, (table) => ({ tenantStageIndex: index("opportunities_org_stage_idx").on(table.organizationId, table.stageId), orgIndex: index("opportunities_org_idx").on(table.organizationId) }));

export const opportunityActivities = pgTable("opportunity_activities", {
  id: id("id"), organizationId: org(), opportunityId: text("opportunity_id").notNull(), actorId: text("actor_id").notNull(), type: text("type").notNull(), detail: text("detail").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ orgIndex: index("opportunity_activities_org_idx").on(table.organizationId, table.opportunityId) }));

export const tags = pgTable("tags", { id: id("id"), organizationId: org(), name: text("name").notNull(), color: text("color").notNull(), ...timestamps() }, (table) => ({ orgNameUnique: uniqueIndex("tags_org_name_unique").on(table.organizationId, table.name) }));
export const contactTags = pgTable("contact_tags", { id: id("id"), organizationId: org(), contactId: text("contact_id").notNull(), tagId: text("tag_id").notNull() }, (table) => ({ contactTagUnique: uniqueIndex("contact_tags_contact_tag_unique").on(table.contactId, table.tagId), orgIndex: index("contact_tags_org_idx").on(table.organizationId) }));

export const integrationAccounts = pgTable("integration_accounts", {
  id: id("id"), organizationId: org(), provider: text("provider").notNull(), displayName: text("display_name").notNull().default("Integração"), externalAccountId: text("external_account_id").notNull(), status: text("status").notNull(), baseUrl: text("base_url"), credentialRef: text("credential_ref"), credentialCiphertext: text("credential_ciphertext"), credentialIv: text("credential_iv"), credentialTag: text("credential_tag"), credentialVersion: integer("credential_version"), webhookSecretCiphertext: text("webhook_secret_ciphertext"), webhookSecretIv: text("webhook_secret_iv"), webhookSecretTag: text("webhook_secret_tag"), webhookSecretVersion: integer("webhook_secret_version"), webhookRegistrationId: text("webhook_registration_id"), lastCheckAt: timestamp("last_check_at", { withTimezone: true }), lastErrorCode: text("last_error_code"), lastSyncStartedAt: timestamp("last_sync_started_at", { withTimezone: true }), lastSyncCompletedAt: timestamp("last_sync_completed_at", { withTimezone: true }), lastSyncStatus: text("last_sync_status"), lastSyncError: text("last_sync_error"), metadata: jsonb("metadata").$type<Record<string, string>>().default({}).notNull(), ...timestamps(),
}, (table) => ({ providerAccountUnique: uniqueIndex("integration_accounts_provider_external_unique").on(table.provider, table.externalAccountId), orgIndex: index("integration_accounts_org_idx").on(table.organizationId) }));

export const authSessions = pgTable("auth_sessions", {
  id: id("id"), userId: text("user_id").notNull(), organizationId: org(), tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), lastSeenAt: timestamp("last_seen_at"), revokedAt: timestamp("revoked_at"),
}, (table) => ({ tokenUnique: uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash), activeLookup: index("auth_sessions_active_lookup_idx").on(table.organizationId, table.expiresAt) }));

export const webhookEvents = pgTable("webhook_events", {
  id: id("id"), organizationId: org(), integrationAccountId: text("integration_account_id").notNull(), provider: text("provider").notNull(), externalEventId: text("external_event_id").notNull(), payloadHash: text("payload_hash").notNull(), receivedAt: timestamp("received_at").defaultNow().notNull(), processedAt: timestamp("processed_at"),
}, (table) => ({ eventUnique: uniqueIndex("webhook_events_integration_event_unique").on(table.integrationAccountId, table.externalEventId), orgIndex: index("webhook_events_org_idx").on(table.organizationId, table.receivedAt) }));

export const organizationInvites = pgTable("organization_invites", {
  id: id("id"), organizationId: org(), email: text("email").notNull(), role: text("role").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdBy: text("created_by").notNull(), acceptedAt: timestamp("accepted_at", { withTimezone: true }), revokedAt: timestamp("revoked_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tokenUnique: uniqueIndex("organization_invites_token_hash_unique").on(table.tokenHash), orgIndex: index("organization_invites_org_idx").on(table.organizationId, table.createdAt), emailIndex: index("organization_invites_org_email_idx").on(table.organizationId, table.email) }));

export const opportunityConversations = pgTable("opportunity_conversations", {
  id: id("id"), organizationId: org(), opportunityId: text("opportunity_id").notNull(), conversationId: text("conversation_id").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ linkUnique: uniqueIndex("opportunity_conversations_unique").on(table.opportunityId, table.conversationId), orgIndex: index("opportunity_conversations_org_idx").on(table.organizationId) }));

export const schemaTables = { organizations, users, organizationMembers, contacts, channels, conversations, messages, pipelines, pipelineStages, opportunities, opportunityActivities, tags, contactTags, integrationAccounts, authSessions, webhookEvents, organizationInvites, opportunityConversations };
