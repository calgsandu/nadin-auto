import assert from "node:assert/strict";
import {
  buildProductSearchWhere,
  formatProductSearchLabel,
  normalizeProductSearchQuery,
} from "@/lib/catalog/product-search";

assert.equal(normalizeProductSearchQuery("  bmw   e90  "), "bmw e90");
assert.equal(normalizeProductSearchQuery("ab"), "");
assert.equal(normalizeProductSearchQuery("  123456789012345678901234567890  "), "12345678901234567890");

assert.deepEqual(buildProductSearchWhere("bmw e90"), {
  OR: [
    { externalCode: { contains: "bmw e90", mode: "insensitive" } },
    { description: { contains: "bmw e90", mode: "insensitive" } },
    { fitment: { label: { contains: "bmw e90", mode: "insensitive" } } },
    { fitment: { carModel: { name: { contains: "bmw e90", mode: "insensitive" } } } },
    {
      fitment: {
        carModel: {
          brand: { name: { contains: "bmw e90", mode: "insensitive" } },
        },
      },
    },
  ],
});

assert.equal(
  formatProductSearchLabel({
    externalCode: "A-100",
    description: "Bară față",
    priceEuro: { toString: () => "42.5" },
    costLei: { toString: () => "700" },
    salePriceLei: { toString: () => "1400" },
    stock: 5,
    fitment: {
      carModel: {
        name: "E90",
        brand: { name: "BMW" },
      },
    },
    type: { name: "Caroserie" },
  }),
  "A-100 · BMW E90 · Caroserie · Bară față · 42.5 EUR",
);

console.log("product search tests passed");
