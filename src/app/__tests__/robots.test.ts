import assert from "node:assert/strict";
import robots from "@/app/robots";

assert.deepEqual(robots().rules, {
  userAgent: "*",
  allow: ["/catalog", "/ru/catalog"],
  disallow: ["/crm", "/auth"],
});
assert.match(String(robots().sitemap), /\/sitemap\.xml$/);

console.log("robots tests passed");
