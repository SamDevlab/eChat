import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed-data.js";
import { createStore, processWebhook } from "./services.js";

describe("webhook idempotency", () => {
  it("normalizes an inbound message once", () => {
    const store = createStore(createSeedState()); const actor = { ...store.state.users[0], sessionId: "session" };
    const payload = { event: "message_created", conversation_id: "conv-maria", content: "Mensagem do webhook" };
    expect(processWebhook(store, actor, "evt-1", payload)).toEqual({ processed: true, duplicate: false });
    expect(processWebhook(store, actor, "evt-1", payload)).toEqual({ processed: false, duplicate: true });
    expect(store.state.conversations[0].messages.filter((item) => item.body === "Mensagem do webhook")).toHaveLength(1);
  });
});
