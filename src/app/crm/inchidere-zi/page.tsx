import { Suspense } from "react";
import { Banknote, Download, FileText, Scale, Undo2 } from "lucide-react";
import { getDayCloseData, type DayCloseData } from "@/lib/reports/day-close";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";
import { COMPANY } from "@/lib/company";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { HeroPanel, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
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

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesDayNav dayKey={data.dayKey} basePath="/crm/inchidere-zi" />
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/sales-register?${exportQuery}&format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-(--c-line) bg-(--c-surface) px-3 py-2 text-sm font-semibold text-(--c-ink) hover:bg-(--c-hover)"
          >
            <FileText className="size-4" aria-hidden="true" /> PDF
          </a>
          <a
            href={`/api/export/sales-register?${exportQuery}&format=xlsx`}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-(--c-line) bg-(--c-surface) px-3 py-2 text-sm font-semibold text-(--c-ink) hover:bg-(--c-hover)"
          >
            <Download className="size-4" aria-hidden="true" /> Excel
          </a>
        </div>
      </div>

      <HeroPanel
        label={`Vânzări, ${dayLabelFormat.format(selectedDate)}`}
        value={`${formatMoney(data.salesTotal)} lei`}
        note={`${formatNumber(data.salesCount)} documente`}
        segments={[
          { label: "Numerar", value: `${formatMoney(data.methods.cash.lei)} lei`, amount: data.methods.cash.lei, tone: "green" as const },
          { label: "Card", value: `${formatMoney(data.methods.card.lei)} lei`, amount: data.methods.card.lei, tone: "blue" as const },
          { label: "Transfer", value: `${formatMoney(data.methods.transfer.lei)} lei`, amount: data.methods.transfer.lei, tone: "lilac" as const },
          { label: "Pe credit", value: `${formatMoney(data.methods.credit.lei)} lei`, amount: data.methods.credit.lei, tone: "yellow" as const },
          { label: "Nespecificat", value: `${formatMoney(data.methods.unspecified.lei)} lei`, amount: data.methods.unspecified.lei, tone: "red" as const },
        ].filter((segment) => segment.amount > 0)}
        stats={[
          { label: "Bani intrați în casă", value: `${formatMoney(data.cashInHand)} lei`, icon: Banknote, tone: "green" },
          {
            label: "Net pe zi",
            value: `${formatMoney(data.netLei)} lei`,
            hint: data.vat ? `din care TVA ${formatMoney(data.vat.tva)} lei` : undefined,
            icon: Scale,
            tone: "blue",
          },
          { label: "Retururi", value: `${formatMoney(data.returnsLei)} lei`, hint: `${formatNumber(data.returnsCount)} documente`, icon: Undo2, tone: "red" },
        ]}
      />

      <div className="grid gap-4">
        <div className="overflow-hidden crm-card">
          <div className="border-b border-(--c-line-2) px-4 py-3 font-semibold text-(--c-ink)">
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
                label="Transfer bancar (bani la încasare)"
                count={data.methods.transfer.count}
                lei={data.methods.transfer.lei}
                warn
              />
              <MethodRow
                label="Nespecificat"
                count={data.methods.unspecified.count}
                lei={data.methods.unspecified.lei}
                warn={data.methods.unspecified.count > 0}
              />
              <tr className="border-t-2 border-(--c-line)">
                <TableCell className="font-semibold">Total vânzări</TableCell>
                <TableCell align="right" className="tabular-nums text-(--c-muted)">
                  {formatNumber(data.salesCount)}
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
                  {formatMoney(data.salesTotal)} lei
                </TableCell>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {data.partnerPayments.length > 0 ? (
        <div className="overflow-hidden crm-card">
          <div className="border-b border-(--c-line) px-4 py-2.5">
            <h2 className="text-sm font-semibold text-(--c-ink)">
              Încasări pe datorii vechi{" "}
              <span className="font-normal tabular-nums text-(--c-muted)">{formatMoney(data.collectedFromPartners)} lei</span>
            </h2>
          </div>
          <table className="crm-table w-full min-w-[520px] border-collapse text-left text-sm">
            <tbody>
              {data.partnerPayments.map((payment) => (
                <tr key={payment.id} className="border-t border-(--c-line-2)">
                  <TableCell className="font-medium">{payment.partnerName}</TableCell>
                  <TableCell secondary className="text-(--c-muted)">{payment.notes ?? "—"}</TableCell>
                  <TableCell align="right" className="font-semibold tabular-nums">
                    {formatMoney(payment.amountLei)} lei
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-hidden crm-card">
        <div className="border-b border-(--c-line) px-4 py-2.5">
          <h2 className="text-sm font-semibold text-(--c-ink)">Vânzările zilei</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-(--c-line) bg-(--c-surface-2)">
              <tr>
                <TableHead>Ora</TableHead>
                <TableHead>Document</TableHead>
                <TableHead secondary>Client</TableHead>
                <TableHead>Plată</TableHead>
                <TableHead align="right">Total</TableHead>
                {COMPANY.vatPayer ? <TableHead align="right" secondary>TVA</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {data.sales.length > 0 ? (
                data.sales.map((sale) => (
                  <tr key={sale.id} className="motion-table-row border-t border-(--c-line-2) hover:bg-(--c-surface-2)">
                    <TableCell className="tabular-nums">{sale.time}</TableCell>
                    <TableCell className="font-semibold">Vânzare #{sale.number}</TableCell>
                    <TableCell secondary className="text-(--c-muted)">
                      {sale.partnerName ?? "—"}
                    </TableCell>
                    <TableCell>{salePaymentMethodLabel(sale.paymentMethod)}</TableCell>
                    <TableCell align="right" className="font-semibold tabular-nums">
                      {formatMoney(sale.totalLei)} lei
                    </TableCell>
                    {COMPANY.vatPayer ? (
                      <TableCell align="right" secondary className="tabular-nums text-(--c-muted)">
                        {formatMoney(sale.totalLei / 6)} lei
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-(--c-muted)" colSpan={COMPANY.vatPayer ? 6 : 5}>
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
    <tr className="border-t border-(--c-line-2)">
      <TableCell className={warn && count > 0 ? "text-(--c-red)" : ""}>{label}</TableCell>
      <TableCell align="right" className="tabular-nums text-(--c-muted)">
        {formatNumber(count)}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {formatMoney(lei)} lei
      </TableCell>
    </tr>
  );
}
