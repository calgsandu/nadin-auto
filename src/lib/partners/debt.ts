import { prisma } from "@/lib/prisma";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";

/** Marfa a plecat, banii se sting printr-o încasare separată. */
const OPEN_METHODS = ["CREDIT", "TRANSFER"] as const;

/**
 * Soldul unui partener („Долг" din 1C):
 *   vânzări predate fără încasare pe loc − retururile lor − încasările scrise.
 *
 * CREDIT și TRANSFER intră amândouă: la transfer marfa pleacă înainte (sau
 * odată cu) banii, iar banii se scriu ca `PartnerPayment` — dacă transferul
 * n-ar intra aici, un cont de plată achitat în avans ar lăsa clientul cu sold
 * negativ pe veci. Cash/card se sting pe loc, deci nu produc sold.
 */
export async function getPartnerBalances(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ partnerId: string; balance: number | string }>>`
    SELECT partner_id AS "partnerId", SUM(amount)::float8 AS balance
    FROM (
      SELECT d."partnerId" AS partner_id, COALESCE(d."totalLei", 0) AS amount
        FROM "StockDocument" d
       WHERE d.type = 'SALE' AND d."paymentMethod"::text = ANY(${[...OPEN_METHODS]}) AND d."partnerId" IS NOT NULL
      UNION ALL
      SELECT s."partnerId", -COALESCE(r."totalLei", 0)
        FROM "StockDocument" r
        JOIN "StockDocument" s ON s.id = r."sourceDocumentId"
       WHERE r.type = 'RETURN' AND s."paymentMethod"::text = ANY(${[...OPEN_METHODS]}) AND s."partnerId" IS NOT NULL
      UNION ALL
      SELECT p."partnerId", -p.amount FROM "PartnerPayment" p
    ) ledger
    GROUP BY partner_id
  `;

  return new Map(
    rows.map((row) => [row.partnerId, Math.round(Number(row.balance) * 100) / 100]),
  );
}

/** O mișcare din fișa partenerului. `+` crește datoria, `−` o scade. */
export type PartnerLedgerEntry = {
  id: string;
  kind: "SALE" | "RETURN" | "PAYMENT";
  date: Date;
  label: string;
  amountLei: number;
};

const LEDGER_LIMIT = 50;

type ReturnRow = {
  id: string;
  number: number;
  documentDate: Date;
  totalLei: number;
  saleNumber: number;
};

/**
 * Mișcările care compun soldul unui partener, pentru fișa lui.
 *
 * Până acum funcția n-avea niciun apelant: vedeai soldul, dar nu și din ce e
 * făcut, deci o cifră care nu-ți convenea nu putea fi urmărită nicăieri.
 */
export async function getPartnerLedger(partnerId: string) {
  const [openSales, returns, payments] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "SALE", paymentMethod: { in: [...OPEN_METHODS] }, partnerId },
      select: { id: true, number: true, documentDate: true, totalLei: true, paymentMethod: true },
      orderBy: { documentDate: "desc" },
      take: LEDGER_LIMIT,
    }),
    // `sourceDocumentId` n-are relație Prisma, deci legătura retur↔vânzare se
    // face în SQL — la fel ca în soldul de mai sus.
    prisma.$queryRaw<ReturnRow[]>`
      SELECT r.id, r.number, r."documentDate" AS "documentDate",
             COALESCE(r."totalLei", 0)::float8 AS "totalLei",
             s.number AS "saleNumber"
        FROM "StockDocument" r
        JOIN "StockDocument" s ON s.id = r."sourceDocumentId"
       WHERE r.type = 'RETURN'
         AND s."partnerId" = ${partnerId}
         AND s."paymentMethod"::text = ANY(${[...OPEN_METHODS]})
       ORDER BY r."documentDate" DESC
       LIMIT ${LEDGER_LIMIT}`,
    prisma.partnerPayment.findMany({
      where: { partnerId },
      select: { id: true, amount: true, paidAt: true, notes: true },
      orderBy: { paidAt: "desc" },
      take: LEDGER_LIMIT,
    }),
  ]);

  const entries: PartnerLedgerEntry[] = [
    ...openSales.map((sale) => ({
      id: sale.id,
      kind: "SALE" as const,
      date: sale.documentDate,
      label: `Vânzare #${sale.number} · ${salePaymentMethodLabel(sale.paymentMethod)}`,
      amountLei: Number(sale.totalLei ?? 0),
    })),
    ...returns.map((entry) => ({
      id: entry.id,
      kind: "RETURN" as const,
      date: entry.documentDate,
      label: `Retur #${entry.number} la vânzarea #${entry.saleNumber}`,
      amountLei: -entry.totalLei,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      kind: "PAYMENT" as const,
      date: payment.paidAt,
      label: payment.notes?.trim() || "Încasare",
      amountLei: -Number(payment.amount),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return { entries };
}
