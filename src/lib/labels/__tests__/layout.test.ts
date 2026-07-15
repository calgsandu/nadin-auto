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
assert.equal(large.my, 20);
assert.equal(large.gy, 1.5);
assert.equal(large.my + large.h + large.gy, 73.5);
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

const pdfSource = readFileSync(
  new URL("../../../app/api/export/labels/route.ts", import.meta.url),
  "utf8",
);
assert.match(pdfSource, /const rowStep = boxH \+ dim\.gy \* MM;/);
assert.match(pdfSource, /y0 \+ row \* rowStep/);

console.log("label layout tests passed");
