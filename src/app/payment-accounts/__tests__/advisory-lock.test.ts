import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const paymentActionsPath = fileURLToPath(new URL("../actions.ts", import.meta.url));
const paymentActions = readFileSync(paymentActionsPath, "utf8");
const operationsActionsPath = fileURLToPath(new URL("../../operations/actions.ts", import.meta.url));
const operationsActions = readFileSync(operationsActionsPath, "utf8");
const fulfillmentServicePath = fileURLToPath(
  new URL("../../../lib/payment-accounts/execute-fulfillment.ts", import.meta.url),
);
const fulfillmentService = readFileSync(fulfillmentServicePath, "utf8");
const stockMutationsPath = fileURLToPath(
  new URL("../../../lib/operations/stock-mutations.ts", import.meta.url),
);
const stockMutations = readFileSync(stockMutationsPath, "utf8");

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
  fulfillmentService,
  /nextStockDocumentNumber\(tx, "SALE"\)/,
  "Predarea contului trebuie să folosească alocarea comună și blocată a numărului de vânzare.",
);

assert.match(
  stockMutations,
  /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\(\$\{`stockdoc:\$\{type\}`\}\)\)`;/,
  "Operațiunile de stoc trebuie să execute lock-ul fără deserializarea rezultatului void.",
);

assert.match(
  operationsActions,
  /nextDocumentNumber\(tx,/,
  "Operațiunile existente trebuie să păstreze alocarea tranzacțională a numerelor.",
);

console.log("payment-account advisory-lock test passed");
