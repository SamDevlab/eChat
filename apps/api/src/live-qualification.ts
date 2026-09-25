export type ReadOnlyChatwootProvider = {
  testConnection(): Promise<{ accountId: string; name?: string }>;
  listContacts(page: number): Promise<{ items: unknown[]; hasNextPage: boolean }>;
  listConversations(page: number): Promise<{ items: Array<{ channelExternalId?: string }>; hasNextPage: boolean }>;
  listWebhooks?(): Promise<Array<{ id: string; url: string; secret?: string }>>;
};

export type ChatwootQualificationOptions = {
  expectedAccountId: string;
  expectedInboxId?: string;
  expectedWebhookUrl?: string;
  requireWebhookMatch?: boolean;
};

export type ChatwootQualificationReport = {
  pass: boolean;
  accountMatch: boolean;
  accountName?: string;
  contactsOnFirstPage: number;
  conversationsOnFirstPage: number;
  inboxMatch: "PASS" | "FAIL" | "SKIPPED" | "EMPTY_PAGE";
  webhookMatch: "PASS" | "FAIL" | "SKIPPED";
  webhookCount?: number;
  mode: "READ_ONLY";
};

const normalizedUrl = (value: string): string => {
  const parsed = new URL(value);
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
};

export const qualifyChatwootReadOnly = async (
  provider: ReadOnlyChatwootProvider,
  options: ChatwootQualificationOptions,
): Promise<ChatwootQualificationReport> => {
  const account = await provider.testConnection();
  const accountMatch = String(account.accountId) === String(options.expectedAccountId);

  const contacts = await provider.listContacts(1);
  const conversations = await provider.listConversations(1);

  let inboxMatch: ChatwootQualificationReport["inboxMatch"] = "SKIPPED";
  if (options.expectedInboxId) {
    inboxMatch = conversations.items.length === 0
      ? "EMPTY_PAGE"
      : conversations.items.every(
        (item) => String(item.channelExternalId ?? "") === String(options.expectedInboxId),
      )
        ? "PASS"
        : "FAIL";
  }

  let webhookMatch: ChatwootQualificationReport["webhookMatch"] = "SKIPPED";
  let webhookCount: number | undefined;
  if (options.expectedWebhookUrl) {
    const webhooks = provider.listWebhooks ? await provider.listWebhooks() : [];
    webhookCount = webhooks.length;
    const expected = normalizedUrl(options.expectedWebhookUrl);
    webhookMatch = webhooks.some((item) => {
      try {
        return normalizedUrl(item.url) === expected;
      } catch {
        return false;
      }
    }) ? "PASS" : "FAIL";
  }

  const webhookPass = !options.requireWebhookMatch || webhookMatch === "PASS";
  const inboxPass = inboxMatch !== "FAIL";
  return {
    pass: accountMatch && inboxPass && webhookPass,
    accountMatch,
    accountName: account.name,
    contactsOnFirstPage: contacts.items.length,
    conversationsOnFirstPage: conversations.items.length,
    inboxMatch,
    webhookMatch,
    webhookCount,
    mode: "READ_ONLY",
  };
};
