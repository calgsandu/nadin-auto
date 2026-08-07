import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sumDeltasByProduct } from "@/lib/operations/stock-mutations";

// Un produs poate apărea pe mai multe linii ale aceluiași document. Cantitățile
// TREBUIE însumate înainte de UPDATE: cu chei duplicate, un
// `UPDATE … FROM (VALUES …)` aplică doar una dintre potriviri și restul se pierd.
assert.deepEqual(
  sumDeltasByProduct([
    { productId: "a", quantity: 3 },
    { productId: "b", quantity: 5 },
    { productId: "a", quantity: -1 },
  ]),
  [
    { productId: "a", quantity: 2 },
    { productId: "b", quantity: 5 },
  ],
);

assert.deepEqual(sumDeltasByProduct([]), []);

// Reversarea și aplicarea se anulează când documentul nu se schimbă.
assert.deepEqual(
  sumDeltasByProduct([
    { productId: "a", quantity: -4 },
    { productId: "a", quantity: 4 },
  ]),
  [{ productId: "a", quantity: 0 }],
);

// Stocul nu se mai atinge rând cu rând: bucla veche era ce depășea limita
// tranzacției la documentele lungi.
const documentActions = readFileSync(
  fileURLToPath(new URL("../../../app/operations/document-actions.ts", import.meta.url)),
  "utf8",
);

for (const perLineCall of [
  "tx.warehouseStock.findUnique",
  "tx.warehouseStock.update(",
  "tx.warehouseStock.create(",
  "tx.stockDocumentLine.create(",
  "tx.product.update(",
]) {
  assert.ok(
    !documentActions.includes(perLineCall),
    `document-actions.ts nu mai trebuie să apeleze ${perLineCall} — se lucrează pe loturi.`,
  );
}

assert.match(documentActions, /applyWarehouseStockDeltas\(/);
assert.match(documentActions, /syncProductAggregateStocks\(/);
assert.match(documentActions, /sumDeltasByProduct\(/);

console.log("stock batching invariants passed");
