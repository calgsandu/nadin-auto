import assert from "node:assert/strict";
import {
  calculatePaymentTotals,
  moneyToRomanianWords,
} from "@/lib/payment-accounts/totals";

const totals = calculatePaymentTotals(
  [
    { quantity: 1, unitPriceGross: 2500 },
    { quantity: 2, unitPriceGross: 1250 },
  ],
  0.2,
  true,
);

assert.deepEqual(totals, {
  lines: [
    {
      quantity: 1,
      unitPriceGross: 2500,
      unitPriceNet: 2083.33,
      net: 2083.33,
      vat: 416.67,
      gross: 2500,
    },
    {
      quantity: 2,
      unitPriceGross: 1250,
      unitPriceNet: 1041.67,
      net: 2083.34,
      vat: 416.66,
      gross: 2500,
    },
  ],
  net: 4166.67,
  vat: 833.33,
  gross: 5000,
});

assert.deepEqual(
  calculatePaymentTotals([{ quantity: 3, unitPriceGross: 10.25 }], 0.2, false),
  {
    lines: [
      {
        quantity: 3,
        unitPriceGross: 10.25,
        unitPriceNet: 10.25,
        net: 30.75,
        vat: 0,
        gross: 30.75,
      },
    ],
    net: 30.75,
    vat: 0,
    gross: 30.75,
  },
);

assert.equal(moneyToRomanianWords(5000), "Cinci mii lei 00 bani");
assert.equal(moneyToRomanianWords(2184.67), "Două mii o sută optzeci și patru lei 67 bani");
assert.equal(moneyToRomanianWords(1.01), "Un leu 01 bani");

console.log("payment account totals tests passed");
