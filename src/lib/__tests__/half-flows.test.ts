import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseExternalOrderStatus } from "@/lib/external-orders/status";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

// --- E4: statusul comenzii externe nu mai trece printr-un cast ------------
assert.equal(parseExternalOrderStatus("LIVRAT"), "LIVRAT");
assert.throws(() => parseExternalOrderStatus("LIVRATA"), /Status de comandă necunoscut\./);
assert.throws(() => parseExternalOrderStatus(""), /Status de comandă necunoscut\./);
// `toString` e pe Object.prototype: `value in STATUS_LABELS` ar fi zis „da".
assert.throws(() => parseExternalOrderStatus("toString"), /Status de comandă necunoscut\./);

const externalOrders = read("src/app/external-orders/actions.ts");
// B4: comanda se oprea la LIVRAT și nu ajungea în NICIUN raport.
assert.match(externalOrders, /async function createDeliverySale/, "livrarea trebuie să creeze vânzarea");
assert.match(
  externalOrders,
  /parseRequiredSalePaymentMethod\(/,
  "livrarea trebuie să ceară metoda de plată",
);
assert.match(
  externalOrders,
  /SELECT "saleDocumentId" FROM "ExternalOrder" WHERE id = \$\{order\.id\} FOR UPDATE/,
  "a doua livrare nu are voie să dubleze vânzarea",
);
assert.match(externalOrders, /productId: null,/, "piesa externă nu intră în catalog, deci nici în stoc");
// E3 + E4b
assert.match(externalOrders, /function parseOfferDate/, "data ofertei are nevoie de gardă NaN");
assert.match(externalOrders, /async function assertSupplier/, "furnizorul ales trebuie verificat");
assert.doesNotMatch(
  externalOrders,
  /as ExternalOrderStatus;/,
  "statusul nu mai are voie să treacă printr-un cast",
);
assert.match(
  read("src/app/external-orders/external-orders-workspace.tsx"),
  /Ofertă expirată la/,
  "oferta expirată trebuie semnalată",
);

// --- B2: fluxul de aprobare dublat, scos din interfață --------------------
const istoric = read("src/app/crm/istoric/page.tsx");
assert.doesNotMatch(istoric, /Neaprobat|Semnalat/, "badge-urile inaccesibile nu mai există");
assert.doesNotMatch(
  read("src/lib/audit/queries.ts"),
  /reviewStatus/,
  "interogarea nu mai citește coloanele fluxului mort",
);
assert.doesNotMatch(
  read("prisma/schema.prisma"),
  /@@index\(\[reviewStatus\]\)/,
  "indexul fluxului mort trebuie scos",
);
// Fluxul real rămâne pe loc.
assert.match(read("src/lib/pending-operations/execute.ts"), /reviewedById/, "aprobarea reală rămâne");

// --- B3: acțiunea fără apelant --------------------------------------------
const documentActions = read("src/app/operations/document-actions.ts");
assert.doesNotMatch(
  documentActions,
  /updateDocumentHeaderAction/,
  "acțiunea fără apelant trebuie ștearsă, nu conectată",
);
// Ce făcea ea (dată, observații, partener) face deja acțiunea folosită.
for (const field of [/documentDate,/, /notes,/, /partnerId \}/]) {
  assert.match(documentActions, field, "editarea documentului scrie și antetul");
}

// --- B5: „fără stoc" nu mai e ușă cu un singur sens ----------------------
assert.match(
  read("src/app/operations/actions.ts"),
  /export async function markRestockPendingAction/,
  "poziția fără stoc trebuie să se poată întoarce în lucru",
);
assert.match(
  read("src/app/crm/fara-stoc/page.tsx"),
  /kind="pending"/,
  "întoarcerea trebuie să aibă buton",
);
assert.match(
  read("src/app/crm/de-adus/page.tsx"),
  /restockDeliveredToday/,
  "poziția adusă trebuie să se vadă undeva",
);

// --- E1: e-Factura nu mai îngheață pe „necesită semnare" -----------------
const paymentActions = read("src/app/payment-accounts/actions.ts");
assert.match(paymentActions, /const accepted = response\.status === 1;/, "statutul 1 e doar acceptare");
assert.match(
  paymentActions,
  /eFacturaStatus: processed \? "PROCESSED" : accepted \? "SUBMITTED" : "ERROR"/,
  "cele două statute nu mai se scriu la fel",
);
assert.doesNotMatch(
  read("src/app/payment-accounts/payment-account-row-actions.tsx"),
  /Trimis în e-Factura, necesită semnare/,
  "eticheta nu mai poate spune „semnare” despre o factură doar acceptată",
);

// --- E2: căderea cursului nu mai e tăcută ---------------------------------
const rates = read("src/lib/currency/rates.ts");
assert.doesNotMatch(rates, /\} catch \{/, "catch-ul gol înghițea motivul");
assert.match(rates, /console\.warn\(`\[curs valutar\]/, "căderea trebuie să lase urmă în loguri");

console.log("half flows test passed");
