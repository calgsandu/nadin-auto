import { Suspense } from "react";
import { PiggyBank, ShoppingCart, TrendingUp, Undo2 } from "lucide-react";
import { DailyChart, MonthlyChart, TopProductsChart } from "@/app/stats-charts";
import { getStatsData, type StatsData } from "@/lib/stats/queries";
import { getPartnerProfitData, type PartnerProfitData } from "@/lib/reports/partner-profit";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { HeroPanel, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatDate, formatMoney, formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function StatsPage() {
  const appUser = await requireCrmSection("statistici");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getStatsData();
  const partnerProfitPromise = canModify ? getPartnerProfitData() : null;

  return (
    <>
      <CrmHeader section="statistici" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={6} />}>
        <Loader
          dataPromise={dataPromise}
          partnerProfitPromise={partnerProfitPromise}
          canModify={canModify}
        />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  partnerProfitPromise,
  canModify,
}: {
  dataPromise: Promise<StatsData>;
  partnerProfitPromise: Promise<PartnerProfitData> | null;
  canModify: boolean;
}) {
  const [data, partnerProfit] = await Promise.all([
    dataPromise,
    partnerProfitPromise ?? Promise.resolve(null),
  ]);
  return (
    <StatsWorkspace data={data} partnerProfit={partnerProfit} canModify={canModify} />
  );
}

function StatsWorkspace({
  data,
  partnerProfit,
  canModify,
}: {
  data: StatsData;
  partnerProfit: PartnerProfitData | null;
  canModify: boolean;
}) {
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <HeroPanel
        label="Venit în ultimele 30 de zile"
        value={`${formatMoney(data.last30.revenueLei)} lei`}
        note={`din ${formatNumber(data.last30.salesCount)} vânzări`}
        segments={
          canModify && data.last30.revenueLei > 0
            ? [
                { label: "Profit", value: `${formatMoney(data.last30.profitLei)} lei`, amount: data.last30.profitLei, tone: "green" },
                {
                  label: "Cost",
                  value: `${formatMoney(data.last30.revenueLei - data.last30.profitLei)} lei`,
                  amount: data.last30.revenueLei - data.last30.profitLei,
                  tone: "gray",
                },
              ]
            : []
        }
        stats={[
          { label: "Coș mediu", value: `${formatMoney(data.last30.avgSaleLei)} lei`, icon: ShoppingCart, tone: "blue" },
          { label: "Produse vândute", value: formatNumber(data.last30.quantity), icon: TrendingUp, tone: "lilac" },
          ...(canModify && data.last30.revenueLei > 0
            ? [{ label: "Marjă", value: `${Math.round((data.last30.profitLei / data.last30.revenueLei) * 100)}%`, icon: PiggyBank, tone: "green" as const }]
            : []),
          { label: "Retururi, 13 luni", value: formatNumber(data.returnsCount), hint: `${formatMoney(data.returnsLei)} lei`, icon: Undo2, tone: "red" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <DailyChart rows={data.daily} canModify={canModify} />
        <MonthlyChart rows={data.monthly} canModify={canModify} />
      </div>

      <div className="grid gap-3 2xl:grid-cols-2">
        <PeriodStatsTable title="Pe săptămâni (ultimele 8)" rows={data.weekly} canModify={canModify} />
        <PeriodStatsTable title="Pe luni (ultimele 12)" rows={data.monthly} canModify={canModify} />
      </div>

      <PeriodStatsTable title="Pe zile (ultimele 14 cu vânzări)" rows={data.daily} canModify={canModify} />

      <TopProductsChart rows={data.topProducts} />

      {partnerProfit ? <PartnerProfitTable rows={partnerProfit} /> : null}

      <div className="overflow-hidden crm-card">
        <div className="border-b border-[#e6e4df] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[#1a1917]">Top produse vândute (30 zile)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e6e4df] bg-[#faf9f7]">
              <tr>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead align="right">Venit</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length > 0 ? (
                data.topProducts.map((product) => {
                  const max = data.topProducts[0]?.quantity || 1;
                  return (
                    <tr key={product.productId} className="motion-table-row border-t border-[#eeede9]">
                      <TableCell>
                        <p className="font-medium text-[#1a1917]">{product.label}</p>
                        <div className="mt-1.5 h-1.5 w-full max-w-64 rounded-full bg-[#f0efeb]">
                          <div
                            className="h-1.5 rounded-full bg-[#2563eb]"
                            style={{ width: `${Math.max((product.quantity / max) * 100, 4)}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell align="right" className="tabular-nums font-semibold">{formatNumber(product.quantity)}</TableCell>
                      <TableCell align="right" className="tabular-nums">{formatMoney(product.revenueLei)} lei</TableCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#57534e]" colSpan={3}>
                    Nu există vânzări în ultimele 30 de zile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PeriodStatsTable({
  title,
  rows,
  canModify,
}: {
  title: string;
  rows: StatsData["daily"];
  canModify: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.revenueLei), 1);

  return (
    <div className="overflow-hidden crm-card">
      <div className="border-b border-[#e6e4df] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[#1a1917]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="crm-table w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e6e4df] bg-[#faf9f7]">
            <tr>
              <TableHead>Perioadă</TableHead>
              <TableHead align="right">Vânzări</TableHead>
              <TableHead align="right" secondary>Buc.</TableHead>
              <TableHead align="right">Venit</TableHead>
              {canModify ? <TableHead align="right" secondary>Cost</TableHead> : null}
              {canModify ? <TableHead align="right">Profit</TableHead> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="motion-table-row border-t border-[#eeede9]">
                  <TableCell className="capitalize">
                    <p className="font-semibold">{row.label}</p>
                    <div className="mt-1.5 h-1.5 w-full max-w-48 rounded-full bg-[#f0efeb]">
                      <div
                        className="h-1.5 rounded-full bg-[#2563eb]"
                        style={{ width: `${Math.max((row.revenueLei / max) * 100, row.revenueLei > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">{formatNumber(row.salesCount)}</TableCell>
                  <TableCell align="right" secondary className="tabular-nums">{formatNumber(row.quantity)}</TableCell>
                  <TableCell align="right" className="tabular-nums font-semibold">{formatMoney(row.revenueLei)} lei</TableCell>
                  {canModify ? (
                    <TableCell align="right" secondary className="tabular-nums text-[#57534e]">{formatMoney(row.costLei)} lei</TableCell>
                  ) : null}
                  {canModify ? (
                    <TableCell
                      align="right"
                      className={`tabular-nums font-semibold ${row.profitLei < 0 ? "text-[#b91c1c]" : "text-[#15803d]"}`}
                    >
                      {formatMoney(row.profitLei)} lei
                    </TableCell>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#57534e]" colSpan={canModify ? 6 : 4}>
                  Nu există date pentru această perioadă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Cine aduce banii: venit, cost și marjă pe client, pe ultimul an. */
function PartnerProfitTable({ rows }: { rows: PartnerProfitData }) {
  return (
    <div className="overflow-hidden crm-card">
      <div className="border-b border-[#e6e4df] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[#1a1917]">Profit pe client (12 luni)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="crm-table w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e6e4df] bg-[#faf9f7]">
            <tr>
              <TableHead>Client</TableHead>
              <TableHead align="right" secondary>Vânzări</TableHead>
              <TableHead align="right" secondary>Buc.</TableHead>
              <TableHead align="right">Venit</TableHead>
              <TableHead align="right" secondary>Cost</TableHead>
              <TableHead align="right">Profit</TableHead>
              <TableHead align="right" secondary>Marjă</TableHead>
              <TableHead secondary>Ultima vânzare</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.partnerId ?? "tejghea"}
                  className="motion-table-row border-t border-[#eeede9] hover:bg-[#faf9f7]"
                >
                  <TableCell className="font-medium text-[#1a1917]">{row.name}</TableCell>
                  <TableCell align="right" secondary className="tabular-nums">
                    {formatNumber(row.salesCount)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums">
                    {formatNumber(row.quantity)}
                  </TableCell>
                  <TableCell align="right" className="font-semibold tabular-nums">
                    {formatMoney(row.revenueLei)} lei
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#57534e]">
                    {formatMoney(row.costLei)} lei
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`font-semibold tabular-nums ${
                      row.profitLei < 0 ? "text-[#b91c1c]" : "text-[#15803d]"
                    }`}
                  >
                    {formatMoney(row.profitLei)} lei
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#57534e]">
                    {row.marginPercent === null ? "—" : `${Math.round(row.marginPercent)}%`}
                  </TableCell>
                  <TableCell secondary className="text-[#57534e]">
                    {row.lastSale ? formatDate(row.lastSale) : "—"}
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#57534e]" colSpan={8}>
                  Nu există vânzări în ultimele 12 luni.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
