import assert from "node:assert/strict";
import test from "node:test";
import { decidePendingEnrollment } from "@/lib/auth/two-factor/enrollment";

const now = new Date("2026-07-20T12:00:00.000Z");

test("creates an enrollment when no credential exists", () => {
  assert.equal(decidePendingEnrollment(null, now), "CREATE");
});

test("reuses an unexpired pending enrollment", () => {
  assert.equal(
    decidePendingEnrollment(
      { status: "PENDING", setupExpiresAt: new Date("2026-07-20T12:14:00.000Z") },
      now,
    ),
    "REUSE",
  );
});

test("replaces an expired pending enrollment", () => {
  assert.equal(
    decidePendingEnrollment(
      { status: "PENDING", setupExpiresAt: new Date("2026-07-20T11:59:59.000Z") },
      now,
    ),
    "REPLACE",
  );
});

test("refuses to overwrite an active credential", () => {
  assert.equal(
    decidePendingEnrollment({ status: "ACTIVE", setupExpiresAt: null }, now),
    "REJECT_ACTIVE",
  );
});
