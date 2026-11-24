import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LABEL_COMPATIBILITY_PREFIX,
  LABEL_PHONE,
  buildCombinedCompatibilityLabel,
  buildProductCodeLabel,
} from "@/lib/labels/format";
import { LABEL_SIZES, decodeLabelCells, encodeLabelCells, placeLabels } from "@/lib/labels/layout";
import { parseLabelRequest } from "@/lib/labels/request";

const large = LABEL_SIZES.l;

assert.equal(large.w, 70);
assert.equal(large.h, 52);
assert.equal(large.cols, 3);
assert.equal(large.rows, 5);
assert.equal(large.mx, 0);
assert.equal(large.my, 22.5);
assert.equal(large.padX, 4);
assert.equal(large.detailOffsetX, 2);
assert.equal(large.gy, 3.3);
assert.equal(large.w - large.padX * 2, 62);
assert.equal(large.my + large.h + large.gy, 77.8);
assert.equal(large.w * large.cols + large.mx * 2, 210);
assert.equal(large.my + large.h * large.rows + large.gy * (large.rows - 1), 295.7);
assert.equal(LABEL_PHONE, "0 (68) 677885");
assert.equal(LABEL_COMPATIBILITY_PREFIX, "Piesă auto compatibilă cu modelul");
assert.equal(
  buildProductCodeLabel("p12013 1", "supplier 42"),
  "P12013 1 / SUPPLIER 42",
);
assert.equal(buildProductCodeLabel("p12013 1", null), "P12013 1");
assert.equal(buildProductCodeLabel(" ", "supplier 42"), "SUPPLIER 42");
assert.equal(buildProductCodeLabel(null, null), "-");
assert.equal(
  buildCombinedCompatibilityLabel([
    {
      brandName: "Dacia",
      modelName: "Duster",
      yearStart: 2010,
      yearEnd: 2018,
      yearOpenEnded: false,
    },
    {
      brandName: "Dacia",
      modelName: "Duster",
      yearStart: 2010,
      yearEnd: 2018,
      yearOpenEnded: false,
    },
    {
      brandName: "Renault",
      modelName: "Clio",
      yearStart: 2012,
      yearEnd: 2018,
      yearOpenEnded: false,
    },
  ]),
  "DACIA DUSTER 10-18 / RENAULT CLIO 12-18",
);

const controlsSource = readFileSync(
  new URL("../../../app/print/labels/label-controls.tsx", import.meta.url),
  "utf8",
);
assert.match(controlsSource, /Mare \(70×52 mm, 15\/foaie\)/);

const pageSource = readFileSync(
  new URL("../../../app/print/labels/page.tsx", import.meta.url),
  "utf8",
);
assert.match(pageSource, /row-gap: \$\{dim\.gy\}mm;/);
assert.doesNotMatch(pageSource, /left: \$\{dim\.ox\}mm;/);
assert.doesNotMatch(pageSource, /data-col=/);
assert.match(pageSource, /padding-inline: \$\{dim\.padX\}mm;/);
assert.match(pageSource, /\.label-detail \{ margin-left: \$\{dim\.detailOffsetX\}mm; \}/);
assert.match(
  pageSource,
  /\.label-model \{ white-space: normal; overflow: hidden; line-height: 1\.05; max-height: 4\.2em; \}/,
);
assert.doesNotMatch(pageSource, /\.label-model \{[^}]*text-overflow/);
assert.match(pageSource, /className="label-model label-detail mt-\[1mm\]/);
assert.match(pageSource, /className="label-part label-detail mt-\[1\.8mm\]/);
assert.match(pageSource, /parseLabelRequest/);
assert.match(pageSource, /data-cell=\{sheetIndex \* perSheet \+ i\}/);

const pdfSource = readFileSync(
  new URL("../../../app/api/export/labels/route.ts", import.meta.url),
  "utf8",
);
assert.match(pdfSource, /const rowStep = boxH \+ dim\.gy \* MM;/);
assert.match(pdfSource, /const x0 = dim\.mx \* MM;/);
assert.match(pdfSource, /const padX = dim\.padX \* MM;/);
assert.doesNotMatch(pdfSource, /contentShiftX/);
assert.match(pdfSource, /const detailX = cx \+ dim\.detailOffsetX \* MM;/);
assert.match(pdfSource, /const detailWidth = cw - dim\.detailOffsetX \* MM;/);
assert.match(pdfSource, /const modelMaxHeight = modelSize \* 4\.2;/);
assert.match(pdfSource, /doc\.text\(compatibility,[\s\S]*?lineBreak: true/);
assert.doesNotMatch(
  pdfSource,
  /doc\.text\(compatibility,[\s\S]*?lineBreak: false, ellipsis: true/,
);
assert.match(pdfSource, /drawLabel\(slot, x0 \+ col \* boxW, y0 \+ row \* rowStep\)/);
assert.match(pdfSource, /y0 \+ row \* rowStep/);
assert.match(pdfSource, /parseLabelRequest/);

// Cererea de print e una: HTML și PDF citesc aceeași parsare.
const requestSource = readFileSync(new URL("../request.ts", import.meta.url), "utf8");
assert.match(requestSource, /productFitments/);
assert.doesNotMatch(requestSource, /compatibilityByCode/);

// Parsarea comună pagină/PDF: linkuri noi (items) și vechi (ids + copies).
const params = (query: string) => {
  const search = new URLSearchParams(query);
  return parseLabelRequest((key) => search.get(key));
};
const parsed = params("items=p1:3,p2:99&alt=p2&size=m&skip=40");
assert.deepEqual([...parsed.counts], [["p1", 3], ["p2", 50]]);
assert.ok(parsed.alternativeCodeIds.has("p2"));
assert.equal(parsed.size, "m");
assert.equal(parsed.skip, 20, "skip rămâne în prima foaie (21 de poziții)");
assert.deepEqual([...params("ids=a,b&copies=2").counts], [["a", 2], ["b", 2]]);
assert.equal(params("items=a:1&layout=roll&skip=4").skip, 0);
assert.equal(params("items=a:1&size=x").size, "l");

// Așezarea liberă: goluri oriunde, bucățile noi după ultimul sticker.
const ab = [{ id: "a", count: 2 }, { id: "b", count: 1 }];
assert.deepEqual(placeLabels(ab, null, 2), [null, null, "a", "a", "b"]);
assert.deepEqual(placeLabels(ab, ["b", null, "a", null, "a", null]), ["b", null, "a", null, "a"]);
assert.deepEqual(
  placeLabels([{ id: "a", count: 1 }, { id: "b", count: 2 }], ["b", null, "a", "a"]),
  ["b", null, "a", "b"],
  "copia a doua de a dispare, b nou intră după ultimul sticker",
);
assert.deepEqual(placeLabels(ab, ["x", "a"]), [null, "a", "a", "b"], "piesă scoasă = celulă goală");
const ids = ["a", "b"];
assert.equal(encodeLabelCells(["b", null, "a", "x"], ids), "1..0.");
assert.deepEqual(decodeLabelCells("1..0.", ids), ["b", null, "a", null]);
assert.equal(decodeLabelCells(null, ids), null);
assert.deepEqual(params("items=a:1,b:1&cells=.1.0").placed, [null, "b", "a"]);
assert.equal(params("items=a:1&cells=0&layout=roll").placed, null);

console.log("label layout tests passed");
