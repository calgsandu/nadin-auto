import assert from "node:assert/strict";
import {
  normalizeUsername,
  technicalEmailForUsername,
  validateUsername,
} from "@/lib/auth/username";

assert.equal(normalizeUsername(" Ion.Popescu "), "ion.popescu");
assert.equal(
  validateUsername("ab"),
  "Numele de utilizator trebuie să aibă între 3 și 32 de caractere.",
);
assert.equal(
  validateUsername("ion popescu"),
  "Folosește doar litere mici, cifre, punct, cratimă sau underscore.",
);
assert.equal(validateUsername("Ion_2"), null);
assert.equal(
  technicalEmailForUsername(" Ion_2 "),
  "ion_2@staff.nadinauto.invalid",
);

console.log("username tests passed");
