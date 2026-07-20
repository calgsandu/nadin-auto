import assert from "node:assert/strict";
import { pendingSaleCustomerName } from "@/lib/pending-operations/display";

assert.equal(
  pendingSaleCustomerName(
    { newCustomerName: null, partnerId: null },
    new Map(),
  ),
  "Consumator final",
);

assert.equal(
  pendingSaleCustomerName(
    { newCustomerName: "Client nou", partnerId: null },
    new Map(),
  ),
  "Client nou",
);

assert.equal(
  pendingSaleCustomerName(
    { newCustomerName: null, partnerId: "partner-1" },
    new Map([["partner-1", "Client existent"]]),
  ),
  "Client existent",
);

assert.equal(
  pendingSaleCustomerName(
    { newCustomerName: null, partnerId: "missing" },
    new Map(),
  ),
  "Client indisponibil",
);

console.log("pending operation display tests passed");
