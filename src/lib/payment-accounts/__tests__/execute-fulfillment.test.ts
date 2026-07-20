import assert from "node:assert/strict";
import {
  assertFulfillmentWarehouseActive,
  fulfillmentRequestSummary,
} from "@/lib/payment-accounts/execute-fulfillment";

assert.equal(
  fulfillmentRequestSummary({
    number: 42,
    customerName: "Client SRL",
    totalGross: 1250,
  }),
  "Cerere predare cont #42 — Client SRL (1250 lei)",
);

assert.doesNotThrow(() => assertFulfillmentWarehouseActive(true));
assert.throws(
  () => assertFulfillmentWarehouseActive(false),
  /locația.*dezactivată/i,
);

console.log("payment fulfillment execution helper tests passed");
