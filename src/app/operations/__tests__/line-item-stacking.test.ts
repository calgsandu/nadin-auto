import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

assert.match(
  css,
  /\.motion-line-item\s*\{[\s\S]*?position:\s*relative;/,
  "Document line items must be positioned so focused rows can stack above siblings.",
);
assert.match(
  css,
  /\.motion-line-item:focus-within\s*\{[\s\S]*?z-index:\s*30;/,
  "Focused document line items must stack above following rows so combobox results are not covered.",
);

console.log("line item stacking tests passed");
