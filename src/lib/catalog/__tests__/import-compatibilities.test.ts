import assert from "node:assert/strict";
import { groupImportRowsByKey } from "@/lib/catalog/import-compatibilities";

const grouped = groupImportRowsByKey([
  { importKey: "2015:0", fitmentId: "golf" },
  { importKey: "2015:0", fitmentId: "vento" },
  { importKey: "2016:0", fitmentId: "vito" },
]);

assert.deepEqual(
  grouped.map((group) => ({
    importKey: group.importKey,
    fitmentIds: group.rows.map((row) => row.fitmentId),
  })),
  [
    { importKey: "2015:0", fitmentIds: ["golf", "vento"] },
    { importKey: "2016:0", fitmentIds: ["vito"] },
  ],
);

console.log("import compatibility tests passed");
