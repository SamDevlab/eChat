import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = { ciphertext: string; iv: string; tag: string; version: number };

const keyFromEnv = (value = process.env.INTEGRATION_ENCRYPTION_KEY): Buffer => {
  if (!value) throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada");
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes");
  return decoded;
};

export const encryptSecret = (value: string, key = process.env.INTEGRATION_ENCRYPTION_KEY): EncryptedSecret => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnv(key), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), version: 1 };
};

export const decryptSecret = (encrypted: EncryptedSecret, key = process.env.INTEGRATION_ENCRYPTION_KEY): string => {
  if (encrypted.version !== 1) throw new Error("Versão de credencial não suportada");
  const decipher = createDecipheriv("aes-256-gcm", keyFromEnv(key), Buffer.from(encrypted.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64url")), decipher.final()]).toString("utf8");
};

export const hasIntegrationEncryptionKey = (): boolean => {
  try { keyFromEnv(); return true; } catch { return false; }
};
