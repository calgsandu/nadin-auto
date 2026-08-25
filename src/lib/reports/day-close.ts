import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";
import type { SalePaymentMethodStatus } from "@/lib/operations/sale-payment-method";

type MethodRow = {
  method: string | null;
  cnt: number;
  total_lei: number;
};

type CashRow = {
  cash_registered: boolean | null;
  cnt: number;
  total_lei: number;
};

export type DayCloseSale = {
  id: string;
  number: number;
  time: string;
  partnerName: string | null;
  totalLei: number;
  paymentMethod: SalePaymentMethodStatus;
  cashRegistered: boolean | null;
};

const timeFormat = new Intl.DateTimeFormat("ro-MD", {
  hour: "2-digit",
  minute: "2-digit",
});

function dayBounds(dayParam?: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? "")
    ? new Date(`${dayParam}T00:00:00`)
    : null;
  const start = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Închiderea de zi: cât s-a vândut, prin ce metodă de plată, cât a intrat efectiv
 * în casă și cât din vânzări a fost bătut la casa de marcat.
 *
 * Totalul unui document e `totalLei`, cu `totalEuro` ca rezervă pentru
 * documentele vechi — aceeași regulă ca în restul rapoartelor.
 */
export async function getDayCloseData(dayParam?: string) {
  const { start, end } = dayBounds(dayParam);

  const [byMethod, byCashRegister, returns, partnerPayments, sales] = await Promise.all([
    prisma.$queryRaw<MethodRow[]>`
      SELECT "paymentMethod"::text AS method,
             COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE("totalLei", "totalEuro")), 0)::float8 AS total_lei
      FROM "StockDocument"
      WHERE type = 'SALE' AND "documentDate" >= ${start} AND "documentDate" < ${end}
      GROUP BY "paymentMethod"`,

    prisma.$queryRaw<CashRow[]>`
      SELECT "cashRegistered" AS cash_registered,
             COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE("totalLei", "totalEuro")), 0)::float8 AS total_lei
      FROM "StockDocument"
      WHERE type = 'SALE' AND "documentDate" >= ${start} AND "documentDate" < ${end}
      GROUP BY "cashRegistered"`,

    prisma.$queryRaw<{ cnt: number; total_lei: number }[]>`
      SELECT COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE("totalLei", "totalEuro")), 0)::float8 AS total_lei
      FROM "StockDocument"
      WHERE type = 'RETURN' AND "documentDate" >= ${start} AND "documentDate" < ${end}`,

    prisma.partnerPayment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { id: true, amount: true, notes: true, partner: { select: { name: true } } },
      orderBy: { paidAt: "asc" },
    }),

    prisma.stockDocument.findMany({
      where: { type: "SALE", documentDate: { gte: start, lt: end } },
      select: {
        id: true,
        number: true,
        documentDate: true,
        totalLei: true,
        totalEuro: true,
        paymentMethod: true,
        cashRegistered: true,
        partner: { select: { name: true } },
      },
      orderBy: [{ documentDate: "asc" }, { number: "asc" }],
    }),
  ]);

  const method = (name: string) => byMethod.find((row) => row.method === name);
  const cash = method("CASH");
  const card = method("CARD");
  const credit = method("CREDIT");
  const unspecified = byMethod.find((row) => row.method === null);

  const salesTotal = byMethod.reduce((sum, row) => sum + row.total_lei, 0);
  const salesCount = byMethod.reduce((sum, row) => sum + row.cnt, 0);
  const registered = byCashRegister.find((row) => row.cash_registered === true);
  const notRegistered = byCashRegister.find((row) => row.cash_registered === false);
  const undeclared = byCashRegister.find((row) => row.cash_registered === null);
  const collectedFromPartners = partnerPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const returnsTotal = returns[0]?.total_lei ?? 0;

  // Bani intrați efectiv azi: numerarul din vânzări + încasările pe datorii vechi.
  // Vânzările pe credit nu intră — marfa a plecat, banii nu au venit.
  const cashInHand = (cash?.total_lei ?? 0) + collectedFromPartners - returnsTotal;

  return {
    dayKey: dayKeyOf(start),
    salesCount,
    salesTotal,
    methods: {
      cash: { count: cash?.cnt ?? 0, lei: cash?.total_lei ?? 0 },
      card: { count: card?.cnt ?? 0, lei: card?.total_lei ?? 0 },
      credit: { count: credit?.cnt ?? 0, lei: credit?.total_lei ?? 0 },
      unspecified: { count: unspecified?.cnt ?? 0, lei: unspecified?.total_lei ?? 0 },
    },
    cashRegister: {
      registered: { count: registered?.cnt ?? 0, lei: registered?.total_lei ?? 0 },
      notRegistered: { count: notRegistered?.cnt ?? 0, lei: notRegistered?.total_lei ?? 0 },
      undeclared: { count: undeclared?.cnt ?? 0, lei: undeclared?.total_lei ?? 0 },
    },
    returnsCount: returns[0]?.cnt ?? 0,
    returnsLei: returnsTotal,
    collectedFromPartners,
    cashInHand,
    netLei: salesTotal - returnsTotal,
    vat: COMPANY.vatPayer ? vatFromGross(salesTotal - returnsTotal) : null,
    partnerPayments: partnerPayments.map((payment) => ({
      id: payment.id,
      partnerName: payment.partner.name,
      amountLei: Number(payment.amount),
      notes: payment.notes,
    })),
    sales: sales.map((sale): DayCloseSale => ({
      id: sale.id,
      number: sale.number,
      time: timeFormat.format(sale.documentDate),
      partnerName: sale.partner?.name ?? null,
      totalLei: Number(sale.totalLei ?? sale.totalEuro ?? 0),
      paymentMethod: sale.paymentMethod,
      cashRegistered: sale.cashRegistered,
    })),
  };
}

export type DayCloseData = Awaited<ReturnType<typeof getDayCloseData>>;
