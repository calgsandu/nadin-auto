import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const saleDialogPath = fileURLToPath(new URL("../stock-document-dialog.tsx", import.meta.url));
const productSearchPath = fileURLToPath(new URL("../product-search-combobox.tsx", import.meta.url));
const saleDialog = readFileSync(saleDialogPath, "utf8");
const productSearch = readFileSync(productSearchPath, "utf8");

assert.match(
  saleDialog,
  /function emptySaleLine\(id: number, external = false\): SaleLineState/,
  "Liniile de vânzare trebuie să rețină produsul selectat.",
);
// Produsul deja pus pe alt rând nu se mai ascunde: alegerea lui adună cantitatea
// pe rândul existent (fără eroare la salvare).
assert.match(
  saleDialog,
  /mergeSelectionIntoExisting\(/,
  "Vânzarea trebuie să adune produsul ales a doua oară pe rândul existent.",
);
assert.match(
  productSearch,
  /excludedProductIds/, 
  "Căutarea de produs trebuie să poată elimina rezultate deja selectate.",
);

console.log("duplicate product selection test passed");
