import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = "v1";
const ENVELOPE_AAD = Buffer.from("nadin-auto:totp-secret:v1", "utf8");

function requireEncryptionKey(key: Buffer) {
  if (key.byteLength !== 32) {
    throw new Error("TOTP encryption key must be exactly 32 bytes");
  }
}

export function encryptTotpSecret(secret: string, key: Buffer) {
  requireEncryptionKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENVELOPE_AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(envelope: string, key: Buffer) {
  requireEncryptionKey(key);
  const [version, ivPart, tagPart, ciphertextPart, extra] = envelope.split(".");
  if (
    version !== ENVELOPE_VERSION
    || !ivPart
    || !tagPart
    || !ciphertextPart
    || extra !== undefined
  ) {
    throw new Error("Invalid encrypted TOTP secret envelope");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength === 0) {
    throw new Error("Invalid encrypted TOTP secret envelope");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(ENVELOPE_AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

function sha256(domain: string, value: string) {
  return createHash("sha256").update(domain, "utf8").update(value, "utf8").digest("hex");
}

export function hashToken(token: string) {
  return sha256("token:", token);
}

export function hashNeonSessionId(sessionId: string) {
  return sha256("neon-session:", sessionId);
}

export function hashRateLimitIp(ip: string, pepper: Buffer) {
  return createHmac("sha256", pepper).update("ip:", "utf8").update(ip, "utf8").digest("hex");
}
