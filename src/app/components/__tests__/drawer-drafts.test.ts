import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/** Formularele de operațiuni: fără `<form action>` = fără resetul automat al React. */
const DIALOGS = [
  "src/app/operations/stock-document-dialog.tsx",
  "src/app/operations/inventory-dialog.tsx",
  "src/app/operations/return-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
  "src/app/payment-accounts/payment-account-dialog.tsx",
  "src/app/partners/payment-dialog.tsx",
  "src/app/partners/partner-form-dialog.tsx",
  "src/app/catalog/product-form-dialog.tsx",
  "src/app/external-orders/external-order-dialog.tsx",
  "src/app/admin/admin-dialogs.tsx",
];

for (const file of DIALOGS) {
  const source = read(file);
  assert.match(source, /useDrawerAction\(/, `${file}: trimiterea trece prin useDrawerAction`);
  // `<form action>` ar goli câmpurile la eroare; formularele de drawer trimit manual.
  // (Formularele de ștergere din aceleași fișiere n-au ce pierde și rămân pe `action`.)
  assert.match(source, /onSubmit=\{onSubmit\}/, `${file}: formularul trebuie trimis prin onSubmit`);
  // Panoul rămâne montat după închidere (ciorna se păstrează). Excepție:
  // return-dialog ține TOT în state-ul componentei părinte, deci ciorna
  // supraviețuiește oricum închiderii.
  if (!file.endsWith("return-dialog.tsx")) {
    assert.match(source, /mounted \?|!mounted/, `${file}: panoul trebuie ținut montat după prima deschidere`);
  }
}

const drawer = read("src/app/components/operation-drawer.tsx");
assert.match(drawer, /DrawerPortal locked=\{open\}/, "panoul ascuns nu blochează scrollul paginii");
assert.match(drawer, /beforeunload/, "ciorna nesalvată avertizează la refresh/închidere de tab");
assert.match(drawer, /formRef\.current\?\.reset\(\)/, "formularul se golește doar la salvare reușită");

const portal = read("src/app/components/drawer-portal.tsx");
assert.match(portal, /locked = true/, "DrawerPortal trebuie să accepte blocarea condiționată");

console.log("drawer drafts test passed");
