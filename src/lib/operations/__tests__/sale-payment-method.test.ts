import assert from "node:assert/strict";
import {
  assertSalePaymentMethodDocumentType,
  parseOptionalSalePaymentMethod,
  parseRequiredSalePaymentMethod,
  salePaymentMethodFormValue,
  salePaymentMethodLabel,
} from "@/lib/operations/sale-payment-method";

assert.equal(parseRequiredSalePaymentMethod("cash"), "CASH");
assert.equal(parseRequiredSalePaymentMethod("card"), "CARD");
assert.equal(parseRequiredSalePaymentMethod("credit"), "CREDIT");
// Transferul bancar e metodă reală de plată: contul de plată se achită prin bancă.
assert.equal(parseRequiredSalePaymentMethod("transfer"), "TRANSFER");
assert.throws(
  () => parseRequiredSalePaymentMethod(""),
  /Alege metoda de plată: Cash, Card, Pe datorie sau Transfer\./,
);

assert.equal(parseOptionalSalePaymentMethod("cash"), "CASH");
assert.equal(parseOptionalSalePaymentMethod("card"), "CARD");
assert.equal(parseOptionalSalePaymentMethod("transfer"), "TRANSFER");
assert.equal(parseOptionalSalePaymentMethod("unspecified"), null);
assert.throws(
  () => parseOptionalSalePaymentMethod("cec"),
  /Metodă de plată invalidă\./,
);

assert.equal(salePaymentMethodLabel("CASH"), "Cash");
assert.equal(salePaymentMethodLabel("CARD"), "Card");
assert.equal(salePaymentMethodLabel("CREDIT"), "Pe datorie");
assert.equal(salePaymentMethodLabel("TRANSFER"), "Transfer bancar");
assert.equal(salePaymentMethodLabel(null), "Nespecificat");
assert.equal(salePaymentMethodFormValue("CASH"), "cash");
assert.equal(salePaymentMethodFormValue("CARD"), "card");
assert.equal(salePaymentMethodFormValue("TRANSFER"), "transfer");
assert.equal(salePaymentMethodFormValue(null), "unspecified");

assert.doesNotThrow(() => assertSalePaymentMethodDocumentType("SALE"));
assert.throws(
  () => assertSalePaymentMethodDocumentType("RECEIPT"),
  /Metoda de plată este disponibilă doar pentru vânzări\./,
);

console.log("sale payment method tests passed");
