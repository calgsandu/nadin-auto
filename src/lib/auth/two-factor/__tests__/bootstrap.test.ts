import assert from "node:assert/strict";
import test from "node:test";
import {
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
