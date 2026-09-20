import { describe, expect, it } from "vitest";
import { hashPassword, hashSessionToken, verifyPassword } from "./auth.js";

describe("secure authentication primitives", () => {
  it("uses a versioned scrypt hash and rejects wrong passwords", () => {
    const stored = hashPassword("local-only");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("local-only");
    expect(verifyPassword("local-only", stored)).toBe(true);
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("stores a deterministic one-way hash of opaque session tokens", () => {
    expect(hashSessionToken("opaque-token")).toHaveLength(64);
    expect(hashSessionToken("opaque-token")).toBe(hashSessionToken("opaque-token"));
    expect(hashSessionToken("opaque-token")).not.toBe("opaque-token");
  });
});
