import assert from "node:assert/strict";
import {
  saleRequestSummary,
  saleTotalLei,
} from "@/lib/operations/execute-sale";

const payload = {
  warehouseId: "w1",
  documentDate: "2026-07-17",
  partnerId: null,
  newCustomerName: "Client",
  notes: null,
  cashRegistered: false,
  paymentMethod: "CARD" as const,
  lines: [
    { productId: "p1", externalName: null, externalCode: null, externalSupplierId: null, unitCostLei: null, quantity: 2, unitPriceLei: 150 },
    { productId: null, externalName: "Aripă externă", externalCode: "506502", externalSupplierId: null, unitCostLei: 60, quantity: 1, unitPriceLei: 80 },
  ],
};

assert.equal(saleTotalLei(payload), 380);
assert.equal(
  saleRequestSummary(payload, "Depozit"),
  "Cerere vânzare (2 produse, 380 lei, nebătută în casă, plată Card) — Depozit",
);

console.log("sale execution helper tests passed");
