import assert from "node:assert/strict";
import { buildCatalogSitemap } from "@/lib/vitrina/sitemap";

const rows = buildCatalogSitemap(
  "https://nadin-auto.example/",
  [{ name: "Mercedes Benz", updatedAt: new Date("2026-07-01T00:00:00Z") }],
  [
    {
      name: "E Class",
      brandName: "Mercedes Benz",
      updatedAt: new Date("2026-07-02T00:00:00Z"),
    },
  ],
  [{ id: "part-1", updatedAt: new Date("2026-07-03T00:00:00Z") }],
);

assert.equal(rows.length, 8);
assert.deepEqual(
  rows.map((row) => row.url),
  [
    "https://nadin-auto.example/catalog",
    "https://nadin-auto.example/ru/catalog",
    "https://nadin-auto.example/catalog/mercedes-benz",
    "https://nadin-auto.example/ru/catalog/mercedes-benz",
    "https://nadin-auto.example/catalog/mercedes-benz/e-class",
    "https://nadin-auto.example/ru/catalog/mercedes-benz/e-class",
    "https://nadin-auto.example/catalog/piesa/part-1",
    "https://nadin-auto.example/ru/catalog/piesa/part-1",
  ],
);
assert.deepEqual(rows[4]?.alternates?.languages, {
  ro: "https://nadin-auto.example/catalog/mercedes-benz/e-class",
  ru: "https://nadin-auto.example/ru/catalog/mercedes-benz/e-class",
});

console.log("catalog sitemap tests passed");
