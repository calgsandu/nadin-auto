import { prisma } from "@/lib/prisma";
import { getSalesDayData } from "@/lib/operations/queries";
import { getPendingApprovalCount } from "@/lib/audit/queries";
import { canReviewOperations, canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";

/** Comenzile la furnizori care încă așteaptă ceva (nu sunt livrate sau anulate). */
const OPEN_EXTERNAL_ORDER = ["CERERE", "OFERTAT", "CONFIRMAT", "RECEPTIONAT"] as const;

/**
 * Datele paginii Azi: vânzările zilei și cozile care cer o mână de om.
 * Fiecare contor se citește doar dacă rolul poate deschide secțiunea lui,
 * altfel ar apărea în „De făcut" un rând pe care nu-l poate rezolva.
 */
export async function getTodayData(role: AppRole) {
  const can = (section: Parameters<typeof canViewSection>[1]) => canViewSection(role, section);
  const zero = Promise.resolve(0);

  const [salesDay, restockPending, unpaidAccounts, openOrders, pendingApprovals] = await Promise.all([
    getSalesDayData(),
    can("de-adus")
      ? prisma.restockTask.count({
          where: { status: "PENDING", warehouse: { name: "Pavilion 110A" } },
        })
      : zero,
    can("conturi-plata")
      ? prisma.paymentAccount.count({ where: { status: "ISSUED", paidAt: null } })
      : zero,
    can("la-comanda")
      ? prisma.externalOrder.count({ where: { status: { in: [...OPEN_EXTERNAL_ORDER] } } })
      : zero,
    canReviewOperations(role) ? getPendingApprovalCount() : zero,
  ]);

  const notRegistered = salesDay.sales.filter((sale) => sale.cashRegistered !== true).length;

  return { salesDay, restockPending, unpaidAccounts, openOrders, pendingApprovals, notRegistered };
}

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;
