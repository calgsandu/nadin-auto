import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LABEL_COMPATIBILITY_PREFIX, LABEL_PHONE } from "@/lib/labels/format";
import { LABEL_SIZES } from "@/lib/labels/layout";

const large = LABEL_SIZES.l;

assert.equal(large.w, 70);
assert.equal(large.h, 52);
assert.equal(large.cols, 3);
assert.equal(large.rows, 5);
assert.equal(large.mx, 0);
assert.equal(large.my, 20.5);
assert.equal(large.padX, 4);
assert.equal(large.gy, 1.5);
assert.equal(large.w - large.padX * 2, 62);
assert.equal(large.my + large.h + large.gy, 74);
assert.equal(large.w * large.cols + large.mx * 2, 210);
assert.equal(large.my + large.h * large.rows + large.gy * (large.rows - 1) <= 297, true);
assert.equal(LABEL_PHONE, "0 (68) 677885");
assert.equal(LABEL_COMPATIBILITY_PREFIX, "Piesă auto compatibilă cu modelul");

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
assert.match(
  pageSource,
  /\.label-model \{ white-space: normal; overflow: hidden; line-height: 1\.05; max-height: 2\.1em; \}/,
);
assert.doesNotMatch(pageSource, /\.label-model \{[^}]*text-overflow/);
assert.match(pageSource, /className="label-model mt-\[1mm\]/);

const pdfSource = readFileSync(
  new URL("../../../app/api/export/labels/route.ts", import.meta.url),
  "utf8",
);
assert.match(pdfSource, /const rowStep = boxH \+ dim\.gy \* MM;/);
assert.match(pdfSource, /const x0 = dim\.mx \* MM;/);
assert.match(pdfSource, /const padX = dim\.padX \* MM;/);
assert.doesNotMatch(pdfSource, /contentShiftX/);
assert.match(pdfSource, /const modelMaxHeight = modelSize \* 2\.4;/);
assert.match(pdfSource, /doc\.text\(compatibility,[\s\S]*?lineBreak: true/);
assert.doesNotMatch(
  pdfSource,
  /doc\.text\(compatibility,[\s\S]*?lineBreak: false, ellipsis: true/,
);
assert.match(pdfSource, /drawLabel\(product, x0 \+ col \* boxW, y0 \+ row \* rowStep\)/);
assert.match(pdfSource, /y0 \+ row \* rowStep/);

console.log("label layout tests passed");
