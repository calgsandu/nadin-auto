import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/operations/actions.ts"),
  "utf8",
);

const returnAction = source.slice(
  source.indexOf("export async function createReturnAction"),
  source.indexOf("export async function createInventoryAction"),
);

assert.match(
  returnAction,
  /SELECT id FROM "StockDocument"[\s\S]*FOR UPDATE/,
  "retururile pentru aceeași vânzare trebuie serializate prin blocarea vânzării sursă",
);
assert.doesNotMatch(
  returnAction,
  /\.filter\(\(line\) => line\.productId && line\.quantity > 0\)/,
  "cantitățile negative sau fracționare nu trebuie ignorate silențios",
);
assert.match(
  returnAction,
  /documentDate < sale\.documentDate/,
  "data returului nu poate fi înaintea vânzării",
);

console.log("return concurrency lock test passed");
