import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSecondFactorSessions,
  clearTrustedDevices,
  resetTwoFactorCredential,
  type TwoFactorResetClient,
} from "@/lib/auth/two-factor/reset";

function fakeClient(calls: string[]): TwoFactorResetClient {
  return {
    twoFactorEnrollmentGrant: {
      deleteMany: async () => {
        calls.push("grant");
        return { count: 1 };
      },
    },
    twoFactorCredential: {
      deleteMany: async () => {
        calls.push("credential");
        return { count: 1 };
      },
    },
    twoFactorSessionProof: {
      deleteMany: async () => {
        calls.push("proofs");
        return { count: 1 };
      },
    },
    trustedDevice: {
      deleteMany: async () => {
        calls.push("devices");
        return { count: 1 };
      },
    },
    appUser: {
      update: async () => {
        calls.push("resetAt");
        return {};
      },
    },
  };
}

test("clears trusted devices without touching proofs or the credential", async () => {
  const calls: string[] = [];
  await clearTrustedDevices(fakeClient(calls), "user_1");
  assert.deepEqual(calls, ["devices"]);
});

test("clears only second-factor session proofs", async () => {
  const calls: string[] = [];
  await clearSecondFactorSessions(fakeClient(calls), "user_1");
  assert.deepEqual(calls, ["proofs"]);
});

test("resets grant, proof, devices, credential, and timestamp in fail-closed order", async () => {
  const calls: string[] = [];
  await resetTwoFactorCredential(fakeClient(calls), "user_1", new Date(100));
  assert.deepEqual(calls, ["grant", "proofs", "devices", "credential", "resetAt"]);
});
