import { Suspense } from "react";
import { CalendarClock, TriangleAlert, Wallet } from "lucide-react";
import { getPayablesData, type PayablesData } from "@/lib/finance/payables";
import { listMoneyAccounts, type MoneyAccountOption } from "@/lib/finance/expenses";
import { PartnerPaymentDialog } from "@/app/partners/payment-dialog";
import { PartnerLedgerButton } from "@/app/partners/partner-ledger-button";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatDate, formatMoney } from "../_components/format";
import { DueDateForm } from "./due-date-form";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PayablesPage() {
  const appUser = await requireCrmSection("de-platit");
  const dataPromise = getPayablesData();
  const accountsPromise = listMoneyAccounts();

  return (
    <>
      <CrmHeader section="de-platit" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={3} rows={10} />}>
        <Loader dataPromise={dataPromise} accountsPromise={accountsPromise} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  accountsPromise,
}: {
  dataPromise: Promise<PayablesData>;
  accountsPromise: Promise<MoneyAccountOption[]>;
}) {
  const [data, accounts] = await Promise.all([dataPromise, accountsPromise]);
  return <PayablesWorkspace data={data} accounts={accounts} />;
}

function PayablesWorkspace({
  data,
  accounts,
}: {
  data: PayablesData;
  accounts: MoneyAccountOption[];
}) {
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="stat-strip grid grid-cols-3">
        <DailyMetric icon={Wallet} label="Total de plătit" value={`${formatMoney(data.totalLei)} lei`} />
        <DailyMetric
          icon={CalendarClock}
          label="Scadent în 7 zile"
          value={`${formatMoney(data.dueThisWeekLei)} lei`}
        />
        <DailyMetric
          icon={TriangleAlert}
          label="Restant"
          value={data.overdueLei > 0 ? `${formatMoney(data.overdueLei)} lei` : "—"}
          hint={data.overdueLei > 0 ? "scadența a trecut" : "nimic depășit"}
        />
      </div>

      {data.suppliers.length === 0 ? (
        <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-12 text-center text-sm text-[#52525b]">
          Nimic de plătit. Recepțiile cu furnizor și valoare apar aici până sunt achitate.
        </div>
      ) : (
        data.suppliers.map((supplier) => (
          <div
            key={supplier.partnerId}
            className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] px-4 py-3">
              <div>
                <h2 className="font-semibold text-[#18181b]">{supplier.partnerName}</h2>
                <p className="text-[13px] text-[#52525b]">
                  {formatMoney(supplier.balanceLei)} lei în {supplier.receipts.length} recepții
                  {supplier.phone ? `, ${supplier.phone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PartnerLedgerButton
                  balanceLei={supplier.balanceLei}
                  partnerId={supplier.partnerId}
                  partnerName={supplier.partnerName}
                  side="SUPPLIER"
                />
                <PartnerPaymentDialog
                  accounts={accounts}
                  balanceLei={supplier.balanceLei}
                  direction="OUT"
                  partnerId={supplier.partnerId}
                  partnerName={supplier.partnerName}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="crm-table w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
                  <tr>
                    <TableHead>Recepție</TableHead>
                    <TableHead secondary>Factura</TableHead>
                    <TableHead>Scadența</TableHead>
                    <TableHead align="right" secondary>Total</TableHead>
                    <TableHead align="right" secondary>Achitat</TableHead>
                    <TableHead align="right">Rest</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {supplier.receipts.map((receipt) => (
                    <tr
                      key={receipt.id}
                      className="motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#f4f4f5]"
                    >
                      <TableCell>
                        <span className="font-medium">#{receipt.number}</span>
                        <span className="mt-0.5 block text-[13px] text-[#52525b]">
                          {formatDate(receipt.documentDate)}
                        </span>
                      </TableCell>
                      <TableCell secondary className="text-[#52525b]">
                        {receipt.externalNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        {receipt.overdue ? (
                          <span className="mb-1 block text-[13px] font-semibold text-[#b91c1c]">
                            Restant din {formatDate(receipt.dueDate!)}
                          </span>
                        ) : null}
                        <DueDateForm
                          documentId={receipt.id}
                          dueDate={receipt.dueDate ? toDateInput(receipt.dueDate) : ""}
                        />
                      </TableCell>
                      <TableCell align="right" secondary className="tabular-nums text-[#52525b]">
                        {formatMoney(receipt.totalLei)}
                      </TableCell>
                      <TableCell align="right" secondary className="tabular-nums text-[#52525b]">
                        {receipt.paidLei > 0 ? formatMoney(receipt.paidLei) : "—"}
                      </TableCell>
                      <TableCell
                        align="right"
                        className={`font-semibold tabular-nums ${
                          receipt.overdue ? "text-[#b91c1c]" : "text-[#18181b]"
                        }`}
                      >
                        {formatMoney(receipt.remainingLei)}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/** `Date` → valoarea unui `<input type="date">`, în fusul serverului. */
function toDateInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
