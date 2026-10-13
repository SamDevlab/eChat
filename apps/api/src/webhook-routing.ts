export type WebhookCandidate = {
  integration: { providerInboxId: string | null };
  provider: { verifyWebhook?: (headers: Record<string, string | undefined>, rawBody: string) => boolean };
};

export const externalInboxFromPayload = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const value = payload as Record<string, unknown>;
  const conversation = value.conversation;
  if (conversation && typeof conversation === "object") {
    const record = conversation as Record<string, unknown>;
    if (typeof record.inbox_id === "string" || typeof record.inbox_id === "number") return String(record.inbox_id);
    const inbox = record.inbox;
    if (inbox && typeof inbox === "object") {
      const id = (inbox as Record<string, unknown>).id;
      if (typeof id === "string" || typeof id === "number") return String(id);
    }
  }
  const inbox = value.inbox;
  if (inbox && typeof inbox === "object") {
    const id = (inbox as Record<string, unknown>).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  if (typeof value.inbox_id === "string" || typeof value.inbox_id === "number") return String(value.inbox_id);
  return undefined;
};

export const selectChatwootWebhookCandidate = <T extends WebhookCandidate>(
  candidates: T[],
  headers: Record<string, string | undefined>,
  rawBody: string,
  payload: unknown,
): T | null => {
  const verified = candidates.filter(({ provider }) => provider.verifyWebhook?.(headers, rawBody));
  if (verified.length === 1) return verified[0];
  if (verified.length === 0) return null;
  const inboxId = externalInboxFromPayload(payload);
  if (!inboxId) return null;
  const scoped = verified.filter(({ integration }) => integration.providerInboxId === inboxId);
  return scoped.length === 1 ? scoped[0] : null;
};
