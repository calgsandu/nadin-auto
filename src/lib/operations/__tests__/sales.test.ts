import assert from "node:assert/strict";
import {
  aggregateSoldProducts,
  calculateSaleTotalEuro,
  groupSalesByPeriod,
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

assert.deepEqual(
  groupSalesByPeriod(
    [
      { id: "sale-1", documentDate: new Date("2026-06-18T12:00:00") },
      { id: "sale-2", documentDate: new Date("2026-06-02T12:00:00") },
      { id: "sale-3", documentDate: new Date("2025-12-31T12:00:00") },
    ],
    "day",
  ),
  [
    { key: "2026-06-18", label: "18.06.2026", sales: [{ id: "sale-1", documentDate: new Date("2026-06-18T12:00:00") }] },
    { key: "2026-06-02", label: "02.06.2026", sales: [{ id: "sale-2", documentDate: new Date("2026-06-02T12:00:00") }] },
    { key: "2025-12-31", label: "31.12.2025", sales: [{ id: "sale-3", documentDate: new Date("2025-12-31T12:00:00") }] },
  ],
);

assert.deepEqual(
  groupSalesByPeriod(
    [
      { id: "sale-1", documentDate: new Date("2026-06-18T12:00:00") },
      { id: "sale-2", documentDate: new Date("2026-06-02T12:00:00") },
      { id: "sale-3", documentDate: new Date("2025-12-31T12:00:00") },
    ],
    "month",
  ).map((group) => ({ key: group.key, count: group.sales.length })),
  [
    { key: "2026-06", count: 2 },
    { key: "2025-12", count: 1 },
  ],
);

assert.deepEqual(
  groupSalesByPeriod(
    [
      { id: "sale-1", documentDate: new Date("2026-06-18T12:00:00") },
      { id: "sale-2", documentDate: new Date("2026-06-02T12:00:00") },
      { id: "sale-3", documentDate: new Date("2025-12-31T12:00:00") },
    ],
    "year",
  ).map((group) => ({ key: group.key, count: group.sales.length })),
  [
    { key: "2026", count: 2 },
    { key: "2025", count: 1 },
  ],
);

console.log("sales tests passed");
