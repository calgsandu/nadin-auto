import assert from "node:assert/strict";
import {
  productLineLabel,
  productLineSubtitle,
} from "@/lib/catalog/product-line-label";

const fitment = {
  yearStart: 1995,
  yearEnd: 2006,
  yearOpenEnded: false,
  carModel: { name: "SPRINTER", brand: { name: "MERCEDES-BENZ" } },
};

assert.equal(
  productLineLabel({ externalCode: "P14902 1", description: "Prag ușă față L", type: { name: "Prag" }, fitment }),
  "P14902 1 · MERCEDES-BENZ SPRINTER 1995–2006 · Prag · Prag ușă față L",
);

// Fără fitment/tip rămân doar părțile cunoscute — fără separatoare goale.
assert.equal(
  productLineLabel({ externalCode: "X1", description: "Piesă" }),
  "X1 · Piesă",
);
assert.equal(
  productLineLabel({ externalCode: null, description: "Piesă", fitment }),
  "MERCEDES-BENZ SPRINTER 1995–2006 · Piesă",
);
assert.equal(productLineSubtitle({ externalCode: null, description: "x" }), null);
assert.equal(
  productLineSubtitle({ externalCode: null, description: "x", type: { name: "Prag" }, fitment }),
  "MERCEDES-BENZ SPRINTER 1995–2006 · Prag",
);

// Toate compatibilitățile intră în etichetă; principalul nu se repetă.
const twinFitment = {
  yearStart: 2006,
  yearEnd: 2016,
  yearOpenEnded: false,
  carModel: { name: "CRAFTER", brand: { name: "VOLKSWAGEN" } },
};
assert.equal(
  productLineLabel({
    externalCode: "P1",
    description: "Prag",
    type: { name: "Prag" },
    fitment,
    productFitments: [{ fitment }, { fitment: twinFitment }],
  }),
  "P1 · MERCEDES-BENZ SPRINTER 1995–2006 • VOLKSWAGEN CRAFTER 2006–2016 · Prag · Prag",
);
assert.equal(
  productLineSubtitle({
    externalCode: null,
    description: "x",
    fitment,
    productFitments: [{ fitment: twinFitment }],
  }),
  "MERCEDES-BENZ SPRINTER 1995–2006 • VOLKSWAGEN CRAFTER 2006–2016",
);

console.log("product line label tests passed");
