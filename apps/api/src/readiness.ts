type ReadinessClient = { unsafe: (query: string) => Promise<unknown> };

const requiredTables = ["organizations", "users", "organization_members", "contacts", "channels", "conversations", "messages", "contact_identities", "integration_accounts", "webhook_events", "auth_sessions", "organization_invites", "pipelines", "pipeline_stages", "opportunities", "opportunity_activities", "opportunity_conversations"] as const;
const readinessQuery = `SELECT ${requiredTables.map((table) => `to_regclass('public.${table}') AS ${table}`).join(", ")}`;

export const checkDatabaseReadiness = async (client: ReadinessClient): Promise<boolean> => {
  const rows = await client.unsafe(readinessQuery);
  const row = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
  return Boolean(row && requiredTables.every((table) => row[table]));
};
