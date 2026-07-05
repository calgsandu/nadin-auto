import assert from "node:assert/strict";
import { aggregateSalesByPeriod, topSoldProducts } from "@/lib/stats/aggregate";

const sale = (iso: string, qty: number, price: number, cost: number, productId = "p1") => ({
  documentDate: new Date(iso),
  lines: [
    {
      quantity: qty,
      unitPriceLei: price,
      unitCostLei: cost,
      productId,
      productLabel: productId,
    },
  ],
});

// Daily totals include revenue, cost and profit.
const daily = aggregateSalesByPeriod(
  [sale("2026-07-01T12:00:00", 2, 100, 60), sale("2026-07-01T15:00:00", 1, 50, 30)],
  "day",
  14,
);
assert.equal(daily.length, 1);
assert.equal(daily[0].salesCount, 2);
assert.equal(daily[0].quantity, 3);
assert.equal(daily[0].revenueLei, 250);
assert.equal(daily[0].costLei, 150);
assert.equal(daily[0].profitLei, 100);

// Newest first, limit applied.
const monthly = aggregateSalesByPeriod(
  [sale("2026-06-01T12:00:00", 1, 10, 5), sale("2026-07-01T12:00:00", 1, 10, 5)],
  "month",
  1,
);
assert.equal(monthly.length, 1);
assert.equal(monthly[0].key, "2026-07");

// ISO weeks group across month edges (2026-06-30 Tue + 2026-07-01 Wed = same week).
const weekly = aggregateSalesByPeriod(
  [sale("2026-06-30T12:00:00", 1, 10, 5), sale("2026-07-01T12:00:00", 1, 10, 5)],
  "week",
  8,
);
assert.equal(weekly.length, 1);
assert.equal(weekly[0].salesCount, 2);

// Top products ranked by quantity, limited.
const top = topSoldProducts(
  [
    sale("2026-07-01T12:00:00", 5, 10, 5, "a"),
    sale("2026-07-02T12:00:00", 2, 10, 5, "b"),
    sale("2026-07-03T12:00:00", 4, 10, 5, "a"),
  ],
  1,
);
assert.equal(top.length, 1);
assert.equal(top[0].productId, "a");
assert.equal(top[0].quantity, 9);
assert.equal(top[0].revenueLei, 90);

console.log("stats aggregate tests passed");
