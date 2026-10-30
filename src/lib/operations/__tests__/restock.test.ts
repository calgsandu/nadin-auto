import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  aggregateRestockRequests,
  bestRestockSource,
  restockTasksCoveredBy,
  splitRestockTasksByStatus,
} from "@/lib/operations/restock";

assert.deepEqual(
  aggregateRestockRequests([
    { productId: "product-a", quantity: 2 },
    { productId: "product-b", quantity: 1 },
    { productId: "product-a", quantity: 3 },
  ]),
  [
    { productId: "product-a", quantity: 5 },
    { productId: "product-b", quantity: 1 },
  ],
);

for (const file of [
  "src/app/operations/actions.ts",
  "src/app/operations/document-actions.ts",
  "src/app/istoric/actions.ts",
]) {
  const source = readFileSync(path.join(process.cwd(), file), "utf8");
  assert.match(
    source,
    /reconcileSaleRestockTasks/,
    `${file} trebuie să recalculeze coada De adus după retur`,
  );
}

assert.deepEqual(
  splitRestockTasksByStatus([
    { id: "task-1", status: "PENDING" },
    { id: "task-2", status: "DELIVERED" },
    { id: "task-3", status: "UNAVAILABLE" },
  ]),
  {
    pending: [{ id: "task-1", status: "PENDING" }],
    unavailable: [{ id: "task-3", status: "UNAVAILABLE" }],
    // `DELIVERED` se scria fără să se vadă nicăieri: poziția adusă dispărea de
    // pe ecran fără confirmare că a fost chiar adusă.
    delivered: [{ id: "task-2", status: "DELIVERED" }],
  },
);

console.log("restock tests passed");

// Transferul în 110A închide pozițiile „De adus", cele mai vechi întâi; o
// poziție pe care cantitatea adusă n-o acoperă întreagă rămâne deschisă.
{
  const tasks = [
    { id: "a", quantity: 2 },
    { id: "b", quantity: 1 },
    { id: "c", quantity: 3 },
  ];
  assert.deepEqual(restockTasksCoveredBy(tasks, 3), ["a", "b"]);
  assert.deepEqual(restockTasksCoveredBy(tasks, 6), ["a", "b", "c"]);
  assert.deepEqual(restockTasksCoveredBy(tasks, 1), []);
  assert.deepEqual(restockTasksCoveredBy([], 5), []);
}

// Sursa propusă pentru „Adu în 110A" = depozitul care acoperă cele mai multe bucăți.
{
  const items = [
    { productId: "p1", quantity: 2 },
    { productId: "p2", quantity: 3 },
  ];
  const stocks = [
    { productId: "p1", warehouseId: "central", quantity: 5 },
    { productId: "p2", warehouseId: "central", quantity: 2 },
    { productId: "p2", warehouseId: "principal", quantity: 1 },
    { productId: "p1", warehouseId: "principal", quantity: 1 },
  ];
  assert.equal(bestRestockSource(items, stocks, ["principal", "central"]), "central");
  assert.equal(bestRestockSource(items, [], ["principal", "central"]), "principal");
  assert.equal(bestRestockSource(items, stocks, []), "");
}
