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

export const departments = pgTable("departments", {
  id: id("id"), organizationId: org(), name: text("name").notNull(), slug: text("slug").notNull(), color: text("color").notNull().default("teal"), description: text("description").notNull().default(""), active: boolean("active").notNull().default(true), ...timestamps(),
}, (table) => ({ orgSlugUnique: uniqueIndex("departments_org_slug_unique").on(table.organizationId, table.slug), orgIndex: index("departments_org_idx").on(table.organizationId) }));

export const departmentMembers = pgTable("department_members", {
  id: id("id"), organizationId: org(), departmentId: text("department_id").notNull(), userId: text("user_id").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ memberUnique: uniqueIndex("department_members_department_user_unique").on(table.departmentId, table.userId), orgIndex: index("department_members_org_idx").on(table.organizationId) }));

export const routingRules = pgTable("routing_rules", {
  id: id("id"), organizationId: org(), departmentId: text("department_id").notNull(), channelId: text("channel_id"), name: text("name").notNull(), keywords: jsonb("keywords").$type<string[]>().notNull().default([]), position: integer("position").notNull().default(0), active: boolean("active").notNull().default(true), ...timestamps(),
}, (table) => ({ orgPositionIndex: index("routing_rules_org_position_idx").on(table.organizationId, table.position), orgIndex: index("routing_rules_org_idx").on(table.organizationId) }));

export const contacts = pgTable("contacts", {
  id: id("id"), organizationId: org(), externalId: text("external_id"), name: text("name").notNull(), company: text("company").notNull(), phone: text("phone").notNull(), email: text("email").notNull(), ownerId: text("owner_id").notNull(), notes: text("notes").notNull(), lastConversationAt: timestamp("last_conversation_at", { withTimezone: true }).notNull(), ...timestamps(),
}, (table) => ({ orgIndex: index("contacts_org_idx").on(table.organizationId), externalIndex: uniqueIndex("contacts_org_external_unique").on(table.organizationId, table.externalId) }));

export const channels = pgTable("channels", {
  id: id("id"), organizationId: org(), integrationAccountId: text("integration_account_id"), externalId: text("external_id"), name: text("name").notNull(), type: text("type").notNull(), status: text("status").notNull(), conversations: integer("conversations").notNull().default(0), ...timestamps(),
}, (table) => ({ orgIndex: index("channels_org_idx").on(table.organizationId), externalIndex: uniqueIndex("channels_org_external_unique").on(table.organizationId, table.externalId) }));

export const conversations = pgTable("conversations", {
  id: id("id"), organizationId: org(), externalId: text("external_id"), contactId: text("contact_id").notNull(), channelId: text("channel_id").notNull(), departmentId: text("department_id"), status: text("status").notNull(), assignedToId: text("assigned_to_id"), unread: integer("unread").notNull().default(0), lastMessage: text("last_message").notNull(), lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(), ...timestamps(),
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

export const opportunityEmails = pgTable("opportunity_emails", {
  id: id("id"), organizationId: org(), opportunityId: text("opportunity_id").notNull(), actorId: text("actor_id").notNull(), fromEmail: text("from_email").notNull(), toEmail: text("to_email").notNull(), cc: text("cc").notNull().default(""), bcc: text("bcc").notNull().default(""), subject: text("subject").notNull(), bodyHtml: text("body_html").notNull(), bodyText: text("body_text").notNull().default(""), status: text("status").notNull(), provider: text("provider").notNull().default("lark_smtp"), providerMessageId: text("provider_message_id"), errorCode: text("error_code"), sentAt: timestamp("sent_at", { withTimezone: true }), ...timestamps(),
}, (table) => ({ orgOpportunityIndex: index("opportunity_emails_org_opportunity_idx").on(table.organizationId, table.opportunityId, table.createdAt), orgIndex: index("opportunity_emails_org_idx").on(table.organizationId) }));

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

export const products = pgTable("products", {
  id: id("id"), organizationId: org(), sku: text("sku").notNull(), name: text("name").notNull(), description: text("description").notNull().default(""), price: numeric("price", { precision: 14, scale: 2 }).notNull(), active: boolean("active").notNull().default(true), ...timestamps(),
}, (table) => ({ orgSkuUnique: uniqueIndex("products_org_sku_unique").on(table.organizationId, table.sku), orgIndex: index("products_org_idx").on(table.organizationId) }));

export const sales = pgTable("sales", {
  id: id("id"), organizationId: org(), contactId: text("contact_id").notNull(), ownerId: text("owner_id").notNull(), status: text("status").notNull().default("OPEN"), subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(), discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"), total: numeric("total", { precision: 14, scale: 2 }).notNull(), currency: text("currency").notNull().default("BRL"), source: text("source").notNull().default("CRM"), closedAt: timestamp("closed_at", { withTimezone: true }), ...timestamps(),
}, (table) => ({ orgStatusIndex: index("sales_org_status_idx").on(table.organizationId, table.status), orgIndex: index("sales_org_idx").on(table.organizationId) }));

export const saleItems = pgTable("sale_items", {
  id: id("id"), organizationId: org(), saleId: text("sale_id").notNull(), productId: text("product_id"), description: text("description").notNull(), quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(), unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(), total: numeric("total", { precision: 14, scale: 2 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ orgSaleIndex: index("sale_items_org_sale_idx").on(table.organizationId, table.saleId) }));

export const contracts = pgTable("contracts", {
  id: id("id"), organizationId: org(), saleId: text("sale_id"), contactId: text("contact_id").notNull(), number: text("number").notNull(), status: text("status").notNull().default("DRAFT"), total: numeric("total", { precision: 14, scale: 2 }).notNull(), startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }), renewalAt: timestamp("renewal_at", { withTimezone: true }), signatureProvider: text("signature_provider"), externalId: text("external_id"), ...timestamps(),
}, (table) => ({ orgNumberUnique: uniqueIndex("contracts_org_number_unique").on(table.organizationId, table.number), orgStatusIndex: index("contracts_org_status_idx").on(table.organizationId, table.status) }));

export const goals = pgTable("goals", {
  id: id("id"), organizationId: org(), userId: text("user_id"), name: text("name").notNull(), metric: text("metric").notNull(), periodStart: timestamp("period_start", { withTimezone: true }).notNull(), periodEnd: timestamp("period_end", { withTimezone: true }).notNull(), target: numeric("target", { precision: 14, scale: 2 }).notNull(), actual: numeric("actual", { precision: 14, scale: 2 }).notNull().default("0"), status: text("status").notNull().default("ACTIVE"), ...timestamps(),
}, (table) => ({ orgPeriodIndex: index("goals_org_period_idx").on(table.organizationId, table.periodStart, table.periodEnd), userIndex: index("goals_org_user_idx").on(table.organizationId, table.userId) }));

export const commissionPlans = pgTable("commission_plans", {
  id: id("id"), organizationId: org(), name: text("name").notNull(), basis: text("basis").notNull().default("SALE_TOTAL"), active: boolean("active").notNull().default(true), ...timestamps(),
}, (table) => ({ orgNameUnique: uniqueIndex("commission_plans_org_name_unique").on(table.organizationId, table.name), orgIndex: index("commission_plans_org_idx").on(table.organizationId) }));

export const commissionRules = pgTable("commission_rules", {
  id: id("id"), organizationId: org(), planId: text("plan_id").notNull(), minAmount: numeric("min_amount", { precision: 14, scale: 2 }).notNull().default("0"), maxAmount: numeric("max_amount", { precision: 14, scale: 2 }), rate: numeric("rate", { precision: 8, scale: 4 }).notNull().default("0"), fixedAmount: numeric("fixed_amount", { precision: 14, scale: 2 }).notNull().default("0"), position: integer("position").notNull(), ...timestamps(),
}, (table) => ({ planPositionUnique: uniqueIndex("commission_rules_plan_position_unique").on(table.planId, table.position), orgIndex: index("commission_rules_org_idx").on(table.organizationId) }));

export const commissionEntries = pgTable("commission_entries", {
  id: id("id"), organizationId: org(), saleId: text("sale_id"), sellerId: text("seller_id").notNull(), planId: text("plan_id"), ruleSnapshot: jsonb("rule_snapshot").$type<Record<string, unknown>>().notNull().default({}), basisAmount: numeric("basis_amount", { precision: 14, scale: 2 }).notNull(), commissionAmount: numeric("commission_amount", { precision: 14, scale: 2 }).notNull(), status: text("status").notNull().default("PENDING"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ orgSellerIndex: index("commission_entries_org_seller_idx").on(table.organizationId, table.sellerId), saleUnique: uniqueIndex("commission_entries_sale_seller_unique").on(table.saleId, table.sellerId) }));

export const auditEvents = pgTable("audit_events", {
  id: id("id"), organizationId: org(), actorId: text("actor_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ orgCreatedIndex: index("audit_events_org_created_idx").on(table.organizationId, table.createdAt), entityIndex: index("audit_events_entity_idx").on(table.organizationId, table.entityType, table.entityId) }));

export const schemaTables = { organizations, users, organizationMembers, departments, departmentMembers, routingRules, contacts, channels, conversations, messages, pipelines, pipelineStages, opportunities, opportunityActivities, opportunityEmails, tags, contactTags, integrationAccounts, authSessions, webhookEvents, organizationInvites, opportunityConversations, products, sales, saleItems, contracts, goals, commissionPlans, commissionRules, commissionEntries, auditEvents };
