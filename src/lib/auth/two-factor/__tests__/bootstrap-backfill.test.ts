import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("schema persists an immutable global 2FA bootstrap completion marker", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model ApplicationSecurityState/);
  assert.match(schema, /twoFactorBootstrapCompletedAt\s+DateTime\?/);
});

test("backfill marks bootstrap completed only when an active credential exists", () => {
  const source = readFileSync("scripts/backfill-2fa-bootstrap-state.ts", "utf8");
  assert.match(source, /status:\s*["']ACTIVE["']/);
  assert.match(source, /applicationSecurityState\.upsert/);
  assert.match(source, /id:\s*["']global["']/);
  assert.doesNotMatch(source, /delete|deleteMany/);
});
