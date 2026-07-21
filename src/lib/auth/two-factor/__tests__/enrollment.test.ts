import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveEnrollmentSetupKind } from "@/lib/auth/two-factor/enrollment";

const now = new Date("2026-07-20T12:00:00.000Z");

test("requires an administrator activation code when no credential exists", () => {
  assert.equal(
    resolveEnrollmentSetupKind(null, "session_hash", now, false),
    "ACTIVATION_REQUIRED",
  );
});

test("offers bootstrap when the first administrator is eligible", () => {
  assert.equal(
    resolveEnrollmentSetupKind(null, "session_hash", now, true),
    "BOOTSTRAP_AVAILABLE",
  );
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

test("successful TOTP activation permanently closes initial bootstrap atomically", () => {
  const source = readFileSync("src/lib/auth/two-factor/enrollment.ts", "utf8");
  const confirm = source.indexOf("confirmPendingEnrollment");
  const transaction = source.indexOf("prisma.$transaction", confirm);
  const activation = source.indexOf("twoFactorCredential.updateMany", transaction);
  const marker = source.indexOf("applicationSecurityState.upsert", activation);
  const audit = source.indexOf("logAuditRequired", marker);

  assert.ok(transaction >= 0 && activation > transaction);
  assert.ok(marker > activation && audit > marker);
  assert.match(
    source.slice(marker, audit),
    /twoFactorBootstrapCompletedAt:\s*now/,
  );
  assert.doesNotMatch(
    source.slice(marker, audit),
    /data:\s*\{[^}]*twoFactorBootstrapCompletedAt:\s*null/s,
  );
});
