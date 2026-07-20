import assert from "node:assert/strict";
import {
  assertPendingOperation,
  normalizeRejectionReason,
  pendingOperationActor,
} from "@/lib/pending-operations/execute";

assert.doesNotThrow(() => assertPendingOperation("PENDING"));
assert.throws(() => assertPendingOperation("APPROVED"), /deja procesată/i);
assert.throws(() => assertPendingOperation("REJECTED"), /deja procesată/i);

assert.equal(
  normalizeRejectionReason("  cantitate greșită  "),
  "cantitate greșită",
);
assert.throws(() => normalizeRejectionReason("  "), /motiv/i);

assert.deepEqual(
  pendingOperationActor({
    requestedById: "user-1",
    requestedByRole: "ANGAJAT",
    requestedByName: "Ana",
    requestedByEmail: "ana@example.test",
  }),
  {
    id: "user-1",
    role: "ANGAJAT",
    name: "Ana",
    email: "ana@example.test",
  },
);

console.log("pending operation decision tests passed");
