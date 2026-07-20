import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRateLimitKeys,
  IP_POLICY,
  nextFailureState,
  rateLimitDecision,
  trustedClientIp,
  USER_SESSION_POLICY,
} from "@/lib/auth/two-factor/rate-limit";

test("blocks a user session after five failures for fifteen minutes", () => {
  const start = new Date("2026-07-20T10:00:00.000Z");
  let state = null;
  for (let index = 0; index < 5; index += 1) {
    state = nextFailureState(state, start, USER_SESSION_POLICY);
  }

  assert.ok(state);
  assert.equal(state.failures, 5);
  assert.equal(state.blockedUntil?.toISOString(), "2026-07-20T10:15:00.000Z");
  assert.equal(
    rateLimitDecision(state, new Date("2026-07-20T10:14:59.000Z")).allowed,
    false,
  );
  assert.equal(
    rateLimitDecision(state, new Date("2026-07-20T10:15:00.000Z")).allowed,
    true,
  );
});

test("blocks an IP after twenty-five failures and resets an expired window", () => {
  const start = new Date("2026-07-20T10:00:00.000Z");
  let state = null;
  for (let index = 0; index < 25; index += 1) {
    state = nextFailureState(state, start, IP_POLICY);
  }

  assert.ok(state);
  assert.equal(state.blockedUntil?.toISOString(), "2026-07-20T10:15:00.000Z");
  assert.equal(
    nextFailureState(state, new Date("2026-07-20T10:11:00.000Z"), IP_POLICY).failures,
    1,
  );
});

test("builds domain-separated user-session and optional IP keys", () => {
  const pepper = Buffer.alloc(32, 5);
  const withoutIp = buildRateLimitKeys("user_1", "session_1", null, pepper);
  const withIp = buildRateLimitKeys("user_1", "session_1", "203.0.113.8", pepper);

  assert.equal(withoutIp.length, 1);
  assert.equal(withoutIp[0]?.scope, "USER_SESSION");
  assert.equal(withIp.length, 2);
  assert.equal(withIp[1]?.scope, "IP");
  assert.notEqual(withIp[0]?.keyHash, withIp[1]?.keyHash);
});

test("trusts forwarded IP headers only in their approved environments", () => {
  const vercelHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.1" });
  const localHeaders = new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.2" });

  assert.equal(trustedClientIp(vercelHeaders, { VERCEL: "1", NODE_ENV: "production" }), "203.0.113.8");
  assert.equal(trustedClientIp(localHeaders, { NODE_ENV: "development" }), "198.51.100.7");
  assert.equal(trustedClientIp(localHeaders, { NODE_ENV: "production" }), null);
  assert.equal(
    trustedClientIp(new Headers({ "x-vercel-forwarded-for": "not-an-ip" }), {
      VERCEL: "1",
      NODE_ENV: "production",
    }),
    null,
  );
});
