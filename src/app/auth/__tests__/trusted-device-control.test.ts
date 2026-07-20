import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("forgetting this device preserves the current 2FA and Neon sessions", () => {
  const actions = readFileSync("src/app/auth/actions.ts", "utf8");
  const control = readFileSync(
    "src/app/account/trusted-device-control.tsx",
    "utf8",
  );
  const start = actions.indexOf(
    "export async function forgetCurrentTrustedDeviceAction",
  );
  const nextExport = actions.indexOf("\nexport ", start + 1);
  const forgetAction = actions.slice(
    start,
    nextExport === -1 ? undefined : nextExport,
  );

  assert.notEqual(start, -1);
  assert.match(forgetAction, /state\.kind !== ["']AUTHENTICATED["']/);
  assert.match(forgetAction, /trustedDevice\.deleteMany/);
  assert.match(forgetAction, /appUserId:[\s\S]*tokenHash:/);
  assert.match(forgetAction, /trustedCookieName/);
  assert.doesNotMatch(forgetAction, /twoFactorSessionProof\.deleteMany/);
  assert.doesNotMatch(forgetAction, /auth\.signOut/);
  assert.match(control, /Uită acest dispozitiv/);
  assert.match(control, /window\.confirm/);
});
