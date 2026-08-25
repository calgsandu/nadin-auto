import assert from "node:assert/strict";
import {
  crmAuditHref,
  crmCatalogPageHref,
  crmCatalogFilterHref,
  crmDocumentsHref,
  crmSectionHref,
  sectionFromPathname,
} from "@/lib/crm/urls";

assert.equal(crmSectionHref("vanzari"), "/crm/vanzari");
assert.equal(crmSectionHref("produse"), "/crm/produse");

assert.equal(sectionFromPathname("/crm/vanzari"), "vanzari");
assert.equal(sectionFromPathname("/crm/conturi-plata"), "conturi-plata");
// `/crm` redirecționează spre produse, deci nav-ul evidențiază tot produse.
assert.equal(sectionFromPathname("/crm"), "produse");
assert.equal(sectionFromPathname("/crm/"), "produse");
assert.equal(sectionFromPathname("/crm/inexistent"), "produse");

assert.equal(
  crmCatalogPageHref({
    q: "far",
    brand: "b1",
    model: undefined,
    type: undefined,
    year: undefined,
    page: 2,
  }),
  "/crm/produse?q=far&brand=b1&page=2",
);

assert.equal(
  crmCatalogFilterHref(new URLSearchParams("q=far&brand=b1&page=4")),
  "/crm/produse?q=far&brand=b1",
);

assert.equal(
  crmDocumentsHref({
    dtype: "SALE",
    partner: "p1",
    from: undefined,
    to: undefined,
    dpage: 3,
  }),
  "/crm/documente?dtype=SALE&partner=p1&dpage=3",
);

assert.equal(
  crmAuditHref({ act: "DELETE", doc: "doc1" }),
  "/crm/istoric?act=DELETE&doc=doc1",
);

// Fără filtre nu rămâne un „?" gol în URL.
assert.equal(crmAuditHref({}), "/crm/istoric");

console.log("crm url tests passed");
