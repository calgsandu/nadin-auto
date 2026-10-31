import assert from "node:assert/strict";
import { countsFromAuditDetails, defaultCountSince, historyEntryFor } from "@/lib/operations/inventory-progress";

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

// Mini-istoricul: din snapshot „era → numărat", altfel doar diferența din linie.
const snapshot = { counts: [{ productId: "p1", before: 0, counted: 1 }, { productId: "p2", before: 4, counted: 4 }] };
assert.deepEqual(historyEntryFor("p1", snapshot, 1), { before: 0, counted: 1, difference: 1 });
assert.deepEqual(historyEntryFor("p2", snapshot, null), { before: 4, counted: 4, difference: 0 });
assert.deepEqual(historyEntryFor("p3", { diffs: [] }, -2), { before: null, counted: null, difference: -2 });
assert.equal(historyEntryFor("p3", snapshot, null), null);
assert.deepEqual(historyEntryFor("p1", { counts: [{ productId: "p1", counted: 3 }] }, 2), {
  before: null,
  counted: 3,
  difference: 2,
});

console.log("inventory progress tests passed");
