import assert from "node:assert/strict";
import { documentSnapshot } from "@/lib/audit";

// Snapshot-ul de ștergere trebuie să conțină exact câmpurile pe care
// restoreDocumentAction le citește (DeletedSnapshot) — round-trip safe.
const snapshot = documentSnapshot({
  type: "SALE",
  number: 12,
  documentDate: new Date("2026-07-05T12:00:00"),
  notes: "test",
  totalLei: { toString: () => "150.50" },
  totalEuro: null,
  warehouse: { name: "Pavilion 110A" },
  partner: { name: "Client X" },
  lines: [
    {
      productId: "p1",
      quantity: 2,
      unitPriceEuro: { toString: () => "75.25" },
      unitCostLei: null,
      product: { description: "Far stânga", externalCode: "F-01" },
    },
  ],
});

assert.equal(snapshot.type, "SALE");
assert.equal(snapshot.number, 12);
assert.equal(snapshot.documentDate, "2026-07-05");
assert.equal(snapshot.totalLei, 150.5);
assert.equal(snapshot.totalEuro, null);
assert.equal(snapshot.warehouse, "Pavilion 110A");
assert.equal(snapshot.partner, "Client X");
assert.equal(snapshot.lines.length, 1);
assert.equal(snapshot.lines[0].productId, "p1");
assert.equal(snapshot.lines[0].quantity, 2);
assert.equal(snapshot.lines[0].price, 75.25);
assert.equal(snapshot.lines[0].product, "F-01 · Far stânga");

// Fără partener/depozit — snapshot-ul rămâne valid (null-uri, nu crash).
const bare = documentSnapshot({
  type: "ADJUSTMENT",
  number: 1,
  documentDate: new Date("2026-01-01T12:00:00"),
  notes: null,
  totalLei: null,
  totalEuro: null,
  lines: [
    { productId: "p2", quantity: -3, unitPriceEuro: null, unitCostLei: null },
  ],
});
assert.equal(bare.partner, null);
assert.equal(bare.warehouse, null);
assert.equal(bare.lines[0].quantity, -3);
assert.equal(bare.lines[0].price, 0);

console.log("audit snapshot tests passed");
