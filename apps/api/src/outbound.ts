export type OutboundMode = "disabled" | "pilot" | "enabled";

export const outboundMode = (env: NodeJS.ProcessEnv = process.env): OutboundMode => {
  const value = env.ECHAT_OUTBOUND_MODE?.trim().toLowerCase();
  return value === "pilot" || value === "enabled" ? value : "disabled";
};

export const isPilotConversationAllowed = (
  integrationId: string,
  externalConversationId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (!externalConversationId) return false;
  const allowed = new Set((env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean));
  return allowed.has(`${integrationId}:${externalConversationId}`);
};

export const canSendExternalMessage = (
  integrationId: string,
  externalConversationId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const mode = outboundMode(env);
  if (mode === "enabled") return Boolean(externalConversationId);
  if (mode === "pilot") return isPilotConversationAllowed(integrationId, externalConversationId, env);
  return false;
};
