import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../language-switcher.tsx", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  source,
  /from ["']next\/link["']/,
  "Schimbarea limbii nu trebuie interceptată de routerul Next, deoarece RO și RU sunt rescrise spre același arbore de rute.",
);
assert.match(source, /<a\s/);
assert.match(source, /href=\{switchCatalogLocale\(/);

console.log("catalog language switch navigation tests passed");
