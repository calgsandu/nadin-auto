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

assert.match(crm, /CashRegisterBadge/);
assert.match(crm, /CashRegisterControl/);
assert.match(crm, /document\.type === "SALE"/);
assert.match(crm, /document\.cashRegistered/);
assert.match(crm, /<TableHead>Casă<\/TableHead>/);

assert.match(details, /cashRegistered/);
assert.match(details, /Statut casă/);
assert.match(details, /cashRegisterLabel/);

console.log("cash register display coverage passed");
