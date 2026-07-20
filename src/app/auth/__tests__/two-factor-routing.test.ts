import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the post-login dispatcher handles all four access states", () => {
  const route = readFileSync("src/app/auth/2fa/continue/route.ts", "utf8");

  for (const kind of [
    "UNAUTHENTICATED",
    "ENROLLMENT_REQUIRED",
    "TOTP_REQUIRED",
    "AUTHENTICATED",
  ]) {
    assert.match(route, new RegExp(`case ["']${kind}["']`));
  }
  assert.match(route, /STALE_AFTER_RESET[\s\S]*auth\.signOut/);
  assert.match(route, /\/auth\/sign-in/);
  assert.match(route, /\/auth\/2fa\/setup/);
  assert.match(route, /\/auth\/2fa\/verify/);
  assert.match(route, /\/crm/);
  assert.match(route, /consumeAndRotateTrustedDevice/);
});
