import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const PREFIX = "v1:";

function encryptionKey(): Buffer | null {
  const raw = process.env.FPL_CREDENTIALS_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  return b64.length === 32 ? b64 : null;
}

/** Encrypt for storage when `FPL_CREDENTIALS_KEY` is set (32-byte hex or base64). */
export function encryptFplCredential(plaintext: string): string {
  const key = encryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptFplCredential(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;

  const key = encryptionKey();
  if (!key) {
    throw new Error("FPL_CREDENTIALS_KEY required to decrypt stored FPL sessions");
  }

  const body = stored.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = body.split(":");
  if (!ivB64 || !dataB64 || !tagB64) return stored;

  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
