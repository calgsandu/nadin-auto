import assert from "node:assert/strict";
import { allocatePayments } from "@/lib/finance/payables";

const receipts = [
  { id: "a", totalLei: 1000 },
  { id: "b", totalLei: 500 },
  { id: "c", totalLei: 250 },
];

// Nimic plătit: totul rămâne de plătit.
const none = allocatePayments(receipts, 0);
assert.deepEqual(
  none.map((row) => row.remainingLei),
  [1000, 500, 250],
);

// Plată parțială: se stinge prima factură, a doua rămâne pe jumătate.
const partial = allocatePayments(receipts, 1250);
assert.deepEqual(
  partial.map((row) => [row.paidLei, row.remainingLei]),
  [
    [1000, 0],
    [250, 250],
    [0, 250],
  ],
);

// Plătit exact: nimic nu rămâne.
const exact = allocatePayments(receipts, 1750);
assert.equal(
  exact.reduce((sum, row) => sum + row.remainingLei, 0),
  0,
);

// Plătit în plus (avans): surplusul nu creează rest negativ nicăieri.
const over = allocatePayments(receipts, 5000);
assert.ok(over.every((row) => row.remainingLei === 0));
assert.deepEqual(
  over.map((row) => row.paidLei),
  [1000, 500, 250],
);

// Bani rotunjiți la bani, nu la virgulă mobilă.
const cents = allocatePayments([{ totalLei: 10.1 }, { totalLei: 20.2 }], 10.15);
assert.equal(cents[0].remainingLei, 0);
assert.equal(cents[0].paidLei, 10.1);
assert.equal(cents[1].paidLei, 0.05);
assert.equal(cents[1].remainingLei, 20.15);

// Lista goală nu explodează.
assert.deepEqual(allocatePayments([], 500), []);

console.log("payables tests passed");
