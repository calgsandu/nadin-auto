import assert from "node:assert/strict";
import { parseWarehouseStockAssignments } from "@/lib/catalog/warehouse-stock";

const activeWarehouses = [{ id: "110a" }, { id: "514" }];

assert.deepEqual(
  parseWarehouseStockAssignments(
    { warehouseIds: ["110a", "514"], quantities: ["2", "4"] },
    activeWarehouses,
  ),
  [
    { warehouseId: "110a", quantity: 2 },
    { warehouseId: "514", quantity: 4 },
  ],
);

assert.deepEqual(
  parseWarehouseStockAssignments(
    { warehouseIds: ["514", "110a"], quantities: ["", "3"] },
    activeWarehouses,
  ),
  [
    { warehouseId: "110a", quantity: 3 },
    { warehouseId: "514", quantity: 0 },
  ],
);

for (const quantities of [["-1", "0"], ["1.5", "0"], ["abc", "0"]]) {
  assert.throws(
    () => parseWarehouseStockAssignments({ warehouseIds: ["110a", "514"], quantities }, activeWarehouses),
    /Cantitatea.*depozit/i,
  );
}

assert.throws(
  () => parseWarehouseStockAssignments({ warehouseIds: ["110a", "110a"], quantities: ["1", "2"] }, activeWarehouses),
  /mai multe ori/i,
);
assert.throws(
  () => parseWarehouseStockAssignments({ warehouseIds: ["110a", "other"], quantities: ["1", "2"] }, activeWarehouses),
  /nu este activ|nu există/i,
);
assert.throws(
  () => parseWarehouseStockAssignments({ warehouseIds: ["110a"], quantities: ["1"] }, activeWarehouses),
  /fiecare depozit/i,
);
assert.throws(
  () => parseWarehouseStockAssignments({ warehouseIds: ["110a", "514", ""], quantities: ["1", "2", "3"] }, activeWarehouses),
  /nu este activ|nu există/i,
);
assert.throws(
  () => parseWarehouseStockAssignments({ warehouseIds: ["110a", "514"], quantities: ["1"] }, activeWarehouses),
  /corespund/i,
);

console.log("warehouse stock tests passed");
