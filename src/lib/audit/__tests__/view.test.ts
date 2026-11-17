import assert from "node:assert/strict";
import { describeAuditDetails, productIdsToResolve } from "@/lib/audit/view";

// Editare document: antet schimbat + produs adăugat / scos / cantitate modificată.
const line = (productId: string, product: string, quantity: number) => ({
  productId,
  product,
  quantity,
  price: 0,
  externalCode: null,
  externalName: null,
  externalSupplierId: null,
});
assert.deepEqual(
  describeAuditDetails({
    before: {
      type: "ADJUSTMENT",
      documentDate: "2026-10-01",
      warehouse: "Pavilion 514",
      lines: [line("a", "A", 1), line("b", "B", 2), line("b", "B", 1)],
    },
    after: {
      type: "ADJUSTMENT",
      documentDate: "2026-10-08",
      warehouse: "Pavilion 514",
      lines: [line("b", "B", 4), line("c", "C", 5)],
    },
  }),
  [
    { title: "Ce s-a schimbat", rows: [{ label: "Data", value: "01.10.2026 → 08.10.2026" }] },
    { title: "Produse adăugate", rows: [{ label: "C", value: "5 buc" }] },
    { title: "Produse scoase", rows: [{ label: "A", value: "1 buc" }] },
    { title: "Produse modificate", rows: [{ label: "B", value: "3 → 4 buc" }] },
  ],
);

// Editare fără diferențe în linii.
assert.deepEqual(
  describeAuditDetails({ before: { lines: [line("a", "A", 1)] }, after: { lines: [line("a", "A", 1)] } }),
  [{ rows: [{ label: "Produse", value: "neschimbate (1)" }] }],
);

// Produs editat: cod schimbat + stoc pe locații (locația lipsă = 0, fără zgomot).
assert.deepEqual(
  describeAuditDetails({
    before: { externalCode: "50629081", costLei: 1080 },
    after: { externalCode: "T3546704", costLei: 1080 },
    beforeWarehouseStocks: [{ warehouse: "P514", quantity: 2 }],
    afterWarehouseStocks: [
      { warehouse: "P514", quantity: 3 },
      { warehouse: "Depozit", quantity: 0 },
    ],
  }),
  [
    { title: "Ce s-a schimbat", rows: [{ label: "Cod", value: "50629081 → T3546704" }] },
    { title: "Stoc pe locații", rows: [{ label: "P514", value: "2 → 3 buc" }] },
  ],
);

// Inventar: numele vin din baza de date.
const inventory = {
  warehouseId: "w1",
  diffs: [{ productId: "a", quantity: 2 }],
  counts: [
    { productId: "a", before: 3, counted: 5 },
    { productId: "b", before: 4, counted: 4 },
  ],
};
assert.deepEqual(productIdsToResolve(inventory), ["a", "b"]);
assert.deepEqual(describeAuditDetails(inventory, { a: "P1 · Prag" }), [
  {
    title: "Numărat la inventar",
    rows: [
      { label: "P1 · Prag", value: "3 → 5 buc" },
      { label: "Produs necunoscut", value: "4 buc, fără diferență" },
    ],
  },
]);

// Câmpuri simple (utilizatori, 2FA): etichete românești, id-urile ascunse.
assert.deepEqual(describeAuditDetails({ role: "ADMIN", username: "nadejda", restoredFromAuditId: "x" }), [
  {
    rows: [
      { label: "Rol", value: "Administrator" },
      { label: "Utilizator", value: "nadejda" },
    ],
  },
]);

// Vânzare creată: liniile au doar productId + prețuri brute, enum-urile traduse.
const sale = {
  lines: [{ productId: "p", quantity: 2, unitPriceEuro: 600, unitCostLei: null }],
  paymentMethod: "CARD",
  cashRegistered: null,
};
assert.deepEqual(productIdsToResolve(sale), ["p"]);
assert.deepEqual(describeAuditDetails(sale, { p: "P9 · Aripă" }), [
  { title: "Produse", rows: [{ label: "P9 · Aripă", value: "2 buc × 600" }] },
  { rows: [{ label: "Plată", value: "Card" }] },
]);
assert.deepEqual(describeAuditDetails({ kind: "DEPUNERE", amountLei: 10000 }), [
  { rows: [{ label: "Tip", value: "Depunere" }, { label: "Sumă lei", value: "10.000" }] },
]);
