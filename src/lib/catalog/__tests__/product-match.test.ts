import assert from "node:assert/strict";
import {
  normalizeCode,
  normalizeText,
  searchTerms,
  parseYearTerm,
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

// Anul de fabricație: în etichetă e prescurtat („/98-06/"), deci se caută pe
// coloanele numerice, nu ca text.
assert.equal(parseYearTerm("2005"), 2005);
assert.equal(parseYearTerm("1998"), 1998);
// Ce nu e an rămâne termen obișnuit de text.
assert.equal(parseYearTerm("e46"), null);
assert.equal(parseYearTerm("907"), null);
assert.equal(parseYearTerm("12345"), null);
// Numerele de patru cifre din afara plajei sunt coduri, nu ani.
assert.equal(parseYearTerm("1200"), null);
assert.equal(parseYearTerm("2999"), null);

console.log("product match tests passed");
