import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const saleDialogPath = fileURLToPath(new URL("../stock-document-dialog.tsx", import.meta.url));
const productSearchPath = fileURLToPath(new URL("../product-search-combobox.tsx", import.meta.url));
const saleDialog = readFileSync(saleDialogPath, "utf8");
const productSearch = readFileSync(productSearchPath, "utf8");

assert.match(
  saleDialog,
  /productId: "", qty: "", price: ""/,
  "Liniile de vânzare trebuie să rețină produsul selectat.",
);
assert.match(
  saleDialog,
  /excludedProductIds=\{lines\.filter\(\(item\) => item\.id !== line\.id\)\.map\(\(item\) => item\.productId\)\}/,
  "Căutarea din vânzare trebuie să excludă produsele selectate pe celelalte linii.",
);
assert.match(
  productSearch,
  /excludedProductIds/, 
  "Căutarea de produs trebuie să poată elimina rezultate deja selectate.",
);

console.log("duplicate product selection test passed");
