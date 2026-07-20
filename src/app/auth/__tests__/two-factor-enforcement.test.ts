import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const protectedRoutes = [
  "src/app/api/export/backup/route.ts",
  "src/app/api/export/document/[id]/pdf/route.ts",
  "src/app/api/export/invoice/[id]/route.ts",
  "src/app/api/export/labels/route.ts",
  "src/app/api/export/payment-account/[id]/efactura-xml/route.ts",
  "src/app/api/export/payment-account/[id]/pdf/route.ts",
  "src/app/api/export/products/route.ts",
  "src/app/api/export/sales-register/route.ts",
  "src/app/api/products/search/route.ts",
];

const protectedActions = [
  "src/app/account/actions.ts",
  "src/app/admin/actions.ts",
  "src/app/aprobari/actions.ts",
  "src/app/catalog/actions.ts",
  "src/app/external-orders/actions.ts",
  "src/app/istoric/actions.ts",
  "src/app/operations/actions.ts",
  "src/app/partners/actions.ts",
  "src/app/payment-accounts/actions.ts",
  "src/app/staff/actions.ts",
];

test("every protected route and server-action module uses the authorization facade", () => {
  for (const path of [...protectedRoutes, ...protectedActions]) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /requireCurrentAppUser|getCurrentAppUser|requireStaffAdmin/,
      `${path} must use the application authorization facade`,
    );
  }
});

test("CRM and label pages resolve 2FA state before protected queries", () => {
  const crm = readFileSync("src/app/crm/page.tsx", "utf8");
  const labels = readFileSync("src/app/print/labels/page.tsx", "utf8");
  const crmBody = crm.slice(crm.indexOf("export default async function"));
  const labelsBody = labels.slice(labels.indexOf("export default async function"));

  assert.ok(crmBody.indexOf("getAuthAccessState()") >= 0);
  assert.ok(crmBody.indexOf("getAuthAccessState()") < crmBody.indexOf("getCatalogData("));
  assert.ok(labelsBody.indexOf("getAuthAccessState()") >= 0);
  assert.ok(
    labelsBody.indexOf("getAuthAccessState()") < labelsBody.indexOf("prisma.product.findMany"),
  );
});
