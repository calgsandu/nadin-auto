import assert from "node:assert/strict";
import {
  assertCashRegisterDocumentType,
  cashRegisterLabel,
  parseOptionalCashRegistered,
  parseRequiredCashRegistered,
} from "@/lib/operations/cash-register";

assert.equal(parseRequiredCashRegistered("yes"), true);
assert.equal(parseRequiredCashRegistered("no"), false);
assert.throws(
  () => parseRequiredCashRegistered(""),
  /Alege dacă vânzarea a fost bătută în casă/,
);

assert.equal(parseOptionalCashRegistered("yes"), true);
assert.equal(parseOptionalCashRegistered("no"), false);
assert.equal(parseOptionalCashRegistered("unspecified"), null);
assert.throws(
  () => parseOptionalCashRegistered("other"),
  /Statut de casă invalid/,
);

assert.equal(cashRegisterLabel(true), "Bătut în casă");
assert.equal(cashRegisterLabel(false), "Nebătut în casă");
assert.equal(cashRegisterLabel(null), "Nespecificat");

assert.doesNotThrow(() => assertCashRegisterDocumentType("SALE"));
assert.throws(
  () => assertCashRegisterDocumentType("RECEIPT"),
  /doar pentru vânzări/,
);

console.log("cash register status tests passed");
