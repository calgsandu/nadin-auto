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

test("dispatcher failures render a safe recovery page instead of an empty response", () => {
  const route = readFileSync("src/app/auth/2fa/continue/route.ts", "utf8");
  const page = readFileSync("src/app/auth/2fa/error/page.tsx", "utf8");

  assert.match(route, /try\s*\{/);
  assert.match(route, /catch\s*\(/);
  assert.match(route, /\[2fa\] continuation failed/);
  assert.match(route, /\/auth\/2fa\/error/);
  assert.match(page, /\/auth\/2fa\/continue/);
  assert.match(page, /\/auth\/sign-in/);
  assert.match(page, /Autentificarea nu a putut fi finalizată/);
});
