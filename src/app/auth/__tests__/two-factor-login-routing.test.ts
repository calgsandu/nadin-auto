import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("password and Google first factors always enter the 2FA dispatcher", () => {
  const actions = readFileSync("src/app/auth/actions.ts", "utf8");
  const loginForm = readFileSync("src/app/auth/login-form.tsx", "utf8");
  const callback = readFileSync("src/app/auth/auth-callback.tsx", "utf8");

  assert.match(actions, /callbackURL:\s*["']\/auth\/2fa\/continue["']/);
  assert.match(actions, /redirect\(["']\/auth\/2fa\/continue["']\)/);
  assert.match(loginForm, /callbackURL:\s*["']\/auth\/callback["']/);
  assert.match(callback, /window\.location\.assign\(["']\/auth\/2fa\/continue["']\)/);
});
