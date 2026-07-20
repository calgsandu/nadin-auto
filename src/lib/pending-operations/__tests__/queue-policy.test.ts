import assert from "node:assert/strict";
import {
  pendingPaymentFulfillmentKey,
  shouldQueueStockOperation,
} from "@/lib/pending-operations/queue";

assert.equal(shouldQueueStockOperation("ANGAJAT"), true);
assert.equal(shouldQueueStockOperation("DIRECTOR"), false);
assert.equal(shouldQueueStockOperation("ADMIN"), false);
assert.equal(
  pendingPaymentFulfillmentKey("account-1"),
  "payment-account-fulfillment:account-1",
);

console.log("pending operation queue policy tests passed");
