// AES-256-GCM encryption for Plaid access tokens at rest.
// Runs only in Node route handlers (never the Edge middleware).
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "dev-insecure-encryption-key";
  // Derive a stable 32-byte key from whatever string is provided.
  return createHash("sha256").update(secret).digest();
}

/** Encrypt to `iv:tag:ciphertext` (all base64). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/** Decrypt a value produced by {@link encrypt}. Throws on tamper. */
export function decrypt(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(":");
  if (!ivB || !tagB || !dataB) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
