import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/operations/document-actions.ts"),
  "utf8",
);
const updateAction = source.slice(
  source.indexOf("export async function updateDocumentLinesAction"),
  source.indexOf("export async function updateDocumentHeaderAction"),
);

assert.match(
  updateAction,
  /if \(doc\.type === "RETURN"\)/,
  "editarea returului trebuie să aibă validare dedicată",
);
assert.match(
  updateAction,
  /SELECT id FROM "StockDocument"[\s\S]*FOR UPDATE/,
  "editarea retururilor trebuie serializată pe vânzarea sursă",
);
assert.match(
  updateAction,
  /sourceDocumentId:[\s\S]*NOT:[\s\S]*documentId: id/,
  "limita returului editat trebuie să excludă liniile returului curent",
);

console.log("return edit invariants test passed");
