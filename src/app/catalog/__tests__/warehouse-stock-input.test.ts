import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const formPath = new URL("../product-form-dialog.tsx", import.meta.url);
const formSource = readFileSync(formPath, "utf8");

assert.match(
  formSource,
  /const quantity = event\.currentTarget\.value;[\s\S]*\[warehouse\.id\]: quantity/,
  "warehouse stock input must capture the event value before scheduling its state update",
);
assert.doesNotMatch(
  formSource,
  /setWarehouseQuantities\(\(current\) => \(\{[\s\S]*?event\.currentTarget\.value/,
  "warehouse stock input must not access currentTarget inside the deferred state updater",
);

console.log("warehouse stock input regression tests passed");
