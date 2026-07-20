import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/istoric/actions.ts"),
  "utf8",
);

assert.match(
  source,
  /sourceDocumentId:\s*type === "RETURN" \? snapshot\.sourceDocumentId : null/,
  "un retur restaurat trebuie să rămână legat de vânzarea sursă",
);
assert.match(
  source,
  /type === "RETURN"[\s\S]*snapshot\.sourceDocumentId[\s\S]*sourceSale\.type !== "SALE"/,
  "restaurarea trebuie să refuze retururile fără o vânzare sursă validă",
);
assert.match(
  source,
  /type === "SALE"[\s\S]*warehouse\.name === "Pavilion 110A"[\s\S]*restockTask\.createMany/,
  "restaurarea unei vânzări din 110A trebuie să refacă sarcinile De adus",
);

console.log("restore invariants test passed");
