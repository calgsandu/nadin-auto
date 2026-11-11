import assert from "node:assert/strict";
import { computeSalePrice, receiptPricingUpdate, weightedAverageCost } from "@/lib/catalog/pricing";

assert.equal(computeSalePrice(null), null);
assert.equal(computeSalePrice(120), 250, "2×120 = 240 → rotunjit la 250");
assert.equal(computeSalePrice(0), 0);

// Cost neschimbat = nimic de scris.
assert.equal(receiptPricingUpdate({ costLei: 120, salePriceLei: 250 }, 120), null);

// Prețul de vânzare era cel automat → urmează noul cost.
assert.deepEqual(
  receiptPricingUpdate({ costLei: 120, salePriceLei: 250 }, 200),
  { costLei: 200, salePriceLei: 400 },
);

// Preț ajustat manual → costul se schimbă, prețul de vânzare rămâne.
assert.deepEqual(
  receiptPricingUpdate({ costLei: 120, salePriceLei: 999 }, 200),
  { costLei: 200 },
);

// Produs fără preț de vânzare → primește prețul automat.
assert.deepEqual(
  receiptPricingUpdate({ costLei: null, salePriceLei: null }, 100),
  { costLei: 100, salePriceLei: 200 },
);

// Produs fără cost, dar cu preț pus de mână → prețul rămâne al lui.
assert.deepEqual(
  receiptPricingUpdate({ costLei: null, salePriceLei: 350 }, 100),
  { costLei: 100 },
);

// Valori imposibile nu ating fișa produsului.
assert.equal(receiptPricingUpdate({ costLei: 10, salePriceLei: 20 }, -5), null);
assert.equal(receiptPricingUpdate({ costLei: 10, salePriceLei: 20 }, Number.NaN), null);

console.log("pricing tests passed");

// ─── Cost mediu ponderat (2026-09-01) ───────────────────────────────────────
// Fără stoc vechi, media E prețul recepționat.
assert.equal(weightedAverageCost({ costLei: null, stock: 0 }, 100, 5), 100);
assert.equal(weightedAverageCost({ costLei: 80, stock: 0 }, 100, 5), 100);
// Fără cost vechi de la care porni, la fel.
assert.equal(weightedAverageCost({ costLei: null, stock: 10 }, 100, 5), 100);

// Cazul obișnuit: 10 buc. la 100 lei + 10 buc. la 200 lei = 150 lei bucata.
assert.equal(weightedAverageCost({ costLei: 100, stock: 10 }, 200, 10), 150);
// O singură bucată scumpă nu mai rescrie costul întregului stoc.
assert.equal(weightedAverageCost({ costLei: 100, stock: 99 }, 200, 1), 101);
// Rezultatul se rotunjește la bani.
assert.equal(weightedAverageCost({ costLei: 100, stock: 3 }, 200, 1), 125);
assert.equal(weightedAverageCost({ costLei: 10, stock: 3 }, 20, 4), 15.71);
// Cantitate zero = nu s-a primit nimic; prețul recepționat rămâne referința.
assert.equal(weightedAverageCost({ costLei: 100, stock: 10 }, 200, 0), 200);
// Stoc negativ (evidență stricată) nu trage media în jos.
assert.equal(weightedAverageCost({ costLei: 100, stock: -5 }, 200, 5), 200);

// Prin `receiptPricingUpdate`: prețul de vânzare urmează media, nu ultimul cost.
const averaged = receiptPricingUpdate({ costLei: 100, salePriceLei: 200, stock: 10 }, 200, 10);
assert.deepEqual(averaged, { costLei: 150, salePriceLei: 300 });

// Prețul ajustat manual rămâne neatins și la media ponderată.
assert.deepEqual(
  receiptPricingUpdate({ costLei: 100, salePriceLei: 999, stock: 10 }, 200, 10),
  { costLei: 150 },
);

// Recepție la același preț cu media curentă: nu e nimic de schimbat.
assert.equal(receiptPricingUpdate({ costLei: 150, salePriceLei: 300, stock: 10 }, 150, 5), null);

console.log("weighted average cost tests passed");
