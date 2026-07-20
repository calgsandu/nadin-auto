import assert from "node:assert/strict";
import test from "node:test";
import { readTwoFactorConfig } from "@/lib/auth/two-factor/config";

const key = Buffer.alloc(32, 7).toString("base64");

test("reads two independent 32-byte secrets", () => {
  const config = readTwoFactorConfig({
    NODE_ENV: "test",
    TWO_FACTOR_ENCRYPTION_KEY: key,
    TWO_FACTOR_RATE_LIMIT_PEPPER: key,
  });

  assert.deepEqual(config.encryptionKey, Buffer.alloc(32, 7));
  assert.equal(config.proofCookieName, "nadin-2fa-session");
  assert.equal(config.trustedCookieName, "nadin-trusted-device");
  assert.equal(config.secureCookies, false);
});

test("requires the encryption key", () => {
  assert.throws(() => readTwoFactorConfig({}), /TWO_FACTOR_ENCRYPTION_KEY/);
});

test("rejects decoded secrets that are not exactly 32 bytes", () => {
  assert.throws(
    () => readTwoFactorConfig({
      TWO_FACTOR_ENCRYPTION_KEY: "c2hvcnQ=",
      TWO_FACTOR_RATE_LIMIT_PEPPER: key,
    }),
    /32 bytes/,
  );
});

test("uses __Host cookies in production", () => {
  const config = readTwoFactorConfig({
    NODE_ENV: "production",
    TWO_FACTOR_ENCRYPTION_KEY: key,
    TWO_FACTOR_RATE_LIMIT_PEPPER: key,
  });

  assert.equal(config.proofCookieName, "__Host-nadin-2fa-session");
  assert.equal(config.trustedCookieName, "__Host-nadin-trusted-device");
  assert.equal(config.secureCookies, true);
});
