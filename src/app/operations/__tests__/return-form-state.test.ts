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
  /useDrawerAction\(/,
  "trimiterea trebuie făcută prin useDrawerAction (fără resetul automat React)",
);
assert.doesNotMatch(
  source,
  /<form action=/,
  "`<form action>` resetează câmpurile după o eroare de server",
);
// Feedback-ul vechi nu mai poate rămâne pe ecran la redeschidere: răspunsul
// iese ca notificare, deci nu mai există un element persistent de ascuns.
assert.doesNotMatch(
  source,
  /showFeedback/,
  "feedback-ul returului trece prin notificare, nu printr-un bloc în formular",
);

console.log("return form state test passed");
