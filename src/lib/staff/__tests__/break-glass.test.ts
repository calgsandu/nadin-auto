import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  expectedBreakGlassConfirmation,
  parseBreakGlassArgs,
} from "@/lib/staff/break-glass";

test("parses only the documented break-glass arguments", () => {
  assert.deepEqual(
    parseBreakGlassArgs([
      "--username",
      "ion",
      "--reason",
      "telefon pierdut",
    ]),
    { username: "ion", reason: "telefon pierdut" },
  );
  assert.deepEqual(parseBreakGlassArgs(["--help"]), { help: true });
  assert.throws(() => parseBreakGlassArgs(["--username", "ion"]), /reason/i);
  assert.throws(
    () =>
      parseBreakGlassArgs([
        "--username",
        "ion",
        "--reason",
        "x",
        "--force",
      ]),
    /--force/,
  );
});

test("requires an exact target-specific interactive confirmation", () => {
  assert.equal(expectedBreakGlassConfirmation("ion"), "RESET ion");
});

test("break-glass resets and issues one code atomically before Neon revocation", () => {
  const source = readFileSync("scripts/reset-staff-2fa.ts", "utf8");
  const transaction = source.indexOf("prisma.$transaction");
  const reset = source.indexOf("resetTwoFactorCredential(tx", transaction);
  const issue = source.indexOf("replaceEnrollmentGrant(tx", transaction);
  const audit = source.indexOf("auditLog.create", transaction);
  const codePrint = source.indexOf("activation.code");
  const revoke = source.indexOf("revokeAuthSessions(target.authUserId)");

  assert.ok(transaction >= 0 && reset > transaction);
  assert.ok(issue > reset && audit > issue);
  assert.ok(codePrint > audit && revoke > codePrint);
  assert.equal(source.match(/activation\.code/g)?.length, 1);
  assert.match(source, /breakGlass: true/);
  assert.match(source, /enrollmentGrantIssued: true/);
  assert.doesNotMatch(source, /--force/);
});
