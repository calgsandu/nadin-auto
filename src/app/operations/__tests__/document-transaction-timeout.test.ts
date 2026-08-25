import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TX_OPTIONS } from "@/lib/operations/transaction-limits";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const documentActions = read("../document-actions.ts");
const actions = read("../actions.ts");
// Plafonul cererii pe Vercel: tranzacția trebuie să pice cu mesajul Prisma
// înainte ca funcția să fie tăiată cu un 504 mut. Acțiunile pornesc din pagina
// secțiunii, deci FIECARE rută CRM trebuie să declare plafonul, nu doar una.
const crmPages = readdirSync(fileURLToPath(new URL("../../crm", import.meta.url)), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => `../../crm/${entry.name}/page.tsx`);

assert.ok(crmPages.length >= 20, "fiecare secțiune CRM are ruta ei");

for (const page of crmPages) {
  const maxDuration = Number(read(page).match(/export const maxDuration = (\d+)/)?.[1]);
  assert.ok(
    Number.isInteger(maxDuration),
    `${page} trebuie să declare maxDuration — altfel Vercel taie la 15 s implicit.`,
  );
  assert.ok(
    DOCUMENT_TX_OPTIONS.timeout < maxDuration * 1000,
    `Marja tranzacției (${DOCUMENT_TX_OPTIONS.timeout} ms) trebuie să stea sub maxDuration (${maxDuration} s) în ${page}.`,
  );
}
assert.ok(
  DOCUMENT_TX_OPTIONS.timeout > 5_000,
  "Marja trebuie să depășească limita implicită Prisma de 5 s.",
);

// Tranzacțiile care scriu stoc linie cu linie depășesc limita implicită la
// documentele lungi — fiecare trebuie să primească marja comună.
const perLineTransactions = [
  ["../document-actions.ts", documentActions, "deleteDocumentAction"],
  ["../document-actions.ts", documentActions, "updateDocumentLinesAction"],
  ["../actions.ts", actions, "createInventoryAction"],
] as const;

for (const [file, source, action] of perLineTransactions) {
  const start = source.indexOf(`export async function ${action}`);
  assert.ok(start >= 0, `Trebuie să existe acțiunea ${action} în ${file}.`);
  const next = source.indexOf("export async function ", start + 1);
  const body = source.slice(start, next === -1 ? undefined : next);

  assert.match(body, /prisma\.\$transaction/, `${action} trebuie să ruleze în tranzacție.`);
  assert.match(
    body,
    /\}, DOCUMENT_TX_OPTIONS\)/,
    `${action} trebuie să ruleze cu DOCUMENT_TX_OPTIONS, altfel pică pe 5 s.`,
  );
}

console.log("document transaction timeout invariants passed");
