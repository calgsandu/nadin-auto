import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  const next = source.indexOf("\nexport async function ", start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  return source.slice(start, next === -1 ? undefined : next);
}

test("own password change clears trusted devices but preserves the current proof", () => {
  const source = readFileSync("src/app/account/actions.ts", "utf8");
  const body = functionBody(source, "changeOwnPasswordAction");

  assert.match(body, /clearTrustedDevices/);
  assert.ok(body.indexOf("clearTrustedDevices") < body.indexOf("auth.changePassword"));
  assert.doesNotMatch(body, /clearSecondFactorSessions/);
  assert.doesNotMatch(body, /resetTwoFactorCredential/);
});

test("administrator password reset revokes local trust before changing Neon identity", () => {
  const source = readFileSync("src/app/staff/actions.ts", "utf8");
  const body = functionBody(source, "resetStaffPasswordAction");

  assert.match(body, /clearTrustedDevices/);
  assert.match(body, /clearSecondFactorSessions/);
  assert.ok(body.indexOf("clearSecondFactorSessions") < body.indexOf("createAuthIdentity"));
  assert.ok(body.indexOf("clearSecondFactorSessions") < body.indexOf("setAuthPassword"));
  assert.doesNotMatch(body, /resetTwoFactorCredential/);
});

test("deactivation blocks locally and clears trust before Neon ban and revocation", () => {
  const source = readFileSync("src/app/staff/actions.ts", "utf8");
  const body = functionBody(source, "setStaffActiveAction");

  assert.match(body, /prisma\.\$transaction/);
  assert.match(body, /active:\s*false/);
  assert.match(body, /clearTrustedDevices/);
  assert.match(body, /clearSecondFactorSessions/);
  assert.ok(body.indexOf("clearSecondFactorSessions") < body.indexOf("banAuthIdentity"));
  assert.doesNotMatch(body, /issueTrustedDevice|resetTwoFactorCredential/);
});
