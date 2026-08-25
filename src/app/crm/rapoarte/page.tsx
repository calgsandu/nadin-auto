import { Suspense } from "react";
import { Download } from "lucide-react";
import { CurrencyWidget } from "@/app/rapoarte/currency-widget";
import { getReportsData, type ReportsData } from "@/lib/reports/queries";
import { canManageStaff } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatMoney, formatNumber, formatText } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReportsPage() {
  const appUser = await requireCrmSection("rapoarte");
  const canBackup = canManageStaff(appUser.role);
  const dataPromise = getReportsData();

  return (
    <>
      <CrmHeader section="rapoarte" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={6} />}>
        <Loader dataPromise={dataPromise} canBackup={canBackup} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  canBackup,
}: {
  dataPromise: Promise<ReportsData>;
  canBackup: boolean;
}) {
  const data = await dataPromise;
  return <ReportsWorkspace data={data} canBackup={canBackup} />;
}

function ReportsWorkspace({ data, canBackup }: { data: ReportsData; canBackup: boolean }) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      {canBackup ? (
        <div className="flex justify-end">
          <a
            href="/api/export/backup"
            className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            <Download className="size-4" aria-hidden="true" /> Backup complet (Excel)
          </a>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DailyMetric label="Produse" value={formatNumber(data.totalProducts)} />
        <DailyMetric label="Stoc total (buc.)" value={formatNumber(data.totalStock)} />
        <DailyMetric
          label="Valoare stoc"
          value={`${formatMoney(data.valueEur)} EUR`}
          hint={`${formatMoney(data.stockValueLei)} lei la preț de vânzare`}
        />
        <DailyMetric
          label="Vânzări 30 zile"
          value={formatNumber(data.sales30Count)}
          hint={`${formatMoney(data.sales30Lei)} lei încasați`}
        />
      </div>

      <CurrencyWidget valueLei={data.stockValueLei} rates={data.rates} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">Stoc pe depozit</div>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {data.warehouseStock.map((w) => {
                const max = Math.max(...data.warehouseStock.map((x) => x.total_quantity), 1);
                return (
                  <tr key={w.id} className={adminRowCls}>
                    <TableCell className="font-medium">
                      {w.name}
                      <div className="mt-1.5 h-1.5 w-full max-w-56 rounded-full bg-[#f0efec]">
                        <div
                          className="h-1.5 rounded-full bg-[#2e90fa]"
                          style={{ width: `${Math.max((w.total_quantity / max) * 100, w.total_quantity > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(w.total_quantity)}</TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">
            Produse sub stocul minim
            <span className="ml-2 text-xs font-normal text-[#98948b]">prag per produs, implicit 3</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id} className={adminRowCls}>
                    <TableCell className="font-mono text-xs">{formatText(p.code)}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell align="right" className="whitespace-nowrap font-mono font-semibold">
                      {p.stock ?? 0}
                      <span className="font-normal text-[#98948b]"> / prag {p.min_stock}</span>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

