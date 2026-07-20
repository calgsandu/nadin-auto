import assert from "node:assert/strict";
import { resolveRootDestination } from "@/lib/auth/root-destination";

assert.equal(resolveRootDestination("UNAUTHENTICATED"), "/catalog");
assert.equal(resolveRootDestination("ENROLLMENT_REQUIRED"), "/auth/2fa/setup");
assert.equal(resolveRootDestination("TOTP_REQUIRED"), "/auth/2fa/verify");
assert.equal(resolveRootDestination("AUTHENTICATED"), "/crm");

console.log("root destination tests passed");
