import assert from "node:assert/strict";
import { buildPaymentAccountSaleData } from "@/lib/payment-accounts/fulfill";

const documentDate = new Date("2026-07-14T12:00:00.000Z");
const sale = buildPaymentAccountSaleData(
  {
    id: "account-1",
    number: 7,
    warehouseId: "warehouse-1",
    partnerId: "partner-1",
    cancelledAt: null,
    fulfilledAt: null,
    totalGross: 630,
    notes: "Ridicare din magazin",
    lines: [
      { productId: "product-1", quantity: 2, unitPriceGross: 315 },
    ],
  },
  documentDate,
);

assert.deepEqual(sale, {
  type: "SALE",
  documentDate,
  warehouseId: "warehouse-1",
  partnerId: "partner-1",
  notes: "Cont de plată #7. Ridicare din magazin",
  totalLei: 630,
  lines: [{ productId: "product-1", quantity: 2, unitPriceEuro: 315 }],
});

assert.throws(
  () => buildPaymentAccountSaleData({ ...saleInput(), cancelledAt: new Date() }, documentDate),
  /anulat/,
);
assert.throws(
  () => buildPaymentAccountSaleData({ ...saleInput(), fulfilledAt: new Date() }, documentDate),
  /deja.*predată/,
);

function saleInput() {
  return {
    id: "account-1",
    number: 7,
    warehouseId: "warehouse-1",
    partnerId: "partner-1",
    cancelledAt: null,
    fulfilledAt: null,
    totalGross: 630,
    notes: null,
    lines: [{ productId: "product-1", quantity: 2, unitPriceGross: 315 }],
  };
}

console.log("payment account fulfillment tests passed");
