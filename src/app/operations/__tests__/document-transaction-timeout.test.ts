import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const actions = readFileSync(
  fileURLToPath(new URL("../document-actions.ts", import.meta.url)),
  "utf8",
);

assert.match(
  actions,
  /const DOCUMENT_TX_OPTIONS = \{ timeout: 30_000, maxWait: 10_000 \}/,
  "Marja de timp pentru tranzacțiile pe linii trebuie să rămână peste cele 5 s implicite.",
);

// Tranzacțiile care reversează și re-aplică stoc linie cu linie depășesc limita
// implicită la documentele lungi — fiecare trebuie să primească marja.
for (const action of ["deleteDocumentAction", "updateDocumentLinesAction"]) {
  const start = actions.indexOf(`export async function ${action}`);
  assert.ok(start >= 0, `Trebuie să existe acțiunea ${action}.`);
  const next = actions.indexOf("export async function ", start + 1);
  const body = actions.slice(start, next === -1 ? undefined : next);

  assert.match(body, /prisma\.\$transaction/, `${action} trebuie să ruleze în tranzacție.`);
  assert.match(
    body,
    /\}, DOCUMENT_TX_OPTIONS\)/,
    `${action} trebuie să ruleze cu DOCUMENT_TX_OPTIONS, altfel pică pe 5 s.`,
  );
}

console.log("document transaction timeout invariants passed");
