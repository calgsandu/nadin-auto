import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";
import { monthBounds, monthLabel, recentMonths } from "@/lib/finance/months";
import { getAccountBalances } from "@/lib/finance/balances";
import { isPeriodClosed, listClosedPeriods } from "@/lib/finance/period-lock";

/**
 * Bilanțul unei luni, adus într-un singur ecran ca să poată fi închisă în
 * cunoștință de cauză: cât s-a vândut, ce TVA a ieșit, cât s-a cheltuit, cât a
 * rămas în conturi și ce a mai rămas nelămurit.
 */
export async function getMonthCloseData(month?: string) {
  const { start, end, key } = monthBounds(month);

  const [sales, returns, expenses, accounts, missingMethod, periods, closed] =
    await Promise.all([
      prisma.stockDocument.aggregate({
        where: { type: "SALE", documentDate: { gte: start, lt: end } },
        _count: true,
        _sum: { totalLei: true },
      }),
      prisma.stockDocument.aggregate({
        where: { type: "RETURN", documentDate: { gte: start, lt: end } },
        _count: true,
        _sum: { totalLei: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: start, lt: end } },
        _count: true,
        _sum: { amountLei: true },
      }),
      // Soldurile la sfârșitul lunii, nu de azi: o lună închisă în octombrie
      // trebuie să arate banii care erau în casă pe 30 septembrie.
      getAccountBalances(new Date(end.getTime() - 1)),
      prisma.stockDocument.count({
        where: {
          type: "SALE",
          documentDate: { gte: start, lt: end },
          paymentMethod: null,
        },
      }),
      listClosedPeriods(),
      isPeriodClosed(key),
    ]);

  const salesLei = Number(sales._sum.totalLei ?? 0);
  const returnsLei = Number(returns._sum.totalLei ?? 0);
  const netLei = salesLei - returnsLei;
  const expensesLei = Number(expenses._sum.amountLei ?? 0);

  return {
    month: key,
    monthLabel: monthLabel(key),
    months: recentMonths(),
    closed,
    periods,
    salesCount: sales._count,
    salesLei,
    returnsCount: returns._count,
    returnsLei,
    netLei,
    vat: COMPANY.vatPayer ? vatFromGross(netLei) : null,
    expensesCount: expenses._count,
    expensesLei,
    /** Adaosul nu se poate ști fără costuri pe linie; profitul brut al lunii. */
    resultLei: netLei - expensesLei,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      balanceLei: account.balanceLei,
    })),
    warnings: [
      missingMethod > 0
        ? `${missingMethod} vânzări fără metodă de plată — nu se știe dacă banii au intrat în casă sau în bancă.`
        : null,
    ].filter((warning): warning is string => warning !== null),
  };
}

export type MonthCloseData = Awaited<ReturnType<typeof getMonthCloseData>>;
