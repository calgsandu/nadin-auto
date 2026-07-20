import assert from "node:assert/strict";
import {
  crmAuditHref,
  crmCatalogPageHref,
  crmCatalogFilterHref,
  crmDocumentsHref,
  crmSectionHref,
} from "@/lib/crm/urls";

assert.equal(crmSectionHref("vanzari"), "/crm?section=vanzari");

assert.equal(
  crmCatalogPageHref({
    q: "far",
    brand: "b1",
    model: undefined,
    type: undefined,
    year: undefined,
    page: 2,
  }),
  "/crm?section=produse&q=far&brand=b1&page=2",
);

assert.equal(
  crmCatalogFilterHref(new URLSearchParams("section=produse&q=far&brand=b1&page=4")),
  "/crm?section=produse&q=far&brand=b1",
);

assert.equal(
  crmDocumentsHref({
    dtype: "SALE",
    partner: "p1",
    from: undefined,
    to: undefined,
    dpage: 3,
  }),
  "/crm?section=documente&dtype=SALE&partner=p1&dpage=3",
);

assert.equal(
  crmAuditHref({ act: "DELETE", doc: "doc1" }),
  "/crm?section=istoric&act=DELETE&doc=doc1",
);

console.log("crm url tests passed");
