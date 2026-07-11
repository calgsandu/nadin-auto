import "dotenv/config";
import assert from "node:assert/strict";
import { getAdminEmails, resolveInitialRole } from "@/lib/auth/bootstrap";
import { isActiveAppUser } from "@/lib/users";

// resolveInitialRole: configured admin emails become ADMIN on first sign-in.
const admins = ["calugareanusandu@gmail.com"];
assert.equal(resolveInitialRole("calugareanusandu@gmail.com", admins), "ADMIN");
// Case-insensitive + trimmed match.
assert.equal(resolveInitialRole("  Calugareanusandu@Gmail.com ", admins), "ADMIN");
// Everyone else starts as ANGAJAT.
assert.equal(resolveInitialRole("altcineva@gmail.com", admins), "ANGAJAT");
assert.equal(resolveInitialRole(null, admins), "ANGAJAT");
assert.equal(resolveInitialRole("x@y.z", []), "ANGAJAT");

// getAdminEmails: parse + normalize the env list.
process.env.NADIN_ADMIN_EMAILS = " A@b.com , c@d.com ,";
assert.deepEqual(getAdminEmails(), ["a@b.com", "c@d.com"]);
delete process.env.NADIN_ADMIN_EMAILS;
assert.deepEqual(getAdminEmails(), []);

assert.equal(isActiveAppUser(undefined), false);
assert.equal(isActiveAppUser(null), false);
assert.equal(isActiveAppUser({ active: false }), false);
assert.equal(isActiveAppUser({ active: true }), true);

console.log("users bootstrap tests passed");
