import assert from "node:assert/strict";
import { parsePaymentAccountForm } from "@/lib/payment-accounts/validate";

function validForm() {
  const form = new FormData();
  form.set("warehouseId", "warehouse-1");
  form.set("partnerId", "customer-1");
  form.set("issueDate", "2026-07-14");
  form.set("dueDate", "2026-07-21");
  form.set("notes", "Achitare prin transfer");
  form.append("productId", "product-1");
  form.append("quantity", "2");
  form.append("unitPriceGross", "315,50");
  return form;
}

assert.deepEqual(parsePaymentAccountForm(validForm()), {
  warehouseId: "warehouse-1",
  partnerId: "customer-1",
  issueDate: new Date("2026-07-14T12:00:00.000Z"),
  dueDate: new Date("2026-07-21T12:00:00.000Z"),
  notes: "Achitare prin transfer",
  lines: [{ productId: "product-1", quantity: 2, unitPriceGross: 315.5 }],
});

const missingCustomer = validForm();
missingCustomer.set("partnerId", "");
assert.throws(() => parsePaymentAccountForm(missingCustomer), /Alege clientul/);

const duplicate = validForm();
duplicate.append("productId", "product-1");
duplicate.append("quantity", "1");
duplicate.append("unitPriceGross", "100");
assert.throws(() => parsePaymentAccountForm(duplicate), /mai multe ori/);

const invalidPrice = validForm();
invalidPrice.set("unitPriceGross", "0");
assert.throws(() => parsePaymentAccountForm(invalidPrice), /Prețul.*mai mare decât zero/);

console.log("payment account validate tests passed");
