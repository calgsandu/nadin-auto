import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const paymentActionsPath = fileURLToPath(new URL("../actions.ts", import.meta.url));
const paymentActions = readFileSync(paymentActionsPath, "utf8");
const operationsActionsPath = fileURLToPath(new URL("../../operations/actions.ts", import.meta.url));
const operationsActions = readFileSync(operationsActionsPath, "utf8");

assert.match(
  paymentActions,
  /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\('payment-account:number'\)\)`;/,
  "Numărul contului trebuie blocat cu $executeRaw: funcția PostgreSQL nu întoarce o valoare pe care Prisma să o poată deserializa.",
);

assert.doesNotMatch(
  paymentActions,
  /await tx\.\$queryRaw`SELECT pg_advisory_xact_lock\(hashtext\('payment-account:number'\)\)`;/,
);

assert.match(
  paymentActions,
  /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\('stockdoc:SALE'\)\)`;/,
  "Predarea contului trebuie să execute lock-ul fără deserializarea rezultatului void.",
);

assert.match(
  operationsActions,
  /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\(\$\{`stockdoc:\$\{type\}`\}\)\)`;/,
  "Operațiunile de stoc trebuie să execute lock-ul fără deserializarea rezultatului void.",
);

console.log("payment-account advisory-lock test passed");
