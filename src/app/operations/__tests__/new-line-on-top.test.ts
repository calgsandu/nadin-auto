import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

// Rândul nou intră în capul listei, ca la documentele lungi (inventare) să nu
// mai fie nevoie de derulat până la capăt după fiecare produs adăugat.
const forms = [
  "../inventory-dialog.tsx",
  "../stock-document-dialog.tsx",
  "../document-row-actions.tsx",
  "../../payment-accounts/payment-account-dialog.tsx",
] as const;

for (const form of forms) {
  const source = read(form);
  assert.doesNotMatch(
    source,
    /set(Editable)?Lines\(\(current\) => \[\s*\.\.\.current,/,
    `${form}: rândul nou trebuie adăugat la început, nu la sfârșitul listei.`,
  );
  assert.match(
    source,
    /set(Editable)?Lines\(\(current\) => \[[\s\S]{0,120}?\.\.\.current,?\s*\]\)/,
    `${form}: trebuie să existe o adăugare de rând care pune noul rând înaintea celor vechi.`,
  );
}

// Enter pe ultimul câmp al rândului în lucru (primul din listă) deschide un
// rând nou și sare în căutarea lui — altfel focusul ar cădea în rândurile vechi.
const drawer = read("../../components/operation-drawer.tsx");
assert.match(drawer, /const onFirstLine =/);
assert.match(drawer, /onLastFieldOfCurrentLine && onFirstLine/);
assert.match(
  drawer,
  /form\.querySelector<HTMLInputElement>\('input\[role="combobox"\]'\)\?\.focus\(\)/,
  "Focusul după adăugare trebuie să meargă pe primul combobox, nu pe ultimul.",
);

console.log("new line on top invariants passed");
