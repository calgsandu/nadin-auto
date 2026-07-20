import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const actions = readFileSync(
  fileURLToPath(new URL("../document-actions.ts", import.meta.url)),
  "utf8",
);

const start = actions.indexOf("export async function updateCashRegisteredAction");
assert.ok(start >= 0, "Trebuie să existe acțiunea de schimbare a statutului de casă.");
const source = actions.slice(start, start + 3800);

assert.match(source, /requireWrite\(\)/);
assert.match(source, /parseOptionalCashRegistered/);
assert.match(source, /prisma\.\$transaction/);
assert.match(source, /assertCashRegisterDocumentType\(doc\.type\)/);
assert.match(source, /data: \{ cashRegistered \}/);
assert.match(source, /logAuditRequired/);
assert.match(source, /before: \{ cashRegistered: doc\.cashRegistered \}/);
assert.match(source, /after: \{ cashRegistered \}/);
assert.match(source, /revalidatePath\("\/crm"\)/);

console.log("cash register update invariants passed");
