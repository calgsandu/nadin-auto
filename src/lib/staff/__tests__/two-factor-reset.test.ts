import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTwoFactorResetConfirmation } from "@/lib/staff/validate";

test("requires exact username confirmation for an administrator reset", () => {
  const form = new FormData();
  form.set("userId", "target_1");
  form.set("username", "ion");
  form.set("confirmation", "ion");
  assert.deepEqual(parseTwoFactorResetConfirmation(form), {
    userId: "target_1",
    username: "ion",
  });

  form.set("confirmation", "ION");
  assert.throws(() => parseTwoFactorResetConfirmation(form), /exact/);
});

test("the reset action is admin-only, forbids self-reset, audits, and revokes Neon sessions", () => {
  const source = readFileSync("src/app/staff/actions.ts", "utf8");
  const start = source.indexOf("export async function resetStaffTwoFactorAction");
  const next = source.indexOf("\nexport async function ", start + 1);
  assert.notEqual(start, -1);
  const body = source.slice(start, next === -1 ? undefined : next);

  assert.match(body, /requireStaffAdmin\(\)/);
  assert.match(body, /target\.id === admin\.id/);
  assert.match(body, /prisma\.\$transaction/);
  assert.match(body, /logAuditRequired/);
  assert.match(body, /revokeAuthSessions\(target\.authUserId\)/);
});
