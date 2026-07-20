import assert from "node:assert/strict";
import test from "node:test";
import * as OTPAuth from "otpauth";
import {
  createTotpEnrollment,
  createTotpUri,
  matchTotpStep,
} from "@/lib/auth/two-factor/totp";

test("creates an authenticator-compatible Nadin Auto enrollment", () => {
  const { secret, uri } = createTotpEnrollment("ion");

  assert.match(secret, /^[A-Z2-7]+$/);
  assert.match(uri, /^otpauth:\/\/totp\/Nadin%20Auto:ion\?/);
  assert.equal(createTotpUri(secret, "ion"), uri);
});

test("accepts six-digit SHA1 codes only inside a one-step window", () => {
  const { secret } = createTotpEnrollment("ion");
  const timestamp = 1_800_000_000_000;
  const totp = new OTPAuth.TOTP({
    issuer: "Nadin Auto",
    label: "ion",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const code = totp.generate({ timestamp });

  assert.equal(matchTotpStep(secret, "ion", code, timestamp), Math.floor(timestamp / 30_000));
  assert.equal(matchTotpStep(secret, "ion", "12345", timestamp), null);
  assert.equal(matchTotpStep(secret, "ion", code, timestamp + 61_000), null);
});
