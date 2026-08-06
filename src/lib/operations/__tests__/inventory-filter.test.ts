import assert from "node:assert/strict";
import {
  inventoryWhere,
  normalizeInventoryPage,
} from "@/lib/operations/inventory-filter";

const base = inventoryWhere({ warehouseId: "wh1" });
assert.equal(base.type, "ADJUSTMENT");
assert.equal(base.warehouseId, "wh1");
assert.equal(base.transferGroupId, null, "jumătățile de transfer nu sunt inventare");
assert.deepEqual(base.notes, { startsWith: "Inventar" });
assert.equal(base.documentDate, undefined, "fără interval, fără filtru pe dată");

const ranged = inventoryWhere({ warehouseId: "wh1", from: "2026-08-01", to: "2026-08-31" });
const range = ranged.documentDate as { gte: Date; lte: Date };
assert.equal(range.gte.getTime(), new Date("2026-08-01T00:00:00").getTime());
// Ziua „până la" e inclusivă: limita superioară e ultima milisecundă a zilei.
assert.equal(range.lte.getTime(), new Date("2026-09-01T00:00:00").getTime() - 1);

const openEnded = inventoryWhere({ warehouseId: "wh1", from: "2026-08-01" });
assert.deepEqual(Object.keys(openEnded.documentDate as object), ["gte"]);

assert.equal(inventoryWhere({ warehouseId: "wh1", from: "nu-i dată" }).documentDate, undefined);

assert.equal(normalizeInventoryPage(undefined), 1);
assert.equal(normalizeInventoryPage("0"), 1);
assert.equal(normalizeInventoryPage("-3"), 1);
assert.equal(normalizeInventoryPage("2.5"), 1);
assert.equal(normalizeInventoryPage("4"), 4);

console.log("inventory filter tests passed");
