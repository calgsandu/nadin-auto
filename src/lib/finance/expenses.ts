import type { ExpenseCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { expenseCategoryLabel, isExpenseCategory } from "@/lib/finance/categories";
import { monthBounds, monthLabel, recentMonths } from "@/lib/finance/months";

export const EXPENSES_PAGE_SIZE = 30;

export type ExpenseFilters = {
  /** Luna afișată, „YYYY-MM". Lipsă = luna curentă. */
  month?: string;
  category?: string;
  epage?: string;
};

export type ExpenseRow = {
  id: string;
  number: number;
  date: Date;
  category: ExpenseCategory;
  categoryLabel: string;
  amountLei: number;
  description: string;
  partnerId: string | null;
  partnerName: string | null;
  accountId: string;
  accountName: string;
  notes: string | null;
  createdByName: string | null;
};

export type MoneyAccountOption = {
  id: string;
  name: string;
  kind: "CASH" | "BANK";
};

export async function listMoneyAccounts(): Promise<MoneyAccountOption[]> {
  const select = { id: true, name: true, kind: true } as const;
  const orderBy = [{ kind: "asc" as const }, { name: "asc" as const }];

  const accounts = await prisma.moneyAccount.findMany({ where: { active: true }, select, orderBy });
  if (accounts.length > 0) return accounts;

  // Începutul zilei, nu clipa creării: cheltuielile se datează la prânz, iar o
  // dată de pornire „azi, 15:59" le-ar fi tăiat din sold pe cele din aceeași zi.
  const openingDate = new Date();
  openingDate.setHours(0, 0, 0, 0);
  await prisma.moneyAccount.createMany({
    data: [
      { name: "Casa", kind: "CASH", openingDate, openingBalanceLei: 0 },
      { name: "Cont curent", kind: "BANK", openingDate, openingBalanceLei: 0 },
    ],
    skipDuplicates: true,
  });

  return prisma.moneyAccount.findMany({ where: { active: true }, select, orderBy });
}

/**
 * Cheltuielile unei luni: lista paginată, totalul lunii și defalcarea pe
 * categorii. Totalurile se cer bazei de date pe TOATĂ luna, nu pe pagina
 * afișată — altfel „total" ar însemna „total pe primele 30 de rânduri".
 */
export async function getExpensesData(filters: ExpenseFilters = {}) {
  const { start, end, key } = monthBounds(filters.month);
  const category =
    filters.category && isExpenseCategory(filters.category) ? filters.category : undefined;
  const page = Math.max(1, Number(filters.epage) || 1);

  const where = { date: { gte: start, lt: end }, ...(category ? { category } : {}) };

  const [rows, total, byCategory, monthTotal, accounts] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (page - 1) * EXPENSES_PAGE_SIZE,
      take: EXPENSES_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        date: true,
        category: true,
        amountLei: true,
        description: true,
        partnerId: true,
        accountId: true,
        notes: true,
        createdByName: true,
        partner: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { date: { gte: start, lt: end } },
      _sum: { amountLei: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amountLei: true },
    }),
    listMoneyAccounts(),
  ]);

  const expenses: ExpenseRow[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    date: row.date,
    category: row.category,
    categoryLabel: expenseCategoryLabel(row.category),
    amountLei: Number(row.amountLei),
    description: row.description,
    partnerId: row.partnerId,
    partnerName: row.partner?.name ?? null,
    accountId: row.accountId,
    accountName: row.account.name,
    notes: row.notes,
    createdByName: row.createdByName,
  }));

  return {
    month: key,
    monthLabel: monthLabel(key),
    months: recentMonths(),
    category: category ?? null,
    expenses,
    page,
    pageCount: Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE)),
    total,
    monthTotalLei: Number(monthTotal._sum.amountLei ?? 0),
    byCategory: byCategory
      .map((group) => ({
        category: group.category,
        label: expenseCategoryLabel(group.category),
        count: group._count,
        amountLei: Number(group._sum.amountLei ?? 0),
      }))
      .sort((a, b) => b.amountLei - a.amountLei),
    accounts,
  };
}

export type ExpensesData = Awaited<ReturnType<typeof getExpensesData>>;

/** Cheltuielile lunii precedente, pentru butonul „Copiază luna trecută". */
export async function getPreviousMonthExpenses(month?: string) {
  const { start } = monthBounds(month);
  const previous = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const previousEnd = start;

  const rows = await prisma.expense.findMany({
    where: { date: { gte: previous, lt: previousEnd } },
    orderBy: [{ category: "asc" }, { number: "asc" }],
    select: {
      category: true,
      amountLei: true,
      description: true,
      partnerId: true,
      accountId: true,
      notes: true,
    },
  });

  return rows.map((row) => ({
    category: row.category,
    amountLei: Number(row.amountLei),
    description: row.description,
    partnerId: row.partnerId,
    accountId: row.accountId,
    notes: row.notes,
  }));
}

export { monthBounds, monthLabel, recentMonths } from "@/lib/finance/months";
