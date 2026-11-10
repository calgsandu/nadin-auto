import assert from "node:assert/strict";
import { prepareQuickIndex, searchQuickIndex, type QuickProduct } from "@/lib/catalog/quick-index";

const product = (over: Partial<QuickProduct> & { id: string }): QuickProduct => ({
  code: null,
  altCode: null,
  description: "",
  type: "",
  vehicles: "",
  stock: 0,
  stocks: [],
  price: null,
  ...over,
});

const index = prepareQuickIndex([
  product({ id: "prag-l", code: "P11323 1", description: "Prag 4/5uși L", type: "Prag", vehicles: "AUDI A4 1994–2000", stock: 1 }),
  product({ id: "prag-r", code: "P11323 2", description: "Prag 4/5uși R", type: "Prag", vehicles: "AUDI A4 1994–2000" }),
  product({ id: "usa", code: "T0014011", description: "Panou ușă L", type: "Panou", vehicles: "MERCEDES-BENZ SPRINTER 906 (DELFIN) 2006–prezent • VW CRAFTER 2006–2016", stock: 2 }),
  product({ id: "aripa", code: "131501", altCode: "AX-77", description: "Aripă față L", type: "Aripă", vehicles: "AUDI 100 (44) din 1982" }),
]);

const ids = (query: string) => searchQuickIndex(index, query).map((p) => p.id);

// Codul se caută fără spații, iar potrivirea exactă e prima.
assert.deepEqual(ids("P113231"), ["prag-l"]);
assert.deepEqual(ids("p11323"), ["prag-l", "prag-r"], "la scor egal, ce e în stoc vine primul");

// Fără diacritice și fără să conteze ordinea cuvintelor.
assert.deepEqual(ids("usa panou"), ["usa"]);
assert.deepEqual(ids("crafter panou"), ["usa"], "se găsește și după mașina-geamăn");

// Codul alternativ.
assert.deepEqual(ids("ax77"), ["aripa"]);

// Anul: prins ca interval de fabricație, inclusiv „–prezent" și „din 1982".
assert.deepEqual(ids("prag 1997"), ["prag-l", "prag-r"]);
assert.deepEqual(ids("prag 2003"), []);
assert.deepEqual(ids("panou 2020"), ["usa"]);
assert.deepEqual(ids("aripa 1982"), ["aripa"]);

// Toți termenii trebuie să apară.
assert.deepEqual(ids("prag sprinter"), []);
assert.deepEqual(ids("   "), []);

console.log("quick-index: ok");
