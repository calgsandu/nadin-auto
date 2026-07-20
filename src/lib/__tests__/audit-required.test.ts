import assert from "node:assert/strict";
import { logAuditBestEffort, logAuditRequired } from "@/lib/audit";

const actor = {
  id: "user-1",
  role: "ANGAJAT" as const,
  name: "Angajat",
  email: "angajat@example.test",
};

const entry = {
  action: "CREATE" as const,
  entity: "StockDocument",
  entityId: "sale-1",
  summary: "Vânzare creată",
};

const failingClient = {
  auditLog: {
    create: async () => {
      throw new Error("audit unavailable");
    },
  },
};

async function main() {
  await assert.rejects(
    () => logAuditRequired(failingClient, actor, entry),
    /audit unavailable/,
  );

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(() =>
      logAuditBestEffort(failingClient, actor, entry),
    );
  } finally {
    console.error = originalConsoleError;
  }

  console.log("required audit tests passed");
}

void main();
