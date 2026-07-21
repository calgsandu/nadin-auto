import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bootstrapSetupExpiry,
  isInitialTwoFactorBootstrapEligible,
  type BootstrapEligibilityInput,
} from "@/lib/auth/two-factor/bootstrap";

const eligible: BootstrapEligibilityInput = {
  currentUser: {
    id: "admin-1",
    role: "ADMIN",
    active: true,
    username: "admin",
  },
  firstActiveAdminId: "admin-1",
  activeCredentialCount: 0,
  bootstrapCompletedAt: null,
  hasForeignLivePendingCredential: false,
};

test("allows only the deterministic first active administrator before initialization", () => {
  assert.equal(isInitialTwoFactorBootstrapEligible(eligible), true);
});

const rejected: Array<[string, BootstrapEligibilityInput]> = [
  [
    "employee",
    { ...eligible, currentUser: { ...eligible.currentUser!, role: "ANGAJAT" } },
  ],
  [
    "director",
    { ...eligible, currentUser: { ...eligible.currentUser!, role: "DIRECTOR" } },
  ],
  ["later administrator", { ...eligible, firstActiveAdminId: "admin-0" }],
  [
    "inactive administrator",
    { ...eligible, currentUser: { ...eligible.currentUser!, active: false } },
  ],
  [
    "administrator without username",
    { ...eligible, currentUser: { ...eligible.currentUser!, username: null } },
  ],
  ["missing user", { ...eligible, currentUser: null }],
  ["existing active credential", { ...eligible, activeCredentialCount: 1 }],
  [
    "pending setup bound to another live session",
    { ...eligible, hasForeignLivePendingCredential: true },
  ],
  [
    "completed bootstrap",
    {
      ...eligible,
      bootstrapCompletedAt: new Date("2026-07-21T12:00:00.000Z"),
    },
  ],
];

for (const [name, input] of rejected) {
  test(`rejects ${name}`, () => {
    assert.equal(isInitialTwoFactorBootstrapEligible(input), false);
  });
}

test("bootstrap setup expires exactly fifteen minutes after it starts", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  assert.equal(
    bootstrapSetupExpiry(now).toISOString(),
    "2026-07-21T12:15:00.000Z",
  );
});

test("bootstrap enrollment revalidates and creates the pending credential serializably", () => {
  const source = readFileSync("src/lib/auth/two-factor/bootstrap.ts", "utf8");
  assert.match(source, /isolationLevel:\s*["']Serializable["']/);
  assert.match(
    source,
    /orderBy:\s*\[\{\s*createdAt:\s*["']asc["']\s*\},\s*\{\s*id:\s*["']asc["']/s,
  );
  assert.match(source, /status:\s*["']ACTIVE["']/);
  assert.match(source, /twoFactorCredential\.deleteMany/);
  assert.match(source, /twoFactorCredential\.create/);
  assert.match(source, /enrollmentAuthSessionHash:\s*hashNeonSessionId/);
  assert.match(source, /TWO_FACTOR_BOOTSTRAP_STARTED/);
  assert.match(source, /logAuditRequired/);
  assert.doesNotMatch(source, /consumeEnrollmentGrant/);
  assert.doesNotMatch(
    source,
    /where:\s*\{\s*role:\s*["']ADMIN["'],\s*active:\s*true,\s*username:/s,
  );
});
