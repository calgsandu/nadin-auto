import assert from "node:assert/strict";
import { parsePendingOperationPayload } from "@/lib/pending-operations/payload";

const sale = parsePendingOperationPayload("SALE", {
  warehouseId: "w1",
  documentDate: "2026-07-17",
  partnerId: null,
  newCustomerName: "Client Nou",
  notes: "",
  cashRegistered: true,
  paymentMethod: "CARD",
  lines: [{ productId: "p1", quantity: 2, unitPriceLei: 450 }],
});

assert.equal(sale.kind, "SALE");
assert.equal(sale.payload.lines[0].quantity, 2);
assert.equal(sale.payload.notes, null);
assert.equal(sale.payload.cashRegistered, true);
assert.equal(sale.payload.paymentMethod, "CARD");

assert.throws(
  () =>
    parsePendingOperationPayload("SALE", {
      warehouseId: "",
      documentDate: "bad",
      partnerId: null,
      newCustomerName: null,
      notes: null,
      cashRegistered: false,
      lines: [],
    }),
  /locația/i,
);

assert.throws(
  () =>
    parsePendingOperationPayload("SALE", {
      warehouseId: "w1",
      documentDate: "2026-07-17",
      partnerId: null,
      newCustomerName: null,
      notes: null,
      cashRegistered: true,
      paymentMethod: "CASH",
      lines: [
        { productId: "p1", quantity: 1, unitPriceLei: 10 },
        { productId: "p1", quantity: 2, unitPriceLei: 20 },
      ],
    }),
  /mai multe ori/i,
);

assert.throws(
  () =>
    parsePendingOperationPayload("SALE", {
      warehouseId: "w1",
      documentDate: "2026-07-17",
      partnerId: null,
      newCustomerName: null,
      notes: null,
      paymentMethod: "CASH",
      lines: [{ productId: "p1", quantity: 1, unitPriceLei: 10 }],
    }),
  /bătută în casă/i,
);

assert.throws(
  () =>
    parsePendingOperationPayload("SALE", {
      warehouseId: "w1",
      documentDate: "2026-07-17",
      partnerId: null,
      newCustomerName: null,
      notes: null,
      cashRegistered: true,
      lines: [{ productId: "p1", quantity: 1, unitPriceLei: 10 }],
    }),
  /Alege metoda de plată: Cash sau Card\./,
);

assert.deepEqual(
  parsePendingOperationPayload("PAYMENT_ACCOUNT_FULFILLMENT", {
    paymentAccountId: "acc1",
  }),
  {
    kind: "PAYMENT_ACCOUNT_FULFILLMENT",
    payload: { paymentAccountId: "acc1" },
  },
);

console.log("pending operation payload tests passed");
