import assert from "node:assert/strict";
import { parseExtraFitments } from "@/lib/catalog/extra-fitments";

function form(rows: [string, string, string, string][]) {
  const data = new FormData();
  for (const [modelId, yearStart, yearEnd, openEnded] of rows) {
    data.append("extraModelId", modelId);
    data.append("extraYearStart", yearStart);
    data.append("extraYearEnd", yearEnd);
    data.append("extraYearOpenEnded", openEnded);
  }
  return data;
}

assert.deepEqual(parseExtraFitments(form([])), []);

// Rândul gol (adăugat și nefolosit) se ignoră, restul păstrează alinierea.
assert.deepEqual(
  parseExtraFitments(
    form([
      ["", "", "", ""],
      ["m1", "2006", "2016", ""],
      ["m2", "2018", "", "1"],
      ["m3", "", "", ""],
    ]),
  ),
  [
    { modelId: "m1", yearStart: 2006, yearEnd: 2016, yearOpenEnded: false },
    { modelId: "m2", yearStart: 2018, yearEnd: null, yearOpenEnded: true },
    { modelId: "m3", yearStart: null, yearEnd: null, yearOpenEnded: false },
  ],
);

assert.throws(
  () => parseExtraFitments(form([["m1", "2016", "2006", ""]])),
  /Anul de început/,
);
assert.throws(() => parseExtraFitments(form([["m1", "acum", "", ""]])), /număr întreg/);

console.log("extra fitments tests passed");
