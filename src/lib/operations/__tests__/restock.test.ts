import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  aggregateRestockRequests,
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
  },
);

console.log("restock tests passed");
