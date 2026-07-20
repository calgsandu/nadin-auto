import assert from "node:assert/strict";
import test from "node:test";
import {
  clearEnrollmentGrant,
  consumeEnrollmentGrant,
  replaceEnrollmentGrant,
  type EnrollmentGrantClient,
} from "@/lib/auth/two-factor/enrollment-grant";
import { hashEnrollmentActivationCode } from "@/lib/auth/two-factor/crypto";

function fakeClient(calls: string[], consumedCount = 1): EnrollmentGrantClient {
  return {
    twoFactorEnrollmentGrant: {
      deleteMany: async (args) => {
        if ("tokenHash" in args.where) {
          calls.push("grant.consume");
          assert.deepEqual(args.where, {
            appUserId: "user_1",
            tokenHash: "hash_1",
            expiresAt: { gt: new Date(100) },
          });
          return { count: consumedCount };
        }
        calls.push(`grant.deleteMany:${args.where.appUserId}`);
        return { count: 1 };
      },
      create: async (args) => {
        calls.push(`grant.create:${args.data.appUserId}`);
        assert.deepEqual(args.data, {
          appUserId: "user_1",
          tokenHash: hashEnrollmentActivationCode("0123456789ABCDEF"),
          expiresAt: new Date(15 * 60_000),
        });
        return {};
      },
    },
    twoFactorCredential: {
      deleteMany: async (args) => {
        calls.push(`credential.deletePending:${args.where.appUserId}`);
        assert.equal(args.where.status, "PENDING");
        return { count: 1 };
      },
    },
  };
}

test("replacement invalidates the old grant and pending QR before storing only a hash", async () => {
  const calls: string[] = [];
  const result = await replaceEnrollmentGrant(
    fakeClient(calls),
    "user_1",
    new Date(0),
    "0123-4567-89AB-CDEF",
  );

  assert.deepEqual(calls, [
    "grant.deleteMany:user_1",
    "credential.deletePending:user_1",
    "grant.create:user_1",
  ]);
  assert.deepEqual(result, {
    code: "0123-4567-89AB-CDEF",
    expiresAt: new Date(15 * 60_000),
  });
});

test("consumption is an atomic exact-user, exact-hash, unexpired delete", async () => {
  const calls: string[] = [];
  assert.equal(
    await consumeEnrollmentGrant(fakeClient(calls), {
      appUserId: "user_1",
      tokenHash: "hash_1",
      now: new Date(100),
    }),
    true,
  );
  assert.equal(
    await consumeEnrollmentGrant(fakeClient([], 0), {
      appUserId: "user_1",
      tokenHash: "hash_1",
      now: new Date(100),
    }),
    false,
  );
  assert.deepEqual(calls, ["grant.consume"]);
});

test("grant cleanup is idempotent and user-scoped", async () => {
  const calls: string[] = [];
  await clearEnrollmentGrant(fakeClient(calls), "user_1");
  assert.deepEqual(calls, ["grant.deleteMany:user_1"]);
});
