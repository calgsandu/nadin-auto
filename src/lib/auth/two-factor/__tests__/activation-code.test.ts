import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  enrollmentActivationExpiry,
  generateEnrollmentActivationCode,
  normalizeEnrollmentActivationCode,
} from "@/lib/auth/two-factor/activation-code";
import {
  hashEnrollmentActivationCode,
  hashToken,
} from "@/lib/auth/two-factor/crypto";

test("generates a deterministic 80-bit Crockford code in readable groups", () => {
  const bytes = Buffer.from("00010203040506070809", "hex");
  const code = generateEnrollmentActivationCode(bytes);

  assert.equal(code, generateEnrollmentActivationCode(bytes));
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.notEqual(
    code,
    generateEnrollmentActivationCode(
      Buffer.from("01010203040506070809", "hex"),
    ),
  );
});

test("normalizes only human-friendly separators and rejects ambiguous input", () => {
  const code = generateEnrollmentActivationCode(
    Buffer.from("00010203040506070809", "hex"),
  );
  const plain = code.replaceAll("-", "");

  assert.equal(
    normalizeEnrollmentActivationCode(
      code.toLowerCase().replaceAll("-", " "),
    ),
    plain,
  );
  assert.throws(() => normalizeEnrollmentActivationCode(`${plain}A`), /valid/);
  assert.throws(() => normalizeEnrollmentActivationCode("OOOO-OOOO-OOOO-OOOO"), /valid/);
});

test("hashes activation codes in a separate domain and expires at 15 minutes", () => {
  const normalized = "0123456789ABCDEFG".slice(0, 16);
  const now = new Date("2026-07-21T00:00:00.000Z");

  assert.equal(
    hashEnrollmentActivationCode(normalized),
    hashEnrollmentActivationCode(normalized),
  );
  assert.notEqual(hashEnrollmentActivationCode(normalized), hashToken(normalized));
  assert.equal(
    enrollmentActivationExpiry(now).getTime() - now.getTime(),
    15 * 60_000,
  );
});

test("schema stores one hashed grant per user and binds pending credentials", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /model TwoFactorEnrollmentGrant/);
  assert.match(schema, /appUserId\s+String\s+@unique/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /@@index\(\[expiresAt\]\)/);
  assert.match(schema, /onDelete:\s*Cascade/);
  assert.match(schema, /enrollmentAuthSessionHash\s+String\?/);
});
