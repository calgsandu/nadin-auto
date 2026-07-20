import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const saleDialog = readFileSync(
  fileURLToPath(new URL("../stock-document-dialog.tsx", import.meta.url)),
  "utf8",
);
const approvalWorkspace = readFileSync(
  fileURLToPath(new URL("../../aprobari/approval-workspace.tsx", import.meta.url)),
  "utf8",
);

assert.match(saleDialog, /name="cashRegistered"/);
assert.match(saleDialog, /value="yes"/);
assert.match(saleDialog, /value="no"/);
assert.match(saleDialog, /Alege Da sau Nu/);
assert.match(saleDialog, /required/);
assert.match(saleDialog, /name="paymentMethod"/);
assert.match(saleDialog, /value="cash"/);
assert.match(saleDialog, /value="card"/);
assert.match(saleDialog, /Alege Cash sau Card/);

assert.match(approvalWorkspace, /cashRegisterLabel/);
assert.match(approvalWorkspace, /entry\.details\.cashRegistered/);
assert.match(approvalWorkspace, /salePaymentMethodLabel/);
assert.match(approvalWorkspace, /entry\.details\.paymentMethod/);

console.log("cash register sale form tests passed");
