type ReadinessClient = { unsafe: (query: string) => Promise<unknown> };

export const checkDatabaseReadiness = async (client: ReadinessClient): Promise<boolean> => {
  const rows = await client.unsafe("SELECT to_regclass('organizations') AS organizations, to_regclass('integration_accounts') AS integration_accounts");
  const row = Array.isArray(rows) ? rows[0] as { organizations?: unknown; integration_accounts?: unknown } | undefined : undefined;
  return Boolean(row?.organizations && row.integration_accounts);
};
