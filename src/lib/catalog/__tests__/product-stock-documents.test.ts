import assert from "node:assert/strict";
import { readStockReason, stockChanges } from "@/lib/catalog/product-stock-documents";

const before = new Map([["w1", 2], ["w2", 0]]);

// Nimic schimbat: niciun document, motivul nu contează.
assert.deepEqual(stockChanges(before, [{ warehouseId: "w1", quantity: 2 }, { warehouseId: "w2", quantity: 0 }], null), []);

// Stoc schimbat fără motiv: refuzat.
assert.throws(() => stockChanges(before, [{ warehouseId: "w1", quantity: 5 }], null), /inventar sau marfă adusă/);

// Inventar: și creșterea, și scăderea trec; doar depozitele schimbate.
assert.deepEqual(
  stockChanges(before, [{ warehouseId: "w1", quantity: 1 }, { warehouseId: "w2", quantity: 0 }], "inventory"),
  [{ warehouseId: "w1", before: 2, after: 1 }],
);

// Marfă adusă: doar creștere.
assert.deepEqual(stockChanges(before, [{ warehouseId: "w2", quantity: 3 }], "receipt"), [{ warehouseId: "w2", before: 0, after: 3 }]);
assert.throws(() => stockChanges(before, [{ warehouseId: "w1", quantity: 1 }], "receipt"), /doar crește/);

assert.equal(readStockReason("receipt"), "receipt");
assert.equal(readStockReason("altceva"), null);
