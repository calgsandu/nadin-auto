import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("restores the CRM sidebar state through the root Next.js Script", () => {
  const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
  const crmLayout = readFileSync("src/app/crm/layout.tsx", "utf8");

  assert.doesNotMatch(crmLayout, /<script\b/i);
  assert.match(rootLayout, /from ["']next\/script["']/);
  assert.match(rootLayout, /strategy=["']beforeInteractive["']/);
  assert.match(rootLayout, /nadin-crm-collapsed/);
  assert.match(rootLayout, /data-crm-collapsed/);
});
