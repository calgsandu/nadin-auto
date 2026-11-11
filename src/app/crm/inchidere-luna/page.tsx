import { Suspense } from "react";
import { HandCoins, Landmark, Percent, Scale, ShoppingCart } from "lucide-react";
import { getMonthCloseData, type MonthCloseData } from "@/lib/finance/month-close";
import { crmMonthCloseHref } from "@/lib/crm/urls";
import { canManageStaff } from "@/lib/roles";
import { CloseMonthForm, ReopenMonthForm } from "@/app/periods/period-buttons";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  DailyMetric,
  ExportLink,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
} from "../_components/ui";
import { formatDate, formatMoney, formatNumber } from "../_components/format";
import { MonthNav } from "../_components/month-nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MonthClosePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const appUser = await requireCrmSection("inchidere-luna");
  const params = await searchParams;
  const dataPromise = getMonthCloseData(params.month);

  return (
    <>
      <CrmHeader section="inchidere-luna" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={8} />}>
        <Loader dataPromise={dataPromise} isAdmin={canManageStaff(appUser.role)} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  isAdmin,
}: {
  dataPromise: Promise<MonthCloseData>;
  isAdmin: boolean;
}) {
  return <MonthCloseWorkspace data={await dataPromise} isAdmin={isAdmin} />;
}

function MonthCloseWorkspace({ data, isAdmin }: { data: MonthCloseData; isAdmin: boolean }) {
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav month={data.month} hrefFor={(month) => crmMonthCloseHref({ month })} />
        <ExportLink href={`/api/export/luna?month=${data.month}`} label="Dosar pentru contabil" />
      </div>

      <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
        <DailyMetric
          icon={ShoppingCart}
          label="Vânzări nete"
          value={`${formatMoney(data.netLei)} lei`}
          hint={`${formatNumber(data.salesCount)} vânzări, ${formatNumber(data.returnsCount)} retururi`}
        />
        <DailyMetric
          icon={Percent}
          label="TVA de plată"
          value={data.vat ? `${formatMoney(data.vat.tva)} lei` : "—"}
          hint={data.vat ? "din vânzările nete" : "firma nu e plătitoare de TVA"}
        />
        <DailyMetric
          icon={HandCoins}
          label="Cheltuieli"
          value={`${formatMoney(data.expensesLei)} lei`}
          hint={`${formatNumber(data.expensesCount)} documente`}
        />
        <DailyMetric
          icon={Scale}
          label="Rămas după cheltuieli"
          value={`${formatMoney(data.resultLei)} lei`}
          hint="vânzări nete − cheltuieli"
        />
      </div>

      {data.accounts.length > 0 ? (
        // Câte conturi sunt, atâtea coloane: banda nu rămâne cu celule goale.
        <div
          className="stat-strip grid"
          style={{ gridTemplateColumns: `repeat(${Math.min(data.accounts.length, 4)}, minmax(0, 1fr))` }}
        >
          {data.accounts.map((account) => (
            <DailyMetric
              key={account.id}
              icon={Landmark}
              label={`Sold ${account.name}`}
              value={`${formatMoney(account.balanceLei)} lei`}
              hint="la sfârșitul lunii"
            />
          ))}
        </div>
      ) : null}

      {data.warnings.length > 0 ? (
        <div className="rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-4 py-3">
          <p className="text-sm font-semibold text-[#92400e]">De lămurit înainte de închidere</p>
          <ul className="mt-1.5 grid gap-1 text-sm text-[#92400e]">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-4">
        {data.closed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#166534]">
              {data.monthLabel} este închisă.
            </p>
            {isAdmin ? (
              <ReopenMonthForm month={data.month} label={data.monthLabel} />
            ) : (
              <p className="text-sm text-[#52525b]">
                Redeschiderea o poate face doar un administrator.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            <CloseMonthForm month={data.month} label={data.monthLabel} />
            <p className="text-[13px] text-[#52525b]">
              După închidere, documentele din lună nu se mai pot crea, edita sau șterge.
            </p>
          </div>
        )}
      </div>

      {data.periods.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
          <div className="border-b border-[#e4e4e7] px-4 py-3">
            <h2 className="font-semibold text-[#18181b]">Lunile închise până acum</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
                <tr>
                  <TableHead>Luna</TableHead>
                  <TableHead>Stare</TableHead>
                  <TableHead secondary>Închisă de</TableHead>
                  <TableHead secondary>Notă</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((period) => (
                  <tr key={period.id} className="motion-table-row border-t border-[#f0f0f2] align-top">
                    <TableCell className="font-semibold capitalize">{period.label}</TableCell>
                    <TableCell>
                      {period.locked ? (
                        <span className="font-semibold text-[#166534]">Închisă</span>
                      ) : (
                        <span className="text-[#52525b]">
                          Redeschisă {period.reopenedAt ? formatDate(period.reopenedAt) : ""}
                          {period.reopenedByName ? ` de ${period.reopenedByName}` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {period.closedByName ?? "—"}
                      <span className="mt-0.5 block text-xs text-[#71717a]">
                        {formatDate(period.closedAt)}
                      </span>
                    </TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {period.note ?? "—"}
                      {period.reopenNote ? (
                        <span className="mt-0.5 block text-xs text-[#71717a]">
                          Redeschisă: {period.reopenNote}
                        </span>
                      ) : null}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
