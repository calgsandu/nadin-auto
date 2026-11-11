import { Suspense } from "react";
import Link from "next/link";
import { Calculator, HandCoins, PieChart } from "lucide-react";
import { getExpensesData, type ExpensesData } from "@/lib/finance/expenses";
import { crmExpensesHref } from "@/lib/crm/urls";
import { prisma } from "@/lib/prisma";
import { ExpenseDialog } from "@/app/expenses/expense-dialog";
import { ExpenseDeleteButton } from "@/app/expenses/expense-delete-button";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  DailyMetric,
  Pagination,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
  segmentCls,
  segmentedCls,
} from "../_components/ui";
import { MonthNav } from "../_components/month-nav";
import { RowMenu } from "@/app/components/row-menu";
import { formatDate, formatMoney, formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = { month?: string; category?: string; epage?: string };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const appUser = await requireCrmSection("cheltuieli");
  const params = await searchParams;
  const dataPromise = getExpensesData(params);
  const partnersPromise = prisma.partner.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <CrmHeader section="cheltuieli" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={12} />}>
        <Loader dataPromise={dataPromise} partnersPromise={partnersPromise} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  partnersPromise,
}: {
  dataPromise: Promise<ExpensesData>;
  partnersPromise: Promise<{ id: string; name: string }[]>;
}) {
  const [data, partners] = await Promise.all([dataPromise, partnersPromise]);
  return <ExpensesWorkspace data={data} partners={partners} />;
}

function ExpensesWorkspace({
  data,
  partners,
}: {
  data: ExpensesData;
  partners: { id: string; name: string }[];
}) {
  const biggest = data.byCategory[0];

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav
          month={data.month}
          hrefFor={(month) => crmExpensesHref({ month, category: data.category ?? undefined })}
        />
        <ExpenseDialog accounts={data.accounts} partners={partners} trigger="Cheltuială nouă" />
      </div>

      <div className="stat-strip grid grid-cols-2 lg:grid-cols-3">
        <DailyMetric
          icon={HandCoins}
          label="Total pe lună"
          value={`${formatMoney(data.monthTotalLei)} lei`}
          hint={`${formatNumber(data.total)} cheltuieli`}
        />
        <DailyMetric
          icon={PieChart}
          label="Cea mai mare categorie"
          value={biggest ? `${formatMoney(biggest.amountLei)} lei` : "—"}
          hint={biggest?.label}
        />
        <DailyMetric
          icon={Calculator}
          label="Medie pe cheltuială"
          value={data.total > 0 ? `${formatMoney(data.monthTotalLei / data.total)} lei` : "—"}
        />
      </div>

      {data.byCategory.length > 1 ? (
        <div className={segmentedCls}>
          <Link
            href={crmExpensesHref({ month: data.month })}
            className={segmentCls(data.category === null)}
          >
            Toate
          </Link>
          {data.byCategory.map((group) => (
            <Link
              key={group.category}
              href={crmExpensesHref({ month: data.month, category: group.category })}
              className={segmentCls(group.category === data.category)}
            >
              {group.label}{" "}
              <span className="tabular-nums opacity-70">{formatMoney(group.amountLei)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <tr>
                <TableHead>Nr.</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descriere</TableHead>
                <TableHead secondary>Categorie</TableHead>
                <TableHead secondary>Plătit din</TableHead>
                <TableHead secondary>Către</TableHead>
                <TableHead align="right">Suma</TableHead>
                <TableHead align="right">Acțiuni</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.expenses.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-[#52525b]" colSpan={8}>
                    Nicio cheltuială în {data.monthLabel}.
                  </td>
                </tr>
              ) : (
                data.expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="motion-table-row border-t border-[#f0f0f2] hover:bg-[#f4f4f5]"
                  >
                    <TableCell className="tabular-nums text-[#52525b]">{expense.number}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(expense.date)}</TableCell>
                    <TableCell className="font-medium">
                      {expense.description}
                      {expense.notes ? (
                        <span className="block text-[13px] text-[#52525b]">{expense.notes}</span>
                      ) : null}
                    </TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {expense.categoryLabel}
                    </TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {expense.accountName}
                    </TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {expense.partnerName ?? "—"}
                    </TableCell>
                    <TableCell align="right" className="font-semibold tabular-nums">
                      {formatMoney(expense.amountLei)}
                    </TableCell>
                    <TableCell align="right">
                      <RowMenu label={expense.description}>
                        <ExpenseDialog
                          accounts={data.accounts}
                          partners={partners}
                          trigger="Editează"
                          title={`Cheltuiala #${expense.number}`}
                          defaults={{
                            id: expense.id,
                            date: toDateInput(expense.date),
                            category: expense.category,
                            amountLei: expense.amountLei,
                            description: expense.description,
                            partnerId: expense.partnerId,
                            accountId: expense.accountId,
                            notes: expense.notes,
                          }}
                        />
                        <ExpenseDeleteButton
                          expenseId={expense.id}
                          label={expense.description}
                        />
                      </RowMenu>
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        hrefFor={(target) =>
          crmExpensesHref({ month: data.month, category: data.category ?? undefined, epage: target })
        }
      />
    </section>
  );
}

/** `Date` → valoarea unui `<input type="date">`, în fusul serverului. */
function toDateInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
