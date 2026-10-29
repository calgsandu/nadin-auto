import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const saleDialog = readFileSync(
  fileURLToPath(new URL("../stock-document-dialog.tsx", import.meta.url)),
  "utf8",
);
const drawer = readFileSync(
  fileURLToPath(new URL("../../components/operation-drawer.tsx", import.meta.url)),
  "utf8",
);
const approvalWorkspace = readFileSync(
  fileURLToPath(new URL("../../aprobari/approval-workspace.tsx", import.meta.url)),
  "utf8",
);

// Casa și metoda de plată se aleg din butoane (DrawerChoice), obligatoriu și
// fără valoare preselectată: omul trebuie să aleagă explicit la fiecare vânzare.
assert.match(saleDialog, /name="cashRegistered"/);
assert.match(saleDialog, /value: "yes"/);
assert.match(saleDialog, /value: "no"/);
assert.match(saleDialog, /Alege Da sau Nu/);
assert.match(saleDialog, /name="paymentMethod"/);
assert.match(saleDialog, /value: "cash"/);
assert.match(saleDialog, /value: "card"/);
assert.match(saleDialog, /Alege metoda de plată/);
assert.match(saleDialog, /value: "credit"/);
assert.match(saleDialog, /name="cashRegistered"[\s\S]*?required/);
assert.match(saleDialog, /name="paymentMethod"[\s\S]*?required/);
assert.match(drawer, /export function DrawerChoice/);
assert.match(drawer, /type="radio"/);
assert.doesNotMatch(drawer, /defaultChecked/, "niciun buton nu e bifat din start");

assert.match(approvalWorkspace, /cashRegisterLabel/);
assert.match(approvalWorkspace, /entry\.details\.cashRegistered/);
assert.match(approvalWorkspace, /salePaymentMethodLabel/);
assert.match(approvalWorkspace, /entry\.details\.paymentMethod/);

console.log("cash register sale form tests passed");
