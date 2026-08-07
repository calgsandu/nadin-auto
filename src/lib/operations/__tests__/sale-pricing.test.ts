import assert from "node:assert/strict";
import { PRICE_CATEGORIES, applyDiscount } from "@/lib/operations/sale-pricing";

assert.equal(applyDiscount("500", "0"), "500");
assert.equal(applyDiscount("500", "10"), "450");
assert.equal(applyDiscount("333", "15"), "283.05", "rotunjire la bani");
assert.equal(applyDiscount("500", ""), "500", "fără discount = prețul de listă");

// Produs fără preț de listă: prețul se scrie manual, nu inventăm 0.
assert.equal(applyDiscount("", "10"), "");
assert.equal(applyDiscount("0", "10"), "");

// Discount imposibil nu poate produce prețuri negative sau umflate.
assert.equal(applyDiscount("500", "-5"), "500");
assert.equal(applyDiscount("500", "150"), "500");
assert.equal(applyDiscount("500", "100"), "0");

assert.ok(PRICE_CATEGORIES.every((category) => Number.isFinite(Number(category.value))));

console.log("sale pricing tests passed");
