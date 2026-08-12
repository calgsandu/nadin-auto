import assert from "node:assert/strict";
import { placeDropdown, DROPDOWN_HEIGHT } from "@/lib/operations/dropdown-position";

const rect = (top: number, height = 44) => ({ top, bottom: top + height, left: 100, width: 500 });

// Loc destul deasupra: lista urcă și se oprește exact deasupra câmpului.
const high = placeDropdown(rect(600), 900);
assert.equal(high.maxHeight, DROPDOWN_HEIGHT);
assert.equal(high.top, 600 - 8 - DROPDOWN_HEIGHT);
assert.equal(high.left, 100);
assert.equal(high.width, 500);

// Câmp lipit de marginea de sus: lista coboară, nu iese din ecran.
const low = placeDropdown(rect(20), 900);
assert.equal(low.top, 72); // sub câmp (bottom 64) + spațiul de 8px
assert.ok(low.top + low.maxHeight <= 900);

// Ecran mic: înălțimea se strânge, dar nu sub minim, și rămâne pe ecran.
const tight = placeDropdown(rect(200), 320);
assert.ok(tight.maxHeight <= 200);
assert.ok(tight.top >= 8);

console.log("dropdown position tests passed");
