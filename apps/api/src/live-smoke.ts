import { ChatwootProvider } from "./providers.js";

const required = ["CHATWOOT_BASE_URL", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_API_TOKEN"] as const;
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.log("LIVE_TEST_BLOCKED_NO_LIVE_CREDENTIALS");
  console.log(`LIVE_TEST_MISSING_REQUIRED_VALUES=${missing.length}`);
  process.exit(0);
}

const provider = new ChatwootProvider({
  baseUrl: process.env.CHATWOOT_BASE_URL!,
  accountId: process.env.CHATWOOT_ACCOUNT_ID!,
  token: process.env.CHATWOOT_API_TOKEN!,
  webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET,
});

try {
  const account = await provider.testConnection();
  if (account.accountId !== process.env.CHATWOOT_ACCOUNT_ID) {
    console.error("LIVE_ACCOUNT_MATCH=FAIL");
    process.exit(1);
  }
  const contacts = await provider.listContacts(1);
  const conversations = await provider.listConversations(1);
  console.log("LIVE_CONNECTION_TEST=PASS");
  console.log("LIVE_ACCOUNT_MATCH=PASS");
  console.log(`LIVE_CONTACT_PAGE=PASS_ITEMS_${contacts.items.length}`);
  console.log(`LIVE_CONVERSATION_PAGE=PASS_ITEMS_${conversations.items.length}`);
  console.log(`LIVE_WEBHOOK_SECRET_PRESENT=${process.env.CHATWOOT_WEBHOOK_SECRET ? "YES" : "NO"}`);
  console.log("LIVE_TEST_MODE=READ_ONLY");
  console.log("LIVE_TEST_OUTBOUND=NOT_RUN");
  console.log("LIVE_TEST_WEBHOOK_REGISTRATION=NOT_RUN");
} catch {
  console.error("LIVE_TEST_PROVIDER_ERROR=SANITIZED");
  process.exit(1);
}
