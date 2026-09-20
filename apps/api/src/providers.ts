import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Contact, Conversation, DemoState, Message, MessagingProvider, User } from "@echat/shared";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const localPasswordHash = hash("local-only");
export const authenticateLocalUser = (state: DemoState, email: string, password: string): User | undefined => state.users.find((candidate) => candidate.email === email && hash(password) === localPasswordHash);

export class MockMessagingProvider implements MessagingProvider {
  async sendMessage(input: { conversationId: string; body: string; internal?: boolean }): Promise<Message> {
    return { id: `msg-${Date.now()}`, conversationId: input.conversationId, sender: "AGENT", authorName: "Carlos Mendes (Você)", body: input.body, createdAt: new Date().toISOString(), internal: input.internal };
  }
  normalizeConversation(input: unknown): Conversation {
    const value = input as Conversation;
    return value;
  }
  normalizeMessage(input: unknown): Message {
    const value = input as Message;
    return value;
  }
  normalizeContact(input: unknown): Contact {
    const value = input as Contact;
    return value;
  }
  verifyWebhook(_headers: Record<string, string | undefined>, _rawBody: string): boolean { return true; }
}

export class ChatwootProvider extends MockMessagingProvider {
  readonly live = Boolean(process.env.CHATWOOT_BASE_URL && process.env.CHATWOOT_API_TOKEN && process.env.CHATWOOT_ACCOUNT_ID);
  override verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean {
    const secret = process.env.CHATWOOT_WEBHOOK_SECRET;
    const timestamp = headers["x-chatwoot-timestamp"];
    const signature = headers["x-chatwoot-signature"];
    if (!secret || !timestamp || !signature?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

export const createMessagingProvider = (): MessagingProvider => process.env.MESSAGING_PROVIDER === "chatwoot" ? new ChatwootProvider() : new MockMessagingProvider();
