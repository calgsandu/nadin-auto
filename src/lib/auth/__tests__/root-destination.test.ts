import assert from "node:assert/strict";
import { resolveRootDestination } from "@/lib/auth/root-destination";

assert.equal(resolveRootDestination(null), "/catalog");
assert.equal(resolveRootDestination({ id: "user_1" }), "/crm");

console.log("root destination tests passed");
