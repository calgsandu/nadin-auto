import assert from "node:assert/strict";
import { placeDropdown, DROPDOWN_HEIGHT } from "@/lib/operations/dropdown-position";

const rect = (top: number, height = 44) => ({ top, bottom: top + height, left: 100, width: 500 });

// Loc destul deasupra: lista se ancorează de câmp, nu de tavan — o listă scurtă
// rămâne lipită de input (bug-ul: stătea sus, la sute de px distanță).
const high = placeDropdown(rect(600), 900);
assert.equal(high.top, undefined);
assert.equal(high.bottom, 900 - 600 + 8);
assert.equal(high.maxHeight, DROPDOWN_HEIGHT);
assert.equal(high.left, 100);
assert.equal(high.width, 500);

// Câmp lipit de marginea de sus: lista coboară sub câmp.
const low = placeDropdown(rect(20), 900);
assert.equal(low.top, 72); // sub câmp (bottom 64) + spațiul de 8px
assert.equal(low.bottom, undefined);
assert.ok(low.top + low.maxHeight <= 900);

// Sus e mai mult loc, dar nu cât lista întreagă: tot sus, cu înălțime strânsă.
const tight = placeDropdown(rect(200), 320);
assert.equal(tight.bottom, 320 - 200 + 8);
assert.ok(tight.maxHeight <= 200);

console.log("dropdown position tests passed");
