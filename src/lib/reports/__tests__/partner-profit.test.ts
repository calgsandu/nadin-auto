import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/reports/partner-profit.ts", "utf8");
const stats = readFileSync("src/lib/stats/queries.ts", "utf8");

// Costul unei linii e cel ÎNGHEȚAT pe linie la vânzare; fișa produsului rămâne
// rezervă doar pentru vânzările de dinaintea înghețării. Regula trebuie să fie
// identică în ambele rapoarte, altfel profitul din Statistici nu se potrivește
// cu cel pe client.
const costRule = /COALESCE\(l\."unitCostLei", p\."costLei", 0\)/;
assert.match(source, costRule);
assert.match(stats, costRule);
// Regula veche („costul curent din fișă") nu trebuie să mai existe nicăieri:
// ar face ca profitul unei vânzări vechi să se schimbe la fiecare recepție.
const staleRule = /WHEN l\."productId" IS NOT NULL THEN COALESCE\(p\."costLei", 0\)/;
assert.doesNotMatch(source, staleRule);
assert.doesNotMatch(stats, staleRule);

// Vânzările fără partener se strâng într-un singur rând, nu dispar.
assert.match(source, /LEFT JOIN "Partner"/);
assert.match(source, /Clienți de tejghea/);

// Documentele fără linii nu trebuie să pice din numărătoare.
assert.match(source, /LEFT JOIN "StockDocumentLine"/);
assert.match(source, /COUNT\(DISTINCT d\.id\)/);

console.log("partner profit tests passed");
