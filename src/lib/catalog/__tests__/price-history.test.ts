import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma } from "@/generated/prisma/client";
import { pricesChanged } from "@/lib/catalog/price-history";

const dec = (value: string) => new Prisma.Decimal(value);

const base = {
  costLei: dec("100.00"),
  salePriceLei: dec("150.00"),
  priceEuro: dec("5.00"),
};

// Aceleași valori — nicio intrare în istoric, altfel orice editare de denumire
// ar umple registrul cu rânduri goale.
assert.equal(pricesChanged(base, { ...base }), false);

// Aceeași valoare scrisă altfel (100 vs 100.00) rămâne aceeași valoare.
assert.equal(pricesChanged(base, { ...base, costLei: dec("100") }), false);

// Fiecare dintre cele trei prețuri declanșează singur înregistrarea.
assert.equal(pricesChanged(base, { ...base, costLei: dec("101") }), true);
assert.equal(pricesChanged(base, { ...base, salePriceLei: dec("149.99") }), true);
assert.equal(pricesChanged(base, { ...base, priceEuro: dec("5.01") }), true);

// Trecerea spre/dinspre „fără preț" e tot o schimbare.
assert.equal(pricesChanged(base, { ...base, costLei: null }), true);
assert.equal(pricesChanged({ ...base, costLei: null }, base), true);
assert.equal(
  pricesChanged(
    { costLei: null, salePriceLei: null, priceEuro: null },
    { costLei: null, salePriceLei: null, priceEuro: null },
  ),
  false,
);

// Editarea produsului trebuie să treacă prin istoric, altfel raportul rămâne gol.
const actions = readFileSync("src/app/catalog/actions.ts", "utf8");
assert.match(actions, /recordPriceChange\(tx, productId, before, updated, user\)/);

console.log("price history tests passed");
