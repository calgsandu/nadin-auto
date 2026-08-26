import assert from "node:assert/strict";
import { DEFAULT_QUANTITY, quantityAfterSelect } from "@/lib/operations/default-quantity";

// Produs ales: cantitatea apare, ca operatorul să tasteze doar când diferă de 1.
assert.equal(quantityAfterSelect("prod-1"), DEFAULT_QUANTITY);

// Rând gol sau produs șters: câmpul rămâne gol, nu cu un „1" moștenit.
assert.equal(quantityAfterSelect(""), "");

console.log("default quantity tests passed");
