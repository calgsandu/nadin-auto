import assert from "node:assert/strict";
import { buildProductWhere } from "@/lib/catalog/queries";

const where = buildProductWhere({ brand: "volkswagen", model: "golf-iii", year: "1995" });
const serialized = JSON.stringify(where);

assert.match(serialized, /"productFitments"/);
assert.match(serialized, /"volkswagen"/);
assert.match(serialized, /"golf-iii"/);

console.log("catalog query compatibility tests passed");
