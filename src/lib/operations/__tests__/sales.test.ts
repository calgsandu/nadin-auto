import assert from "node:assert/strict";
import {
  aggregateSoldProducts,
  calculateSaleTotalEuro,
  parseSaleLines,
} from "@/lib/operations/sales";

const lines = parseSaleLines({
  productIds: ["product-a", "product-b"],
  quantities: ["2", "3"],
  unitPricesEuro: ["10,50", ""],
});

assert.deepEqual(lines, [
  { productId: "product-a", quantity: 2, unitPriceEuro: 10.5 },
  { productId: "product-b", quantity: 3, unitPriceEuro: null },
]);
assert.equal(calculateSaleTotalEuro(lines), 21);

assert.deepEqual(
  aggregateSoldProducts([
    { productId: "product-a", quantity: 2 },
    { productId: "product-b", quantity: 1 },
    { productId: "product-a", quantity: 3 },
  ]),
  [
    { productId: "product-a", quantity: 5 },
    { productId: "product-b", quantity: 1 },
  ],
);

assert.throws(
  () => parseSaleLines({ productIds: [], quantities: [], unitPricesEuro: [] }),
  /Adaugă cel puțin un produs în vânzare/,
);

assert.throws(
  () =>
    parseSaleLines({
      productIds: ["product-a", "product-a"],
      quantities: ["1", "2"],
      unitPricesEuro: ["", ""],
    }),
  /Produsul de pe poziția 2 este adăugat de mai multe ori/,
);

console.log("sales tests passed");
