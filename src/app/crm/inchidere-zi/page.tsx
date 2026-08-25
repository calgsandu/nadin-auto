import { Suspense } from "react";
import { Download, FileText } from "lucide-react";
import { getDayCloseData, type DayCloseData } from "@/lib/reports/day-close";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";
import { COMPANY } from "@/lib/company";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatMoney, formatNumber } from "../_components/format";
import { SalesDayNav } from "../sales-day-nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dayLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function DayClosePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const appUser = await requireCrmSection("inchidere-zi");
  const { day } = await searchParams;
  const dataPromise = getDayCloseData(day);

  return (
    <>
      <CrmHeader section="inchidere-zi" role={appUser.role} />
      <Suspense key={day ?? "azi"} fallback={<WorkspaceSkeleton cards={4} rows={6} />}>
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<DayCloseData> }) {
  const data = await dataPromise;
  return <DayCloseWorkspace data={data} />;
}

function DayCloseWorkspace({ data }: { data: DayCloseData }) {
  const selectedDate = new Date(`${data.dayKey}T12:00:00`);
  const exportQuery = `from=${data.dayKey}&to=${data.dayKey}`;
  const unregisteredCash =
    data.methods.cash.lei - data.cashRegister.registered.lei;

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesDayNav dayKey={data.dayKey} basePath="/crm/inchidere-zi" />
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/sales-register?${exportQuery}&format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            <FileText className="size-4" aria-hidden="true" /> PDF
          </a>
          <a
            href={`/api/export/sales-register?${exportQuery}&format=xlsx`}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            <Download className="size-4" aria-hidden="true" /> Excel
          </a>
        </div>
      </div>

      <h2 className="font-semibold capitalize text-[#1b1a17]">
        {dayLabelFormat.format(selectedDate)}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DailyMetric
          label="Vânzări"
          value={`${formatMoney(data.salesTotal)} lei`}
          hint={`${formatNumber(data.salesCount)} documente`}
        />
        <DailyMetric
          label="Retururi"
          value={`${formatMoney(data.returnsLei)} lei`}
          hint={`${formatNumber(data.returnsCount)} documente`}
        />
        <DailyMetric
          label="Net pe zi"
          value={`${formatMoney(data.netLei)} lei`}
          hint={data.vat ? `din care TVA ${formatMoney(data.vat.tva)} lei` : undefined}
        />
        <DailyMetric
          label="Bani intrați în casă"
          value={`${formatMoney(data.cashInHand)} lei`}
          hint="numerar din vânzări + încasări pe datorii − retururi"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">
            Cum s-a plătit
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              <MethodRow label="Numerar" count={data.methods.cash.count} lei={data.methods.cash.lei} />
              <MethodRow label="Card" count={data.methods.card.count} lei={data.methods.card.lei} />
              <MethodRow
                label="Pe credit (marfă predată, bani neîncasați)"
                count={data.methods.credit.count}
                lei={data.methods.credit.lei}
                warn
              />
              <MethodRow
                label="Nespecificat"
                count={data.methods.unspecified.count}
                lei={data.methods.unspecified.lei}
                warn={data.methods.unspecified.count > 0}
              />
              <tr className="border-t-2 border-[#e8e7e3]">
                <TableCell className="font-semibold">Total vânzări</TableCell>
                <TableCell align="right" className="tabular-nums text-[#6f6b63]">
                  {formatNumber(data.salesCount)}
                </TableCell>
                <TableCell align="right" className="font-semibold tabular-nums">
                  {formatMoney(data.salesTotal)} lei
                </TableCell>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">
            Casa de marcat
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              <MethodRow
                label="Bătute"
                count={data.cashRegister.registered.count}
                lei={data.cashRegister.registered.lei}
              />
              <MethodRow
                label="Nebătute"
                count={data.cashRegister.notRegistered.count}
                lei={data.cashRegister.notRegistered.lei}
                warn={data.cashRegister.notRegistered.count > 0}
              />
              <MethodRow
                label="Nespecificat"
                count={data.cashRegister.undeclared.count}
                lei={data.cashRegister.undeclared.lei}
                warn={data.cashRegister.undeclared.count > 0}
              />
            </tbody>
          </table>
          <div
            className={`border-t border-[#efeeeb] px-4 py-3 text-sm ${
              Math.abs(unregisteredCash) < 0.01 ? "text-[#6f6b63]" : "text-[#b91c1c]"
            }`}
          >
            {Math.abs(unregisteredCash) < 0.01 ? (
              "Numerarul încasat coincide cu ce s-a bătut la casă."
            ) : (
              <>
                Diferență numerar încasat − bătut la casă:{" "}
                <span className="font-semibold tabular-nums">
                  {formatMoney(unregisteredCash)} lei
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {data.partnerPayments.length > 0 ? (
        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#e8e7e3] px-4 py-3">
            <h2 className="font-semibold text-[#1b1a17]">
              Încasări pe datorii vechi ·{" "}
              <span className="tabular-nums">{formatMoney(data.collectedFromPartners)} lei</span>
            </h2>
          </div>
          <table className="crm-table w-full min-w-[520px] border-collapse text-left text-sm">
            <tbody>
              {data.partnerPayments.map((payment) => (
                <tr key={payment.id} className="border-t border-[#efeeeb]">
                  <TableCell className="font-medium">{payment.partnerName}</TableCell>
                  <TableCell secondary className="text-[#6f6b63]">{payment.notes ?? "—"}</TableCell>
                  <TableCell align="right" className="font-semibold tabular-nums">
                    {formatMoney(payment.amountLei)} lei
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">Vânzările zilei</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Ora</TableHead>
                <TableHead>Document</TableHead>
                <TableHead secondary>Client</TableHead>
                <TableHead>Plată</TableHead>
                <TableHead secondary>Casă</TableHead>
                <TableHead align="right">Total</TableHead>
                {COMPANY.vatPayer ? <TableHead align="right" secondary>TVA</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {data.sales.length > 0 ? (
                data.sales.map((sale) => (
                  <tr key={sale.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell className="tabular-nums">{sale.time}</TableCell>
                    <TableCell className="font-semibold">Vânzare #{sale.number}</TableCell>
                    <TableCell secondary className="text-[#6f6b63]">
                      {sale.partnerName ?? "—"}
                    </TableCell>
                    <TableCell>{salePaymentMethodLabel(sale.paymentMethod)}</TableCell>
                    <TableCell secondary>
                      {sale.cashRegistered === true
                        ? "Bătută"
                        : sale.cashRegistered === false
                          ? "Nebătută"
                          : "—"}
                    </TableCell>
                    <TableCell align="right" className="font-semibold tabular-nums">
                      {formatMoney(sale.totalLei)} lei
                    </TableCell>
                    {COMPANY.vatPayer ? (
                      <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                        {formatMoney(sale.totalLei / 6)} lei
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={COMPANY.vatPayer ? 7 : 6}>
                    Nicio vânzare în ziua aleasă.
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

function MethodRow({
  label,
  count,
  lei,
  warn = false,
}: {
  label: string;
  count: number;
  lei: number;
  warn?: boolean;
}) {
  return (
    <tr className="border-t border-[#efeeeb]">
      <TableCell className={warn && count > 0 ? "text-[#b91c1c]" : ""}>{label}</TableCell>
      <TableCell align="right" className="tabular-nums text-[#6f6b63]">
        {formatNumber(count)}
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {formatMoney(lei)} lei
      </TableCell>
    </tr>
  );
}
