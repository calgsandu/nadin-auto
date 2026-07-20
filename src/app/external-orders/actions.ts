"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { NEXT_STATUS, STATUS_LABELS } from "@/lib/external-orders/status";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

export type ExternalOrderActionState = {
  ok: boolean;
  message: string;
};

const STATUS_TIMESTAMP: Partial<Record<ExternalOrderStatus, "quotedAt" | "confirmedAt" | "receivedAt" | "deliveredAt" | "cancelledAt">> = {
  OFERTAT: "quotedAt",
  CONFIRMAT: "confirmedAt",
  RECEPTIONAT: "receivedAt",
  LIVRAT: "deliveredAt",
  ANULAT: "cancelledAt",
};

async function requireOrderAccess() {
  const appUser = await requireCurrentAppUser();
  if (!canCreateSales(appUser.role)) {
    throw new Error("Nu ai drepturi pentru comenzile la furnizori.");
  }
  return appUser;
}

export async function createExternalOrderAction(
  _state: ExternalOrderActionState,
  formData: FormData,
): Promise<ExternalOrderActionState> {
  try {
    const appUser = await requireOrderAccess();
    const data = parseOrderForm(formData);

    const order = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('externalorder'))`;
      const last = await tx.externalOrder.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      return tx.externalOrder.create({
        data: { ...data, number: (last?.number ?? 0) + 1 },
      });
    });

    await logAudit(prisma, appUser, {
      action: "CREATE",
      entity: "ExternalOrder",
      entityId: order.id,
      summary: `Comandă externă #${order.number}: ${order.productName} pentru ${order.customerName}`,
    });
    revalidatePath("/crm");
    return { ok: true, message: `Comanda #${order.number} a fost creată.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateExternalOrderAction(
  _state: ExternalOrderActionState,
  formData: FormData,
): Promise<ExternalOrderActionState> {
  try {
    const appUser = await requireOrderAccess();
    const id = readString(formData, "orderId");
    if (!id) throw new Error("Lipsește comanda pentru editare.");
    const data = parseOrderForm(formData);

    const order = await prisma.externalOrder.update({ where: { id }, data });
    await logAudit(prisma, appUser, {
      action: "UPDATE",
      entity: "ExternalOrder",
      entityId: order.id,
      summary: `Comandă externă #${order.number} actualizată.`,
    });
    revalidatePath("/crm");
    return { ok: true, message: "Comanda a fost actualizată." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setExternalOrderStatusAction(
  _state: ExternalOrderActionState,
  formData: FormData,
): Promise<ExternalOrderActionState> {
  try {
    const appUser = await requireOrderAccess();
    const id = readString(formData, "orderId");
    const status = readString(formData, "status") as ExternalOrderStatus;
    if (!id || !status) throw new Error("Lipsește comanda sau statusul.");

    const order = await prisma.externalOrder.findUnique({ where: { id } });
    if (!order) throw new Error("Comanda nu există.");
    if (!NEXT_STATUS[order.status].includes(status)) {
      throw new Error(
        `Nu se poate trece din „${STATUS_LABELS[order.status]}" în „${STATUS_LABELS[status]}".`,
      );
    }
    if (status === "CONFIRMAT") {
      if (!order.supplierId) throw new Error("Alege furnizorul înainte de confirmare.");
      if (order.supplierPriceLei == null || order.salePriceLei == null) {
        throw new Error("Completează prețul de achiziție și prețul de vânzare înainte de confirmare.");
      }
    }

    const timestampField = STATUS_TIMESTAMP[status];
    const updated = await prisma.externalOrder.update({
      where: { id },
      data: {
        status,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });

    await logAudit(prisma, appUser, {
      action: "UPDATE",
      entity: "ExternalOrder",
      entityId: updated.id,
      summary: `Comandă externă #${updated.number}: ${STATUS_LABELS[order.status]} → ${STATUS_LABELS[status]}`,
    });
    revalidatePath("/crm");
    return { ok: true, message: `Comanda #${updated.number}: ${STATUS_LABELS[status]}.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteExternalOrderAction(
  _state: ExternalOrderActionState,
  formData: FormData,
): Promise<ExternalOrderActionState> {
  try {
    const appUser = await requireCurrentAppUser();
    if (!canWriteCatalog(appUser.role)) {
      throw new Error("Doar directorul sau adminul poate șterge comenzi.");
    }
    const id = readString(formData, "orderId");
    if (!id) throw new Error("Lipsește comanda.");

    const order = await prisma.externalOrder.delete({ where: { id } });
    await logAudit(prisma, appUser, {
      action: "DELETE",
      entity: "ExternalOrder",
      entityId: order.id,
      summary: `Comandă externă #${order.number} ștearsă (${order.productName}, ${order.customerName}).`,
    });
    revalidatePath("/crm");
    return { ok: true, message: `Comanda #${order.number} a fost ștearsă.` };
  } catch (error) {
    return toActionError(error);
  }
}

function parseOrderForm(formData: FormData) {
  const customerName = readString(formData, "customerName");
  const productName = readString(formData, "productName");
  if (!customerName) throw new Error("Completează numele clientului.");
  if (!productName) throw new Error("Completează denumirea piesei.");

  const quantity = Number(readString(formData, "quantity") || "1");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Cantitatea trebuie să fie un număr întreg pozitiv.");
  }

  const offerValidUntil = readString(formData, "offerValidUntil");

  return {
    customerName,
    customerPhone: readString(formData, "customerPhone") || null,
    productName,
    productCode: readString(formData, "productCode") || null,
    quantity,
    supplierId: readString(formData, "supplierId") || null,
    supplierPriceLei: readDecimal(formData, "supplierPriceLei"),
    salePriceLei: readDecimal(formData, "salePriceLei"),
    offerValidUntil: offerValidUntil ? new Date(offerValidUntil) : null,
    notes: readString(formData, "notes") || null,
  };
}

function readDecimal(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Prețurile trebuie să fie numere pozitive.");
  }
  return value;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toActionError(error: unknown): ExternalOrderActionState {
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "Comanda nu a putut fi salvată." };
}
