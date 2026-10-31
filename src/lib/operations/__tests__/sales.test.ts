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
  {
    productId: "product-a",
    externalName: null,
    externalCode: null,
    externalSupplierId: null,
    unitCostLei: null,
    quantity: 2,
    unitPriceEuro: 10.5,
  },
  {
    productId: "product-b",
    externalName: null,
    externalCode: null,
    externalSupplierId: null,
    unitCostLei: null,
    quantity: 3,
    unitPriceEuro: null,
  },
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

// Linie externă: fără produs în catalog, cu denumire liberă + furnizor + cost.
const mixedLines = parseSaleLines({
  productIds: ["product-a", ""],
  quantities: ["1", "2"],
  unitPricesEuro: ["100", "550"],
  externalNames: ["", "Aripă față Sprinter"],
  externalCodes: ["", "506502"],
  externalSupplierIds: ["", "supplier-1"],
  externalCostsLei: ["", "400,50"],
});
assert.deepEqual(mixedLines[1], {
  productId: null,
  externalName: "Aripă față Sprinter",
  externalCode: "506502",
  externalSupplierId: "supplier-1",
  unitCostLei: 400.5,
  quantity: 2,
  unitPriceEuro: 550,
});
// Câmpurile externe se ignoră pe liniile de catalog.
assert.equal(mixedLines[0].externalName, null);

assert.throws(
  () =>
    parseSaleLines({
      productIds: [""],
      quantities: ["1"],
      unitPricesEuro: ["10"],
      externalNames: [""],
    }),
  /Alege produsul de pe poziția 1/,
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
