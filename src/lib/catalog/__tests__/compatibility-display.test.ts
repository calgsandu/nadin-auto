import assert from "node:assert/strict";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";

const lines = buildCompatibilityLines([
  {
    id: "vito",
    brandName: "MERCEDES-BENZ",
    modelName: "VITO W639",
    yearStart: 2003,
    yearEnd: 2014,
    yearOpenEnded: false,
  },
  {
    id: "viano",
    brandName: "MERCEDES-BENZ",
    modelName: "VIANO W639",
    yearStart: 2003,
    yearEnd: 2014,
    yearOpenEnded: false,
  },
  {
    id: "vito",
    brandName: "MERCEDES-BENZ",
    modelName: "VITO W639",
    yearStart: 2003,
    yearEnd: 2014,
    yearOpenEnded: false,
  },
]);

assert.deepEqual(lines, [
  { title: "MERCEDES-BENZ VIANO W639", years: "2003–2014" },
  { title: "MERCEDES-BENZ VITO W639", years: "2003–2014" },
]);

console.log("compatibility display tests passed");
