import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const schema = source("../../../../prisma/schema.prisma");
const form = source("../product-form-dialog.tsx");
const actions = source("../actions.ts");
const crmPage = source("../../crm/page.tsx");
const labelPicker = source("../label-picker.tsx");
const htmlLabels = source("../../print/labels/page.tsx");
const labelControls = source("../../print/labels/label-controls.tsx");
const pdfLabels = source("../../api/export/labels/route.ts");
const generatedProduct = source("../../../generated/prisma/models/Product.ts");

assert.match(schema, /alternativeCode\s+String\?/);
assert.match(form, /alternativeCode: string;/);
assert.match(form, /name="alternativeCode"/);
assert.match(form, /defaultValue=\{product\?\.alternativeCode \?\? ""\}/);

assert.match(
  actions,
  /const alternativeCode = readString\(formData, "alternativeCode"\) \|\| null;/,
);
assert.equal(
  actions.match(/alternativeCode: input\.alternativeCode/g)?.length,
  2,
  "codul alternativ trebuie salvat atât la creare, cât și la editare",
);
assert.match(actions, /alternativeCode: product\.alternativeCode/);
assert.match(actions, /alternativeCode,\s+description,/);

assert.match(crmPage, /alternativeCode: product\.alternativeCode \?\? ""/);
assert.match(
  crmPage,
  /data-label-alternative-code=\{product\.alternativeCode \?\? ""\}/,
);
assert.match(labelPicker, /box\.dataset\.labelAlternativeCode/);
assert.match(labelPicker, /setLabelAlternativeCode/);
assert.match(labelPicker, /Include cod alternativ/);
assert.match(
  htmlLabels,
  /includeAlternativeCode\s*\?\s*product\.alternativeCode\s*:\s*null/,
);
assert.match(htmlLabels, /alt\?: string;/);
assert.match(htmlLabels, /includeAlternativeCode: alternativeCodeIds\.has\(product\.id\)/);
assert.match(labelControls, /includeAlternativeCode: boolean;/);
assert.match(labelControls, /next\.set\("alt"/);
assert.match(labelControls, /p\.set\("alt"/);
assert.match(
  pdfLabels,
  /product\.includeAlternativeCode\s*\?\s*product\.alternativeCode\s*:\s*null/,
);
assert.match(pdfLabels, /const alternativeCodeIds = parseAlternativeCodeIds/);
assert.match(generatedProduct, /alternativeCode/);

console.log("product alternative code integration tests passed");
