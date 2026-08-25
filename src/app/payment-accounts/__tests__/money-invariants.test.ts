import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/**
 * Banii unui cont de plată trebuie să se închidă în AMBELE registre: soldul
 * clientului și „bani intrați în casă". Verificarea e pe sursă fiindcă legătura
 * trece prin patru fișiere — se poate rupe fără ca vreun test de logică să pice,
 * iar rezultatul e marfă predată care nu apare nicăieri ca datorie.
 */
const actions = read("src/app/payment-accounts/actions.ts");

// „Marchează achitat" scria doar `paidAt`: încasarea nu ajungea niciodată în
// registrul de bani, deci proformele erau un al doilea registru, nereconciliat.
assert.match(actions, /tx\.partnerPayment\.create\(\{/, "achitarea trebuie să scrie o încasare");
assert.match(
  actions,
  /idempotencyKey: paymentAccountPaymentKey\(id\)/,
  "încasarea trebuie să fie idempotentă pe cont",
);
assert.match(
  actions,
  /function paymentAccountPaymentKey\(accountId: string\) \{\s*\n\s*return `payment-account:\$\{accountId\}`;/,
  "cheia încasării se derivă din contul de plată",
);

// Contul achitat dar nelivrat era fundătură: anularea cerea o rambursare, iar
// rambursarea nu exista nicăieri.
assert.match(actions, /const refunded = formData\.get\("refund"\) === "1"/, "anularea citește rambursarea");
assert.match(
  actions,
  /amount: account\.totalGross\.negated\(\)/,
  "rambursarea e o încasare negativă (bani ieșiți)",
);
assert.match(
  actions,
  /idempotencyKey: paymentAccountRefundKey\(id\)/,
  "rambursarea trebuie să fie idempotentă pe cont",
);
// Cele două scrieri stau în aceeași tranzacție cu schimbarea de stare: un cont
// marcat achitat fără încasare (sau invers) ar strica soldul pe tăcute.
for (const guard of [
  /await prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?tx\.paymentAccount\.updateMany[\s\S]*?tx\.partnerPayment\.create/,
]) {
  assert.match(actions, guard, "starea și banii se scriu împreună");
}

// Corectarea contului: până acum un IDNO greșit rămânea greșit pe factură.
assert.match(actions, /export async function updatePaymentAccountAction/, "contul trebuie să poată fi corectat");
assert.match(
  actions,
  /Contul nu mai poate fi corectat după ce marfa a fost predată\./,
  "corectarea se oprește după predare",
);

// Vânzarea născută din cont: fără metodă cădea în „Nespecificat" ȘI nu intra în
// datoria clientului — marfa predată și neîncasată dispărea din socoteli.
const fulfill = read("src/lib/payment-accounts/fulfill.ts");
assert.match(
  fulfill,
  /paymentMethod: account\.paidAt \? \("TRANSFER" as const\) : \("CREDIT" as const\)/,
  "vânzarea din cont trebuie să poarte metoda de plată",
);
assert.match(fulfill, /cashRegistered: false/, "nici transferul, nici creditul nu trec prin casa de marcat");

// Ambele metode „deschise" intră în sold: altfel un cont achitat în avans ar
// lăsa clientul cu sold negativ pe veci.
const debt = read("src/lib/partners/debt.ts");
assert.match(
  debt,
  /const OPEN_METHODS = \["CREDIT", "TRANSFER"\] as const;/,
  "soldul trebuie să numere și transferurile",
);
assert.doesNotMatch(debt, /"paymentMethod" = 'CREDIT'/, "nu mai există filtru doar pe CREDIT");
// Fișa partenerului avea funcția scrisă și niciun apelant.
assert.match(debt, /export async function getPartnerLedger/, "fișa partenerului rămâne expusă");
assert.match(
  read("src/app/api/partners/[id]/ledger/route.ts"),
  /getPartnerLedger\(id\)/,
  "fișa trebuie să aibă un apelant",
);
assert.match(
  read("src/app/crm/furnizori/page.tsx"),
  /<PartnerLedgerButton/,
  "fișa trebuie să fie deschisă din lista de parteneri",
);

// Încasarea era create-only: o sumă tastată greșit rămânea pe veci în sold.
const partners = read("src/app/partners/actions.ts");
assert.match(partners, /export async function deletePartnerPaymentAction/, "încasarea trebuie să poată fi ștearsă");
assert.match(
  partners,
  /payment\.idempotencyKey\?\.startsWith\("payment-account"\)/,
  "mișcările născute dintr-un cont de plată nu se șterg de mână",
);
assert.match(partners, /entity: "PartnerPayment",\s*\n\s*entityId: id,/, "ștergerea trece prin audit");

// Închiderea de zi: fără găleată, transferurile intrau în total dar dispăreau
// din defalcare, iar suma coloanelor nu mai dădea totalul.
const dayClose = read("src/lib/reports/day-close.ts");
assert.match(dayClose, /const transfer = method\("TRANSFER"\)/, "închiderea de zi trebuie să numere transferurile");
assert.match(dayClose, /transfer: \{ count: transfer\?\.cnt/, "transferul are propria coloană");
assert.match(
  read("src/app/crm/inchidere-zi/page.tsx"),
  /data\.methods\.transfer\.lei/,
  "coloana de transfer trebuie să se și vadă",
);

console.log("payment account money invariants passed");
