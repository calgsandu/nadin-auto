import assert from "node:assert/strict";
import test from "node:test";
import { hashNeonSessionId, hashToken } from "@/lib/auth/two-factor/crypto";
import { sessionProofMatches } from "@/lib/auth/two-factor/session";

const now = new Date("2026-07-21T10:00:00.000Z");
const input = {
  rawToken: "proof-token",
  appUserId: "user_1",
  credentialId: "credential_1",
  authSessionId: "session_1",
  now,
};
const proof = {
  tokenHash: hashToken(input.rawToken),
  appUserId: input.appUserId,
  credentialId: input.credentialId,
  authSessionHash: hashNeonSessionId(input.authSessionId),
  expiresAt: new Date("2026-07-21T11:00:00.000Z"),
};

test("accepts a proof bound to the exact user, credential, session, and future expiry", () => {
  assert.equal(sessionProofMatches(proof, input), true);
});

test("rejects a proof for a different user", () => {
  assert.equal(sessionProofMatches(proof, { ...input, appUserId: "user_2" }), false);
});

test("rejects a proof for a different credential", () => {
  assert.equal(
    sessionProofMatches(proof, { ...input, credentialId: "credential_2" }),
    false,
  );
});

test("rejects a proof for a different Neon session", () => {
  assert.equal(
    sessionProofMatches(proof, { ...input, authSessionId: "session_2" }),
    false,
  );
});

test("rejects a proof exactly at its expiry", () => {
  assert.equal(sessionProofMatches(proof, { ...input, now: proof.expiresAt }), false);
});
