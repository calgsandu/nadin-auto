import assert from "node:assert/strict";
import { planProductWarehouseMigration } from "@/lib/catalog/warehouse-stock-migration";

assert.deepEqual(
  planProductWarehouseMigration({
    productId: "product-1",
    legacyStock: 7,
    existingRows: [],
    warehouse110AId: "110a",
  }),
  { create110AQuantity: 7, totalQuantity: 7 },
);

assert.deepEqual(
  planProductWarehouseMigration({
    productId: "product-2",
    legacyStock: 99,
    existingRows: [
      { warehouseId: "110a", quantity: 2 },
      { warehouseId: "514", quantity: 4 },
    ],
    warehouse110AId: "110a",
  }),
  { create110AQuantity: null, totalQuantity: 6 },
);

assert.deepEqual(
  planProductWarehouseMigration({
    productId: "product-1",
    legacyStock: 7,
    existingRows: [{ warehouseId: "110a", quantity: 7 }],
    warehouse110AId: "110a",
  }),
  { create110AQuantity: null, totalQuantity: 7 },
);

console.log("warehouse stock migration tests passed");
