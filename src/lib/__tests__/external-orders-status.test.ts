import assert from "node:assert/strict";
import { test } from "node:test";
import { NEXT_STATUS, STATUS_LABELS } from "../external-orders/status";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

const ALL: ExternalOrderStatus[] = [
  "CERERE",
  "OFERTAT",
  "CONFIRMAT",
  "RECEPTIONAT",
  "LIVRAT",
  "ANULAT",
];

test("fiecare status are etichetă și tranziții definite", () => {
  for (const status of ALL) {
    assert.ok(STATUS_LABELS[status], `lipsă etichetă pentru ${status}`);
    assert.ok(Array.isArray(NEXT_STATUS[status]), `lipsă tranziții pentru ${status}`);
  }
});

test("statusurile finale nu au tranziții, restul pot fi anulate", () => {
  assert.deepEqual(NEXT_STATUS.LIVRAT, []);
  assert.deepEqual(NEXT_STATUS.ANULAT, []);
  for (const status of ["CERERE", "OFERTAT", "CONFIRMAT", "RECEPTIONAT"] as const) {
    assert.ok(NEXT_STATUS[status].includes("ANULAT"), `${status} trebuie să permită anularea`);
  }
});

test("fluxul principal e înlănțuit până la livrare", () => {
  assert.ok(NEXT_STATUS.CERERE.includes("OFERTAT"));
  assert.ok(NEXT_STATUS.OFERTAT.includes("CONFIRMAT"));
  assert.ok(NEXT_STATUS.CONFIRMAT.includes("RECEPTIONAT"));
  assert.ok(NEXT_STATUS.RECEPTIONAT.includes("LIVRAT"));
});
