"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { logAudit } from "@/lib/audit";
import { COMPANY } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import {
  executePaymentAccountFulfillment,
  fulfillmentRequestSummary,
  validatePaymentFulfillmentRequest,
} from "@/lib/payment-accounts/execute-fulfillment";
import {
  enqueuePaymentFulfillmentRequest,
  shouldQueueStockOperation,
} from "@/lib/pending-operations/queue";
import {
  assertCanCancelPaymentAccount,
  assertCanMarkPaymentAccountPaid,
} from "@/lib/payment-accounts/status";
import { calculatePaymentTotals } from "@/lib/payment-accounts/totals";
import { parsePaymentAccountForm } from "@/lib/payment-accounts/validate";
import { postUnsignedInvoice } from "@/lib/e-factura/client";
import { buildPaymentAccountEFacturaXml } from "@/lib/e-factura/payment-account";

export type PaymentAccountActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_ERROR: PaymentAccountActionState = {
  ok: false,
  message: "Contul de plată nu a putut fi salvat.",
};

export async function createPaymentAccountAction(
  _state: PaymentAccountActionState,
  formData: FormData,
): Promise<PaymentAccountActionState> {
  try {
    const user = await requirePaymentAccountWrite();
    const input = parsePaymentAccountForm(formData);

    const created = await prisma.$transaction(async (tx) => {
      const [warehouse, partner, products] = await Promise.all([
        tx.warehouse.findFirst({
          where: { id: input.warehouseId, active: true },
          select: { id: true },
        }),
        input.newCustomer
          ? Promise.resolve(null)
          : tx.partner.findUnique({ where: { id: input.partnerId } }),
        tx.product.findMany({
          where: { id: { in: input.lines.map((line) => line.productId) } },
          select: { id: true, externalCode: true, description: true },
        }),
      ]);

      if (!warehouse) throw new Error("Locația aleasă nu există sau este dezactivată.");
      let resolvedPartner = partner;
      if (input.newCustomer) {
        const existing = await tx.partner.findUnique({
          where: { name: input.newCustomer.name },
          select: { id: true, kind: true, name: true, idno: true, address: true, vatCode: true, phone: true, email: true, iban: true, bankName: true, bankCode: true },
        });
        if (existing) {
          if (existing.kind === "SUPPLIER") {
            resolvedPartner = await tx.partner.update({
              where: { id: existing.id },
              data: { kind: "BOTH", idno: input.newCustomer.idno, address: input.newCustomer.address },
            });
          } else {
            resolvedPartner = await tx.partner.update({
              where: { id: existing.id },
              data: { idno: input.newCustomer.idno, address: input.newCustomer.address },
            });
          }
        } else {
          resolvedPartner = await tx.partner.create({
            data: { name: input.newCustomer.name, kind: "CUSTOMER", idno: input.newCustomer.idno, address: input.newCustomer.address },
          });
        }
      }
      if (!resolvedPartner || resolvedPartner.kind === "SUPPLIER") throw new Error("Clientul ales nu este valid.");
      if (!resolvedPartner.idno || !resolvedPartner.address) {
        throw new Error("Completează IDNO-ul și adresa clientului în secțiunea Parteneri.");
      }
      if (products.length !== input.lines.length) {
        throw new Error("Unul dintre produsele selectate nu mai există.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const totals = calculatePaymentTotals(input.lines, COMPANY.vatRate, COMPANY.vatPayer);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payment-account:number'))`;
      const last = await tx.paymentAccount.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });

      return tx.paymentAccount.create({
        data: {
          number: (last?.number ?? 0) + 1,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          warehouseId: warehouse.id,
          partnerId: resolvedPartner.id,
          notes: input.notes,
          customerName: resolvedPartner.name,
          customerAddress: resolvedPartner.address,
          customerIdno: resolvedPartner.idno,
          customerVatCode: resolvedPartner.vatCode,
          customerPhone: resolvedPartner.phone,
          customerEmail: resolvedPartner.email,
          customerIban: resolvedPartner.iban,
          customerBankName: resolvedPartner.bankName,
          customerBankCode: resolvedPartner.bankCode,
          totalNet: totals.net,
          totalVat: totals.vat,
          totalGross: totals.gross,
          lines: {
            create: input.lines.map((line, index) => {
              const product = productById.get(line.productId)!;
              const calculated = totals.lines[index];
              return {
                productId: product.id,
                productCode: product.externalCode,
                description: product.description,
                quantity: line.quantity,
                unitPriceGross: calculated.unitPriceGross,
                unitPriceNet: calculated.unitPriceNet,
                totalNet: calculated.net,
                totalVat: calculated.vat,
                totalGross: calculated.gross,
              };
            }),
          },
        },
      });
    });

    await logAudit(prisma, user, {
      action: "CREATE",
      entity: "PaymentAccount",
      entityId: created.id,
      summary: `Cont de plată #${created.number} emis pentru ${created.customerName} (${Number(created.totalGross)} lei)`,
    });

    revalidatePath("/crm");
    return { ok: true, message: `Contul de plată #${created.number} a fost emis.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markPaymentAccountPaidAction(
  _state: PaymentAccountActionState,
  formData: FormData,
): Promise<PaymentAccountActionState> {
  try {
    const user = await requirePaymentAccountWrite();
    const id = readId(formData);
    const account = await prisma.paymentAccount.findUnique({
      where: { id },
      select: { number: true, cancelledAt: true, fulfilledAt: true, paidAt: true },
    });
    if (!account) throw new Error("Contul de plată nu există.");
    assertCanMarkPaymentAccountPaid(account);

    const paidAt = new Date();
    const updated = await prisma.paymentAccount.updateMany({
      where: { id, cancelledAt: null, paidAt: null },
      data: { paidAt },
    });
    if (updated.count !== 1) throw new Error("Starea contului s-a schimbat între timp. Reîncarcă pagina.");

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "PaymentAccount",
      entityId: id,
      summary: `Cont de plată #${account.number} marcat achitat`,
    });
    revalidatePath("/crm");
    return { ok: true, message: `Contul #${account.number} a fost marcat achitat.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelPaymentAccountAction(
  _state: PaymentAccountActionState,
  formData: FormData,
): Promise<PaymentAccountActionState> {
  try {
    const user = await requirePaymentAccountWrite();
    const id = readId(formData);
    const account = await prisma.paymentAccount.findUnique({
      where: { id },
      select: { number: true, cancelledAt: true, fulfilledAt: true, paidAt: true },
    });
    if (!account) throw new Error("Contul de plată nu există.");
    assertCanCancelPaymentAccount(account);

    const cancelledAt = new Date();
    const updated = await prisma.paymentAccount.updateMany({
      where: { id, cancelledAt: null, fulfilledAt: null, paidAt: null },
      data: { cancelledAt, status: "CANCELLED" },
    });
    if (updated.count !== 1) throw new Error("Starea contului s-a schimbat între timp. Reîncarcă pagina.");

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "PaymentAccount",
      entityId: id,
      summary: `Cont de plată #${account.number} anulat`,
    });
    revalidatePath("/crm");
    return { ok: true, message: `Contul #${account.number} a fost anulat.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function fulfillPaymentAccountAction(
  _state: PaymentAccountActionState,
  formData: FormData,
): Promise<PaymentAccountActionState> {
  try {
    const user = await requirePaymentAccountWrite();
    const id = readId(formData);
    if (shouldQueueStockOperation(user.role)) {
      const account = await validatePaymentFulfillmentRequest(prisma, id);
      await enqueuePaymentFulfillmentRequest(
        user,
        { paymentAccountId: id },
        fulfillmentRequestSummary({
          number: account.number,
          customerName: account.customerName,
          totalGross: Number(account.totalGross),
        }),
      );
      revalidatePath("/crm");
      return {
        ok: true,
        message:
          "Cererea de predare a fost trimisă spre aprobare. Stocul nu a fost modificat.",
      };
    }

    const result = await prisma.$transaction((tx) =>
      executePaymentAccountFulfillment(tx, user, id),
    );
    revalidatePath("/crm");
    return {
      ok: true,
      message: `Marfa a fost predată. Vânzarea #${result.saleNumber} a fost creată din contul #${result.accountNumber}.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function submitPaymentAccountToEFacturaAction(
  _state: PaymentAccountActionState,
  formData: FormData,
): Promise<PaymentAccountActionState> {
  try {
    const user = await requirePaymentAccountFiscalWrite();
    const id = readId(formData);
    const account = await prisma.paymentAccount.findUnique({
      where: { id },
      include: { lines: { orderBy: { createdAt: "asc" } } },
    });

    if (!account) throw new Error("Contul de plată nu există.");
    if (account.cancelledAt) throw new Error("Contul de plată este anulat.");
    if (!account.fulfilledAt) {
      throw new Error("Factura poate fi trimisă numai după predarea mărfii.");
    }
    if (account.eFacturaStatus === "SUBMITTED") {
      throw new Error("Factura a fost deja trimisă către SIA e-Factura.");
    }

    const xml = buildPaymentAccountEFacturaXml({
      ...account,
      lines: account.lines.map((line) => ({
        ...line,
        unitPriceNet: Number(line.unitPriceNet),
        totalNet: Number(line.totalNet),
        totalVat: Number(line.totalVat),
        totalGross: Number(line.totalGross),
      })),
    });
    const requestId = randomUUID();
    const claimed = await prisma.paymentAccount.updateMany({
      where: {
        id,
        eFacturaStatus: account.eFacturaStatus,
        eFacturaRequestId: account.eFacturaRequestId,
      },
      data: {
        eFacturaStatus: "NOT_SENT",
        eFacturaRequestId: requestId,
        eFacturaResponseCode: null,
        eFacturaMessage: null,
        eFacturaSubmittedAt: null,
      },
    });
    if (claimed.count !== 1) {
      throw new Error("Starea transmiterii s-a schimbat între timp. Reîncarcă pagina.");
    }

    let response: Awaited<ReturnType<typeof postUnsignedInvoice>>;
    try {
      response = await postUnsignedInvoice(xml, { requestId });
    } catch (error) {
      const message = publicEFacturaError(error);
      await prisma.paymentAccount.updateMany({
        where: { id, eFacturaRequestId: requestId },
        data: {
          eFacturaStatus: "ERROR",
          eFacturaMessage: message.slice(0, 1000),
          eFacturaSubmittedAt: null,
        },
      });
      throw new Error(message);
    }

    const success = response.status === 1 || response.status === 2;
    const message = response.errorMessage ?? (
      response.status === 1
        ? "Cererea a fost acceptată pentru executare."
        : response.status === 2
          ? "Factura a fost procesată cu succes."
          : `SIA e-Factura a returnat statutul ${response.status}.`
    );
    const stored = await prisma.paymentAccount.updateMany({
      where: { id, eFacturaRequestId: requestId },
      data: {
        eFacturaStatus: success ? "SUBMITTED" : "ERROR",
        eFacturaRequestId: response.requestId,
        eFacturaResponseCode: response.status,
        eFacturaMessage: message.slice(0, 1000),
        eFacturaSubmittedAt: success ? new Date() : null,
      },
    });
    if (stored.count !== 1) {
      throw new Error("Răspunsul e-Factura a fost primit, dar starea locală nu a putut fi salvată.");
    }

    if (!success) {
      revalidatePath("/crm");
      return { ok: false, message };
    }

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "PaymentAccount",
      entityId: id,
      summary: `Cont de plată #${account.number} trimis nesemnat către SIA e-Factura`,
    });
    revalidatePath("/crm");
    return {
      ok: true,
      message: `Contul #${account.number} a fost transmis. Semnează factura în SIA e-Factura.`,
    };
  } catch (error) {
    revalidatePath("/crm");
    return toActionError(error);
  }
}

async function requirePaymentAccountWrite() {
  const user = await requireCurrentAppUser();
  if (!canCreateSales(user.role)) throw new Error("Nu ai drepturi pentru emiterea conturilor de plată.");
  return user;
}

async function requirePaymentAccountFiscalWrite() {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    throw new Error("Numai administratorul sau directorul poate transmite către e-Factura.");
  }
  return user;
}

function readId(formData: FormData) {
  const value = formData.get("paymentAccountId");
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) throw new Error("Lipsește contul de plată.");
  return id;
}

function toActionError(error: unknown): PaymentAccountActionState {
  return error instanceof Error ? { ok: false, message: error.message } : INITIAL_ERROR;
}

function publicEFacturaError(error: unknown) {
  if (!(error instanceof Error)) return "Transmiterea către SIA e-Factura a eșuat.";
  const message = error.message.replace(/[\r\n]+/g, " ").trim();
  return message || "Transmiterea către SIA e-Factura a eșuat.";
}
