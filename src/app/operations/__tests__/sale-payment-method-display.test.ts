import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const crm = readFileSync(
  fileURLToPath(new URL("../../crm/page.tsx", import.meta.url)),
  "utf8",
);
const details = readFileSync(
  fileURLToPath(new URL("../document-details.tsx", import.meta.url)),
  "utf8",
);
const control = readFileSync(
  fileURLToPath(new URL("../sale-payment-method-control.tsx", import.meta.url)),
  "utf8",
);

assert.match(crm, /SalePaymentMethodBadge/);
assert.match(crm, /SalePaymentMethodControl/);
assert.match(crm, /document\.paymentMethod/);
assert.match(crm, /d\.paymentMethod/);
assert.match(crm, /paymentMethod: doc\.paymentMethod/);
assert.match(crm, />Plată</);
assert.match(crm, /colSpan=\{COMPANY\.vatPayer \? 10 : 9\}/);

assert.match(details, /paymentMethod/);
assert.match(details, /Metoda de plată/);
assert.match(details, /salePaymentMethodLabel/);

assert.match(control, /Cash/);
assert.match(control, /Card/);
assert.match(control, /Nespecificat/);
assert.match(control, /updateSalePaymentMethodAction/);

console.log("sale payment method display coverage passed");
