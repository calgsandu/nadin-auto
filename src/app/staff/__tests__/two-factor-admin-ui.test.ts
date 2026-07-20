import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("staff UI shows 2FA status and hides reset for the current administrator", () => {
  const crm = readFileSync("src/app/crm/page.tsx", "utf8");
  const dialogs = readFileSync("src/app/staff/staff-dialogs.tsx", "utf8");

  assert.match(crm, />2FA</);
  assert.match(crm, /Activ/);
  assert.match(crm, /În configurare/);
  assert.match(crm, /Neconfigurat/);
  assert.match(crm, /user\.id !== currentUserId/);
  assert.match(crm, /ResetTwoFactorDialog/);
  assert.match(dialogs, /export function ResetTwoFactorDialog/);
  assert.match(dialogs, /name="confirmation"/);
  assert.match(dialogs, /toate sesiunile/i);
});
