import assert from "node:assert/strict";
import {
  normalizeCode,
  normalizeText,
  searchTerms,
} from "@/lib/catalog/product-match";

// Codul se caută fără spații/cratime: „P149031" trebuie să prindă „P14903 1".
assert.equal(normalizeCode("P14903 1"), "P149031");
assert.equal(normalizeCode("p14903-1"), "P149031");
assert.equal(normalizeCode(" 955001-8 "), "9550018");
// Codurile sunt ASCII: diacriticele cad, nu se pliază pe litera de bază.
assert.equal(normalizeCode("prag față"), "PRAGFA");

// Diacriticele nu mai contează.
assert.equal(normalizeText("Prag ușă FAȚĂ"), "prag usa fata");
assert.equal(normalizeText("Arcă aripă"), "arca aripa");
assert.equal(normalizeText("Jgheab"), "jgheab");

// Termenii se separă; ordinea cuvintelor nu contează pentru că se caută cu ȘI.
assert.deepEqual(searchTerms("  sprinter   prag  "), ["sprinter", "prag"]);
assert.deepEqual(searchTerms("FAȚĂ stânga"), ["fata", "stanga"]);
assert.deepEqual(searchTerms("   "), []);

console.log("product match tests passed");
