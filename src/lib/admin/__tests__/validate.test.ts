import assert from "node:assert/strict";
import { parseName, parseTranslatedName, parseModel, parseFitment, parseWarehouse } from "@/lib/admin/validate";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

// parseName
assert.equal(parseName(fd({ name: "  " })).ok, false);
const n = parseName(fd({ name: "  AUDI " }));
assert.equal(n.ok && n.data.name, "AUDI");
const tn = parseTranslatedName(fd({ name: " Prag ", nameRu: "  Порог  " }));
assert.deepEqual(tn, { ok: true, data: { name: "Prag", nameRu: "Порог" } });
const emptyRu = parseTranslatedName(fd({ name: "Prag", nameRu: "   " }));
assert.equal(emptyRu.ok && emptyRu.data.nameRu, null);

// parseModel: brand + name required
assert.equal(parseModel(fd({ name: "Passat" })).ok, false);
assert.equal(parseModel(fd({ brandId: "b1" })).ok, false);
const m = parseModel(fd({ brandId: "b1", name: " Passat B6 " }));
assert.equal(m.ok && m.data.brandId, "b1");
assert.equal(m.ok && m.data.name, "Passat B6");

// parseWarehouse: name + flags
const w = parseWarehouse(fd({ name: "Depozit", isDefault: "on" }));
assert.equal(w.ok && w.data.isDefault, true);
assert.equal(w.ok && w.data.active, false);

// parseFitment: label + model required, year ordering enforced
assert.equal(parseFitment(fd({ carModelId: "m1" })).ok, false);
const bad = parseFitment(fd({ carModelId: "m1", label: "B6", yearStart: "2010", yearEnd: "2005" }));
assert.equal(bad.ok, false);
if (!bad.ok) assert.match(bad.message, /început/i);
const badYear = parseFitment(fd({ carModelId: "m1", label: "B6", yearStart: "1700" }));
assert.equal(badYear.ok, false);
const ok = parseFitment(fd({ carModelId: "m1", label: " B6 ", yearStart: "2005", yearEnd: "2010", yearOpenEnded: "on" }));
assert.equal(ok.ok && ok.data.yearStart, 2005);
assert.equal(ok.ok && ok.data.yearEnd, 2010);
assert.equal(ok.ok && ok.data.yearOpenEnded, true);
assert.equal(ok.ok && ok.data.labelRu, null);
const translatedFitment = parseFitment(fd({ carModelId: "m1", label: " B6 ", labelRu: " Б6 " }));
assert.equal(translatedFitment.ok && translatedFitment.data.labelRu, "Б6");

console.log("admin validate tests passed");
