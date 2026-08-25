import { Suspense } from "react";
import { getVatReportData, type VatReportData } from "@/lib/reports/vat";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatMoney, formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function VatPage() {
  const appUser = await requireCrmSection("tva");
  const dataPromise = getVatReportData();

  return (
    <>
      <CrmHeader section="tva" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={12} />}>
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<VatReportData> }) {
  const data = await dataPromise;
  return <VatWorkspace data={data} />;
}

function VatWorkspace({ data }: { data: VatReportData }) {
  if (!data.vatPayer) {
    return (
      <section className="motion-page p-4 lg:p-5">
        <div className="rounded-xl border border-[#e8e7e3] bg-white px-4 py-10 text-center text-sm text-[#6f6b63]">
          Firma este configurată ca neplătitoare de TVA
          (<code className="font-medium">COMPANY.vatPayer = false</code>), deci
          registrul nu se calculează.
        </div>
      </section>
    );
  }

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DailyMetric
          label={`Vânzări (${data.months.length} luni)`}
          value={`${formatMoney(data.totals.salesGross)} lei`}
          hint="cu TVA inclus"
        />
        <DailyMetric
          label="TVA colectată"
          value={`${formatMoney(data.totals.salesVat)} lei`}
          hint={`cota ${Math.round(data.vatRate * 100)}%`}
        />
        <DailyMetric
          label="TVA din retururi"
          value={`${formatMoney(data.totals.returnsVat)} lei`}
          hint="se scade din colectată"
        />
        <DailyMetric
          label="TVA netă"
          value={`${formatMoney(data.totals.netVat)} lei`}
          hint="colectată − retururi"
        />
      </div>

      <p className="text-sm text-[#6f6b63]">
        Prețurile sunt cu TVA inclus, deci TVA = total ÷ 6. Coloana „Facturi”
        arată cât din vânzările lunii au plecat cu cont de plată — sunt o parte
        din vânzări, nu se adună la ele.
      </p>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Luna</TableHead>
                <TableHead align="right" secondary>Vânzări</TableHead>
                <TableHead align="right">Brut</TableHead>
                <TableHead align="right" secondary>Bază (fără TVA)</TableHead>
                <TableHead align="right">TVA colectată</TableHead>
                <TableHead align="right" secondary>Retururi</TableHead>
                <TableHead align="right" secondary>TVA retururi</TableHead>
                <TableHead align="right">TVA netă</TableHead>
                <TableHead align="right" secondary>Facturi</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <tr key={month.key} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                  <TableCell className="font-semibold capitalize">{month.label}</TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {formatNumber(month.salesCount)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatMoney(month.salesGross)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {formatMoney(month.salesNet)}
                  </TableCell>
                  <TableCell align="right" className="font-semibold tabular-nums">
                    {formatMoney(month.salesVat)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {month.returnsGross > 0 ? formatMoney(month.returnsGross) : "—"}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {month.returnsVat > 0 ? `−${formatMoney(month.returnsVat)}` : "—"}
                  </TableCell>
                  <TableCell align="right" className="font-semibold tabular-nums">
                    {formatMoney(month.netVat)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {month.invoicesCount > 0
                      ? `${formatNumber(month.invoicesCount)} · ${formatMoney(month.invoicesGross)}`
                      : "—"}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
