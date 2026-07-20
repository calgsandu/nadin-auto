import assert from "node:assert/strict";
import {
  catalogHref,
  catalogNumberFormat,
  localizedValue,
  localeFromCatalogPath,
  switchCatalogLocale,
} from "@/lib/vitrina/i18n";

assert.equal(catalogHref("ro"), "/catalog");
assert.equal(catalogHref("ru"), "/ru/catalog");
assert.equal(catalogHref("ru", "/cauta?q=prag"), "/ru/catalog/cauta?q=prag");
assert.equal(catalogHref("ro", "/ford/focus"), "/catalog/ford/focus");
assert.equal(localeFromCatalogPath("/ru/catalog/ford"), "ru");
assert.equal(localeFromCatalogPath("/catalog/ford"), "ro");
assert.equal(localizedValue("ru", "Prag", " Порог "), "Порог");
assert.equal(localizedValue("ru", "Prag", "  "), "Prag");
assert.equal(localizedValue("ro", "Prag", "Порог"), "Prag");
assert.equal(
  switchCatalogLocale("/catalog/ford/focus", "?tip=prag", "ru"),
  "/ru/catalog/ford/focus?tip=prag",
);
assert.equal(
  switchCatalogLocale("/ru/catalog/piesa/p1", "", "ro"),
  "/catalog/piesa/p1",
);
assert.equal(catalogNumberFormat("ru").format(1900), "1 900");

console.log("catalog i18n tests passed");
