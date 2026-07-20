import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../document-actions.ts", import.meta.url)),
  "utf8",
);

assert.match(source, /export async function updateSalePaymentMethodAction/);
assert.match(source, /parseOptionalSalePaymentMethod/);
assert.match(source, /assertSalePaymentMethodDocumentType\(doc\.type\)/);
assert.match(source, /select: \{ id: true, type: true, number: true, paymentMethod: true \}/);
assert.match(source, /data: \{ paymentMethod \}/);
assert.match(source, /before: \{ paymentMethod: doc\.paymentMethod \}/);
assert.match(source, /after: \{ paymentMethod \}/);
assert.match(source, /revalidatePath\("\/crm"\)/);

console.log("sale payment method update invariants passed");
