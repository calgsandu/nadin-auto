import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("setup renders a server-generated QR and safe manual enrollment controls", () => {
  const page = readFileSync("src/app/auth/2fa/setup/page.tsx", "utf8");
  const form = readFileSync("src/app/auth/2fa/setup/setup-form.tsx", "utf8");
  const activationForm = readFileSync(
    "src/app/auth/2fa/setup/activation-form.tsx",
    "utf8",
  );

  assert.match(page, /QRCode\.toDataURL/);
  assert.match(page, /ACTIVATION_REQUIRED/);
  assert.match(page, /<ActivationForm/);
  assert.match(activationForm, /name="activationCode"/);
  assert.match(form, /Cheie manuală/);
  assert.match(form, /name="rememberDevice"/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /pattern="\[0-9\]\{6\}"/);
  assert.doesNotMatch(page, /redirect\([^)]*(?:secret|otpauth)/i);
  assert.doesNotMatch(form, /href=[^\n]*(?:secret|otpauth)/i);
});

test("the use-server module exports only server actions at runtime", () => {
  const actions = readFileSync("src/app/auth/2fa/actions.ts", "utf8");
  const setupForm = readFileSync(
    "src/app/auth/2fa/setup/setup-form.tsx",
    "utf8",
  );
  const verifyForm = readFileSync(
    "src/app/auth/2fa/verify/verify-form.tsx",
    "utf8",
  );

  assert.doesNotMatch(actions, /export const initialTwoFactorFormState/);
  assert.match(setupForm, /@\/app\/auth\/2fa\/form-state/);
  assert.match(verifyForm, /@\/app\/auth\/2fa\/form-state/);
});

test("activation is consumed before the pending secret is created and both are audited", () => {
  const enrollment = readFileSync(
    "src/lib/auth/two-factor/enrollment.ts",
    "utf8",
  );

  assert.match(enrollment, /consumeEnrollmentGrant\(tx/);
  assert.match(enrollment, /enrollmentAuthSessionHash/);
  assert.match(enrollment, /logAuditRequired\(tx/);
  assert.doesNotMatch(enrollment, /getOrCreatePendingEnrollment/);
});
