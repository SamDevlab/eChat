import { ChatwootProvider } from "./providers.js";
import { qualifyChatwootReadOnly } from "./live-qualification.js";

const required = ["CHATWOOT_BASE_URL", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_API_TOKEN"] as const;
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.log("LIVE_TEST_BLOCKED_NO_LIVE_CREDENTIALS");
  console.log(`LIVE_TEST_MISSING_REQUIRED_VALUES=${missing.length}`);
  process.exit(0);
}

const publicAppUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
const expectedWebhookUrl = process.env.CHATWOOT_EXPECTED_WEBHOOK_URL?.trim()
  || (publicAppUrl ? `${publicAppUrl}/api/v1/webhooks/chatwoot` : undefined);
const expectedInboxId = process.env.CHATWOOT_INBOX_ID?.trim() || undefined;
const requireWebhookMatch = process.env.CHATWOOT_REQUIRE_WEBHOOK_MATCH === "1";

const provider = new ChatwootProvider({
  baseUrl: process.env.CHATWOOT_BASE_URL!,
  accountId: process.env.CHATWOOT_ACCOUNT_ID!,
  inboxId: expectedInboxId,
  token: process.env.CHATWOOT_API_TOKEN!,
  webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET,
});

try {
  const report = await qualifyChatwootReadOnly(provider, {
    expectedAccountId: process.env.CHATWOOT_ACCOUNT_ID!,
    expectedInboxId,
    expectedWebhookUrl,
    requireWebhookMatch,
  });

  console.log(`LIVE_CONNECTION_TEST=${report.pass ? "PASS" : "FAIL"}`);
  console.log(`LIVE_ACCOUNT_MATCH=${report.accountMatch ? "PASS" : "FAIL"}`);
  console.log(`LIVE_CONTACT_PAGE=PASS_ITEMS_${report.contactsOnFirstPage}`);
  console.log(`LIVE_CONVERSATION_PAGE=PASS_ITEMS_${report.conversationsOnFirstPage}`);
  console.log(`LIVE_INBOX_MATCH=${report.inboxMatch}`);
  console.log(`LIVE_WEBHOOK_MATCH=${report.webhookMatch}`);
  if (report.webhookCount !== undefined) console.log(`LIVE_WEBHOOK_COUNT=${report.webhookCount}`);
  console.log(`LIVE_WEBHOOK_MATCH_REQUIRED=${requireWebhookMatch ? "YES" : "NO"}`);
  console.log(`LIVE_WEBHOOK_SECRET_PRESENT=${process.env.CHATWOOT_WEBHOOK_SECRET ? "YES" : "NO"}`);
  console.log("LIVE_TEST_MODE=READ_ONLY");
  console.log("LIVE_TEST_OUTBOUND=NOT_RUN");
  console.log("LIVE_TEST_WEBHOOK_REGISTRATION=NOT_RUN");

  if (!report.pass) process.exit(1);
} catch {
  console.error("LIVE_TEST_PROVIDER_ERROR=SANITIZED");
  process.exit(1);
}
