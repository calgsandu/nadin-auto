import assert from "node:assert/strict";
import {
  formatProductSearchLabel,
  normalizeProductSearchQuery,
} from "@/lib/catalog/product-search";

assert.equal(normalizeProductSearchQuery("  bmw   e90  "), "bmw e90");
assert.equal(normalizeProductSearchQuery("ab"), "");
// Interogările lungi nu se mai taie la 20 de caractere (tăia „…baza medie delfin 907"
// la „…baza m" și scotea rezultate de la alt model).
assert.equal(
  normalizeProductSearchQuery("  Panou lateral baza medie delfin 907  "),
  "Panou lateral baza medie delfin 907",
);
assert.equal(normalizeProductSearchQuery("x".repeat(120)).length, 80);

assert.equal(
  formatProductSearchLabel({
    externalCode: "A-100",
    description: "Bară față",
    priceEuro: { toString: () => "42.5" },
    costLei: { toString: () => "700" },
    salePriceLei: { toString: () => "1400" },
    stock: 5,
    fitment: {
      yearStart: null,
      yearEnd: null,
      yearOpenEnded: false,
      carModel: {
        name: "E90",
        brand: { name: "BMW" },
      },
    },
    type: { name: "Caroserie" },
  }),
  "A-100 · BMW E90 · Caroserie · Bară față · 42.5 EUR",
);

// Piesele legate de mai multe modele își arată toate compatibilitățile.
assert.equal(
  formatProductSearchLabel(
    {
      externalCode: "50658311",
      description: "Panou lateral 1L",
      priceEuro: null,
      costLei: null,
      salePriceLei: null,
      stock: 2,
      fitment: {
        yearStart: 2006,
        yearEnd: 2018,
        yearOpenEnded: false,
        carModel: { name: "SPRINTER 906 (DELFIN)", brand: { name: "MERCEDES-BENZ" } },
      },
      productFitments: [
        {
          fitment: {
            yearStart: 2006,
            yearEnd: 2018,
            yearOpenEnded: false,
            carModel: { name: "SPRINTER 906 (DELFIN)", brand: { name: "MERCEDES-BENZ" } },
          },
        },
        {
          fitment: {
            yearStart: 2006,
            yearEnd: 2016,
            yearOpenEnded: false,
            carModel: { name: "CRAFTER", brand: { name: "VOLKSWAGEN" } },
          },
        },
      ],
      type: { name: "Panou" },
    },
    false,
  ),
  "50658311 · MERCEDES-BENZ SPRINTER 906 (DELFIN) 2006–2018 • VOLKSWAGEN CRAFTER 2006–2016 · Panou · Panou lateral 1L",
);

console.log("product search tests passed");
