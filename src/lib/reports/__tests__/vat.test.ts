import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMPANY, vatFromGross } from "@/lib/company";

// Prețurile sunt cu TVA inclus: TVA se scoate din total, nu se adaugă peste el.
assert.equal(COMPANY.vatRate, 0.2);
assert.deepEqual(vatFromGross(120), { tva: 20, net: 100 });
assert.deepEqual(vatFromGross(0), { tva: 0, net: 0 });
assert.deepEqual(vatFromGross(6), { tva: 1, net: 5 });

// La cota standard, TVA = total ÷ 6.
for (const gross of [1, 99.99, 1234.56, 1_000_000]) {
  const { tva, net } = vatFromGross(gross);
  assert.ok(Math.abs(tva - gross / 6) < 0.01, `TVA din ${gross}`);
  assert.ok(Math.abs(tva + net - gross) < 0.01, `net + TVA ≠ brut pentru ${gross}`);
}

// Cota e parametru, nu constantă îngropată: la 12% raportul se schimbă.
assert.deepEqual(vatFromGross(112, 0.12), { tva: 12, net: 100 });

const source = readFileSync("src/lib/reports/vat.ts", "utf8");

// Facturile sunt un subset al vânzărilor; dacă s-ar aduna, cifra lunii s-ar dubla.
assert.doesNotMatch(
  source,
  /sales_gross\s*\+\s*invoices_gross|invoices_gross\s*\+\s*sales_gross/,
  "Facturile nu se adună la vânzări — sunt o parte din ele.",
);

// Conturile anulate nu intră în registru.
assert.match(source, /status = 'ISSUED'/);

// Formula stă într-un singur loc, ca facturile și registrul să nu se despartă.
assert.match(source, /vatFromGross/);

// Lunile fără vânzări trebuie să apară totuși în tabel (generate_series),
// altfel un ianuarie gol dispare și pare că raportul a pierdut date.
assert.match(source, /generate_series/);

console.log("vat report tests passed");
