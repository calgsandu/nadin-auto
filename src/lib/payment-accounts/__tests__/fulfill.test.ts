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
    paidAt: null,
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
  // Neachitat = marfa a plecat fără bani: intră în datoria clientului.
  paymentMethod: "CREDIT",
  cashRegistered: false,
  totalLei: 630,
  lines: [{ productId: "product-1", quantity: 2, unitPriceEuro: 315 }],
});

// Achitat înainte de predare: banii au venit prin bancă și sunt scriși separat
// ca `PartnerPayment`, deci vânzarea e TRANSFER, nu CREDIT — și nici „Nespecificat".
const prepaid = buildPaymentAccountSaleData(
  { ...saleInput(), paidAt: new Date("2026-07-13T09:00:00.000Z") },
  documentDate,
);
assert.equal(prepaid.paymentMethod, "TRANSFER");
assert.equal(prepaid.cashRegistered, false);

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
    paidAt: null,
    totalGross: 630,
    notes: null,
    lines: [{ productId: "product-1", quantity: 2, unitPriceGross: 315 }],
  };
}

console.log("payment account fulfillment tests passed");
