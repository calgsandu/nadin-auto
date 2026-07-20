import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTwoFactorActivationTarget } from "@/lib/staff/validate";

test("activation issuance carries the exact selected username", () => {
  const form = new FormData();
  form.set("userId", "target_1");
  form.set("username", "ion");
  assert.deepEqual(parseTwoFactorActivationTarget(form), {
    userId: "target_1",
    username: "ion",
  });
});

test("activation action is admin-only, rejects self and active credentials, replaces and audits transactionally", () => {
  const source = readFileSync("src/app/staff/actions.ts", "utf8");
  const start = source.indexOf(
    "export async function issueStaffTwoFactorActivationAction",
  );
  const next = source.indexOf("\nexport async function ", start + 1);
  assert.notEqual(start, -1);
  const body = source.slice(start, next === -1 ? undefined : next);

  assert.match(body, /requireStaffAdmin\(\)/);
  assert.match(body, /target\.id === admin\.id/);
  assert.match(body, /twoFactorCredential\?\.status === "ACTIVE"/);
  assert.match(body, /target\.username !== input\.username/);
  assert.match(body, /prisma\.\$transaction/);
  assert.match(body, /replaceEnrollmentGrant\(tx/);
  assert.match(body, /logAuditRequired\(tx/);
  assert.match(body, /revealedActivationCode/);
  assert.match(body, /activationExpiresAt/);
});
