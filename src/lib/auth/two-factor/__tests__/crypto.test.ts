import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateOpaqueToken,
  hashNeonSessionId,
  hashRateLimitIp,
  hashToken,
} from "@/lib/auth/two-factor/crypto";

test("encrypts and decrypts a TOTP secret with a versioned envelope", () => {
  const key = Buffer.alloc(32, 3);
  const envelope = encryptTotpSecret("JBSWY3DPEHPK3PXP", key);

  assert.match(envelope, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(decryptTotpSecret(envelope, key), "JBSWY3DPEHPK3PXP");

  const replacement = envelope.endsWith("A") ? "B" : "A";
  assert.throws(() => decryptTotpSecret(`${envelope.slice(0, -1)}${replacement}`, key));
});

test("creates opaque tokens with at least 256 bits", () => {
  const token = generateOpaqueToken();
  assert.ok(Buffer.from(token, "base64url").byteLength >= 32);
});

test("domain-separates token, Neon session, and IP hashes", () => {
  const value = "203.0.113.8";
  const pepper = Buffer.alloc(32, 9);

  assert.equal(hashToken(value), hashToken(value));
  assert.notEqual(hashToken(value), hashNeonSessionId(value));
  assert.notEqual(hashRateLimitIp(value, pepper), hashToken(value));
});
