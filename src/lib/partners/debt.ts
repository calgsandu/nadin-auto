import { prisma } from "@/lib/prisma";

/**
 * Soldul unui partener („Долг" din 1C):
 *   vânzări predate pe datorie − retururile lor − încasările înregistrate.
 * Vânzările cash/card nu produc datorie, deci nu intră în calcul.
 */
export async function getPartnerBalances(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ partnerId: string; balance: number | string }>>`
    SELECT partner_id AS "partnerId", SUM(amount)::float8 AS balance
    FROM (
      SELECT d."partnerId" AS partner_id, COALESCE(d."totalLei", 0) AS amount
        FROM "StockDocument" d
       WHERE d.type = 'SALE' AND d."paymentMethod" = 'CREDIT' AND d."partnerId" IS NOT NULL
      UNION ALL
      SELECT s."partnerId", -COALESCE(r."totalLei", 0)
        FROM "StockDocument" r
        JOIN "StockDocument" s ON s.id = r."sourceDocumentId"
       WHERE r.type = 'RETURN' AND s."paymentMethod" = 'CREDIT' AND s."partnerId" IS NOT NULL
      UNION ALL
      SELECT p."partnerId", -p.amount FROM "PartnerPayment" p
    ) ledger
    GROUP BY partner_id
  `;

  return new Map(
    rows.map((row) => [row.partnerId, Math.round(Number(row.balance) * 100) / 100]),
  );
}

/** Mișcările care compun soldul unui partener, pentru fișa lui. */
export async function getPartnerLedger(partnerId: string) {
  const [creditSales, payments] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "SALE", paymentMethod: "CREDIT", partnerId },
      select: { id: true, number: true, documentDate: true, totalLei: true },
      orderBy: { documentDate: "desc" },
      take: 50,
    }),
    prisma.partnerPayment.findMany({
      where: { partnerId },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
  ]);

  return { creditSales, payments };
}
