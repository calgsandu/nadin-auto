import assert from "node:assert/strict";
import test from "node:test";
import { hashToken } from "@/lib/auth/two-factor/crypto";
import {
  consumeAndRotateTrustedDevice,
  trustedDeviceExpiry,
  trustedDeviceMatches,
  type TrustedDeviceRotationStore,
} from "@/lib/auth/two-factor/session";

const now = new Date("2026-07-21T10:00:00.000Z");
const oldToken = "old-trusted-token";
const record = {
  tokenHash: hashToken(oldToken),
  appUserId: "user_1",
  credentialId: "credential_1",
  expiresAt: new Date("2026-07-22T10:00:00.000Z"),
};

test("expires a trusted device exactly thirty days after issuance", () => {
  assert.equal(
    trustedDeviceExpiry(now).toISOString(),
    "2026-08-20T10:00:00.000Z",
  );
});

test("rejects a trusted device for another user, credential, or exact expiry", () => {
  assert.equal(
    trustedDeviceMatches(record, {
      rawToken: oldToken,
      appUserId: "user_1",
      credentialId: "credential_1",
      now,
    }),
    true,
  );
  assert.equal(
    trustedDeviceMatches(record, {
      rawToken: oldToken,
      appUserId: "user_2",
      credentialId: "credential_1",
      now,
    }),
    false,
  );
  assert.equal(
    trustedDeviceMatches(record, {
      rawToken: oldToken,
      appUserId: "user_1",
      credentialId: "credential_2",
      now,
    }),
    false,
  );
  assert.equal(
    trustedDeviceMatches(record, {
      rawToken: oldToken,
      appUserId: "user_1",
      credentialId: "credential_1",
      now: record.expiresAt,
    }),
    false,
  );
});

test("rotates a trusted token exactly once", async () => {
  const hashes = new Set([hashToken(oldToken)]);
  const store: TrustedDeviceRotationStore = {
    async rotate(input) {
      if (!hashes.delete(input.presentedTokenHash)) return false;
      hashes.add(input.replacementTokenHash);
      return true;
    },
  };
  const input = {
    rawToken: oldToken,
    appUserId: "user_1",
    credentialId: "credential_1",
    now,
  };

  const first = await consumeAndRotateTrustedDevice(input, store);
  const second = await consumeAndRotateTrustedDevice(input, store);

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(hashes.has(hashToken(oldToken)), false);
  assert.equal(hashes.has(hashToken(first.rawToken)), true);
  assert.equal(first.expiresAt.toISOString(), "2026-08-20T10:00:00.000Z");
});
