"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import {
  NEXT_STATUS,
  STATUS_LABELS,
  parseExternalOrderStatus,
} from "@/lib/external-orders/status";
import { nextStockDocumentNumber } from "@/lib/operations/stock-mutations";
import { parseRequiredSalePaymentMethod } from "@/lib/operations/sale-payment-method";
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
    await assertSupplier(data.supplierId);

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
    revalidatePath("/crm", "layout");
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
    await assertSupplier(data.supplierId);

    const order = await prisma.externalOrder.update({ where: { id }, data });
    await logAudit(prisma, appUser, {
      action: "UPDATE",
      entity: "ExternalOrder",
      entityId: order.id,
      summary: `Comandă externă #${order.number} actualizată.`,
    });
    revalidatePath("/crm", "layout");
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
    const rawStatus = readString(formData, "status");
    if (!id || !rawStatus) throw new Error("Lipsește comanda sau statusul.");
    const status = parseExternalOrderStatus(rawStatus);

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
    const updated = await prisma.$transaction(async (tx) => {
      const saleDocumentId =
        status === "LIVRAT" ? await createDeliverySale(tx, order, formData) : undefined;

      return tx.externalOrder.update({
        where: { id },
        data: {
          status,
          ...(timestampField ? { [timestampField]: new Date() } : {}),
          ...(saleDocumentId ? { saleDocumentId } : {}),
        },
      });
    });

    await logAudit(prisma, appUser, {
      action: "UPDATE",
      entity: "ExternalOrder",
      entityId: updated.id,
      summary: `Comandă externă #${updated.number}: ${STATUS_LABELS[order.status]} → ${STATUS_LABELS[status]}`,
    });
    revalidatePath("/crm", "layout");
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
    revalidatePath("/crm", "layout");
    return { ok: true, message: `Comanda #${order.number} a fost ștearsă.` };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Vânzarea născută la livrarea unei comenzi externe.
 *
 * Fluxul se oprea la LIVRAT și nu ajungea în NICIUN raport — nici închiderea de
 * zi, nici TVA, nici statistici, nici profitul pe client — deși costul și prețul
 * erau deja captate. Documentul creat aici e exact forma pe care rapoartele o
 * știu deja: o vânzare cu o linie externă (`productId` null), deci stocul nu se
 * atinge, iar cealaltă implementare a aceleiași idei (linii externe pe vânzări
 * obișnuite) și aceasta ajung în sfârșit în același loc.
 */
async function createDeliverySale(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    number: number;
    customerName: string;
    productName: string;
    productCode: string | null;
    quantity: number;
    supplierId: string | null;
    supplierPriceLei: Prisma.Decimal | null;
    salePriceLei: Prisma.Decimal | null;
    saleDocumentId: string | null;
  },
  formData: FormData,
) {
  // Livrarea se poate confirma o singură dată: a doua ar dubla vânzarea.
  // Citirea de dinaintea tranzacției poate fi deja veche, deci rândul se
  // blochează aici — două file deschise nu pot livra amândouă.
  const locked = await tx.$queryRaw<{ saleDocumentId: string | null }[]>`
    SELECT "saleDocumentId" FROM "ExternalOrder" WHERE id = ${order.id} FOR UPDATE`;
  if (locked.length === 0) throw new Error("Comanda nu există.");
  if (locked[0].saleDocumentId) {
    throw new Error("Comanda are deja o vânzare înregistrată.");
  }
  if (order.salePriceLei == null) {
    throw new Error("Completează prețul de vânzare înainte de livrare.");
  }

  // Banii au nevoie de metodă: fără ea vânzarea ar cădea în „Nespecificat" la
  // închiderea de zi și n-ar intra în datoria clientului.
  const paymentMethod = parseRequiredSalePaymentMethod(
    readString(formData, "paymentMethod"),
  );
  const cashRegistered = formData.get("cashRegistered") === "on";

  const warehouse = await tx.warehouse.findFirst({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!warehouse) throw new Error("Nu există niciun depozit activ.");

  // Clientul e text liber pe comandă; ca vânzarea să intre și în profitul pe
  // client, îi trebuie un partener — aceeași potrivire pe nume ca la editarea
  // documentelor.
  const partner = await tx.partner.upsert({
    where: { name: order.customerName },
    create: { name: order.customerName, kind: "CUSTOMER" },
    update: {},
    select: { id: true },
  });

  const unitPriceLei = Number(order.salePriceLei);
  const sale = await tx.stockDocument.create({
    data: {
      type: "SALE",
      number: await nextStockDocumentNumber(tx, "SALE"),
      documentDate: new Date(),
      warehouseId: warehouse.id,
      partnerId: partner.id,
      notes: `Comandă la furnizor #${order.number}`,
      totalLei: unitPriceLei * order.quantity,
      paymentMethod,
      cashRegistered,
      lines: {
        create: [
          {
            // Linie externă: piesa nu e în catalog, deci stocul nu se mișcă.
            productId: null,
            externalName: order.productName,
            externalCode: order.productCode,
            externalSupplierId: order.supplierId,
            quantity: order.quantity,
            unitPriceEuro: unitPriceLei,
            unitCostLei: order.supplierPriceLei,
          },
        ],
      },
    },
    select: { id: true },
  });

  return sale.id;
}

/**
 * `supplierId` venea din formular nevalidat: un id inventat trecea până la FK,
 * iar un CLIENT ales din greșeală ar fi rămas „furnizorul" comenzii.
 */
async function assertSupplier(supplierId: string | null) {
  if (!supplierId) return;
  const partner = await prisma.partner.findUnique({
    where: { id: supplierId },
    select: { kind: true },
  });
  if (!partner) throw new Error("Furnizorul ales nu există.");
  if (partner.kind === "CUSTOMER") throw new Error("Partenerul ales nu este furnizor.");
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
    offerValidUntil: parseOfferDate(offerValidUntil),
    notes: readString(formData, "notes") || null,
  };
}

/**
 * Valabilitatea ofertei. Fără gardă, o dată tastată greșit ajungea `Invalid
 * Date` în baza de date — spre deosebire de conturile de plată, care o verifică.
 */
function parseOfferDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de valabilitate a ofertei nu este validă.");
  }
  return date;
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
