import { afterEach, describe, expect, it } from "vitest";
import { canSendExternalMessage, outboundMode } from "./outbound.js";

const originalMode = process.env.ECHAT_OUTBOUND_MODE;
const originalAllowlist = process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS;
afterEach(() => {
  if (originalMode === undefined) delete process.env.ECHAT_OUTBOUND_MODE;
  else process.env.ECHAT_OUTBOUND_MODE = originalMode;
  if (originalAllowlist === undefined) delete process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS;
  else process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS = originalAllowlist;
});

describe("Chatwoot outbound policy", () => {
  it("defaults to disabled and fails closed on invalid modes", () => {
    delete process.env.ECHAT_OUTBOUND_MODE;
    expect(outboundMode()).toBe("disabled");
    process.env.ECHAT_OUTBOUND_MODE = "anything-else";
    expect(outboundMode()).toBe("disabled");
    expect(canSendExternalMessage("integration-a", "conversation-1")).toBe(false);
  });

  it("requires both the matching integration and allowlisted external conversation in pilot", () => {
    process.env.ECHAT_OUTBOUND_MODE = "pilot";
    process.env.ECHAT_OUTBOUND_PILOT_CONVERSATIONS = "integration-a:conversation-1";
    expect(canSendExternalMessage("integration-a", "conversation-1")).toBe(true);
    expect(canSendExternalMessage("integration-b", "conversation-1")).toBe(false);
    expect(canSendExternalMessage("integration-a", "conversation-2")).toBe(false);
  });

  it("allows mapped conversations only in enabled mode", () => {
    process.env.ECHAT_OUTBOUND_MODE = "enabled";
    expect(canSendExternalMessage("integration-a", "conversation-1")).toBe(true);
    expect(canSendExternalMessage("integration-a", undefined)).toBe(false);
  });
});
