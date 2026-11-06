import assert from "node:assert/strict";
import test from "node:test";
import { getSessionWithRetry } from "@/lib/auth/two-factor/session-retry";

const noPause = async () => {};
const ok = { data: { user: "u" }, error: null } as const;

function sequence(...steps: Array<"ok" | "throw" | number>) {
  let calls = 0;
  const fn = async () => {
    const step = steps[calls++];
    if (step === "throw") throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    if (typeof step === "number") return { data: null, error: { status: step } };
    return ok;
  };
  return { fn, calls: () => calls };
}

test("retries once when getSession throws (cookie write inside a page)", async () => {
  const s = sequence("throw", "ok");
  assert.deepEqual(await getSessionWithRetry(s.fn, noPause), ok);
  assert.equal(s.calls(), 2);
});

test("retries once on a 5xx (auth service cold start)", async () => {
  const s = sequence(503, "ok");
  assert.deepEqual(await getSessionWithRetry(s.fn, noPause), ok);
  assert.equal(s.calls(), 2);
});

test("does not retry a real 4xx answer or a success", async () => {
  const unauthorized = sequence(401);
  assert.equal((await getSessionWithRetry(unauthorized.fn, noPause)).error?.status, 401);
  assert.equal(unauthorized.calls(), 1);
  const success = sequence("ok");
  await getSessionWithRetry(success.fn, noPause);
  assert.equal(success.calls(), 1);
});

test("a second failure still surfaces", async () => {
  const s = sequence("throw", "throw");
  await assert.rejects(getSessionWithRetry(s.fn, noPause));
});
