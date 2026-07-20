import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("setup renders a server-generated QR and safe manual enrollment controls", () => {
  const page = readFileSync("src/app/auth/2fa/setup/page.tsx", "utf8");
  const form = readFileSync("src/app/auth/2fa/setup/setup-form.tsx", "utf8");

  assert.match(page, /QRCode\.toDataURL/);
  assert.match(form, /Cheie manuală/);
  assert.match(form, /name="rememberDevice"/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /pattern="\[0-9\]\{6\}"/);
  assert.doesNotMatch(page, /redirect\([^)]*(?:secret|otpauth)/i);
  assert.doesNotMatch(form, /href=[^\n]*(?:secret|otpauth)/i);
});
