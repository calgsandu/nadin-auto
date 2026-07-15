import assert from "node:assert/strict";
import { LABEL_COMPATIBILITY_PREFIX, LABEL_PHONE } from "@/lib/labels/format";
import { LABEL_SIZES } from "@/lib/labels/layout";

const large = LABEL_SIZES.l;

assert.equal(large.w, 70);
assert.equal(large.h, 50.8);
assert.equal(large.cols, 3);
assert.equal(large.rows, 5);
assert.equal(large.mx, 0);
assert.equal(large.my, 18);
assert.equal(large.w * large.cols + large.mx * 2, 210);
assert.equal(large.my + large.h * large.rows <= 297, true);
assert.equal(LABEL_PHONE, "0 (68) 677885");
assert.equal(LABEL_COMPATIBILITY_PREFIX, "Piesă auto compatibilă cu modelul");

console.log("label layout tests passed");
