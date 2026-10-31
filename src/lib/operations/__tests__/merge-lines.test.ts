import assert from "node:assert/strict";
import { mergeLinesByProduct, mergedUnitPrice } from "../merge-lines";

// Ordinea primei apariții, cantitățile adunate, rândurile externe (fără produs) neatinse.
assert.deepEqual(
  mergeLinesByProduct(
    [
      { productId: "a", quantity: 1 },
      { productId: null, quantity: 2 },
      { productId: "b", quantity: 1 },
      { productId: "a", quantity: 4 },
      { productId: null, quantity: 5 },
    ],
    (line) => line.productId,
  ),
  [
    { productId: "a", quantity: 5 },
    { productId: null, quantity: 2 },
    { productId: "b", quantity: 1 },
    { productId: null, quantity: 5 },
  ],
);

assert.equal(mergedUnitPrice({ quantity: 1, price: 10 }, { quantity: 1, price: 10 }), 10);
assert.equal(mergedUnitPrice({ quantity: 1, price: 10 }, { quantity: 3, price: 20 }), 17.5);
assert.equal(mergedUnitPrice({ quantity: 1, price: null }, { quantity: 3, price: 20 }), 20);
assert.equal(mergedUnitPrice({ quantity: 1, price: 10 }, { quantity: 3, price: null }), 10);
assert.equal(mergedUnitPrice({ quantity: 1, price: null }, { quantity: 3, price: null }), null);

console.log("merge lines tests passed");
