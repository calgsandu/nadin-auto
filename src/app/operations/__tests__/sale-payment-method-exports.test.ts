import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function source(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const register = source("../../api/export/sales-register/route.ts");
const pdf = source("../../api/export/document/[id]/pdf/route.ts");
const invoice = source("../../api/export/invoice/[id]/route.ts");

for (const route of [register, pdf, invoice]) {
  assert.match(route, /salePaymentMethodLabel/);
  assert.match(route, /paymentMethod/);
}

assert.match(register, /paymentMethod: string/);
assert.match(register, /Metoda plății/);
assert.match(register, /header: "Plată"/);
assert.equal(register.match(/din care TVA \(÷6\)/g)?.length, 1);
assert.match(pdf, /Metoda de plată:/);
assert.match(invoice, /"Metoda de plată:"/);

console.log("sale payment method export coverage passed");
