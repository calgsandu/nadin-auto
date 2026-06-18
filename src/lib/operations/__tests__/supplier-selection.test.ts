import assert from "node:assert/strict";
import {
  ensureSupplierPartner,
  normalizeOptionalPartnerId,
} from "@/lib/operations/supplier-selection";

assert.equal(normalizeOptionalPartnerId(""), null);
assert.equal(normalizeOptionalPartnerId("   "), null);
assert.equal(normalizeOptionalPartnerId(" supplier-1 "), "supplier-1");

assert.equal(
  ensureSupplierPartner({ id: "supplier-1", kind: "SUPPLIER" }, "supplier-1"),
  "supplier-1",
);
assert.equal(
  ensureSupplierPartner({ id: "partner-1", kind: "BOTH" }, "partner-1"),
  "partner-1",
);
assert.equal(ensureSupplierPartner(null, null), null);

assert.throws(
  () => ensureSupplierPartner(null, "text-scris-manual"),
  /Furnizorul ales nu există/,
);
assert.throws(
  () => ensureSupplierPartner({ id: "customer-1", kind: "CUSTOMER" }, "customer-1"),
  /Partenerul ales nu este furnizor/,
);

console.log("supplier selection tests passed");
