import { prisma } from "@/lib/prisma";

export type PayableReceipt = {
  id: string;
  number: number;
  documentDate: Date;
  dueDate: Date | null;
  externalNumber: string | null;
  totalLei: number;
  paidLei: number;
  remainingLei: number;
  /** Scadența a trecut și mai e ceva de plătit. */
  overdue: boolean;
};

export type PayableSupplier = {
  partnerId: string;
  partnerName: string;
  phone: string | null;
  balanceLei: number;
  receipts: PayableReceipt[];
};

/**
 * Repartizează plățile pe recepții, cea mai veche întâi.
 *
 * `PartnerPayment` nu ține de un document anume — plătești furnizorului o sumă,
 * nu o factură. Regula „cea mai veche întâi" e cea folosită și la ghișeu, și
 * singura care nu cere ca operatorul să bifeze facturi la fiecare plată.
 */
export function allocatePayments<T extends { totalLei: number }>(
  receipts: T[],
  paidTotal: number,
): (T & { paidLei: number; remainingLei: number })[] {
  let left = paidTotal;

  return receipts.map((receipt) => {
    const paidLei = Math.min(Math.max(left, 0), receipt.totalLei);
    left -= paidLei;
    return {
      ...receipt,
      paidLei: round(paidLei),
      remainingLei: round(receipt.totalLei - paidLei),
    };
  });
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Ce datorăm furnizorilor, defalcat pe recepții. Sunt listați doar partenerii
 * cu sold pozitiv: cei plătiți la zi n-au ce căuta într-o listă de plătit.
 */
export async function getPayablesData(): Promise<{
  suppliers: PayableSupplier[];
  totalLei: number;
  overdueLei: number;
  dueThisWeekLei: number;
}> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [receipts, payments] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "RECEIPT", partnerId: { not: null }, totalLei: { gt: 0 } },
      orderBy: { documentDate: "asc" },
      select: {
        id: true,
        number: true,
        documentDate: true,
        dueDate: true,
        externalNumber: true,
        totalLei: true,
        partnerId: true,
        partner: { select: { name: true, phone: true } },
      },
    }),
    prisma.partnerPayment.groupBy({
      by: ["partnerId"],
      where: { direction: "OUT" },
      _sum: { amount: true },
    }),
  ]);

  const paidByPartner = new Map(
    payments.map((row) => [row.partnerId, Number(row._sum.amount ?? 0)]),
  );

  const byPartner = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const list = byPartner.get(receipt.partnerId!) ?? [];
    list.push(receipt);
    byPartner.set(receipt.partnerId!, list);
  }

  const suppliers: PayableSupplier[] = [];
  for (const [partnerId, list] of byPartner) {
    const allocated = allocatePayments(
      list.map((receipt) => ({ ...receipt, totalLei: Number(receipt.totalLei ?? 0) })),
      paidByPartner.get(partnerId) ?? 0,
    );

    const unpaid = allocated
      .filter((receipt) => receipt.remainingLei > 0.005)
      .map((receipt) => ({
        id: receipt.id,
        number: receipt.number,
        documentDate: receipt.documentDate,
        dueDate: receipt.dueDate,
        externalNumber: receipt.externalNumber,
        totalLei: receipt.totalLei,
        paidLei: receipt.paidLei,
        remainingLei: receipt.remainingLei,
        overdue: receipt.dueDate !== null && receipt.dueDate < now,
      }));

    if (unpaid.length === 0) continue;

    suppliers.push({
      partnerId,
      partnerName: list[0].partner?.name ?? "—",
      phone: list[0].partner?.phone ?? null,
      balanceLei: round(unpaid.reduce((sum, receipt) => sum + receipt.remainingLei, 0)),
      receipts: unpaid,
    });
  }

  // Cine trebuie plătit primul: scadența cea mai apropiată, apoi suma cea mai mare.
  suppliers.sort((a, b) => {
    const dueA = earliestDue(a);
    const dueB = earliestDue(b);
    if (dueA !== dueB) return dueA - dueB;
    return b.balanceLei - a.balanceLei;
  });

  const all = suppliers.flatMap((supplier) => supplier.receipts);

  return {
    suppliers,
    totalLei: round(all.reduce((sum, receipt) => sum + receipt.remainingLei, 0)),
    overdueLei: round(
      all.filter((receipt) => receipt.overdue).reduce((sum, r) => sum + r.remainingLei, 0),
    ),
    dueThisWeekLei: round(
      all
        .filter((receipt) => receipt.dueDate !== null && receipt.dueDate <= weekEnd)
        .reduce((sum, receipt) => sum + receipt.remainingLei, 0),
    ),
  };
}

/** Cea mai apropiată scadență a unui furnizor; fără scadență = la coadă. */
function earliestDue(supplier: PayableSupplier) {
  const dates = supplier.receipts
    .map((receipt) => receipt.dueDate?.getTime())
    .filter((time): time is number => time !== undefined);
  return dates.length > 0 ? Math.min(...dates) : Number.POSITIVE_INFINITY;
}

export type PayablesData = Awaited<ReturnType<typeof getPayablesData>>;
