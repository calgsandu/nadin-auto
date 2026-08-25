import assert from "node:assert/strict";
import { periodLabelFromKey } from "@/lib/stats/aggregate";

// Ziua: cheia `YYYY-MM-DD` se citește ca dată locală, nu UTC — altfel eticheta
// ar sări cu o zi pe serverele la vest de Greenwich.
assert.equal(periodLabelFromKey("2026-08-24", "day"), "24.08.2026");
assert.equal(periodLabelFromKey("2026-01-01", "day"), "01.01.2026");

// Luna: numele lunii în română, fără ziua.
assert.match(periodLabelFromKey("2026-08", "month"), /august/i);
assert.match(periodLabelFromKey("2026-08", "month"), /2026/);

// Săptămâna ISO: numărul fără zero-ul din față, anul ISO al săptămânii.
assert.equal(periodLabelFromKey("2026-W34", "week"), "Săpt. 34 / 2026");
assert.equal(periodLabelFromKey("2026-W01", "week"), "Săpt. 1 / 2026");

console.log("stats aggregate tests passed");
