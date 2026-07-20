import assert from "node:assert/strict";
import nextConfig from "../../../next.config";

assert.equal(typeof nextConfig.headers, "function");

void (async () => {
  const headers = await nextConfig.headers!();
  const crmRule = headers.find((rule) => rule.source === "/crm/:path*");

  assert.ok(crmRule, "CRM-ul trebuie să aibă o regulă HTTP dedicată");
  assert.deepEqual(crmRule.headers, [
    {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet",
    },
  ]);

  console.log("crm security header tests passed");
})();
