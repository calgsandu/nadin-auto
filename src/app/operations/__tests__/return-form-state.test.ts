import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/operations/return-dialog.tsx"),
  "utf8",
);

assert.match(
  source,
  /value=\{documentDate\}[\s\S]*setDocumentDate/,
  "data returului trebuie păstrată după o eroare de server",
);
assert.match(
  source,
  /value=\{notes\}[\s\S]*setNotes/,
  "notițele returului trebuie păstrate după o eroare de server",
);
assert.match(
  source,
  /if \(nextState\.ok\)[\s\S]*else[\s\S]*setQuantities/,
  "după o eroare trebuie forțată reaplicarea valorilor controlate",
);
assert.match(
  source,
  /setShowFeedback\(false\)[\s\S]*setOpen\(true\)/,
  "redeschiderea formularului trebuie să ascundă feedback-ul vechi",
);
assert.match(
  source,
  /showFeedback && state\.message/,
  "feedback-ul trebuie afișat numai pentru trimiterea curentă",
);

console.log("return form state test passed");
