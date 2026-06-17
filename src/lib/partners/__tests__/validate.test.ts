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
}

// Valid explicit kind is kept.
const both = parsePartnerForm(form({ name: "X", kind: "BOTH" }));
assert.equal(both.ok && both.data.kind, "BOTH");

// Invalid kind is rejected.
const badKind = parsePartnerForm(form({ name: "X", kind: "VENDOR" }));
assert.equal(badKind.ok, false);
if (!badKind.ok) assert.match(badKind.message, /tip/i);

console.log("partner validate tests passed");
