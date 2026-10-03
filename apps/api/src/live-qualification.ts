export type ReadOnlyChatwootProvider = {
  testConnection(): Promise<{ accountId: string; name?: string }>;
  listInboxes(): Promise<Array<{ id: string; name: string }>>;
  listContacts(page: number): Promise<{ items: unknown[]; hasNextPage: boolean }>;
  listConversations(page: number): Promise<{ items: unknown[]; hasNextPage: boolean }>;
  listWebhooks(): Promise<Array<{ id: string; url: string; subscriptions: string[] }>>;
};

export type ChatwootQualificationOptions = {
  expectedAccountId: string;
  expectedInboxId: string;
  expectedWebhookUrl: string;
};

export type ChatwootQualificationReport = {
  pass: boolean;
  accountMatch: boolean;
  accountName?: string;
  inboxMatch: "PASS" | "FAIL";
  inboxCount: number;
  contactsOnFirstPage: number;
  conversationsOnFirstPage: number;
  webhookMatch: "PASS" | "FAIL";
  webhookCount: number;
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
  const [account, inboxes, contacts, conversations, webhooks] = await Promise.all([
    provider.testConnection(),
    provider.listInboxes(),
    provider.listContacts(1),
    provider.listConversations(1),
    provider.listWebhooks(),
  ]);
  const accountMatch = String(account.accountId) === String(options.expectedAccountId);
  const inboxMatch = inboxes.some((item) => String(item.id) === String(options.expectedInboxId));
  const expected = normalizedUrl(options.expectedWebhookUrl);
  const webhookMatch = webhooks.some((item) => {
    try {
      return normalizedUrl(item.url) === expected && item.subscriptions.includes("message_created");
    } catch {
      return false;
    }
  });

  return {
    pass: accountMatch && inboxMatch && webhookMatch,
    accountMatch,
    accountName: account.name,
    inboxMatch: inboxMatch ? "PASS" : "FAIL",
    inboxCount: inboxes.length,
    contactsOnFirstPage: contacts.items.length,
    conversationsOnFirstPage: conversations.items.length,
    webhookMatch: webhookMatch ? "PASS" : "FAIL",
    webhookCount: webhooks.length,
    mode: "READ_ONLY",
  };
};
