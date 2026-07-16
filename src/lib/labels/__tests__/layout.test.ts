import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LABEL_COMPATIBILITY_PREFIX,
  LABEL_PHONE,
  buildCombinedCompatibilityLabel,
} from "@/lib/labels/format";
import { LABEL_SIZES } from "@/lib/labels/layout";

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
assert.match(controlsSource, /Mare \(70×52 mm · 15\/foaie\)/);

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
assert.match(pageSource, /productFitments/);
assert.doesNotMatch(pageSource, /compatibilityByCode/);

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
assert.match(pdfSource, /doc\.text\(product\.compatibility,[\s\S]*?lineBreak: true/);
assert.doesNotMatch(
  pdfSource,
  /doc\.text\(product\.compatibility,[\s\S]*?lineBreak: false, ellipsis: true/,
);
assert.match(pdfSource, /drawLabel\(product, x0 \+ col \* boxW, y0 \+ row \* rowStep\)/);
assert.match(pdfSource, /y0 \+ row \* rowStep/);
assert.match(pdfSource, /productFitments/);
assert.doesNotMatch(pdfSource, /compatibilityByCode/);

console.log("label layout tests passed");
