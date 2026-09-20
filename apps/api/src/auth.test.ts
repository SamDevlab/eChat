import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed-data.js";
import { authenticateLocalUser } from "./providers.js";

describe("local authentication contract", () => {
  it("accepts the local-only seed password and rejects invalid credentials", () => {
    const state = createSeedState();
    expect(authenticateLocalUser(state, "owner@echat.local", "local-only")?.role).toBe("OWNER");
    expect(authenticateLocalUser(state, "owner@echat.local", "wrong-password")).toBeUndefined();
  });
});
