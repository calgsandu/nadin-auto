import assert from "node:assert/strict";
import test from "node:test";
import { canConsumeTotpStep } from "@/lib/auth/two-factor/verification";

test("accepts only a TOTP step newer than the last consumed step", () => {
  assert.equal(canConsumeTotpStep(null, 100), true);
  assert.equal(canConsumeTotpStep(BigInt(99), 100), true);
  assert.equal(canConsumeTotpStep(BigInt(100), 100), false);
  assert.equal(canConsumeTotpStep(BigInt(101), 100), false);
});
