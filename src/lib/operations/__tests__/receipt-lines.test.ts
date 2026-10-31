import assert from "node:assert/strict";
import {
  calculateReceiptTotalLei,
  parseReceiptLines,
} from "@/lib/operations/receipt-lines";

const lines = parseReceiptLines({
  productIds: ["product-a", "product-b"],
  quantities: ["3", "2"],
  unitCostsLei: ["12,50", ""],
});

assert.deepEqual(lines, [
  { productId: "product-a", quantity: 3, unitCostLei: 12.5 },
  { productId: "product-b", quantity: 2, unitCostLei: null },
]);
assert.equal(calculateReceiptTotalLei(lines), 37.5);

assert.throws(
  () =>
    parseReceiptLines({
      productIds: [],
      quantities: [],
      unitCostsLei: [],
    }),
  /Adaugă cel puțin un produs/,
);

assert.throws(
  () =>
    parseReceiptLines({
      productIds: ["product-a"],
      quantities: ["0"],
      unitCostsLei: [""],
    }),
  /Cantitatea de pe poziția 1 trebuie să fie mai mare decât zero/,
);

assert.throws(
  () =>
    parseReceiptLines({
      productIds: ["product-a", "product-a"],
      quantities: ["1", "2"],
      unitCostsLei: ["", ""],
    }),
  /Produsul de pe poziția 2 este adăugat de mai multe ori/,
);

assert.throws(
  () =>
    parseReceiptLines({
      productIds: ["product-a", ""],
      quantities: ["1", "2"],
      unitCostsLei: ["", ""],
    }),
  /Alege produsul de pe poziția 2/,
);

console.log("receipt lines tests passed");
