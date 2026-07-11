import assert from "node:assert/strict";
import { parseCreateStaffInput, parsePassword } from "@/lib/staff/validate";
import { needsPasswordCredential } from "@/lib/staff/bootstrap";

function createForm(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

assert.throws(
  () =>
    parseCreateStaffInput(
      createForm({ name: "I", username: "ion", role: "ANGAJAT", password: "parola123" }),
    ),
  /Numele persoanei/,
);
assert.throws(
  () =>
    parseCreateStaffInput(
      createForm({ name: "Ion", username: "ion pop", role: "ANGAJAT", password: "parola123" }),
    ),
  /litere mici/,
);
assert.throws(
  () =>
    parseCreateStaffInput(
      createForm({ name: "Ion", username: "ion", role: "PATRON", password: "parola123" }),
    ),
  /Rol invalid/,
);
assert.throws(() => parsePassword("123"), /cel puțin 8/);

assert.deepEqual(
  parseCreateStaffInput(
    createForm({ name: " Ion Popescu ", username: " Ion_2 ", role: "DIRECTOR", password: "parola123" }),
  ),
  { name: "Ion Popescu", username: "ion_2", role: "DIRECTOR", password: "parola123" },
);

assert.equal(needsPasswordCredential(["google"]), true);
assert.equal(needsPasswordCredential(["google", "credential"]), false);

console.log("staff validate tests passed");
