import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/reports/day-close.ts", "utf8");

// Ziua e locală și închisă la stânga: [00:00, 00:00 a doua zi), ca o vânzare
// de la 23:59 să nu cadă în ziua următoare.
assert.match(source, /setHours\(0, 0, 0, 0\)/);
assert.match(source, /"documentDate" >= \$\{start\} AND "documentDate" < \$\{end\}/);

// Totalul unui document: totalLei, cu totalEuro ca rezervă pentru documentele
// vechi — aceeași regulă ca în restul rapoartelor.
assert.match(source, /COALESCE\("totalLei", "totalEuro"\)/);

// Banii intrați azi = numerar din vânzări + încasări pe datorii − retururi.
// Vânzările pe credit NU intră: marfa a plecat, banii nu au venit.
const cashInHand = source.slice(source.indexOf("const cashInHand"));
assert.match(cashInHand.slice(0, 200), /cash\?\.total_lei/);
assert.match(cashInHand.slice(0, 200), /collectedFromPartners/);
assert.match(cashInHand.slice(0, 200), /- returnsTotal/);
assert.doesNotMatch(
  cashInHand.slice(0, 200),
  /credit/,
  "Vânzările pe credit nu sunt bani în casă.",
);

// Metodele de plată se citesc grupat din bază, nu se numără în JS.
assert.match(source, /GROUP BY "paymentMethod"/);
assert.match(source, /GROUP BY "cashRegistered"/);

console.log("day close tests passed");
