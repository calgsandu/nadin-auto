import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/reports/partner-profit.ts", "utf8");
const stats = readFileSync("src/lib/stats/queries.ts", "utf8");

// Costul unei linii se ia din fișa produsului pentru piesele proprii și de pe
// linie pentru cele externe. Regula trebuie să fie identică în ambele rapoarte,
// altfel profitul din Statistici nu se potrivește cu cel pe client.
const costRule =
  /WHEN l\."productId" IS NOT NULL THEN COALESCE\(p\."costLei", 0\)\s*\n?\s*ELSE COALESCE\(l\."unitCostLei", 0\)/;
assert.match(source, costRule);
assert.match(stats, costRule);

// Vânzările fără partener se strâng într-un singur rând, nu dispar.
assert.match(source, /LEFT JOIN "Partner"/);
assert.match(source, /Clienți de tejghea/);

// Documentele fără linii nu trebuie să pice din numărătoare.
assert.match(source, /LEFT JOIN "StockDocumentLine"/);
assert.match(source, /COUNT\(DISTINCT d\.id\)/);

console.log("partner profit tests passed");
