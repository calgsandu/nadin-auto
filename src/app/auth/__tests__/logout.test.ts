import assert from "node:assert/strict";
import { performLogout } from "@/app/auth/logout";

const calls: string[] = [];

async function main() {
  await performLogout({
    signOut: async () => {
      calls.push("signOut");
    },
    redirect: (path) => {
      calls.push(`redirect:${path}`);
    },
  });

  assert.deepEqual(calls, ["signOut", "redirect:/auth/sign-in"]);

  console.log("auth logout tests passed");
}

void main();
