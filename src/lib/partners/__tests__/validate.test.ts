import assert from "node:assert/strict";
import { parsePartnerForm } from "@/lib/partners/validate";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

// Name is required.
const missingName = parsePartnerForm(form({ name: "   " }));
assert.equal(missingName.ok, false);
if (!missingName.ok) assert.match(missingName.message, /nume/i);

// Default kind is SUPPLIER and fields are trimmed / nulled.
const defaults = parsePartnerForm(form({ name: "  Auto Parts  ", phone: "" }));
assert.equal(defaults.ok, true);
if (defaults.ok) {
  assert.equal(defaults.data.name, "Auto Parts");
  assert.equal(defaults.data.kind, "SUPPLIER");
  assert.equal(defaults.data.phone, null);
  assert.equal(defaults.data.notes, null);
  assert.equal(defaults.data.address, null);
  assert.equal(defaults.data.email, null);
  assert.equal(defaults.data.idno, null);
  assert.equal(defaults.data.vatCode, null);
  assert.equal(defaults.data.iban, null);
  assert.equal(defaults.data.bankName, null);
  assert.equal(defaults.data.bankCode, null);
}

const company = parsePartnerForm(
  form({
    name: "  Nanu Market SRL ",
    kind: "CUSTOMER",
    phone: " 060000000 ",
    address: " mun. Chișinău, str. Constructorilor 1 ",
    email: " office@example.md ",
    idno: " 1006600052073 ",
    vatCode: " 0600000 ",
    iban: " md17mo2224asv48168667100 ",
    bankName: " OTP Bank S.A. ",
    bankCode: " mobbmd22 ",
  }),
);
assert.equal(company.ok, true);
if (company.ok) {
  assert.deepEqual(company.data, {
    name: "Nanu Market SRL",
    kind: "CUSTOMER",
    phone: "060000000",
    notes: null,
    address: "mun. Chișinău, str. Constructorilor 1",
    email: "office@example.md",
    idno: "1006600052073",
    vatCode: "0600000",
    iban: "MD17MO2224ASV48168667100",
    bankName: "OTP Bank S.A.",
    bankCode: "MOBBMD22",
  });
}

const badEmail = parsePartnerForm(form({ name: "X", email: "nu-este-email" }));
assert.equal(badEmail.ok, false);
if (!badEmail.ok) assert.match(badEmail.message, /e-mail/i);

// Valid explicit kind is kept.
const both = parsePartnerForm(form({ name: "X", kind: "BOTH" }));
assert.equal(both.ok && both.data.kind, "BOTH");

// Invalid kind is rejected.
const badKind = parsePartnerForm(form({ name: "X", kind: "VENDOR" }));
assert.equal(badKind.ok, false);
if (!badKind.ok) assert.match(badKind.message, /tip/i);

console.log("partner validate tests passed");
