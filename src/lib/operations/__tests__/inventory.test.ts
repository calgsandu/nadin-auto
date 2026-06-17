import assert from "node:assert/strict";
import {
  calculateNextQuantity,
  validateDifferentWarehouses,
  validatePositiveQuantity,
  validateSaleAvailability,
} from "@/lib/operations/inventory";

assert.equal(calculateNextQuantity(4, "RECEIPT", 3), 7);
assert.equal(calculateNextQuantity(4, "SALE", 3), 1);
assert.equal(calculateNextQuantity(4, "RETURN", 2), 6);
assert.equal(calculateNextQuantity(4, "ADJUSTMENT", -1), 3);
assert.throws(
  () => calculateNextQuantity(2, "ADJUSTMENT", -3),
  /Stoc insuficient în locația selectată/,
);

assert.throws(
  () => validatePositiveQuantity(0),
  /Cantitatea trebuie să fie mai mare decât zero/,
);

assert.doesNotThrow(() => validateSaleAvailability(5, 5));
assert.throws(
  () => validateSaleAvailability(2, 3),
  /Stoc insuficient în locația selectată/,
);

assert.doesNotThrow(() => validateDifferentWarehouses("warehouse-a", "warehouse-b"));
assert.throws(
  () => validateDifferentWarehouses("warehouse-a", "warehouse-a"),
  /Locațiile pentru transfer trebuie să fie diferite/,
);
assert.throws(
  () => validateDifferentWarehouses("", "warehouse-b"),
  /Alege locația sursă și locația destinație/,
);

console.log("inventory tests passed");
