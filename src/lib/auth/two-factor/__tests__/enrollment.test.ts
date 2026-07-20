import assert from "node:assert/strict";
import test from "node:test";
import { resolveEnrollmentSetupKind } from "@/lib/auth/two-factor/enrollment";

const now = new Date("2026-07-20T12:00:00.000Z");

test("requires an administrator activation code when no credential exists", () => {
  assert.equal(resolveEnrollmentSetupKind(null, "session_hash", now), "ACTIVATION_REQUIRED");
});

test("reveals enrollment only to the exact bound session before expiry", () => {
  assert.equal(
    resolveEnrollmentSetupKind(
      {
        status: "PENDING",
        setupExpiresAt: new Date("2026-07-20T12:14:00.000Z"),
        enrollmentAuthSessionHash: "session_hash",
      },
      "session_hash",
      now,
    ),
    "READY",
  );
});

test("rejects legacy pending credentials without a session binding", () => {
  assert.equal(
    resolveEnrollmentSetupKind(
      {
        status: "PENDING",
        setupExpiresAt: new Date("2026-07-20T12:14:00.000Z"),
        enrollmentAuthSessionHash: null,
      },
      "session_hash",
      now,
    ),
    "ACTIVATION_REQUIRED",
  );
});

test("rejects a pending credential bound to another session", () => {
  assert.equal(
    resolveEnrollmentSetupKind(
      {
        status: "PENDING",
        setupExpiresAt: new Date("2026-07-20T12:14:00.000Z"),
        enrollmentAuthSessionHash: "other_session_hash",
      },
      "session_hash",
      now,
    ),
    "ACTIVATION_REQUIRED",
  );
});

test("rejects an expired pending credential even in the bound session", () => {
  assert.equal(
    resolveEnrollmentSetupKind(
      {
        status: "PENDING",
        setupExpiresAt: new Date("2026-07-20T12:00:00.000Z"),
        enrollmentAuthSessionHash: "session_hash",
      },
      "session_hash",
      now,
    ),
    "ACTIVATION_REQUIRED",
  );
});

test("refuses to replace an active credential", () => {
  assert.equal(
    resolveEnrollmentSetupKind(
      {
        status: "ACTIVE",
        setupExpiresAt: null,
        enrollmentAuthSessionHash: null,
      },
      "session_hash",
      now,
    ),
    "REJECT_ACTIVE",
  );
});
