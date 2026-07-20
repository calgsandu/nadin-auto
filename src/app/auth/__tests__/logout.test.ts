import assert from "node:assert/strict";
import test from "node:test";
import { performLogout } from "@/app/auth/logout";

test("clears the second-factor proof before Neon sign-out and redirect", async () => {
  const calls: string[] = [];
  await performLogout({
    clearSecondFactor: async () => {
      calls.push("clearSecondFactor");
    },
    signOut: async () => {
      calls.push("signOut");
    },
    redirect: (path) => {
      calls.push(`redirect:${path}`);
    },
  });

  assert.deepEqual(calls, [
    "clearSecondFactor",
    "signOut",
    "redirect:/auth/sign-in",
  ]);
});

test("still signs out when local proof cleanup fails", async () => {
  const calls: string[] = [];
  const cleanupError = new Error("database unavailable");
  await performLogout({
    clearSecondFactor: async () => {
      calls.push("clearSecondFactor");
      throw cleanupError;
    },
    reportCleanupError: (error) => {
      assert.equal(error, cleanupError);
      calls.push("reportCleanupError");
    },
    signOut: async () => {
      calls.push("signOut");
    },
    redirect: (path) => {
      calls.push(`redirect:${path}`);
    },
  });

  assert.deepEqual(calls, [
    "clearSecondFactor",
    "reportCleanupError",
    "signOut",
    "redirect:/auth/sign-in",
  ]);
});
