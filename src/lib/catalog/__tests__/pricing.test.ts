import assert from "node:assert/strict";
import { computeSalePrice, receiptPricingUpdate } from "@/lib/catalog/pricing";

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
