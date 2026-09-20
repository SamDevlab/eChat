import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto.js";

const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("integration secret encryption", () => {
  it("roundtrips with AES-256-GCM and uses a new nonce", () => {
    const first = encryptSecret("chatwoot-token", key); const second = encryptSecret("chatwoot-token", key);
    expect(decryptSecret(first, key)).toBe("chatwoot-token"); expect(first.iv).not.toBe(second.iv); expect(first.ciphertext).not.toContain("chatwoot-token");
  });
  it("rejects wrong keys and tampering", () => {
    const encrypted = encryptSecret("secret", key); const wrongKey = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefab";
    expect(() => decryptSecret(encrypted, wrongKey)).toThrow(); expect(() => decryptSecret({ ...encrypted, ciphertext: `${encrypted.ciphertext[0] === "A" ? "B" : "A"}${encrypted.ciphertext.slice(1)}` }, key)).toThrow();
  });
});
