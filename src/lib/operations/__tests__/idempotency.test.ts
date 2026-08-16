import assert from "node:assert/strict";
import { isDuplicateKeyError, newToken, readToken } from "@/lib/operations/idempotency";

const formData = new FormData();
assert.equal(readToken(formData), null);

formData.set("idempotencyKey", "  ");
assert.equal(readToken(formData), null, "token gol = fără idempotență (documente vechi)");

formData.set("idempotencyKey", " abc-123 ");
assert.equal(readToken(formData), "abc-123");

// Două token-uri nu se pot ciocni.
assert.notEqual(newToken(), newToken());
assert.match(newToken(), /^[0-9a-f-]{36}$/);

// Doar P2002 pe idempotencyKey înseamnă „a scris altcineva primul".
assert.equal(isDuplicateKeyError({ code: "P2002", meta: { target: ["idempotencyKey"] } }), true);
assert.equal(
  isDuplicateKeyError({ code: "P2002", meta: { target: "StockDocument_idempotencyKey_key" } }),
  true,
);
// Forma reală a adaptorului Neon (Prisma 7) — vezi tmp/verify-idempotency.ts.
assert.equal(
  isDuplicateKeyError({
    code: "P2002",
    meta: {
      modelName: "StockDocument",
      driverAdapterError: {
        cause: { kind: "UniqueConstraintViolation", constraint: { fields: ['"idempotencyKey"'] } },
      },
    },
    message: "Unique constraint failed on the fields: (`\"idempotencyKey\"`)",
  }),
  true,
);
// Numărul de document dublat rămâne eroare adevărată, nu „salvat deja".
assert.equal(isDuplicateKeyError({ code: "P2002", meta: { target: ["type", "number"] } }), false);
assert.equal(isDuplicateKeyError({ code: "P2002" }), false);
assert.equal(isDuplicateKeyError({ code: "P2025", meta: { target: ["idempotencyKey"] } }), false);
assert.equal(isDuplicateKeyError(new Error("boom")), false);
assert.equal(isDuplicateKeyError(null), false);
assert.equal(isDuplicateKeyError(undefined), false);

console.log("idempotency test passed");
