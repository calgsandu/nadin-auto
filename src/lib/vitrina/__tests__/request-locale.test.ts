import assert from "node:assert/strict";
import {
  publicLocaleFromPath,
  russianCatalogRewritePath,
} from "@/lib/vitrina/request-locale";

assert.equal(publicLocaleFromPath("/ru/catalog"), "ru");
assert.equal(publicLocaleFromPath("/ru/catalog/piesa/p1"), "ru");
assert.equal(publicLocaleFromPath("/catalog"), "ro");
assert.equal(publicLocaleFromPath("/crm"), "ro");
assert.equal(russianCatalogRewritePath("/ru/catalog"), "/catalog");
assert.equal(
  russianCatalogRewritePath("/ru/catalog/ford/focus"),
  "/catalog/ford/focus",
);

console.log("catalog request locale tests passed");
