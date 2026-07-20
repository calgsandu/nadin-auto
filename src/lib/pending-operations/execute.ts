import type { AppRole, PendingOperationStatus } from "@/generated/prisma/enums";
import type { CurrentAppUser } from "@/lib/auth/access";
import {
  logAuditRequired,
  type AuditActor,
} from "@/lib/audit";
import { executeSale } from "@/lib/operations/execute-sale";
import { executePaymentAccountFulfillment } from "@/lib/payment-accounts/execute-fulfillment";
import { parsePendingOperationPayload } from "@/lib/pending-operations/payload";
import { prisma } from "@/lib/prisma";
import { canReviewOperations } from "@/lib/roles";

export function assertPendingOperation(status: PendingOperationStatus) {
  if (status !== "PENDING") {
    throw new Error("Operațiunea a fost deja procesată.");
  }
}

export function normalizeRejectionReason(value: string) {
  const reason = value.trim();
  if (!reason) {
    throw new Error("Completează motivul respingerii.");
  }
  return reason;
}

export function pendingOperationActor(operation: {
  requestedById: string;
  requestedByRole: AppRole;
  requestedByName: string | null;
  requestedByEmail: string | null;
}): AuditActor {
  return {
    id: operation.requestedById,
    role: operation.requestedByRole,
    name: operation.requestedByName,
    email: operation.requestedByEmail,
  };
}

export async function approvePendingOperation(
  operationId: string,
  reviewer: CurrentAppUser,
) {
  requireReviewer(reviewer);

  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "PendingOperation" WHERE id = ${operationId} FOR UPDATE`;
      if (locked.length === 0) {
        throw new Error("Cererea de aprobare nu există.");
      }

      const operation = await tx.pendingOperation.findUnique({
        where: { id: operationId },
      });
      if (!operation) throw new Error("Cererea de aprobare nu există.");
      assertPendingOperation(operation.status);

      const parsed = parsePendingOperationPayload(
        operation.kind,
        operation.payload,
      );
      const actor = pendingOperationActor(operation);
      let appliedEntityId: string;
      let resultMessage: string;

      if (parsed.kind === "SALE") {
        const sale = await executeSale(tx, actor, parsed.payload);
        appliedEntityId = sale.id;
        resultMessage = `Vânzarea #${sale.number} a fost aprobată și aplicată.`;
      } else {
        const result = await executePaymentAccountFulfillment(
          tx,
          actor,
          parsed.payload.paymentAccountId,
        );
        appliedEntityId = result.appliedEntityId;
        resultMessage = `Predarea a fost aprobată. Vânzarea #${result.saleNumber} a fost creată.`;
      }

      const reviewedAt = new Date();
      await tx.pendingOperation.update({
        where: { id: operation.id },
        data: {
          status: "APPROVED",
          activeKey: null,
          reviewedById: reviewer.id,
          reviewedByName:
            reviewer.name ?? reviewer.email ?? reviewer.username,
          reviewedAt,
          appliedEntityId,
          lastError: null,
        },
      });
      await logAuditRequired(tx, reviewer, {
        action: "UPDATE",
        entity: "PendingOperation",
        entityId: operation.id,
        summary: `Cerere aprobată: ${operation.summary}`,
        details: { appliedEntityId },
      });

      return { operationId: operation.id, appliedEntityId, resultMessage };
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aprobarea a eșuat.";
    await prisma.pendingOperation.updateMany({
      where: { id: operationId, status: "PENDING" },
      data: { lastError: message.slice(0, 1000) },
    });
    throw error;
  }
}

export async function rejectPendingOperation(
  operationId: string,
  reviewer: CurrentAppUser,
  rawReason: string,
) {
  requireReviewer(reviewer);
  const reason = normalizeRejectionReason(rawReason);

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "PendingOperation" WHERE id = ${operationId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new Error("Cererea de aprobare nu există.");
    }

    const operation = await tx.pendingOperation.findUnique({
      where: { id: operationId },
    });
    if (!operation) throw new Error("Cererea de aprobare nu există.");
    assertPendingOperation(operation.status);

    await tx.pendingOperation.update({
      where: { id: operation.id },
      data: {
        status: "REJECTED",
        activeKey: null,
        reviewedById: reviewer.id,
        reviewedByName:
          reviewer.name ?? reviewer.email ?? reviewer.username,
        reviewedAt: new Date(),
        reviewNote: reason,
        lastError: null,
      },
    });
    await logAuditRequired(tx, reviewer, {
      action: "UPDATE",
      entity: "PendingOperation",
      entityId: operation.id,
      summary: `Cerere respinsă: ${operation.summary}`,
      details: { reason },
    });

    return { operationId: operation.id };
  });
}

function requireReviewer(reviewer: CurrentAppUser) {
  if (!canReviewOperations(reviewer.role)) {
    throw new Error(
      "Doar directorul sau administratorul poate decide cererile.",
    );
  }
}
