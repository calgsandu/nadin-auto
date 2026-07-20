import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const proxyPath = join(projectRoot, "src", "proxy.ts");

assert.equal(
  existsSync(proxyPath),
  true,
  "Next.js projects with src/app must keep the proxy convention in src/proxy.ts",
);
assert.match(readFileSync(proxyPath, "utf8"), /russianCatalogRewritePath/);

console.log("proxy location tests passed");
