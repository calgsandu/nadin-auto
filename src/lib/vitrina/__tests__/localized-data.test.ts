import assert from "node:assert/strict";
import { localizePublicProduct } from "@/lib/vitrina/queries";

const row = {
  id: "p1",
  externalCode: "A1",
  description: "Prag stânga",
  descriptionRu: "Левый порог",
  stock: 2,
  isLocal: false,
  fitment: { label: "toți anii", labelRu: "все годы" },
};

assert.equal(localizePublicProduct(row, "ru").description, "Левый порог");
assert.equal(
  localizePublicProduct({ ...row, descriptionRu: null }, "ru").description,
  "Prag stânga",
);
assert.equal(localizePublicProduct(row, "ro").fitLabel, "toți anii");
assert.equal(localizePublicProduct(row, "ru").fitLabel, "все годы");

console.log("localized catalog data tests passed");
