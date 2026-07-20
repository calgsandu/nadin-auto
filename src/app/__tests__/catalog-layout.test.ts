import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const layout = readFileSync(
  join(process.cwd(), "src", "app", "(vitrina)", "catalog", "layout.tsx"),
  "utf8",
);

assert.match(layout, /fontFamily:\s*["']var\(--font-catalog\), sans-serif["']/);

console.log("catalog layout font test passed");
