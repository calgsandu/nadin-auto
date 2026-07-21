import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("eligible first admin gets an explicit bootstrap action instead of an activation code", () => {
  const page = readFileSync("src/app/auth/2fa/setup/page.tsx", "utf8");
  const actions = readFileSync("src/app/auth/2fa/actions.ts", "utf8");
  const form = readFileSync(
    "src/app/auth/2fa/setup/bootstrap-form.tsx",
    "utf8",
  );

  assert.match(page, /BOOTSTRAP_AVAILABLE/);
  assert.match(page, /<BootstrapForm\s*\/>/);
  assert.match(actions, /startInitialTwoFactorBootstrapAction/);
  assert.match(actions, /startInitialTwoFactorBootstrap\(\{\s*primary/s);
  assert.match(actions, /redirect\(["']\/auth\/2fa\/setup["']\)/);
  assert.match(form, /Inițializează 2FA/);
  assert.doesNotMatch(form, /activationCode/);
});
