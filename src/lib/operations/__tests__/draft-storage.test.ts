import assert from "node:assert/strict";
import {
  DRAFT_MAX_AGE_MS,
  draftKey,
  parseDraft,
  serializeDraft,
} from "@/lib/operations/draft-storage";

const NOW = 1_700_000_000_000;

assert.equal(draftKey("receipt"), "nadin-draft:v1:receipt");

// Round-trip: ce s-a serializat se citește înapoi identic.
const formData = new FormData();
formData.append("documentDate", "2026-08-15");
formData.append("warehouseId", "wh-1");
formData.append("quantity", "3");
formData.append("quantity", "5");
formData.append("idempotencyKey", "nu-trebuie-salvat");

const draft = serializeDraft(formData, [{ id: 1, productId: "p-1" }], "token-1", NOW);
assert.deepEqual(draft.fields, {
  documentDate: ["2026-08-15"],
  warehouseId: ["wh-1"],
  quantity: ["3", "5"],
});
// Token-ul se ține separat, nu printre câmpuri.
assert.equal(Object.keys(draft.fields).includes("idempotencyKey"), false);
assert.equal(draft.token, "token-1");

const restored = parseDraft(JSON.stringify(draft), NOW);
assert.deepEqual(restored, draft);

// Ciorna expirată (mai veche de 7 zile) nu se mai propune.
assert.equal(parseDraft(JSON.stringify(draft), NOW + DRAFT_MAX_AGE_MS + 1), null);
assert.notEqual(parseDraft(JSON.stringify(draft), NOW + DRAFT_MAX_AGE_MS - 1), null);

// JSON stricat sau formă necunoscută: se pornește curat, fără să crape nimic.
assert.equal(parseDraft("{nu e json", NOW), null);
assert.equal(parseDraft(null, NOW), null);
assert.equal(parseDraft("[]", NOW), null);
assert.equal(parseDraft(JSON.stringify({ ...draft, token: "" }), NOW), null);
assert.equal(parseDraft(JSON.stringify({ ...draft, savedAt: "ieri" }), NOW), null);
assert.equal(parseDraft(JSON.stringify({ ...draft, fields: null }), NOW), null);
assert.equal(parseDraft(JSON.stringify({ ...draft, fields: { a: "text" } }), NOW), null);
assert.equal(parseDraft(JSON.stringify({ ...draft, fields: { a: [1] } }), NOW), null);

// Liniile sunt opace: se întorc exact cum au intrat.
assert.deepEqual(restored?.lines, [{ id: 1, productId: "p-1" }]);

console.log("draft storage test passed");
