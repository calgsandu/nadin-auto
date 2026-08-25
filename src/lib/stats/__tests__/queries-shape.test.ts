import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/stats/queries.ts", "utf8");

// Agregarea stă în Postgres. Dacă reapare un findMany peste vânzări, costul
// redevine liniar cu vechimea magazinului: 13 luni de linii aduse în memorie.
assert.doesNotMatch(
  source,
  /stockDocument\.findMany/,
  "Statisticile nu au voie să aducă vânzările rând cu rând.",
);
assert.match(source, /\$queryRaw/);

// Vânzările fără linii rămân în numărătoare (LEFT JOIN + COUNT DISTINCT).
assert.match(source, /LEFT JOIN "StockDocumentLine"/);
assert.match(source, /COUNT\(DISTINCT id\)/);

// Cele trei granularități se citesc într-un singur drum la bază.
for (const bucket of ["'day'", "'week'", "'month'"]) {
  assert.ok(source.includes(bucket), `lipsește bucket-ul ${bucket}`);
}
// Cheia de săptămână e ISO, ca să nu se rupă la granița dintre ani.
assert.match(source, /IYYY-"W"IW/);

// Ordinea din „Top produse" trebuie să fie deterministă: la cantități egale
// decide venitul, apoi id-ul. Fără asta, lista sare între reîncărcări.
assert.match(source, /ORDER BY quantity DESC, revenue_lei DESC, product_id/);

// Indexul care face filtrarea „un tip, un interval" ieftină.
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /@@index\(\[type, documentDate\]\)/);

console.log("stats query shape tests passed");
