import type { Prisma } from "@/generated/prisma/client";
import type { AppRole } from "@/generated/prisma/enums";
import type { CurrentAppUser } from "@/lib/auth/access";
import type {
  PendingPaymentFulfillmentPayload,
  PendingSalePayload,
} from "@/lib/pending-operations/types";
import { prisma } from "@/lib/prisma";

export function shouldQueueStockOperation(role: AppRole) {
  return role === "ANGAJAT";
}

export function pendingPaymentFulfillmentKey(paymentAccountId: string) {
  return `payment-account-fulfillment:${paymentAccountId}`;
}

export function enqueueSaleRequest(
  actor: CurrentAppUser,
  payload: PendingSalePayload,
  summary: string,
) {
  return prisma.pendingOperation.create({
    data: {
      kind: "SALE",
      requestedById: actor.id,
      requestedByName: actor.name,
      requestedByEmail: actor.email,
      requestedByRole: actor.role,
      summary,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

export function enqueuePaymentFulfillmentRequest(
  actor: CurrentAppUser,
  payload: PendingPaymentFulfillmentPayload,
  summary: string,
) {
  return createUniquePaymentRequest(actor, payload, summary);
}

async function createUniquePaymentRequest(
  actor: CurrentAppUser,
  payload: PendingPaymentFulfillmentPayload,
  summary: string,
) {
  try {
    return await prisma.pendingOperation.create({
      data: {
        kind: "PAYMENT_ACCOUNT_FULFILLMENT",
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedByEmail: actor.email,
        requestedByRole: actor.role,
        summary,
        payload: payload as unknown as Prisma.InputJsonValue,
        activeKey: pendingPaymentFulfillmentKey(payload.paymentAccountId),
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error(
        "Există deja o cerere de predare în așteptare pentru acest cont.",
      );
    }
    throw error;
  }
}
