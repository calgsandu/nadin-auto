import assert from "node:assert/strict";
import { countsFromAuditDetails, defaultCountSince } from "@/lib/operations/inventory-progress";

// Snapshot-ul nou: toate produsele numărate, și cele fără diferență.
assert.deepEqual(
  countsFromAuditDetails({
    warehouseId: "w1",
    diffs: [{ productId: "a", quantity: 2 }],
    counts: [
      { productId: "a", before: 3, counted: 5 },
      { productId: "b", before: 4, counted: 4 },
    ],
  }),
  [
    { productId: "a", counted: 5 },
    { productId: "b", counted: 4 },
  ],
);

// Istoric vechi, fără snapshot sau stricat: nimic, nu o eroare.
assert.deepEqual(countsFromAuditDetails(null), []);
assert.deepEqual(countsFromAuditDetails({ diffs: [] }), []);
assert.deepEqual(countsFromAuditDetails({ counts: [{ productId: 1 }, "x", { productId: "c", counted: 0 }] }), [
  { productId: "c", counted: 0 },
]);

assert.equal(defaultCountSince(new Date("2026-10-30T12:00:00Z")), "2026-09-30");

console.log("inventory progress tests passed");
