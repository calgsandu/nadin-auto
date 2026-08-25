import assert from "node:assert/strict";
import {
  assertCanCancelPaymentAccount,
  assertCanFulfillPaymentAccount,
  assertCanMarkPaymentAccountPaid,
} from "@/lib/payment-accounts/status";

const active = { cancelledAt: null, fulfilledAt: null, paidAt: null };
assert.doesNotThrow(() => assertCanMarkPaymentAccountPaid(active));
assert.doesNotThrow(() => assertCanFulfillPaymentAccount(active));
assert.doesNotThrow(() => assertCanCancelPaymentAccount(active));

assert.throws(
  () => assertCanMarkPaymentAccountPaid({ ...active, cancelledAt: new Date() }),
  /anulat/,
);
assert.throws(
  () => assertCanMarkPaymentAccountPaid({ ...active, paidAt: new Date() }),
  /deja.*achitat/,
);
assert.throws(
  () => assertCanFulfillPaymentAccount({ ...active, fulfilledAt: new Date() }),
  /deja.*predată/,
);
assert.throws(
  () => assertCanCancelPaymentAccount({ ...active, fulfilledAt: new Date() }),
  /predată/,
);
assert.throws(
  () => assertCanCancelPaymentAccount({ ...active, paidAt: new Date() }),
  /achitat/,
);
// Contul achitat dar nelivrat era fundătură: nu se putea nici anula, nici stinge.
// Cu rambursarea confirmată se poate — anularea scrie și restituirea banilor.
assert.doesNotThrow(() =>
  assertCanCancelPaymentAccount({ ...active, paidAt: new Date() }, true),
);
// Rambursarea nu deschide însă și calea celor deja predate.
assert.throws(
  () => assertCanCancelPaymentAccount({ ...active, fulfilledAt: new Date() }, true),
  /predată/,
);

console.log("payment account status tests passed");
