import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccessKind } from "@/lib/auth/two-factor/access-state";

test("resolves the four authentication states exhaustively", () => {
  assert.equal(
    resolveAccessKind({ primary: null, resetAt: null, credentialStatus: null, proofValid: false }),
    "UNAUTHENTICATED",
  );
  assert.equal(
    resolveAccessKind({
      primary: { sessionCreatedAt: new Date(20) },
      resetAt: new Date(20),
      credentialStatus: null,
      proofValid: false,
    }),
    "UNAUTHENTICATED",
  );
  assert.equal(
    resolveAccessKind({
      primary: { sessionCreatedAt: new Date(21) },
      resetAt: new Date(20),
      credentialStatus: null,
      proofValid: false,
    }),
    "ENROLLMENT_REQUIRED",
  );
  assert.equal(
    resolveAccessKind({
      primary: { sessionCreatedAt: new Date(21) },
      resetAt: null,
      credentialStatus: "PENDING",
      proofValid: false,
    }),
    "ENROLLMENT_REQUIRED",
  );
  assert.equal(
    resolveAccessKind({
      primary: { sessionCreatedAt: new Date(21) },
      resetAt: null,
      credentialStatus: "ACTIVE",
      proofValid: false,
    }),
    "TOTP_REQUIRED",
  );
  assert.equal(
    resolveAccessKind({
      primary: { sessionCreatedAt: new Date(21) },
      resetAt: null,
      credentialStatus: "ACTIVE",
      proofValid: true,
    }),
    "AUTHENTICATED",
  );
});
